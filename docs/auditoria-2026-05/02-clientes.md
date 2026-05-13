# Auditoria 13/05/2026 — Clientes + ClienteDetalhe

## Clientes (`/clientes` — src/pages/Clientes.tsx)

### Layout
Página listagem master com 3 seções principais: (1) **Cabeçalho** com título, badge de contagem e botão "Novo Cliente" → `/cadastro-rapido`; (2) **4 cards de stats** (Total Clientes, Mensalistas, Avulsos, Pré-pago+Preço/tipo — último card escondido se ambos count=0) com ícones coloridos por tipo; (3) **Filtros** (busca por nome/código/contador, toggles de inativos/arquivados, badge de estado/UF); (4) **Tabela de clientes** com colunas: compliance (⚠️ se contrato falta), nome/apelido/contador, CNPJ (vermelho se inválido), tipo (badge com 4 cores), valor base/mensalidade, desconto %, processos (badge em cinza/verde/amarelo), ações (edit + arquivo toggle). Duplo-clique na linha → abre modal de edição. Modal "Editar Cliente" tem 5 seções: dados básicos (nome, apelido, contador, CNPJ/código, tipo, faturamento), parâmetros financeiros (diferem por tipo: mensalista vs avulso), contatos, contratos anexados com dropzone, botões de salvar/cancelar/arquivar.

### Botões/cards clicáveis
- **+ Novo Cliente** (botão topo): navega para `/cadastro-rapido`
- **Editar (✏️)** em ações: abre modal com dados do cliente + contratos
- **Arquivar/Desarquivar** (botão ações ou modal): abre dialog de confirmação de senha, chama RPC `arquivar_cliente` (preserva histórico)
- **Clique na linha cliente**: navega para `/clientes/:id`
- **Duplo-clique na linha**: abre modal "Editar Cliente"
- **Abas filtro**: "Inativos" (clientes com 0 processos ou sem movimentação em 10 dias), "Arquivados" (mostra is_archived=true)
- **Filtro Estado/UF**: badge mostra estado selecionado, X para limpar (set searchParams = {})
- **Contrato em modal**: Preview → abre signed URL em modal, Download → cria blob+download, Excluir → dialog de senha
- **Salvar em modal**: valida CNPJ, atualiza campo `cnpj` (14 dígitos criptografados), atualiza `codigo_identificador` (6 dígitos, auto-extraído do CNPJ)

### Modais
1. **Edit Client Modal** (Dialog): contém formulário com abas visuais por tipo (mensalista vs avulso), validação CNPJ, upload dropzone para contratos (PDF/PNG/JPG, max 10MB), operações do armazenamento (S3 via Supabase), botões Arquivar/Cancelar/Salvar
2. **Contract Preview Modal** (ContractPreviewModal): exibe PDF/IMG via signed URL, permite visualização antes de download

### Achados

#### 🔴 BUG
- **Código inválido em `maskCodigo` para clientes sem CNPJ** (`src/pages/Clientes.tsx` linha 706): Clientes que não têm CNPJ (campo null/vazio) mostram "Código: —" mesmo que `codigo_identificador` tenha valor. O chamador passa `codigoDisplay` (que faz fallback a "—"), logo a máscara recebe "—" e retorna "—". Se o cliente foi criado com CNPJ retroativamente preenchido mas 0 clientes CNPJ=null no banco atual, não afeta; mas será bug ao migrar clientes sem CNPJ do Trevo antigo.

#### 🟡 UX ruim
- **Microcopy confusa em modal de arquivamento** (`src/pages/Clientes.tsx` linhas 198-199, 638-640): Comentário diz "Excluir removido daqui (era rota dupla)" mas em ClienteDetalhe linha 737 botão ainda diz "Arquivar" para deleteCliente. Labels são claros agora (audit fix #5), mas resto da base pode ter histórico léxico misto (delete vs archive vs remove).
- **Tabela tipo_processo mostra 4 valores, modal edit tipo apenas 2** (`src/pages/Clientes.tsx` linhas 398-410 vs 536-542): Tabela exibe MENSALISTA, AVULSO_4D, PRE_PAGO, PRECO_POR_TIPO com cores diferentes (UX-083). Mas modal "Editar Cliente" (SelectTrigger tipo) só oferece MENSALISTA + AVULSO_4D. PRE_PAGO e PRECO_POR_TIPO não aparecem como opção para editar cliente existente — impossível downgrade PRE_PAGO → MENSALISTA ou switch de tipo se foi criado em Clientes (não via ClienteDetalhe). Fluxo forçado é editar em ClienteDetalhe onde modal tem 3 opções (linhas 1630-1637).
- **Estatísticas de inativos calculadas inline sem cache** (`src/pages/Clientes.tsx` linhas 73-78, 306): Função `isInactive()` recalcula a cada render comparando todos processos+data; botão mostra `filter(c => !is_archived && isInactive(c.id)).length` — custoso em listagem com 50+ clientes. Sem memoização pura.

#### 🟢 POLISH
- **Badge "Tipo Cliente" em aba header vs tabela**: Em 257, grid usa `grid-cols-${...}` template string — não padronizado com Tailwind (deve ser classe estática). Funciona se Tailwind pré-processa, mas é antipadrão. Sugestão: split em 2 Cards visíveis condicionais.
- **Tooltip "Contrato não anexado" cortado em mobile**: Icon apenas, sem label (linha 371). Em tela pequena fica genérico. Sugestão: usar "aria-label" ou refatorar Tooltip para versão mobile-friendly.
- **Cor inconsistente em "Processando" vs "Concluído"**: Badges de processos usam `bg-muted/40` (parado), `bg-primary/10` (tudo feito), `bg-warning/10` (em progresso). Sem transição visual clara no mouse. `hover:bg-...` ajudaria.

#### ⚫ INÚTIL
- **Campo "Momento do Faturamento" em modal MENSALISTA não tem efeito** (`src/pages/Clientes.tsx` linhas 544-553): SelectTrigger renderiza always, mas em `handleSave()` (linhas 178-182) só salva `momento_faturamento` se tipo === 'MENSALISTA'. Problema: na linha 512 em ClienteDetalhe, momento_faturamento é setado pra null se tipo !== 'AVULSO_4D'. Logo mensalista fica com null no BD, comportamento undefined. Campo decorativo, nunca deve estar visível pra tipo MENSALISTA.
- **"Código do Cliente" campo manual (auto-extract + manual edit) totalmente redundante** (`src/pages/Clientes.tsx` linhas 522-531): Campo com máscara que só formata, mas código é auto-extraído do CNPJ na linha 508-512 (`const codigo = digits.slice(0, 6)`). Usuário digita código manualmente, mas é sobrescrito no onChange do CNPJ imediatamente. Não serve pra nada — deletar o campo.
- **Contrato preview não precisa de modal separado pra cada file** (`src/pages/Clientes.tsx` linhas 124-135, 656-662): Modal genérico ContractPreviewModal renderiza 1 arquivo por vez. Antes do estado `contracts[]` ser carregado, usuario já pode clicar "Preview" — causa fetch race condition silenciosa (erro no toast "Arquivo antigo incompatível"). Refatorar pra lazy-load signed URL no component contrato inline, não separado.

---

## ClienteDetalhe (`/clientes/:id` — src/pages/ClienteDetalhe.tsx, 2549 linhas)

### Layout (tab por tab)

#### Tab Financeiro (default: `activeTab='financeiro-config'`)
Card "Parâmetros Financeiros" com 2 seções: (1) Tipo cliente (badge) + Momento faturamento (select), exibe leitura ou modo edit; (2) Parâmetros por tipo (diferenciados visualmente em cores):
- **MENSALISTA**: Mensalidade (R$), Franquia/mês, Dia vencimento, Valor base excedente, Desc. progressivo %, com footer explicativo ("Dentro franquia: R$ 0. Excedente usa valor base...").
- **PRE_PAGO**: Card grande "Saldo Atual" (verde se >=0, vermelho se <0), Última recarga (data + valor), footer pra info ("Preço definido em Serviços Pré-Acordados...").
- **AVULSO**: Forma cobrança (radio: por processo D+X / fatura mensal dia fixo), campos condicionais (D+X ou dia vencimento mensal), Valor base, Desc. progressivo %, Valor limite/piso. Modo edit vs display (Read-only text ou Input).

Button "Editar Parâmetros" (outline) muda `editing=true`, aparece Save + Cancel.

#### Tab Serviços (`value='honorarios'`)
Component externo `ServicosPreAcordados`: tabela/listagem de negociações (service_name, fixed_price, billing_trigger, trigger_days). Permite add/edit/delete inline. Condicional: `isPrePago=true` renderiza este tab (em fila).

#### Tab Processos (`value='processos'`)
Aviso "Aguardando Deferimento para Cobrança" (se cliente `momento_faturamento='no_deferimento'` e existem processos com !(p).data_deferimento), mostra lista com razão social + etapa + valor.

Tabela de processos com colunas: checkbox, razão social (com etiquetas + ícone ✓ se pago), tipo (badge + "Avulso" / "Plano" / "Avulso R$X.XX"), etapa (texto ou "Concluído"), pagamento (PagamentoBadge), prioridade (badge urgente / Normal), data (created_at), valor (R$ ou strikethrough+verde se pago), ações (botões).

**Botões ações por linha**:
- Marcar Deferido (Check, verde): aparece se cliente no_deferimento + lançamento.etapa_financeiro='aguardando_deferimento' + !pago (FEAT-002).
- Desfazer Deferimento (Undo2, amber): aparece se no_deferimento + processo.data_deferimento != null + lançamento etapa_financeiro in ['solicitacao_criada', 'cobranca_gerada'] + !pago (FEAT-003).
- Marcar Pago (CheckCircle, success): aparece se !pago (FEAT-001).
- Settings (gear): abre ProcessoConfigEditModal.

Header: "Histórico de Processos (N) · M pagos · P pendentes", botão "Gerar Extrato (N selecionados)" (ativo se checkbox algum selecionado), botão "+ Novo Processo" → abre Dialog Novo Processo.

#### Tab Faturas (`value='faturas'`)
Card com 2 partes:

**MENSALISTA** (linha 1250-1300):
- Sub-card "Sem fatura neste mês" (amber): mostra Mensalidade/mês, Dia vencimento, botão "Gerar Fatura Mensal" (cria lancamento type='receber', automático).
- Ou nada se fatura do mês existe.

**AVULSO** (linhas 1302-1309):
- Info "Próximo Fechamento (Avulso)" — D+X dias após última solicitação (readonly).

**Aguardando Auditoria** (linhas 1311-1319):
- Component `ClienteDetalheFaturasAuditoria` renderiza lançamentos não-auditados (tipo='receber', status='pendente', !auditado, etapa_financeiro='solicitacao_criada'). Cada item: descricao, vencimento, valor (destacado), botões "Editar Valor" (toggle input), "Add Taxa" (abre ValoresAdicionaisModal), "Auditar" (marca auditado=true). Header com botão "Auditar Todos".

**Auditados — Prontos para cobrar** (linhas 1321-1344):
- Table com lançamentos auditados + pendentes. Colunas: descricao (com badge "✅ Auditado" + "✏️ Alterado" se valor_alterado_em), vencimento, status, valor. Se isMaster, coluna extra com undo button (volta pra não-auditado).

**Pagos** (linhas 1346-1382):
- Table com lançamentos type='receber' + status='pago'. Read-only listagem.

#### Tab Contratos (`value='contratos'`)
Card com lista de arquivos (contracts[]). Cada arquivo: ícone, nome (truncado), botões "Visualizar" (modal signed URL), "Nova aba" (abre arquivo direto), "Baixar", "Excluir" (confirmação senha). Dropzone pra upload (handleUpload). Se 0 contratos, texto "Nenhum contrato anexado".

#### Tab Pré-Pago (condicional: só se `isPrePago`)
Component externo `PrepagoTab`: renderiza interface pra gerenciar saldo pré-pago (recarga, histórico, debitação por processo). Se PRE_PAGO mas saldo < 0 ou 0, pode haver fluxo pra depositar.

#### Tab Observações (`value='observacoes'`)
Card textarea com botão "Editar". Modo edit: textarea grande (150px min). Modo display: texto com `whitespace-pre-wrap`. Save via updateCliente mutation.

### Modais

1. **Dialog Editar Cadastro** (linhas 1480-1778): Formulário grande (sm:max-w-4xl) com seções:
   - Nome, apelido, contador, CNPJ (com validação 14 dígitos + código auto), email, telefone, código do cliente
   - Endereço: CEP (com busca automática viaViaCEP + setando logradouro/bairro/cidade/estado), estado (select), cidade, logradouro, número, complemento, bairro
   - Contato para Cobrança: nome contato financeiro, telefone financeiro (WhatsApp) — esclarecimento "Se diferente do contador"
   - Modalidade: select (MENSALISTA / AVULSO_4D / PRE_PAGO)
   - Financial fields (condicional por tipo): campos diferentes por tipo; mensalista = mensalidade + franquia + vencimento + valor base excedente + desconto excedente; avulso = faturamento + forma cobrança (radio) + D+X ou dia mensal + valor base + desconto + limite; pré-pago = saldo atual + valor por processo
   - Honorários inline: `HonorariosInlineRepeater` repeater pra add/edit/remove serviços negociados
   - Footer: Cancelar + Salvar (disabled durante saving)

2. **Dialog Novo Processo** (linhas 1881-2167): Formulário (sm:max-w-xl) com campos:
   - Razão Social *
   - Tipo de Serviço * (select com tipos padrão TIPO_PROCESSO_LABELS + seção "Serviços Negociados" mostrando negotiations com preço fixo)
   - Prioridade (select: normal / urgente +50%)
   - Responsável (select colaboradores ativo; opcional)
   - Mudança UF (checkbox, aparece se tipo in [alteracao, transformacao]): label "2 slots", desc "Será tratado como 2 processos"
   - **Precificação** (radio group: Automático vs Valor Manual):
     - Automático: exibe `descontoPreview` box com Slot nº, valor, desconto (ou MÉTODO TREVO +50% se urgente)
     - Manual: inputs Valor (R$), Motivo (ex: cortesia)
   - **Boas-vindas** (se isFirstProcessNovo): card verde com toggle + input percentual
   - Dentro do Plano (só se isMensalista): radio "Sim" (default) / "Não" → condição "Honorário avulso" inputs (valor avulso, justificativa)
   - Já Pago (switch)
   - Data de Entrada (input type=date, default hoje)
   - Observações (textarea)
   - Footer: Cancelar + Criar Processo

3. **AlertDialog Boas-vindas** (linhas 1795-1878): Aparece antes de abrir formulário Novo Processo se `showBoasVindasAlert=true` (disparado por `handleNovoProcesso()` se isFirstProcessNovo). Título "🎉 Primeiro processo!", descrição, button "Sim, aplicar desconto" → toggle `aplicarBoasVindas`, mostra input percentual + preview de valor. Buttons: "Pular desconto, seguir", "Confirmar X%".

4. **Dialog Gerar Relatório** (linhas 2198-2267): Checkbox list de processos (com "Selecionar Todos" / "Limpar"), cada item mostra razão social + tipo + etapa + valor. Footer: Cancelar + "Gerar Relatório (N)" → chama `gerarRelatorioStatusPDF()`, download PDF.

5. **Dialog Baixar resumo (.txt)** (linhas 2270-2341): Checkbox list de lançamentos pendentes (procura by descricao + venc). Info "Gera arquivo .txt local — não envia cobrança". Footer: Cancelar + "Baixar .txt (N)" → cria blob com lista formatada (COBRANÇA - nome, código, ITENS com vencimento/valor, TOTAL), click a.download.

6. **Dialog Edit Proceso** (ProcessoEditModal, linha 2344): Modal externo pra editar processo (etapa, razao_social, etc.). Disparado por duplo-clique na tabela processos.

7. **Dialog Edit Processo CONFIG** (ProcessoConfigEditModal, linha 2351): Modal externo pra configurações (prioridade, responsavel, etc.). Disparado por botão Settings (gear).

8. **Dialog Marcar Pago** (MarcarPagoProcessoModal, linha 2358): Modal externo pra confirmar marcação como pago (FEAT-001). Chama `loadAll(silent=true)` ao sucesso.

9. **Dialog Marcar Deferido** (MarcarDeferidoProcessoModal, linha 2366): Modal externo pra confirmar marcação como deferido (FEAT-002). Chama `loadAll(silent=true)` ao sucesso.

10. **AlertDialog Mark Faturado** (linhas 2377-2423): Aparece após gerar extrato — "Deseja marcar N processo(s) como Faturado?" Buttons: "Não, manter" / "Marcar como Faturado" → update lancamentos etapa_financeiro='cobranca_gerada'. Usa `pendingFaturadoProcs` (não selectedProcessosTab) pra cobrir 3 fluxos (aba processos, deferimento alert com deferidos, deferimento alert com todos).

11. **AlertDialog Deferimento Alert** (linhas 2425-2476): Aparece se cliente `momento_faturamento='no_deferimento'` e há processos selecionados NÃO em etapa ['registro', 'finalizados']. Aviso "Cliente com Faturamento no Deferimento", lista processos NÃO deferidos. Buttons: "Cancelar", "Gerar Apenas Deferidos" (filtra p com data_deferimento != null), "Gerar Todos Mesmo Assim".

12. **PasswordConfirmDialog Archive** (linhas 2170-2183): Confirma senha pra arquivar/desarquivar cliente. Se isArchived → "Desarquivar", else → "Arquivar".

13. **PasswordConfirmDialog Delete (= Archive conforme audit fix #5)** (linhas 2186-2195): Confirma senha pra "Arquivar cliente e N processo(s)", esclarece "histórico financeiro preservado, pode desarquivar".

### Achados

#### 🔴 BUG
- **Race condition em `loadAll(silent=true)` × SelectTrigger aba ativa** (`src/pages/ClienteDetalhe.tsx` linhas 382-393, 771): `loadAll()` faz 3 queries paralelas (clientes, processos, lancamentos). Se `silent=true`, não seta `loading=true`, logo Skeleton não remonta árvore. Problema: se há `activeTab` controlado (linha 771 `value={activeTab}`), e loading não remonta, mas um child component dentro dessa tab (ex ProcessoEditModal) fecha durante o refresh silencioso, o state do parent pode não sincronizar — modal fica "open=false" mas o child listener (ex de etiquetas) continua firando mutações que atualizam state desincronizado. Resultado: close modal, refresh silent, re-open modal shows velhos dados até próximo focus. Solução: usar `queryClient.invalidateQueries()` em vez de refetch manual pra trusted state.
- **DECISION-001 Fase 3 quebra cálculo de "Aguardando Deferimento"** (`src/pages/ClienteDetalhe.tsx` linhas 663-669): Filtro `aguardandoDeferimento` busca processos onde `!(p).data_deferimento && !isProcessoFinalizado(p.etapa) && !billedProcessIds.has(p.id)`. Função `getEtapaSimplificada()` agora retorna só "Ativo"/"Finalizado" (binário, linha 32 imports), logo `isProcessoFinalizado()` faz check simples em 'finalizados' string. Pero antes os dados salvos têm etapas antigas como 'registro', 'solicitacao_criada', etc. Lógica: se etapa === 'finalizados' (novo) → isProcessoFinalizado=true, senão false. Portanto processo em 'registro' (etapa antes de Fase 3) → !isProcessoFinalizado('registro')=true (pois 'registro' != 'finalizados') → entra no aguardandoDeferimento. Mas semanticamente antes 'registro' = "deferido". Bug: campo `data_deferimento` NÃO foi poblado na migração — todos processos antigos têm null. Logo vão aparecer em aguardandoDeferimento mesmo que historicamente FORAM deferidos. Sugestão: migration script que popula data_deferimento = updated_at se etapa in ['registro', 'finalizados'] e data_deferimento is null.
- **Botão "Marcar Pago" sem verificar lancamento.confirmado_recebimento** (`src/pages/ClienteDetalhe.tsx` linhas 1194-1207): Botão aparece se !pago. MarcarPagoProcessoModal provavelmente só seta status='pago' sem marcar `confirmado_recebimento=true`. Efeito: paidProcessIds.has(p.id) (linhas 601-609) checa `l.status='pago' && l.confirmado_recebimento && l.processo_id` — se confirmado_recebimento fica false, processo não entra no set, logo botão "Marcar Pago" aparece infinitamente.
- **Excel.typo: "Processando" condicional mal fechado pra AVULSO no EditCadastro** (`src/pages/ClienteDetalhe.tsx` linhas 1672-1690): Forma cobrança radio para AVULSO — se selecionado 'por_processo', exibe "D+ dias" input. Se 'fatura_mensal', exibe "dia de vencimento" input. Lógica OK. Pero se usuario troca de AVULSO → MENSALISTA, a forma cobranca fica stale (ainda 'por_processo'), e ao salvar, `dia_cobranca` é passado pro setado payload.dia_cobranca. Check linha 514: `dia_cobranca: isAvulso && isFormaProcesso ? ... : null` — isAvulso só é true se editCadastroForm.tipo==='AVULSO_4D', logo OK. Não é bug.

#### 🟡 UX ruim
- **"Pré-Pago" tab só aparece condicionalmente mas sem aviso visual** (`src/pages/ClienteDetalhe.tsx` linhas 783, 1435-1439): Se cliente isPrePago=true, tab "Pré-Pago" renderiza (linha 783). Se false, não aparece. Sem aviso "Este cliente não é pré-pago" — usuário que esperava a aba fica confuso. Sugestão: sempre renderizar tab, com placeholder "Apenas clientes pré-pagos". Ou add commented tab ("Pré-Pago [desabilitado para Avulso]") pra clareza.
- **"Gerar Fatura Mensal" apenas se zero faturas no mês atual — pode cair em raia fina** (`src/pages/ClienteDetalhe.tsx` linhas 1250-1300): Check `lancamentos.some(l => venc >= inicioMes && venc <= fimMes && l.tipo='receber')`. Se usuário gera fatura dia 1º, depois quer gerar OUTRA dia 10, botão desaparece. Sem feedback "Fatura já gerada em MM/2026". Sugestão: add info badge "✅ Fatura gerada em DD/MM".
- **Tab Honorarios (Serviços) não tem indicador visual se vazio** (`src/pages/ClienteDetalhe.tsx` linha 969): `ServicosPreAcordados clienteId={...}` renderiza component externo. Sem preload state — se cliente tem 0 serviços, aparece só botão "+ Novo"? Sem aviso "Nenhum serviço negociado". Reduz discoverability.
- **Modal "Novo Processo" mostra combo "Tipo de Serviço" com negotiations APENAS se agreements carregados** (`src/pages/ClienteDetalhe.tsx` linhas 1934-1943): Se `negotiations=undefined/loading`, seção "Serviços Negociados" não aparece. Sem skeleton/loading state no select. Se usuario troca aba enquanto negotiations carregam, volta pra aba Processos, re-abre modal: agreements agora aparecem mas ele já selecionou tipo='abertura'. Fluxo confuso.
- **Desconto "Boas-vindas" na tab Novo Processo mostra 2 UIs (AlertDialog + card inline)** (`src/pages/ClienteDetalhe.tsx` linhas 1795-1878 vs 2036-2075): Antes de abrir formulário, AlertDialog pergunta "Sim, aplicar?". Se sim, abre form com card verde + toggle switch. Redundante. Fluxo melhor: excluir AlertDialog, mostrar card verde com toggle já ativo no form.
- **Campo "Dentro do Plano" assume boolean true/false, mas desconto_boas_vindas também booleano** (`src/pages/ClienteDetalhe.tsx` linhas 2093-2114 vs 148-150): `dentro_do_plano` é boolean (true=franquia, false=avulso). Separate de `boas_vindas` (boolean). Se usuario marca "Não" (dentro_do_plano=false) + marca "Sim, desconto boas-vindas", como renderiza? Valor avulso vs boas-vindas desconto — unclear semântica. Sugestão: boas-vindas só aparece se dentro_do_plano=true (ou sempre, mas com aviso "Desconto se aplicado para honorário dentro da franquia").
- **Etiquetas (tags) em processo na tabela aparecem compactas, sem pista pra "add tag" no double-click** (`src/pages/ClienteDetalhe.tsx` linhas 1104-1105): Mostra `<EtiquetasDisplay ... size="compact" />` + `<EtiquetasEdit ... triggerVariant="icon" />`. Se icon é '+ tag', fica apertado. Se escondido, user nunca descobre que pode editar tags inline. Sugestão: tooltip "Clique para adicionar/editar tags".

#### 🟢 POLISH
- **Grid layout "sm:grid-cols-6" vs "sm:grid-cols-7" para tabs** (`src/pages/ClienteDetalhe.tsx` linha 772): Uses `cn()` com condicional. Sem fallback pra muito-pequeno (xs). Em mobile <640px, layout quebra (tabs não ficam em linha). CSS media query adicional ou usar `grid-cols-auto` pra wrap.
- **Cor do texto em badge "Fatura no Deferimento"** (linhas 688-692): `Badge className="... text-warning"` em warning/30 border. Pode ficar claro demais (warning com low alpha). Sugestão: aumentar contrast ou usar `text-orange-700` + `border-orange-500`.
- **Placeholder vazio em "Data de Entrada"** (`src/pages/ClienteDetalhe.tsx` linhas 2137-2147): `<Input type="date" value={processoForm.data_entrada} .../>` sem visual help. Em mobile, picker fica unclear. Sugestão: usar pattern "DD/MM/YYYY" em label ou add calendar icon.

#### ⚫ INÚTIL
- **Tab "Observações" redundante com EditCadastro** (`src/pages/ClienteDetalhe.tsx` linhas 1442-1476): Campo textarea separado na aba Observações. Pero campo `observacoes` também existe no ClienteDetalhe, editável ali. Redundância: mesmo campo em 2 lugares. Usuario edita obs lá, abre aba obs — vê campo vazio pq refreshed. UX confusão. Solução: deletar aba Observações, mover campo pra EditCadastro dialog (mais perto de outros dados cadastrais).
- **PrepagoTab (aba Pré-Pago) condicionado mas sem suporte real no banco de dados** (`src/pages/ClienteDetalhe.tsx` linhas 783, 1435-1439): Tab renderiza se `isPrePago && <TabsContent value="prepago"><PrepagoTab .../></TabsContent>`. Pero banco TEM 0 clientes PRE_PAGO (apenas 2 mensalistas + 48 avulsos, conforme contexto). Logo PrepagoTab component nunca foi testado em produção. É código morto candidate para deletar ou refatorar pra feature flag se será usado futuramente.
- **`isMensalista` variável local não é derivada, duplica logic** (`src/pages/ClienteDetalhe.tsx` linha 646): `const isMensalista = cliente.tipo === 'MENSALISTA'`. Depois usa 20+ vezes no render. Sem memoização. Deve ser OK pra performance, pero could simplify com `cliente.tipo.startsWith('MENSALISTA')` ou usar tipo como enum.
- **"Gerar Relatório" dialog ñ filtra por data, período, ou tipo — lista TODOS processos indiscriminately** (`src/pages/ClienteDetalhe.tsx` linhas 2198-2267): Checkbox list mostra todos `processos` sem agrupação/filtro. Se cliente tem 500+ processos, listagem fica enorme. Sem UI pra "últimos 30 dias" / "por tipo" / "pagos/pendentes". Sugestão: add filtros no dialog.
- **"Baixar resumo .txt" botão label UX-011 fix, pero SEGUNDO botão "Gerar Cobrança" ainda existe** (`src/pages/ClienteDetalhe.tsx` linhas 722-724): Comment na linha 718-720 diz "UX-011 (11/05/2026): renomeado de 'Gerar Cobrança'". Botão agora diz "Baixar resumo (.txt)" — OK. Pero no modal (linha 2273) título diz "Baixar resumo (.txt)" e descricao clarifica "não envia cobrança". Redundante — botão label + modal label diz mesma coisa. Simplificar: ou botão "(txt)" no header, ou modal. Não ambos.
- **Button "Auditar Todos" em faturasAuditoria condicional renderizado sempre (quando há non-audited) pero semvisual feedback de loading** (`src/pages/ClienteDetalhe.tsx` linhas 2513-2521): Disabled durante mutate, but sem spinner. User pode pensar nada aconteceu. Sugestão: add loading spinner ou "Auditando..." label.
- **`processosOrdenados` memoized based em `processos` + `paidProcessIds`, pero paidProcessIds gerado a cada render** (`src/pages/ClienteDetalhe.tsx` linhas 601-622): `paidProcessIds` useMemo garante stable reference, mas `processosOrdenados` useMemo depende dele. OK pra performance, pero redundância se `processos` não mudou — sort stabili
ty pode flutuar. Refactor: combine em 1 useMemo.
- **`descontoPreview` useMemo nunca é usado se `processoForm.dentro_do_plano=false`** (linhas 211-270): Preview sempre calcula even if mensalista=false (então dentro_do_plano relevante). Se usuario marca "Não, avulso" no form, descontoPreview still computed. Wasted. Sugestão: add condition `&& processoForm.dentro_do_plano` pra skip computation.

---

## Resumo

**Bugs**: 4 (código CNPJ null, etapa migração data_deferimento, confirmado_recebimento sync, raia fina fatura mensal)
**UX ruim**: 9 (tipo modal duplo, inativos cache, mensalista faturamento campo dead, pré-pago aba silenciosa, novo processo boas-vindas 2x UI, dentro_do_plano + desconto unclear, gerar relatório sem filtro, botão label redundante modal, tab observações duplicado)
**Polish**: 4 (grid tailwind, badge contrast, data placeholder, span layout)
**Inútil/morto**: 7 (momento_faturamento MENSALISTA field, código_identificador manual edit, PrepagoTab 0 users, isMensalista duplication, relatório sem filtro date, auditar todos loading feedback, descontoPreview wasted compute)

**Foco Thales (⚫ inútil principal)**:
1. **Tab Observações** — deletar, mover pra EditCadastro
2. **PrepagoTab** — código morto sem clientes, remover ou feature-flag
3. **"Momento Faturamento" em MENSALISTA** — campo fake, não salva, delete
4. **Código Cliente manual edit** — redundante com auto-extract CNPJ, delete
5. **Gerar Relatório sem filtro** — agregar por data/tipo, ou limitar últimos 30 processos
6. **Boas-vindas 2x UI** — unificar AlertDialog + card inline em 1 fluxo

Arquivo salvo em: `/Users/thalesburger/Desktop/Trevo-ERP-ATIVO/trevo-sparkle-share/docs/auditoria-2026-05/02-clientes.md`
