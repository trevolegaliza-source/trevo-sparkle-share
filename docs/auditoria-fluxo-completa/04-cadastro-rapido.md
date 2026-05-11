# 04 — Cadastro Rápido (`/cadastro-rapido`)

> Arquivo: `src/pages/CadastroRapido.tsx` (558 linhas) + 8 componentes em `src/components/cadastro-rapido/`

## 🎯 O que é

Wizard de 4 steps pra cadastrar processo de um cliente. Tela mais usada pela secretária no dia-a-dia. Permite enfileirar múltiplos processos (mesmo cliente) e salvar tudo em lote.

**Permissão:** `modulo='processos' acao='criar'`. Master, gerente, financeiro, operacional veem.

Thales mencionou explicitamente como tela com problemas:
> "Eu clico na cadastro rápido, ele demora 1 tempo a carregar, depois ele vai aparecer 1 tela pra eu cadastrar cliente e cadastrar o processo. A forma de cadastro está coerente? Se eu marco aqui pra cadastrar 1 processo novo, na próxima etapa ele vai me perguntar se é normal, urgente, matriz, escritório regional, método trevo, Aí embaixo ele tem etiqueta de novo, de método trevo, prioridade, enfim..."

## 🗺️ Mapa de elementos

```
┌─────────────────────────────────────────────────────────┐
│ Cadastro Rápido                                          │
│ Cadastre processos com preview financeiro em tempo real │
├─────────────────────────────────────────────────────────┤
│ Wizard:   [1 Cliente] → [2 Processo] → [3 Valor] → [4 Rev]│
├──────────────────────────────────┬──────────────────────┤
│                                  │ FICHA DO CLIENTE     │
│         STEP ATUAL               │ (depois de step 1)   │
│         (formulário)             │                      │
│                                  │ PREVIEW FINANCEIRO   │
│                                  │ (a partir do step 2) │
│                                  │                      │
│                                  │ ÚLTIMOS PROCESSOS    │
│                                  │ (do cliente)         │
│                                  │                      │
│                                  │ FILA EM BATCH        │
│                                  │ (até salvar)         │
└──────────────────────────────────┴──────────────────────┘
```

## 🔬 Steps detalhados

### Step 1 — Cliente
Componente `StepCliente`. Busca/seleciona cliente OU cria novo cliente inline (`NovoClienteInline`).

**Achado UX-073 🟡 (Thales reclamou):** **lentidão de abertura.** O componente faz na inicialização:
- `useClientes()` — busca 47 clientes
- `useServiceNegotiations()` — busca negociações
- query `colaboradores_ativos_cadastro` — busca colaboradores
- query `processos_mes_count` — count por cliente selecionado (rola depois)
- `useEffect → checkFirstProcess` — checa se é primeiro processo
- Pré-fill via query params (`?cliente_codigo=...`)

Em conexão lenta ou banco com latência, soma 800ms-1.5s. Não é tela travada — é só "espera o painel direito carregar". Sugestões:
1. `staleTime: 5*60*1000` em `useClientes` (clientes não mudam toda hora)
2. Pré-carregar `colaboradores` no `AppLayout` (vive lá no contexto)
3. Loading skeletons mais expressivos (hoje fica meio em branco)

### Step 2 — Processo
Componente `StepProcesso`. Campos:
- Razão social
- Tipo (abertura, alteração, transformação, baixa, avulso) — **default 'abertura'**
- Responsável (select de colaboradores)
- Prioridade (normal / urgente)
- Mudança de UF (checkbox)
- Data de entrada
- Etiquetas
- **Via análise** (`matriz` / `regional` / `metodo_trevo`)
- Descrição (só pra avulso)

**Achado UX-067 🔴 (Thales reclamou):** redundância visual.
> "ele tem etiqueta de novo, de método trevo, prioridade..."

Vou validar lendo `StepProcesso.tsx` quando atacar. Pelo prompt do Thales, parece que **"via análise"** (`metodo_trevo`) e **etiqueta** com mesmo nome existem em paralelo — se selecionou via='metodo_trevo' não deveria precisar etiqueta separada. **Sugestão pre-release:** consolidar via análise + etiqueta `metodo_trevo` em UM controle.

**Achado UX-068 🟢:** `INITIAL_PROCESSO.tipo='abertura'` + `viaAnalise='matriz'` (linhas 23, 33) — defaults rígidos. Se o user cadastra majoritariamente "alteração regional", ele troca a cada cadastro. Lembrar último selecionado no localStorage seria 5min de fix com alto ROI.

### Step 3 — Valor
Componente `StepValor`. Campos:
- Método de preço (automatico / manual / servico_preacordado)
- Valor manual (se aplicável)
- Motivo do valor manual (se manual)
- Boas-vindas (toggle, só se isFirstProcess)
- Boas-vindas % (50% default)
- Já pago (toggle) — `ja_pago=true` cria lancamento já confirmado
- Observações

**Achado UX-075 🟢:** "Boas-vindas %" tem default 50%. Master decide. Mas o user nem sempre sabe que pode mudar — input poderia ter ícone/tooltip.

### Step 4 — Revisão
Mostra resumo + 2 botões:
- **Adicionar à fila** — enfileira pra batch, volta pro step 2 reseta form
- **Salvar** — chama `saveProcessos([buildQueueItem(), ...fila])`

**Achado UX-072 🟡:** convivência confusa.
- Botão "Salvar" salva **tudo na fila + o atual**.
- Botão "Adicionar à fila" não salva, só põe na fila.
- Em mobile, ordem dos botões varia. Cara pode clicar errado.
- Sugestão: se fila vazia, mostrar só "Salvar". Se >0, mostrar "Salvar + Continuar" (adiciona+ adicionar) e "Salvar todos (X)" (salva fila).

### Painel direito (sempre visível após step 1)

**FichaCliente:** info do cliente (CNPJ, tipo, valor base, mensalidade)
**PreviewFinanceiro:** mostra valor calculado em tempo real (com slot, desconto, etc) — ✅ útil
**UltimosProcessos:** lista dos últimos 5 processos do cliente — ✅ útil pra evitar duplicata visual
**FilaBatch:** N processos enfileirados — pode "Limpar" ou "Salvar todos"

## 🔬 Interação SAVE — `saveProcessos`

Linha 307-421. Bem feito:
- Anti-duplicata (60s mesmo cliente+razão+tipo bloqueia)
- For-loop com try/catch individual — não para no primeiro erro
- 3 caminhos pós-loop:
  - Tudo OK → feedback + reset
  - Tudo falhou → mantém fila, toast com 3 primeiros erros
  - Parcial → mantém só os que falharam, toast separado
- ✅ Lógica robusta. **Boa engenharia.**

**Achado UX-069 🟡:** após "Tudo OK" (linha 379-389), reset COMPLETO incluindo `setClienteId(null)`. Se Thales/secretária quer cadastrar 2 processos seguidos de **clientes diferentes**, OK. Se quer 2 do MESMO cliente, paga o pedágio: re-selecionar cliente. Mais comum é "vários processos do mesmo cliente" (caso ASLAN, BENJAMIN da auditoria). Fix sugerido:
- Botão `[Cadastrar mais para este cliente]` no `FeedbackSucesso` que volta pro step 2 mantendo cliente.

**Achado UX-074 🟢:** `WizardSteps.onStepClick` permite pular steps (`goToStep`). Sem validação de "step 1 completo". User pode clicar step 4 sem cliente selecionado e crashar em `selectedCliente!`. Adicionar `disabled={!completedSteps.includes(step-1)}` no WizardSteps.

## 🐛 Bugs / Inconsistências

| ID | Severidade | Problema | Fix |
|---|---|---|---|
| **UX-067** | 🔴 (Thales reclamou) | Redundância "via análise" + etiqueta `metodo_trevo` + prioridade | Consolidar em 1 controle |
| **UX-068** | 🟢 | Defaults rígidos (abertura, matriz) | Lembrar último selecionado |
| **UX-069** | 🟡 | Reset total após save (perde cliente) | Botão "Cadastrar mais pra este cliente" |
| **UX-070** | 🟢 (Thales reclamou) | Wizard pesado pra cadastro simples | Modo "express" que pula step 3 quando preço é automático |
| **UX-071** | 🟢 | Anti-duplicata 60s pode disparar falso positivo | Aumentar p/ 5min OU permitir override |
| **UX-072** | 🟡 | Botões "Salvar" vs "Adicionar à fila" confusos | Hierarquia clara, esconder/mostrar baseado em fila.length |
| **UX-073** | 🟡 (Thales reclamou) | Lentidão de abertura | `staleTime` em useClientes, pré-carregar colaboradores |
| **UX-074** | 🟢 | Wizard permite pular steps | `disabled` no step click |
| **UX-075** | 🟢 | Boas-vindas % sem tooltip | adicionar |

## 🎨 Poluição visual

🔴 **Thales reclamou explicitamente.** Step 2 mostra simultaneamente: tipo, prioridade, mudança UF, via análise, etiquetas, data de entrada, responsável, etc. **8+ campos** numa única tela.

Heurística violada: **Hick's Law** — quanto mais opções simultâneas, mais tempo pra decidir.

Sugestões:
1. **Progressive disclosure:** mostrar só "Tipo" e "Razão social" inicialmente. "Prioridade" e demais aparecem como "+ Mais opções" expandível.
2. **Eliminar redundância:** se "via análise = metodo_trevo", esconde etiqueta `metodo_trevo` (mostrar como aplicada automaticamente).
3. **Defaults sensatos:** prioridade='normal', via='matriz', mudancaUF=false são corretos 90% do tempo. Não precisam aparecer em destaque.

## 🚦 Verdict release amanhã

**🟡 ATENÇÃO — GO com 1 fix recomendado.**

Pra a secretária que vai usar essa tela o dia todo:
- **UX-073 (lentidão)** — não é bloqueio mas atrita. Se conseguir adicionar `staleTime: 5*60*1000` em `useClientes` (1 linha), reduz 50% das queries no abre/fecha.
- **UX-067 (redundância)** — Thales reclamou diretamente. Vale 1h olhando `StepProcesso.tsx` pra consolidar.
- **UX-069 (perde cliente após save)** — secretária vai cadastrar batch o dia todo. Botão "+1 processo pra este cliente" no FeedbackSucesso ajuda muito.

Atacar UX-067 + UX-069 + UX-073 antes do release dá uma elevada decente sem risco.

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **UX-067** | Redundância via análise + etiqueta + prioridade no Step 2 |
| **UX-068** | Defaults rígidos não lembram último valor |
| **UX-069** | Reset perde cliente após save (impede batch mesmo cliente) |
| **UX-070** | Wizard pesado — sem modo express |
| **UX-071** | Anti-duplicata 60s pode bloquear cadastros legítimos |
| **UX-072** | "Salvar" vs "Adicionar à fila" confusos |
| **UX-073** | Lentidão de abertura (queries em série, sem cache forte) |
| **UX-074** | Wizard permite pular steps sem validação |
| **UX-075** | Boas-vindas % sem tooltip |
