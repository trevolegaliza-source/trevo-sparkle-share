# Auditoria Clientes — 26/05/2026

Escopo:
- `src/pages/Clientes.tsx` (686 linhas)
- `src/pages/ClienteDetalhe.tsx` (2731 linhas)
- `src/hooks/useFinanceiroClientes.ts` (852 linhas)
- `src/hooks/useFinanceiro.ts` (recortes Clientes)
- `src/components/clientes/*.tsx` (7 arquivos)
- `src/components/cadastro-rapido/NovoClienteInline.tsx`
- `docs/sql/cliente-suporte-pf.sql`, `cleanup-clientes-teste-17-05.sql`, `notif-cliente-eventos.sql`, `rls-delete-libera-operacional.sql`

Metodologia: leitura linha-a-linha; cruzamento entre UI / hook / RPC / RLS; checklist do prompt (race conditions, validações, edge cases, RLS, SQLi/XSS, perf, idempotência, TS).

---

## 🔴 Bugs críticos

### CLI-001 — Fatura Mensal usa `valor_base` em vez de `mensalidade`
**Arquivo:** `src/pages/ClienteDetalhe.tsx:1331` (display) e `:1375` (INSERT real)
**Impacto:** CRÍTICO — fatura mensal de mensalista é gerada com o valor **errado**. O campo `valor_base` em cliente MENSALISTA é o "valor base do processo EXCEDENTE" (após estourar a franquia), **não** a mensalidade. Cliente que tem `mensalidade=R$1.500` e `valor_base=R$300` (excedente) tem fatura gerada com R$300/mês.
**Trecho:**
```ts
valor: Number((cliente as any).valor_base || 0),  // ❌ deveria ser mensalidade
descricao: `Fatura mensal — ${mesLabel}`,
```
**Fix:** Trocar `valor_base` por `mensalidade` em ambas as linhas. Bloquear botão se `mensalidade==null`. Considerar migrar essa lógica para RPC `gerar_fatura_mensal(cliente_id)` para garantir consistência com cálculo de excedente (que pode existir noutro lugar).

### CLI-002 — `useUpsertServiceNegotiations`: DELETE + INSERT sem transação
**Arquivo:** `src/hooks/useServiceNegotiations.ts:35-65`
**Impacto:** ALTO — race + perda de dados. Se INSERT falhar após o DELETE (rede, validação, RLS), o cliente fica **sem** nenhuma negociação. Não há rollback. Pior: o handler `handleSaveCadastro` (ClienteDetalhe.tsx:563-574) chama esse upsert mesmo quando `validRows.length === 0` (rows todas vazias por erro de digitação) — apaga todas as negociações sem warning.
**Fix:** Migrar para RPC `replace_service_negotiations(cliente_id, rows[])` em transação Postgres única. Alternativa intermediária: comparar IDs e fazer UPDATE/INSERT/DELETE seletivo no client.

### CLI-003 — `audit_pendentes_clientes` sem filtro de tenant
**Arquivo:** `src/pages/Clientes.tsx:60-75`
**Impacto:** ALTO — query depende 100% do RLS para isolamento. Se um dia o RLS de `lancamentos` for afrouxado (já houve auditoria recente sobre DELETE permissivo em 22 tabelas), o front exibirá contagens de outros tenants. Defesa-em-profundidade falhando.
**Trecho:**
```ts
.from('lancamentos')
.select('cliente_id')
.eq('auditado', false)
.eq('status', 'pendente')
.eq('tipo', 'receber') as any;
```
Não há `.eq('empresa_id', ...)`. Cast `as any` esconde do TS.
**Fix:** Adicionar `.eq('empresa_id', await getEmpresaId())` ou criar VIEW/RPC `audit_pendentes_por_cliente()` SECURITY DEFINER com filtro explícito.

### CLI-004 — Cadastro Rápido não valida unicidade de `codigo_identificador` antes de criar
**Arquivo:** `src/components/cadastro-rapido/NovoClienteInline.tsx:119-208`, `src/hooks/useFinanceiro.ts:65-81`
**Impacto:** ALTO — duplo clique no submit ou dois operadores criando simultaneamente o mesmo cliente. Não vi `await` antes do `.mutate()` (que é fire-and-forget) — o botão não fica disabled durante a mutation. Soma-se: NÃO há `.maybeSingle()` checking existing CNPJ/CPF/codigo_identificador antes. Não localizei UNIQUE constraint em SQL para `codigo_identificador` / `cnpj` / `cpf` (busca em `docs/sql/` retornou vazio).
**Fix:**
1. Trocar `.mutate` por `.mutateAsync` + `disabled={createCliente.isPending}` no botão.
2. Adicionar UNIQUE PARTIAL INDEX `(empresa_id, codigo_identificador) WHERE codigo_identificador IS NOT NULL`.
3. Idem para `(empresa_id, cnpj)` e `(empresa_id, cpf)`.
4. Tratar erro `23505` (unique violation) no `onError` mostrando "Cliente já cadastrado com este código/CNPJ".

### CLI-005 — Botão "Excluir" do header é uma armadilha (label incorreta)
**Arquivo:** `src/pages/ClienteDetalhe.tsx:766-769`
**Trecho:**
```tsx
{/* audit fix #5 — botão "Excluir" hoje arquiva (preserva histórico financeiro) */}
<Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive" onClick={() => setShowDeleteClientePassword(true)}>
  <Trash2 className="h-3.5 w-3.5" /> Arquivar
</Button>
```
Mesma ação que o botão "Arquivar" ao lado (linha 762), mas com ícone Trash2 + cor destructive. Confunde o usuário (parece destruir o cliente) e duplica feature.
**Impacto:** MÉDIO-ALTO — confusão grave, especialmente pra Letícia/secretária. Mensagem do dialog (linha 2206) diz "Arquivar X e seus N processo(s)" — texto correto, mas o botão de origem é enganador.
**Fix:** Remover botão duplicado (apenas "Arquivar"/"Desarquivar"). Se quiser manter, mudar para outro contexto (ex: "Mover para lixeira").

### CLI-006 — Validação de CNPJ assimétrica entre Clientes.tsx e ClienteDetalhe.tsx
**Arquivos:** `src/pages/Clientes.tsx:173` (usa `isValidCNPJ` com algoritmo mod-11), `src/pages/ClienteDetalhe.tsx:507` (só checa comprimento `=== 14`)
**Trechos:**
- Clientes.tsx: `if (cnpjRaw && cnpjRaw.replace(/\D/g, '').length > 0 && !isValidCNPJ(cnpjRaw)) toast.error(...)`
- ClienteDetalhe.tsx (Edit Cadastro): `if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) toast.error('Erro ao validar CNPJ: deve conter 14 dígitos.')`

ClienteDetalhe **aceita** CNPJ com dígito verificador inválido (qualquer 14 dígitos passa). Pior: o `isValidCNPJ` exibe erro inline (linha 1585), mas o salvamento (`handleSaveCadastro` linha 504-510) só checa comprimento — clicar "Salvar" salva CNPJ inválido.
**Fix:** Padronizar todas as telas para `isValidCNPJ(cnpj)` no submit. Mesmo problema potencial pra CPF — embora a tela de Editar Cadastro nem tenha campo CPF (suporte PF foi adicionado em 18/05 mas só no Cadastro Rápido).

### CLI-007 — Tela de Edição não suporta `tipo_pessoa` PF nem campo CPF
**Arquivo:** `src/pages/ClienteDetalhe.tsx:1572-1604` (Edit Cadastro form), `src/pages/Clientes.tsx:515-547`
**Impacto:** ALTO — feature `cliente-suporte-pf.sql` adicionou `tipo_pessoa` + `cpf` em 18/05, mas a UI de **edição** só conhece PJ/CNPJ. Cliente PF criado via Cadastro Rápido fica sem como editar/visualizar o CPF na edição. ClienteDetalhe.tsx mostra CPF corretamente no header (linha 700-703) mas não no Edit Cadastro.
**Fix:** Replicar RadioGroup PF/PJ + campo CPF/CNPJ condicional no Edit Cadastro (Clientes.tsx Edit Modal e ClienteDetalhe.tsx).

---

## 🟡 Melhorias / débitos médios

### CLI-008 — Falta validação de email e telefone
**Arquivos:** `Clientes.tsx:572-578`, `ClienteDetalhe.tsx:1670-1701`, `NovoClienteInline.tsx:280-285`
**Detalhe:** Nenhum dos forms valida formato de email (apesar de o Input usar `type="email"`, isso só faz parsing pelo browser e não bloqueia submit no React). Telefone aceita qualquer string (sem máscara, sem comprimento mínimo). Email mal formatado vai gerar falhas silenciosas em `notify-cliente-evento` (notificação de deferimento/cobrança), causada por `notif-cliente-eventos.sql` que usa email como destinatário.
**Fix:** Adicionar `isValidEmail()` em `src/lib/email.ts` + máscara `(11) 99999-9999` no telefone + flag no submit. Bonus: forçar `tel` input mode com `inputMode="numeric"`.

### CLI-009 — `isInactive` usa fuso UTC; cliente cadastrado nas últimas 10 noites pode virar "Inativo" às vezes
**Arquivo:** `src/pages/Clientes.tsx:84-89`
**Trecho:** `const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();`
ISO inclui hora e timezone. `p.created_at >= tenDaysAgo` faz comparação string-string que funciona porque ambos estão em UTC ISO, mas a definição de "10 dias" para um usuário em UTC-3 pode parecer arbitrária no limite do dia. Não é bug crítico, mas é UX surpreendente.
**Fix:** Comparar por data calendário do user: `startOfDay(subDays(new Date(), 10))`.

### CLI-010 — Re-renders desnecessários em `Clientes.tsx`
**Arquivo:** `src/pages/Clientes.tsx:77-89, 91-98, 230-249`
**Detalhe:** `processCount`, `activeCount`, `doneCount`, `getProcessBadgeClass`, `isInactive` são funções recriadas em todo render. Cada `<TableRow>` chama 4-5 delas; com 50+ clientes filtrados, ~250+ `filter()` por render. `useMemo` para `processosByCliente: Map<id, Processos[]>` resolveria.
**Fix:** Memoizar 1 vez:
```ts
const processosByCliente = useMemo(() => {
  const map = new Map<string, ProcessoDB[]>();
  for (const p of (processos || [])) {
    if (!map.has(p.cliente_id)) map.set(p.cliente_id, []);
    map.get(p.cliente_id)!.push(p);
  }
  return map;
}, [processos]);
```

### CLI-011 — `loadAll` faz 3 SELECT independentes (potencial N+1)
**Arquivo:** `src/pages/ClienteDetalhe.tsx:400-412`
**Detalhe:** `Promise.all` minimiza, mas ainda são 3 round-trips + posterior `loadContracts` (Storage). Para cliente com muitos processos+lançamentos, primeiro render demora ~500-800ms.
**Fix:** Criar RPC `get_cliente_completo(cliente_id)` retornando JSONB com cliente + processos + lancamentos. Ou usar `select('*, processos(*), lancamentos(*)')` (single request, embedded). 

### CLI-012 — Permissões só na lista, não na tela de detalhe
**Arquivo:** `src/pages/ClienteDetalhe.tsx:743-769`
**Detalhe:** Em `Clientes.tsx`, `canEdit`/`canArchive` escondem os botões corretamente (linha 461-474). Mas em `ClienteDetalhe.tsx`, o header (linha 743 "Editar Cadastro", 763 "Arquivar", 767 "Excluir") **NÃO** consulta `podeEditar/podeExcluir`. Operacional/visualizador vê botões, clica, e a RPC `arquivar_cliente` rejeita com mensagem genérica — UX ruim (igual à reclamação de SEC-029/PERM-012).
**Fix:** Adicionar `const canEdit = podeEditar('clientes'); const canArchive = podeExcluir('clientes');` e condicionar render dos botões. Já tem o framework `usePermissions` importado.

### CLI-013 — Contracts upload: download/preview disponível pra todos, deleção só master
**Arquivo:** `src/pages/ClienteDetalhe.tsx:1496-1535` vs `src/pages/Clientes.tsx:158-167`
**Detalhe:** Em ClienteDetalhe: download e preview de contratos é livre, delete só `permIsMaster`. Em Clientes.tsx (Edit Modal): delete usa só PasswordConfirmDialog, **sem** check de master. Inconsistência.
**Fix:** Aplicar mesma regra (master-only para delete) nos dois lugares. Se a RLS do bucket bloqueia, pelo menos esconder o botão.

### CLI-014 — `handlePreviewContract` em Clientes.tsx não trata `error` da signed URL
**Arquivo:** `src/pages/Clientes.tsx:135-146`
**Trecho:** `const { data, error } = await ...createSignedUrl(...)` — só verifica `data?.signedUrl`. Se `error` for `RLS error` ou rede falhar, o user vê "Erro: Arquivo antigo incompatível", mensagem que **mente** sobre a causa real.
**Fix:** Logar `error.message` e mostrar mensagem real. Mesma observação para `handleDownloadContract` (linha 152).

### CLI-015 — `lancamentos.find(l => l.processo_id === p.id)` repetido em loop
**Arquivo:** `src/pages/ClienteDetalhe.tsx:1125, 1181, 1195, 2409`
**Detalhe:** Cada `<TableRow>` chama `lancamentos.find(...)` 2-3 vezes. Para 100 processos + 100 lançamentos = 200-300 lookups O(n) por render = 20000-30000 ops. Vira lag visível ao rolar a tabela.
**Fix:** Memoizar `lancamentosByProcesso: Map<processo_id, Lancamento>`:
```ts
const lancamentoByProcessoId = useMemo(() => {
  const m = new Map<string, Lancamento>();
  for (const l of lancamentos) if (l.processo_id && l.tipo === 'receber') m.set(l.processo_id, l);
  return m;
}, [lancamentos]);
```

### CLI-016 — `useUpsertServiceNegotiations` salva sempre `is_custom: true`
**Arquivo:** `src/hooks/useServiceNegotiations.ts:53`
**Detalhe:** Hardcoded `is_custom: true` ignora o valor recebido em `n.is_custom`. Se o tipo `ServiceNegotiationInsert` previa ambos, há perda silenciosa de informação. Aparente débito de TS — o `Omit` na assinatura inclui `is_custom` mas o `rows.map` ignora.
**Fix:** Decidir: ou remover `is_custom` do tipo, ou usar `n.is_custom ?? true`.

### CLI-017 — `data_entrada` no Novo Processo aceita data futura sem validar
**Arquivo:** `src/pages/ClienteDetalhe.tsx:2152-2163`
**Detalhe:** Input `type="date"` sem `max={hoje}`. O cliente pode cadastrar processo com data 2030. Tem comentário "Padrão: hoje. Altere para cadastrar processos retroativos." — mas não bloqueia futuro.
**Fix:** Adicionar `max={new Date().toISOString().split('T')[0]}` no Input.

### CLI-018 — `parseFloat(novoValor.replace(',', '.'))` aceita "1.000,50" como "1.0" silenciosamente
**Arquivo:** `src/pages/ClienteDetalhe.tsx:2618`
**Detalhe:** Brasileiro escreve "R$ 1.000,50". `replace(',', '.')` → "1.000.50" → `parseFloat` → `1.0`. Loss de dados na auditoria financeira (Alterar Valor de lançamento).
**Fix:** Normalizar: remover todos os `.` exceto último, ou usar `Intl.NumberFormat` parser, ou input mascarado.

### CLI-019 — `descontoPreview` recalcula `processos.filter(p => new Date(p.created_at) >= startMonth)` a cada keystroke
**Arquivo:** `src/pages/ClienteDetalhe.tsx:229-288`
**Detalhe:** `useMemo` está correto, mas as dependências incluem `processos` (array completo). Cada mudança em campo do form não re-deve recalcular `monthCount`. Considerar derivar `monthCountBase` em `useMemo(() => ..., [processos])` separado.
**Fix:** Quebrar em 2 `useMemo` (base + form-dependent).

### CLI-020 — `pendingDeleteAction` armazena closure obsoleto
**Arquivo:** `src/pages/Clientes.tsx:42-43, 160-167, 213-218`, `src/pages/ClienteDetalhe.tsx:94, 618-624`
**Detalhe:** O pattern `setPendingDeleteAction(() => () => archiveCliente.mutate(clientId, ...))` captura `clientId` no momento do clique, mas a função pode rodar muito depois (user digitando senha). Se o estado mudar entre clique e confirmação, há risco de inconsistência. Não é bug agudo, mas é frágil.
**Fix:** Passar `{ kind: 'archive', clientId }` ao state e fazer dispatch no `onConfirm`.

### CLI-021 — `handlePreviewContract` perde `previewClienteName` quando muda de cliente sem fechar
**Arquivo:** `src/pages/Clientes.tsx:103-104, 142, 671-677`
**Detalhe:** `previewClienteName` é state level-page; se o modal é aberto pra cliente A, fechado, e o user clica em cliente B antes do `previewUrl` ir pra null, o nome pode aparecer divergente. Pequeno risco.
**Fix:** Empacotar `previewUrl + previewFileName + previewClienteName` em um único objeto `previewState: PreviewState | null`.

### CLI-022 — Falta a11y em vários botões com só ícone
**Arquivos:** `Clientes.tsx:462, 467, 471`, `ClienteDetalhe.tsx:1214, 1228, 1247, 1261, 1274`
**Detalhe:** `<Button variant="ghost" size="icon" title="X"><Icon /></Button>` — `title` é tooltip mas screen readers preferem `aria-label`. Alguns botões têm `aria-label` (download/excluir), outros só `title`. Inconsistente. Botão de auditar (linha 2642) tem texto, OK.
**Fix:** Padronizar `aria-label` em **todos** os IconButtons. Adicionar pelos menos os críticos: editar, arquivar, "Marcar pago", "Marcar deferido", "Histórico", "Settings".

### CLI-023 — `formatCEP` aceita CEP inválido silenciosamente
**Arquivo:** `src/lib/cep.ts:1-5`, `ClienteDetalhe.tsx:1610-1632`
**Detalhe:** `formatCEP` só mascara, não valida. `buscarCEP` retorna `null` em CEP inválido mas o user só vê toast info "CEP não encontrado". Cliente fica com CEP `00000-001` no banco se o user errar.
**Fix:** Validar CEP com regex `^\d{5}-?\d{3}$` no submit; toast.error se falhar.

### CLI-024 — `buscarCoordenadas` chama Nominatim em todo save de cadastro
**Arquivo:** `src/pages/ClienteDetalhe.tsx:549-556`
**Detalhe:** Para qualquer pequena edição (ex: trocar telefone), `handleSaveCadastro` chama Nominatim. Nominatim tem rate-limit (~1 req/seg). Letícia/secretária editando 10 clientes seguidos pode ter requests bloqueados. Pior: a request é AWAIT antes de salvar — bloqueia UI por ~500ms em cada save.
**Fix:** Só chamar `buscarCoordenadas` se `(cidade || estado || logradouro)` MUDARAM em relação ao state original. Cachear resultado por (endereço completo) em `geo-cache.ts` (já existe, basta usar).

### CLI-025 — `useFinanceiroClientes` retorna até "Pago" mas hook é instanciado em telas Cliente
**Arquivo:** `src/hooks/useFinanceiroClientes.ts:267-518`
**Detalhe:** Hook puxa TODOS lançamentos da empresa (pendentes + pagos do período), enriquece com processos/clientes/valores_adicionais, e roda agrupamento O(N). Em Clientes.tsx e ClienteDetalhe.tsx, esse hook **não** é usado (usam `useFinanceiro` diretamente). Mas se algum desenvolvedor o importar pra "filtrar 1 cliente", paga overhead da empresa toda. Verificar uso.

### CLI-026 — Em `ClienteDetalhe.tsx`, ao avançar `loadAll(silent:true)` o `processos`/`lancamentos` ficam stale em algumas mutations
**Arquivo:** `ClienteDetalhe.tsx:438, 577, 622, 1237, 1414, 1437`
**Detalhe:** Várias mutations chamam `loadAll(cliente.id, { silent: true })` no onSuccess. Mas o React Query invalidate de `['clientes']` (em `useUpdateCliente`) não invalida `processos` state local — pois `processos` aqui é **useState**, não useQuery. `loadAll` recarrega, OK, mas algumas mutations passam pelo `useFinanceiro` invalidate e dependem de queries que ClienteDetalhe nem usa.
**Fix:** Migrar `processos`/`lancamentos` de `useState` pra `useQuery` para participar do cache invalidation. Reduz duplicação de loadAll.

### CLI-027 — Botão "Auditar Todos" sem confirmação
**Arquivo:** `src/pages/ClienteDetalhe.tsx:2575-2583, 2561-2566`
**Detalhe:** Auditar todos os lançamentos pendentes do cliente é ação em batch, sem AlertDialog. Auditar é reversível (linha 2715 — onlymaster pode desauditar), mas a fricção zero pode causar cliques acidentais.
**Fix:** Adicionar `if (!confirm('Auditar todos os N lançamentos?')) return;` ou AlertDialog dedicado.

### CLI-028 — `handleSave` em Clientes.tsx Edit Modal não preserva campos não tocados
**Arquivo:** `src/pages/Clientes.tsx:169-207`
**Detalhe:** O `payload` enviado pra `useUpdateCliente` inclui campos como `dia_cobranca`, `valor_base`, etc. baseado no tipo atual. Se o user mudar `tipo` de MENSALISTA para AVULSO_4D, os campos `valor_base`/`desconto_progressivo`/etc são enviados (com valores de mensalista preenchidos no form? ou vazio? depende do useState init). Risco de overwrite com null indevido. `useUpdateCliente` (linha 105) só atualiza se `!== undefined`, então undefined está seguro, mas null sobrescreve. Verificar.

### CLI-029 — `tipo` do cliente em Clientes.tsx Edit Modal só oferece 2 opções
**Arquivo:** `src/pages/Clientes.tsx:551-557`
**Detalhe:** Banco tem 4 tipos (MENSALISTA, AVULSO_4D, PRE_PAGO, PRECO_POR_TIPO), card de stats já corrige isso (linha 268-302), mas o `<Select>` no modal de edição só oferece MENSALISTA e AVULSO_4D. Cliente PRE_PAGO editado nesse modal vira AVULSO_4D ao salvar (se o Select valor for forçado a um dos 2). Mas comentário no código (linha 232-235) reconhece o problema parcialmente.
**Fix:** Adicionar SelectItem para PRE_PAGO e PRECO_POR_TIPO. Ou — melhor — usar o Edit Cadastro do ClienteDetalhe (linha 1706-1714) que tem 3 dos 4 tipos (ainda falta PRECO_POR_TIPO).

### CLI-030 — `useDeleteCliente` chama `arquivar_cliente` mas o toast diz "Cliente arquivado — histórico financeiro preservado"
**Arquivo:** `src/hooks/useFinanceiro.ts:143-160`
**Detalhe:** O ALIAS de DELETE → ARCHIVE é correto e defensivo, mas o toast confunde. Em `ClienteDetalhe.tsx:2207-2211`, o `onSuccess` navega `/clientes` — o user clicou "Excluir" e foi mandado de volta pra lista esperando ver o cliente sumir, mas o cliente continua na lista (em "Arquivados"). Documentar melhor ou unificar com `useArchiveCliente`.
**Fix:** Remover `useDeleteCliente` totalmente; usar `useArchiveCliente` e remover o botão "Excluir" duplicado (ver CLI-005).

### CLI-031 — Notify-cliente-evento sem rate limit
**Arquivo:** `docs/sql/notif-cliente-eventos.sql:38-81`
**Detalhe:** Trigger fire-and-forget via `pg_net.http_post`. Não há throttling no banco. Se Asaas webhook (PAYMENT_UPDATED) for mass-fired ou um cliente alterar `data_deferimento` em loop (durante teste), pode disparar centenas de emails. Edge function tem que ser idempotente, mas não vi o código dela.
**Fix:** Verificar `notify-cliente-evento` edge function. Adicionar coluna `notif_*_enviado_em` checa idempotência mas só o trigger 1 (deferimento) usa. Trigger 2 (cobrança gerada, linha 117-129) **não checa** `notif_geracao_enviado_em` antes de chamar dispatch — pode gerar duplicado se INSERT for atualizado.

### CLI-032 — `ServicosPreAcordados`: estado `dirty` perdido ao trocar de cliente
**Arquivo:** `src/components/clientes/ServicosPreAcordados.tsx:33-49`
**Detalhe:** Se user mudar `rows` (dirty=true), navegar para outro cliente sem salvar, o `useEffect` recarrega `existing` mas o aviso "dirty" some — perde tudo silenciosamente.
**Fix:** Detectar mudança de `clienteId` e prompt `confirm('Você tem mudanças não salvas...')`. Ou auto-save (debounce 1s).

### CLI-033 — `useUpsertServiceNegotiations` permite valor 0 e dias 0 sem warning
**Arquivo:** `src/hooks/useServiceNegotiations.ts:47-66`
**Detalhe:** `service_name.trim() && fixed_price` (ClienteDetalhe.tsx:564) — valida que não é vazio, mas aceita `fixed_price = "0"`. Cliente recebe lançamento R$ 0,00.
**Fix:** Validar `Number(fixed_price) > 0`.

### CLI-034 — Botão "Gerar Extrato" não confere `confirmado_recebimento` de lançamentos já pagos
**Arquivo:** `src/pages/ClienteDetalhe.tsx:1051-1083`
**Detalhe:** `selectedProcessosTab` permite selecionar processos pagos (não há filtro). Se user gera extrato com processos pagos, o PDF mostra valores já pagos. Pode ser intencional (extrato histórico), mas não há aviso.

### CLI-035 — `handleArchive`/`handleUnarchive` em Clientes.tsx não fecham o modal em caso de erro
**Arquivo:** `src/pages/Clientes.tsx:212-228`
**Detalhe:** `onSuccess: () => setEditClient(null)`. Não há `onError`. Se a RPC falhar (ex: cliente com FK restritiva), modal continua aberto + toast genérico do `useArchiveCliente.onError`. OK, mas o user pode pensar que a ação foi feita. Adicionar `onError: (e) => toast.error('Não foi possível arquivar: ' + e.message)`.

---

## 🟢 OK / observações positivas

### CLI-036 — RPC `arquivar_cliente` corretamente substituiu DELETE direto
Tese do CODE-009/audit fix #5 — preserva histórico financeiro. Bem documentado nos comentários do hook. Bom defensivo.

### CLI-037 — Pre-check + UNIQUE constraint em Fatura Mensal (Bug-006)
3 camadas de defesa contra double-click: state disable + pre-check no DB + UNIQUE constraint SQL. Padrão correto.

### CLI-038 — `formatCNPJ`/`isValidCNPJ` corretos com algoritmo mod-11
Lib `src/lib/cnpj.ts` tem testes (`cnpj.test.ts`), valida sequências repetidas (`/^(\d)\1{13}$/`), implementa dígito verificador. Mesmo padrão pra `cpf.ts`. Bom.

### CLI-039 — Tenant isolation via `empresaPath` em Storage
`src/lib/storage-path.ts` cacheia `empresa_id` por user_id + TTL 5min. Todos os uploads de contratos passam por `empresaPath`. Bom.

### CLI-040 — Histórico campo-por-campo no ClienteDetalhe (auditoria 18/05)
`HistoricoEntidadeModal` (linha 1877-1883) + triggers SQL `created_by`/`updated_by` (citados em comments) — ferramenta sólida pra rastreio.

### CLI-041 — Guard anti-rebaixamento em "Marcar como Faturado"
ClienteDetalhe.tsx:2411-2416 checa `honorario_pago`/`cobranca_enviada` antes de rebaixar pra `cobranca_gerada`. Bug DERMAE 07/05 corrigido.

### CLI-042 — Skeleton + carregamento silent em mutations
`SkeletonTable` em vez de "Carregando..." (UX-Onda10). `loadAll(silent: true)` preserva aba/scroll/seleção em refresh pós-mutação. UX consistente.

### CLI-043 — `valor_protegido` em campos sensíveis
ValorProtegido envelopa valor_base, mensalidade, totalFaturado, totalPendente. Camada de privacidade pra valores financeiros. Bem aplicado.

### CLI-044 — Tipos `ClienteDB`, `ProcessoDB`, `Lancamento` centralizados em `src/types/financial`
Apesar do liberal uso de `as any` em fields ainda não no tipo (ex: `is_archived`, `cnpj`, `tipo_pessoa`), os tipos principais existem e são compartilhados.

### CLI-045 — Alerta deferimento bem desenhado
`DeferimentoAlertData` com 3 opções (Cancelar / Apenas Deferidos / Todos Mesmo Assim) — bom UX pra fluxo `no_deferimento`.

---

## 📊 Resumo

- **Críticos (🔴):** 7 — CLI-001 (mensalidade errada na fatura), CLI-002 (race em service_negotiations), CLI-003 (RLS-only no audit count), CLI-004 (duplicata de cliente), CLI-005 (botão Excluir armadilha), CLI-006 (CNPJ inconsistente), CLI-007 (PF não editável)
- **Médios (🟡):** 28 — validações faltando, perf (N+1, re-renders), a11y, permissões inconsistentes, ux frágil
- **OK (🟢):** 10 — RPCs atômicas, idempotência de fatura, tenant isolation, histórico

**Top 3 ações sugeridas (alta relevância vs. esforço):**
1. **CLI-001** — patch de 2 linhas (`valor_base` → `mensalidade` em ClienteDetalhe.tsx:1331, :1375), risco financeiro alto, fix barato.
2. **CLI-005 + CLI-030** — remover botão "Excluir" do ClienteDetalhe + remover `useDeleteCliente` (alias confuso). Limpa débito de UX e reduz superfície de risco.
3. **CLI-002** — migrar `useUpsertServiceNegotiations` pra RPC. Já existe pattern (`alterar_valor_lancamento`, `arquivar_cliente`). Resolve race + perda de dados.

Total: **35 itens** identificados (7 críticos, 28 médios, 10 positivos).
