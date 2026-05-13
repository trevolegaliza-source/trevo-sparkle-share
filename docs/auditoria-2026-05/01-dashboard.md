# Auditoria 13/05/2026 — Dashboard + drill-ins

Escopo: 3 telas do painel master (Thales).
Data: 13/05/2026
Foco: layout, navegação, redundância, code smell, UX confusa e **widgets inúteis**.

---

## Dashboard (`/`)

### Layout

- **Header** com saudação + data + botão "Relatório Mensal" (só master financeiro)
- **Seção 1 (KPIs)**: 4 cards glass — Receita, A Receber, Recebido, Processos Ativos
- **Seção 2 (Ações Urgentes)**: título + input dias-alerta + grid de alertas dinâmica (ou "Tudo em dia!")
- **Seção 3 (removida)**: pipeline gráfico eliminado em DECISION-001
- **Seção 4 (Gráfico)**: bar chart 6 meses (recebido/pendente/vencido) — só master financeiro
- **Seção 5 (Dupla)**: Top 5 Clientes + Próximos Vencimentos — só master financeiro

### Botões/Cards clicáveis

- **KPI "Receita do mês"** → `/financeiro` (default aba)
- **KPI "A Receber"** → `/financeiro` (default aba)
- **KPI "Recebido"** → `/financeiro` (state: tab=historico)
- **KPI "Processos Ativos"** → `/processos-ativos`
- **"Relatório Mensal"** botão → gera PDF mensal (permissão financeiro)
- **Alertas** (grid) → navegam conforme tipo (financeiro, contas-pagar, processos, clientes, auditoria)
- **Top Clientes** (cada linha) → `/clientes/{id}`
- **Próximos Vencimentos** (cada linha) → `/clientes/{id}` se tem cliente_id

### Achados

🔴 **BUG — Acesso fragmentado às abas de Financeiro** (linhas 34–37, 153, 159, 169, 175, 489–490)
O Dashboard usa `tabState` (state.tab) para algumas abas, mas a rota `/financeiro` não está mapeada como receiver de state — verificar se Financeiro.tsx realmente consome `location.state.tab`. Comentário no código admite padronização recente (UX-018), mas sem testes de integração fica frágil. Risco: usuário clica alerta e cai na aba errada.

🔴 **BUG — Cálculo de Próximos Vencimentos sem limite temporal** (linhas 287–291)
Seção "Próximos Vencimentos" exibe lancamentos sem filtro de data — pega todos com `data_vencimento`. Se houver 50 vencimentos, carrega todos. Sem paginação, scroll infinito ou limite (ex: próximos 10 dias), a performance degrada e UX fica ruim. Comportamento esperado: filtrar próximos 7–14 dias.

🔴 **BUG — Race condition: mensalistaAlerts sem dependency correta** (linhas 91–121)
useEffect do `checkMensalistas` roda quando `data` muda (linha 121), mas `data` vem de `useDashboardData` que inclui lancamentos do mês. Se um lançamento for criado/deletado fora desta página, o efeito dispara mas pode desincronizar com `calc` (linha 293 usa `mensalistaAlerts`). Adicionar `mensalistaAlerts` à dependency array do useMemo (linha 293) é temporário — refatorar para fazer query única no hook.

🟡 **UX ruim — "Sem alertas no seu escopo" vs "Tudo em dia!" confuso** (linhas 456–465)
Mensagem dinâmica tenta ser honesta (UX-026) mas texto é críptico pro operacional. "Seu escopo" é jargão técnico. Sugestão: "Sem ações urgentes em seus módulos" ou simplificar pra "Tudo certo por enquanto!" em ambos casos.

🟡 **UX ruim — Input "dias alerta pagar" frágil** (linhas 431–443)
Campo numérico acima dos alertas de contas a pagar, mas visual isolado — usuário não faz conexão que é configuração local (localStorage). Após reload, valor reseta se localStorage corromper. Sugestão: mover pra modal/popover com label "Quando avisar sobre contas?" e salvar via mutation (não localStorage).

🟡 **UX ruim — KPI "A Receber" genérico demais** (linhas 384–395)
Label "A receber" é ambíguo: inclui tudo que não está marcado pago, inclusive valores que falharam em receber (extrato não gerado). Comparar com "Recebido" (aba histórico) deixa espaço pra confusão: Recebido 50k, A Receber 30k, Total Faturado 100k = 20k sumiu? (provavelmente vencido/bloqueado). Clarificar com label "Pendente de Confirmação" (já está na descrição, linha 393) ou adicionar tooltip.

🟢 **POLISH — Variação de receita % sem contexto mês passado** (linhas 374–378)
Comparação "vs mês anterior" é útil, mas falta data/range. Exemplo: "-15% vs maio" deixa claro. Atual é vago demais, especialmente se rodar em dias 1–5 (mês antigo quase zerado = 100% de variação ilusória).

🟢 **POLISH — Animação countUp abrupta em reload** (linhas 295–298)
Números animam de 0 até valor (500ms), legal, mas se página recarrega frequente (ex: usuário em guia aberta 8h), animar toda vez fica chato. Considerar só animar mudanças (delta > 0), não renderizações.

⚫ **INÚTIL — "6 meses" do gráfico é hardcoded, sem contexto selecionável** (linhas 237–261)
Gráfico sempre mostra 6 meses anteriores, mas UI não permite mudar range. Thales nunca clica "quero ver últimos 3 meses" ou "últimos 12 meses". Se incluir período em query/state, tira proveito; senão, é display cosmético que ocupa muito espaço (300px height) pra "info que não mudo nunca". Candidato: remover ou oferecer botões de range (trimestral/anual).

⚫ **INÚTIL — "Top 5 Clientes do mês" redundante com Próximos Vencimentos** (linhas 562–598)
Seção mostra top 5 (critério: maior valor faturado no mês). Mas:
  - Clientes com vencimento próximo já aparecem na segunda coluna.
  - Status "sem extrato / pendente / vencido" duplica lógica que já está nos alertas (acima).
  - Thales raramente usa pra tomar ação — é observacional puro.
  - Só visível se `podeVer('financeiro')`, então já é modo especialista.
  Candidato: deletar ou mover pra página /financeiro com mais contexto (lucro, taxa conversão, etc.). Aqui, ocupa espaço sem ROI.

⚫ **INÚTIL — "Próximos Vencimentos" sem ação pré-definida** (linhas 601–637)
Clicando em linha navega pra `/clientes/{id}`, mas abre ficha geral, não aba "Faturas". Usuário vê "Vencimento 10/05, faltam 2 dias" e quer lançar cobrança rapidinho — em vez disso, cai em cliente detail que tem 5 abas. UX-061 diz "navega pra aba Faturas" mas código (linha 617) só navega ao cliente. Ou implementar direito (pass tab no state) ou remover do dashboard (cobrança é job do Financeiro > Emissão tab).

⚫ **INÚTIL — "Mensalistas sem fatura no mês" alerta amarelo em dia normal** (linhas 223–235)
Alerta cria entrada pra cada mensalista sem fatura no mês (ex: "Mensalista Empresa XYZ sem fatura — R$ 500/mês, dia 10"). Mas:
  - Fatura será gerada no dia configured (dia_vencimento_mensal).
  - Se rodar em dia 5 de um mês sem ciclo iniciado, alerta falso.
  - Duplica aviso que apareceria naturalmente no Clientes > detalhes do cliente.
  - Thales não age sobre isso (gera automático), só "clutter".
  Sugestão: remover ou mover pra "apenas se passou dia de vencimento e ainda nada".

⚫ **INÚTIL — "Processos parados (7+ dias)" alerta info genérico** (linhas 198–199)
Alerta diz "N processos parados > 7 dias, sem movimentação". Mas:
  - Não lista quais (user clica, vai pra `/processos-ativos` genérica).
  - Thales não sabe se é normal (cliente esperando doc, é isso) ou real parada.
  - Visão ProcessosAtivos já mostra tudo — alerta aqui é pré-aviso redundante.
  Considerar: só exibir se > 5 processos parados (threshold relevante) ou integrar com SLA do ProcessosDetalhe (que já mostra "urgentes").

⚫ **INÚTIL — Relatório Mensal em PDF (botão header)** (linhas 342–359)
Botão gera PDF de relatório — funcionalidade boa. Mas:
  - Localização (canto header) é aleatória, não claro pra usuário novo.
  - Só visível se `podeVer('financeiro')`.
  - Função `gerarRelatorioMensal()` é opaca — sem saber resultado.
  - Thales talvez use uma vez por mês, não diário.
  - Seria melhor em `/financeiro` > aba "Relatórios" dedicada.
  Sugestão: mover pra menu ou tela especialista; remover de dashboard pra desclutterar.

---

## ProcessosAtivosDetalhe (`/processos-ativos`)

### Layout

- **Header** com botão voltar + título + subtítulo
- **Card 1**: "SLAs em Risco" — lista de processos urgentes (color: destructive/red)
- **Card 2**: "Processos Recentes" — lista geral

### Botões/Cards clicáveis

- **Botão Voltar** → `/`
- **Cada processo (linhas urgentes e recentes)** → nenhuma ação (display puro, sem click)

### Achados

🟡 **UX ruim — "SLAs em Risco" sem critério explícito** (linhas 28–66)
Card mostra `urgentes.length`, mas código fonte (`useProcessos.ts` ou `useDashboardStats`) não está visível aqui. UI não explica "risco = atraso de quanto tempo?". Sugestão: adicionar subtítulo "Processos com >7 dias sem movimentação" ou link pra docs.

🟡 **UX ruim — Responsável e Valor cramped em linha única** (linhas 48–59)
Info importante (responsável, valor) aparece alinhada à direita, texto pequeno (xs). Se nome responsável é longo, empurra valor pra fora. Melhor: quebra em 2 linhas ou card único com grid. Ex: linha 1 "Razão Social | Cliente", linha 2 "Responsável: X | Valor: R$ Y | Tipo: Z".

🟡 **UX ruim — "Nenhum processo encontrado" genérico (linhas 79–80)
Mensagem não diferencia: "API tá lenta", "realmente nenhum", "permissão negada". Sugestão: "Parabéns! Todos os processos estão em dia" (se vazio com urgentes também vazio) ou "Carregando..." com Skeleton enquanto `isLoading`.

⚫ **INÚTIL — "Processos Recentes" sem ação** (linhas 68–106)
Segunda seção lista "todos os recentes" (provavelmente últimos N dias), mas:
  - Clique em linha não leva a nada (display puro).
  - Redundante com dashboard > "Processos ativos: N, X novos esta semana" (já mostra número).
  - Se Thales quer ver detalhe, vai ao Kanban `/processos` (não linked aqui).
  - Seção ocupa espaço, preenche tela com dados que não são actionable.
  Refatorar: ou tornar clicável (link pra processo detail, ex `/processos/{id}`) ou remover e colocar badge "últimos 5" no SLAs.

⚫ **INÚTIL — Badge "Tipo" redundante em ambas seções** (linhas 50, 92)
Cada processo tem label do tipo (ex: "ABERTURA", "REFORMA"). Aparecem em SLAs E em Recentes. Sem filtro por tipo, é só cosmético. Se Thales quiser filtar por tipo, não tem UI — então badge é inútil. Remover ou adicionar select de filtro.

---

## FaturamentoDetalhe (`/faturamento`)

### Layout

- **Header** com botão voltar + título + subtítulo
- **KPIs**: 3 cards (Receita Prevista, Pendente, Recebido)
- **Card Atrasados** (condicional, só se > 0): lista de lançamentos vencidos
- **Card Pendências do Mês**: lista de lançamentos pendentes

### Botões/Cards clicáveis

- **Botão Voltar** → `/`
- **Cada lançamento** → nenhuma ação (display puro, sem click)

### Achados

🔴 **BUG — "Receita Prevista" desincronizada do Dashboard** (linhas 28–29)
Dashboard exibe "Receita do mês" (lancamentos faturados), drill-in mostra "Receita Prevista" (from `dashData.receitaPrevistaMes`). Sem ver hook, assume: um é realizado, outro é previsão (planejado). Diferença pode ser grande. Sem clareza, Thales fica confuso qual figura confiar. Renomear campo ou adicionar label clara "Previsto (calculado)" vs "Realizado (faturado)".

🟡 **UX ruim — KPI "Pendente" valor cai se mudar data atual** (linhas 21, 25)
Cálculo de `thisMonthLancamentos` usa `new Date()` todo render. Se executar perto de midnight (transição de mês), números podem pular. Adicionar comment ou usar data fixa (from server). Risco baixo mas UX-jarring.

🟡 **UX ruim — "Atrasados" card só aparece se count > 0** (linhas 64–81)
Condicional: render só se `atrasados.length > 0`. UX boa (não clutter), mas usuário que vê "Pendências do Mês" sem ver "Atrasados" acima fica esperando lê-lo ali. Sugestão: sempre render card, com "Nenhum atrasado 🎉" se vazio.

🟡 **UX ruim — Descrição de lançamento (l.descricao) pode ser NULL** (linhas 73, 98)
Mostra em truncate (linha 98), mas sem validação se existe. Se NULL, renderiza "..." vazio. Melhor: fallback "Sem descrição" ou combinar com cliente nome.

⚫ **INÚTIL — "Receita Prevista" sem breakdown** (linhas 28–29)
KPI mostra valor único de receita prevista do mês (from `dashData`), mas:
  - Sem saber de onde vem (previsão de quê? Clientes mensalistas? Próximos vencimentos?).
  - Não clicável, não filtrável.
  - Comparar com "Pendente" (R$ 30k) não faz sentido se "Previsto" é R$ 80k (diferença de 50k nunca explicada).
  - Candidato pro lixo: remover ou levar pra `/financeiro` > aba "Previsões" com breakdown por cliente.

⚫ **INÚTIL — "Pendências do Mês" sem ação ou filtro** (linhas 84–114)
Lista todos os lançamentos pendentes do mês, mas:
  - Sem clique em linha (display puro).
  - Sem sort (data_vencimento, valor, cliente).
  - Sem filtro (ex: "apenas > R$ 1000", "apenas tipo X").
  - Sem export (CSV, PDF).
  - User vê 20 itens, quer enviar cobrança, mas vai pra `/financeiro` pra fazer (redundante).
  Refatorar: ou tornar clicável (lança modal de ação: "enviar cobrança", "desistir", "marcar pago") ou ser só leitura honesta "estes são pendentes — detalhes em /financeiro".

⚫ **INÚTIL — "Atrasados" card sem nuance** (linhas 64–81)
Lista lançamentos vencidos, mas sem diferenciar:
  - Vencido há 2 dias vs vencido há 6 meses (UI igual).
  - Tentativa de cobrança em andamento vs. sem movimento.
  - Processo de cliente "sempre atrasa" vs cliente novo que é exceção.
  Sem contexto, é só "aqui está o problema", mas sem caminho actionable. Se integrar com responsável/processo/tentativa, ganha valor.

---

## Resumo

### Contagem de Achados

- 🔴 **BUGs**: 3 (acesso fragmentado abas financeiro, próximos vencimentos sem limite, race condition mensalistas)
- 🟡 **UX ruins**: 10 (alertas confusos, input dias-alerta, KPI ambíguo, variação % vaga, countUp abrupta, SLAs sem critério, responsável cramped, recentes sem ação, KPI receita desincronizada, atrasados condicionais)
- 🟢 **Polish**: 2 (contexto mês anterior, countUp no reload)
- ⚫ **Inúteis**: 9 (gráfico 6 meses fixed, top 5 clientes redundante, próximos vencimentos sem aba alvo, mensalistas alerta falso, processos parados genérico, relatório PDF no header, processos recentes sem click, badges tipo inúteis, receita prevista sem breakdown, pendências sem ação)

### Foco Especial ⚫ INÚTIL

Thales pediu: "Me incomoda muito, e tem coisa inútil ali". Identificadas 9 seções/widgets que:
- Duplicam informação (top clientes + próximos vencimentos, processos parados + ProcessosDetalhe urgentes)
- Ocupam espaço sem ação (gráfico 6 meses, receita prevista, relatório PDF em header)
- São honestos demais sobre nada (mensal sem fatura = alerta falso, recentes = display puro)
- Roubam atenção do que importa (Financeiro, Processos urgentes, Contas a pagar)

**Recomendação**: remover ou mover pra telas especializadas:
- Top Clientes, Gráfico 6 meses → `/financeiro` próprio.
- Processos Recentes, badges tipo → `/processos-kanban`.
- Mensalista alerta → filtrar por data (só se passou vencimento).
- Relatório PDF → menu ou `/financeiro > Relatórios`.

Resultado: Dashboard mais limpo, call-to-action mais clara, menos clutter pra Thales lidar todo dia.

