# Auditoria Proposta Comercial — 26/05/2026

Auditoria abrangente da feature de Proposta Comercial de Terceirização. Cobre:
form `PropostaComercialNova.tsx`, listagem `PropostasComerciais.tsx`, landing pública
`TerceirizacaoPublicaView.tsx`, engine `terceirizacao-engine.ts`, edge function
`gerar-proposta-msa-pdf-FULL.ts` e SQLs de `docs/sql/feature-terceirizacao-*`.

---

## 🔴 Bugs críticos (precisam fix imediato)

### ITEM-001 — CHECK constraint rejeita modalidade `preco_por_tipo`
**Arquivo:** `docs/sql/feature-terceirizacao-mvp.sql:46`
**Detalhe:**
```sql
ADD COLUMN IF NOT EXISTS terc_modalidade text
  CHECK (terc_modalidade IN ('avulso', 'pro_5', 'enterprise_10', 'custom'))
```
A SQL `feature-terceirizacao-precos-por-tipo-regras.sql` (26/05) adicionou a modalidade
`preco_por_tipo` no engine + UI mas NÃO atualizou o CHECK constraint. Qualquer tentativa
de salvar uma proposta com `terc_modalidade='preco_por_tipo'` lança
`new row for relation "orcamentos" violates check constraint "orcamentos_terc_modalidade_check"`.
**Impacto:** modalidade nova totalmente quebrada em prod. Não dá pra salvar.
**Fix:**
```sql
ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_terc_modalidade_check;
ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_terc_modalidade_check
  CHECK (terc_modalidade IN ('avulso','pro_5','enterprise_10','custom','preco_por_tipo'));
```

### ITEM-002 — Aceite concorrente dispara 2 PDFs (race condition)
**Arquivo:** `docs/sql/feature-pdf-proposta-terceirizacao.sql:53-96` (RPC `aceitar_proposta_terceirizacao`)
**Detalhe:** o UPDATE de status pra `aceito` não é atômico em relação ao status read. O
SELECT busca por `status IN ('enviado','aguardando_pagamento')` mas sem `FOR UPDATE`.
Dois cliques simultâneos no botão "Aceitar" (ex: cliente impaciente, ou abriu em 2 abas,
ou WhatsApp + browser) executam a RPC 2x em paralelo:
1. SELECT 1 vê status=enviado, retorna v_orc.id
2. SELECT 2 (concorrente) também vê status=enviado, retorna mesmo v_orc.id
3. UPDATE 1 muda status pra 'aceito'
4. UPDATE 2 também executa (sem filtro de status), passa
5. **DOIS** `net.http_post` disparam → DOIS PDFs gerados, DOIS jobs no PDFShift,
   DOIS arquivos no bucket, DOIS Google Docs criados+deletados, DOIS notifs pro master.
**Impacto:** custo (PDFShift cobra por conversão), notifs duplicados, e mais grave:
o último UPDATE de `terc_pdf_url` ganha — o cliente pode acabar com link pro PDF errado
(corrida no upload do bucket).
**Fix:** adicionar `FOR UPDATE` no SELECT INTO ou condicionar o UPDATE:
```sql
UPDATE public.orcamentos
   SET status='aceito', terc_aceito_em=NOW()
 WHERE id=v_orc.id
   AND status IN ('enviado','aguardando_pagamento')  -- guard concorrente
 RETURNING id INTO v_orc.id;
IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'JA_ACEITO'); END IF;
```

### ITEM-003 — Idempotência do PDF tem janela de corrida
**Arquivo:** `docs/edge/gerar-proposta-msa-pdf-FULL.ts:1146-1148`
**Detalhe:** o guard `if (orc.terc_pdf_url && !force) return cached` só funciona DEPOIS
do primeiro PDF ser persistido. Como o aceite dispara `net.http_post` sem await (fire-and-forget),
um cliente que clica "Aceitar" + abre "Baixar PDF" 5s depois pode trigger 2 gerações
simultâneas: ambas leem `terc_pdf_url=NULL`, geram + uploadam. O Google Docs cria
nomes únicos (`MSA-X-{Date.now()}`), então cleanup ok, mas o storage acumula 2 PDFs
e o `terc_pdf_url` final é do último a terminar.
**Impacto:** custos duplicados Google API + PDFShift + storage poluído.
**Fix:** marcar `terc_pdf_url` como "gerando" antes de começar, ou usar advisory lock:
```sql
SELECT pg_try_advisory_xact_lock(hashtext('pdf-' || orcamento_id));
```

### ITEM-004 — Botão "Gerar/baixar PDF" não tem proteção contra duplo clique
**Arquivo:** `src/pages/PropostaComercialNova.tsx:693-714`
**Detalhe:** o botão dispara `force: true` no body. Não usa state local para
travar/disable durante o fetch. Usuário ansioso clica 5x → 5 PDFs gerados (cada um
com `Date.now()` no nome) + 5 chamadas Google Docs API. Custos reais.
**Impacto:** o toast `'Gerando PDF... aguarde 5-10 segundos'` é só visual, sem disabled.
**Fix:** state `[gerandoPdf, setGerandoPdf] = useState(false)`, `disabled={gerandoPdf}`,
trocar texto pra "Gerando..." durante o request.

### ITEM-005 — `valor_abertura` é override-only, mas se houver `valor_final_override` o "valor por processo" é mesmo do override
**Arquivo:** `src/components/orcamentos/publico/TerceirizacaoPublicaView.tsx:108-112, 446-459`
**Detalhe:** quando `terc_valor_final_override` está preenchido, `valorPrincipal=override`.
Mas a UI quando renderiza o split "Abertura R$ X / Demais R$ Y" usa `valorPrincipal` no
"Demais processos" — o que é o override, não o valor base calculado. Se o Thales preencheu
override pensando "valor cheio" e abertura como "específico de abertura", o cliente vê:
Abertura: R$ 750, Demais: R$ 680 — quando o override pode ter sido pensado como avulso geral.
A semântica do override + valor_abertura juntos é ambígua no UI atualmente.
**Impacto:** cliente pode ver valor incorreto. Negociação com erro.
**Sugestão:** clarificar — ou bloquear `valor_abertura` quando há override, ou adicionar
campo `valor_demais_processos` separado.

### ITEM-006 — Defaults `SERVICOS_DEFAULT`/etc são compartilhados por referência entre instâncias
**Arquivo:** `src/lib/terceirizacao-engine.ts:25-51` + `src/pages/PropostaComercialNova.tsx:84-86`
**Detalhe:** `emptyState()` retorna `servicos: SERVICOS_DEFAULT` — referência direta ao
array exportado, não cópia. Quando o user clica num chip pra desativar, o `ListaEditavel`
chama `onChange` com `itens.map(...)` que **cria array novo** (ok). Mas se algum lugar
mutar o array direto (push/splice/sort), todas as propostas novas herdam mutação. O código
atual usa map/filter (imutável) então não há bug ATIVO, mas é landmine que vai morder
quem mexer no `ListaEditavel` futuramente.
**Fix:** `servicos: [...SERVICOS_DEFAULT]` ou função `criarServicosDefault()`.

### ITEM-007 — `tipo_contrato` é gravado com valor da modalidade (`preco_por_tipo`/`pro_5`/...) — quebra checks legados
**Arquivo:** `src/pages/PropostaComercialNova.tsx:208`
**Detalhe:** `tipo_contrato: state.modalidade` — a coluna `tipo_contrato` é compartilhada
com orçamentos legados que esperam valores tipo `'mensal'`, `'avulso'`, etc. Salvar
`'preco_por_tipo'` ali pode quebrar dashboards, filtros, KPIs em outras pages.
**Impacto:** acoplamento ruim. Difícil de auditar se há queries lá fora que filtram por
`tipo_contrato`.

### ITEM-008 — Edge function não revalida tenant antes de upload
**Arquivo:** `docs/edge/gerar-proposta-msa-pdf-FULL.ts:1136-1175`
**Detalhe:** a edge usa service_role (bypass RLS) — qualquer um com `orcamento_id` válido
chamando a edge gera+salva PDF. Não há verificação de quem chamou. Se um atacante
descobrir UM `orcamento_id` (UUID), pode forçar regeneração de PDFs (custo) ou expor o
PDF (URL é pública). Combinado com o `force: true` flag, é DoS de baixo esforço.
**Impacto:** custos abusivos (PDFShift + Google API) por atacante externo.
**Fix:** validar pelo menos via Authorization header com JWT do usuário e checar empresa_id,
ou throttle por IP, ou exigir que venha do disparo da RPC (token de service).

---

## 🟡 Melhorias / débitos médios

### ITEM-009 — Sem validação de CNPJ no form (cliente principal)
**Arquivo:** `src/pages/PropostaComercialNova.tsx:362-368`
**Detalhe:** existe `isValidCNPJ` em `src/lib/cnpj.ts` mas o form aceita qualquer string
no CNPJ do prospect. CNPJ inválido sobe pro PDF + landing pública sem validação.
**Sugestão:** validar antes de mudar status pra 'enviado' (no validar()).

### ITEM-010 — Sem validação de email
**Arquivo:** `src/pages/PropostaComercialNova.tsx:377-383`
**Detalhe:** `type="email"` no input mas sem validação no `validar()`. Email mal-formado
chega no PDF e em integrações futuras (ClickSign, notifs).

### ITEM-011 — `validade_dias` aceita 0 e negativos por edge case
**Arquivo:** `src/pages/PropostaComercialNova.tsx:450-453`
**Detalhe:** `Math.max(1, Number(e.target.value) || 15)` — se user digita "0", `Number("0")=0`,
falsy, daí `|| 15` retorna 15. OK. Mas `min={1} max={90}` no input não previne o user
de colar "-5" via teclado — o Number("-5")=-5, truthy, vira `Math.max(1, -5)=1`. Funciona
mas inconsistente: alguns valores caem em 15, outros em 1.

### ITEM-012 — Autosave pode salvar rascunho sem identidade de usuário
**Arquivo:** `src/pages/PropostaComercialNova.tsx:268-275`
**Detalhe:** o autosave roda a cada 5s se `prospect_nome` não vazio. Quando criação
inicial dispara, navega pra `/editar/{id}` (linha 255). Em paralelo, o timer do useEffect
continua disparando até o componente unmount, e como o `propostaId` ainda é null nesse
ciclo, ele cria NOVA proposta com mesma razão. Em 5s pode criar duplicata.
**Impacto:** propostas duplicadas no banco se user demora ou navegação é lenta.
**Sugestão:** depois do primeiro save success, atualizar imediatamente `propostaId`
no state local antes de continuar.

### ITEM-013 — Botão "Excluir" não tem confirmação dupla — só `window.confirm`
**Arquivo:** `src/pages/PropostasComerciais.tsx:206-217`
**Detalhe:** `window.confirm()` é primitivo e dismissível por Enter. Para item destrutivo
(deleta proposta), considerar AlertDialog do shadcn com botão destacado em vermelho.

### ITEM-014 — Acessibilidade: botões sem `aria-label`
**Arquivo:** múltiplos
**Detalhe:** botões com só ícones (ex: `<Button variant="ghost" size="icon"><ArrowLeft/>`
em `PropostaComercialNova.tsx:290`, ações no dropdown da listagem) não têm `aria-label`,
inviáveis pra screen readers.

### ITEM-015 — Acessibilidade: campos do form sem `htmlFor`/`id`
**Arquivo:** `src/pages/PropostaComercialNova.tsx:355-390`
**Detalhe:** Labels do shadcn não estão associadas via `htmlFor={id}` ao input. SR
não conecta label ao campo.

### ITEM-016 — Modal de confirmação de aceite sem `role="dialog"` ou trap focus
**Arquivo:** `src/components/orcamentos/publico/TerceirizacaoPublicaView.tsx:669-706`
**Detalhe:** modal feito à mão com `<div>` + `z-50`. Sem `role="dialog"`, sem trap focus,
sem fechar com ESC, sem fechar clicando no backdrop. Cliente leigo pode "se perder".

### ITEM-017 — Telefone do WhatsApp tem regex bizarro
**Arquivo:** `src/pages/PropostasComerciais.tsx:86`
**Detalhe:**
```ts
const telefone = (orc.prospect_telefone || '').replace(/\D/g, '').replace(/^/, '55').replace(/^5555/, '55');
```
O `.replace(/^/, '55')` adiciona 55 no começo SEMPRE, depois `.replace(/^5555/, '55')`
tenta corrigir se já tinha 55. Não pega `+55`, não pega telefone sem DDD, não valida
quantidade de dígitos. Vai gerar URLs `wa.me/55` se telefone vier vazio (após `||''`).
**Sugestão:** lib utilitária com testes.

### ITEM-018 — Hardcoded `wa.me/5511934927001` no CTA da landing
**Arquivo:** `src/components/orcamentos/publico/TerceirizacaoPublicaView.tsx:624`
**Detalhe:** o link "Tirar dúvidas no WhatsApp" tem número fixo no código. Mudou telefone?
Tem que fazer commit + deploy. Devia vir de `empresas_config` ou env.

### ITEM-019 — Edge function tem retry zero em caso de falha Google Docs
**Arquivo:** `docs/edge/gerar-proposta-msa-pdf-FULL.ts:233-278`
**Detalhe:** se `driveCopy` falha (rate limit Google, 5xx transiente, OAuth expirado),
toda a operação aborta. PDF nunca gerado, cliente não recebe, e a RPC `aceitar_*`
já mudou status pra `aceito` (sem rollback). Cliente acha que aceitou mas PDF não tem.
**Sugestão:** retry 3x com backoff exponencial.

### ITEM-020 — `terc_clicksign_status` tem default `'nao_enviado'` mas CHECK aceita NULL
**Arquivo:** `docs/sql/feature-terceirizacao-mvp.sql:63-64` + `src/pages/PropostaComercialNova.tsx:249`
**Detalhe:** o form sempre seta `terc_clicksign_status: 'nao_enviado'` no save. Mas
o CHECK também aceita NULL. Propostas legadas (antes do refactor) ficam NULL. Filtros
`WHERE terc_clicksign_status='nao_enviado'` vão pular as antigas.
**Sugestão:** backfill + adicionar `NOT NULL DEFAULT 'nao_enviado'`.

### ITEM-021 — RPC `get_proposta_por_token` foi recriada 5x — risco de drift
**Arquivos:** `feature-terceirizacao-mvp.sql`, `fix-terceirizacao-share-token-ambiguo.sql`,
`feature-terceirizacao-customizacao-livre.sql`, `feature-terceirizacao-precos-por-tipo-regras.sql`,
`feature-terceirizacao-valor-abertura-dia-pagto.sql`, `feature-terceirizacao-video-url.sql`.
**Detalhe:** cada feature nova `DROP FUNCTION ... CREATE OR REPLACE` da assinatura inteira
com TODOS os campos. Em 6 SQLs. Se um SQL for executado em ordem errada (ou re-executado),
volta pra versão anterior e perde campos novos. Toda nova feature precisa **lembrar** de
adicionar a coluna ao RETURNS TABLE + ao SELECT.
**Sugestão:** mudar pra `RETURNS SETOF orcamentos` + view, ou eliminar dependência
da assinatura.

### ITEM-022 — `terc_valor_pro` hardcoded em 0 quando modalidade != pro_5
**Arquivo:** `src/pages/PropostaComercialNova.tsx:237`
**Detalhe:** `terc_valor_enterprise: 0` sempre (campo legado), mas `terc_valor_pro: calc.valorPro`
**sempre** calcula valorPro mesmo quando o user escolheu modalidade `custom` ou
`preco_por_tipo`. Não bug, mas pollution. Considerar `null` quando irrelevante.

### ITEM-023 — `valorPrincipal` na landing pública não respeita `terc_valor_pro * 5` quando override existe
**Arquivo:** `src/components/orcamentos/publico/TerceirizacaoPublicaView.tsx:108-112`
**Detalhe:** lógica:
```ts
if (override > 0) return override;
if (modalidade === 'pro_5') return valor_pro * 5;
return valor_base;
```
Para `pro_5`, se Thales preencheu override = R$ 3000 querendo "tudo no mês", e a
proposta mostra "R$ 3000/mês" — OK. Mas se Thales preencheu override = R$ 680 querendo
o valor por processo dentro do PRO, a landing mostra "R$ 680/mês" (ERRADO) em vez de
"R$ 680 × 5 × (1-15%)". Semântica do override no contexto de plano mensal não está clara.
**Sugestão:** UI deixar explícito "override do total mensal" vs "override por processo".

### ITEM-024 — Landing pública não trata `aceito` → tela de sucesso por reload
**Arquivo:** `src/components/orcamentos/publico/TerceirizacaoPublicaView.tsx:135-171`
**Detalhe:** se cliente fecha aba após aceite e re-abre o link, a RPC `get_proposta_por_token`
retorna `status='aceito'` (allowlist tem 'aceito'). A `TerceirizacaoPublicaView` então
renderiza a tela de hero+aceite, NÃO a tela de sucesso (porque `statusLocal=orc.status='aceito'`).
Espera, na verdade isso funciona! `if (statusLocal === 'aceito')` retorna tela de sucesso.
OK, falso positivo. **Mas** existe outra issue: se cliente clicou Aceitar mas o PDF demorou
+30s, e ele dá refresh, vê a tela de sucesso COM "PDF sendo gerado, atualize em ~30s" mas
nunca tem polling. Ele tem que dar F5 várias vezes pra ver o link.
**Sugestão:** adicionar `setInterval(fetch, 5000)` na tela de sucesso pra detectar pdf_url.

### ITEM-025 — `parseVideoUrl` aceita iframes genéricos sem sanitização
**Arquivo:** `src/components/orcamentos/publico/TerceirizacaoPublicaView.tsx:62-76, 285-293`
**Detalhe:**
```ts
return { type: 'iframe', embed: trimmed };  // fallback
```
Qualquer URL não-YouTube/Vimeo/MP4 vira `<iframe src={URL}>` direto no DOM. Thales pode
colar `javascript:alert(1)` ou URL malicioso e a landing pública roda no contexto do
domínio Trevo (cookies, localStorage). **MAS** quem preenche é o Thales, não usuário
externo — então XSS exigiria conta dele. Risco médio. Ainda assim, vale validar o protocolo
(só `https:` permitido) e quem sabe whitelist domínios.

### ITEM-026 — Edge function tem `delay: 2000` ms hardcoded no PDFShift
**Arquivo:** `docs/edge/gerar-proposta-msa-pdf-FULL.ts:1097`
**Detalhe:** delay de 2s sempre, mesmo quando HTML é simples. PDFShift cobra por tempo +
volume. Em maioria dos casos não é necessário (sem JS dinâmico).
**Sugestão:** remover ou condicionar a `delay: 500`.

### ITEM-027 — `aceitar_proposta_terceirizacao` não cobre status `recusado` revertível
**Arquivo:** `docs/sql/feature-pdf-proposta-terceirizacao.sql:58`
**Detalhe:** se cliente clicou "recusar" e depois mudou de ideia (tela pp-center mostra
"Revisar novamente"), o status fica `recusado` e ele não consegue mais aceitar — RPC só
aceita status `enviado`/`aguardando_pagamento`. Fluxo de reabilitação só dá pelo Thales
editar.

### ITEM-028 — Bucket `propostas-pdf` é público e listável
**Arquivo:** `docs/sql/feature-pdf-proposta-terceirizacao.sql:21-31`
**Detalhe:** o bucket é `public=true` com policy SELECT pública. Comentário diz "Sem listagem"
mas isso depende da policy em `storage.objects` pra LIST. Por padrão Supabase bloqueia
listing se não houver policy, mas vale revisar. Se houver, qualquer um lista o bucket.
**Sugestão:** confirmar via supabase MCP que não há policy LIST.

### ITEM-029 — Re-renders excessivos no PropostaComercialNova (sem useCallback)
**Arquivo:** `src/pages/PropostaComercialNova.tsx`
**Detalhe:** todo onChange dispara `setState({...state, campo: x})` — re-renderiza o
componente inteiro. Com ~15 campos, o input "Nome" re-renderiza toda a árvore. Os
filhos `ListaEditavel` recebem `onChange` inline novo a cada render, quebrando
memoization se houver. Para o caso atual é tolerável, mas degrada quando o engine ficar
mais complexo.

### ITEM-030 — Comparar `created_at` vs `enviado_em` pra expiração mostra inconsistência
**Arquivo:** `TerceirizacaoPublicaView.tsx:89-94` + `docs/sql/fix-orcamento-expiracao.sql`
**Detalhe:** o componente público calcula expiração como `created_at + validade_dias`, mas
a trigger SQL grava `data_expiracao = enviado_em + validade_dias` (quando vai pra 'enviado').
Se Thales criou em 01/05, editou rascunho até 20/05, enviou em 20/05, a landing exibe
"expira em 16/05" (created_at + 15) — mas o RPC só filtra pela `data_expiracao` real
(20/05 + 15 = 04/06). Datas exibidas pro cliente ESTÃO ERRADAS.
**Fix:** front-end deveria usar `enviado_em || created_at` (e melhor: ler `data_expiracao`
direto do RPC).

### ITEM-031 — Logo Trevo PNG base64 inline (~70KB no edge function)
**Arquivo:** `docs/edge/gerar-proposta-msa-pdf-FULL.ts:285+`
**Detalhe:** o LOGO_TREVO_PNG_B64 ocupa centenas de linhas no fonte. Cada cold start do
edge function carrega isso. Considerar hospedar em Storage e referenciar URL no HTML
(o PDFShift baixa).
**Sugestão:** mover pra `propostas-assets` bucket público.

### ITEM-032 — Pagamento via texto fixo "boleto bancário em até 3 dias" no PDF
**Arquivo:** `docs/edge/gerar-proposta-msa-pdf-FULL.ts:1054-1057`
**Detalhe:** "Cobrança via boleto bancário em até 3 dias da data da solicitação. Pagamento
à vista." é hardcoded no PDF. Não respeita o `terc_dia_pagamento` (que aparece na landing
mas não no PDF). Inconsistência entre o que cliente vê na landing vs PDF.

### ITEM-033 — `MODALIDADE_LABEL` duplicado em 3 lugares com valores diferentes
**Arquivos:** `src/pages/PropostasComerciais.tsx:44-49`, `docs/edge/...:64-69`, `terceirizacao-engine.ts:68-71`
**Detalhe:**
- Listagem TS: `enterprise_10: 'ENTERPRISE (10/mês)'`
- Edge: `preco_por_tipo: 'Preço por tipo'`
- Engine: só `avulso`/`pro_5` em PLANOS
**Bug imediato:** se modalidade for `preco_por_tipo`, a listagem mostra `'—'` (fallback `|| '—'`).
Não é bug critical mas é dado morto. Considerar fonte única `engine.ts`.

---

## 🟢 OK / observações positivas

### ITEM-034 — `escapeHtml` aplicado consistentemente no PDF HTML
**Arquivo:** `docs/edge/gerar-proposta-msa-pdf-FULL.ts:86-91, 925-1073`
**Detalhe:** todas as interpolações de campos do banco (prospect_nome, cnpj, telefone,
email, observações, labels de chips, descrições de inclusos, textos de regras) usam
`escapeHtml`. Não vi nenhum vazamento. Bom trabalho.

### ITEM-035 — Token de share usa `gen_random_bytes(24)::hex` (entropia 192 bits)
**Detalhe:** confirmado em `docs/sql/rel-014-gerar-extrato-completo.sql`. 48 chars
hexadecimais. Não é guessable.

### ITEM-036 — RPC pública filtra por status allowlist + expiração
**Arquivo:** `get_proposta_por_token`
**Detalhe:** só retorna se `status IN ('enviado','aguardando_pagamento','convertido','aceito')`
E `data_expiracao IS NULL OR > NOW()`. Rascunho não vaza.

### ITEM-037 — Senha de proposta via SEC-033 implementada corretamente
**Detalhe:** `get_proposta_publica_minima` separada de `get_proposta_por_token` — minimum
data antes da senha, full data só após. RPC retorna 0 linhas se senha não bate. Atacante
não vê valores via DevTools.

### ITEM-038 — Cleanup do Google Docs cópia em `finally`
**Arquivo:** `docs/edge/gerar-proposta-msa-pdf-FULL.ts:247-277`
**Detalhe:** o `try/finally` garante que `driveDelete` roda mesmo se export falhar.
Boa prática. Drive da service account não acumula arquivos órfãos.

### ITEM-039 — Edge function trata cors/options corretamente
**Detalhe:** `if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })`.
Sem isso, browsers bloqueiam.

### ITEM-040 — RLS herdada da tabela `orcamentos` (multi-tenant ok)
**Detalhe:** `tipo_proposta='terceirizacao'` só é discriminator de filtro, não altera RLS.
A política existente em `orcamentos` (tenant por empresa_id) cobre. RPCs públicas usam
`SECURITY DEFINER` + share_token check.

### ITEM-041 — Idempotência básica do PDF via `terc_pdf_url && !force`
**Detalhe:** apesar do problema de race (ITEM-003), o caso normal (cliente clica Aceitar
1 vez → 1 PDF) está coberto. Cliques subsequentes não re-geram.

### ITEM-042 — Layout mobile considerado
**Arquivo:** múltiplos
**Detalhe:** `grid-cols-1 md:grid-cols-2` em todos os blocos, tipografia responsiva
(`text-4xl md:text-6xl`), grid sticky desativa em mobile. Boa atenção a touch devices.

---

## 📊 Resumo

- **8 bugs críticos** (ITEM-001 a ITEM-008): CHECK quebrado bloqueia modalidade nova,
  race conditions no aceite e PDF, custos abusivos por DoS na edge function, semântica
  de override + valor_abertura ambígua.
- **25 melhorias / débitos** (ITEM-009 a ITEM-033): validações faltando (CNPJ, email),
  acessibilidade básica (aria-label, htmlFor, dialog), edge cases (autosave duplica
  rascunho, telefone wa.me bizarro, expiração calculada errada), arquitetura
  (RPC recriada 6x sem fonte única, tipo_contrato pollution).
- **9 OKs / observações positivas** (ITEM-034 a ITEM-042): `escapeHtml` consistente, RLS
  herdada, cleanup Google Docs em `finally`, senha via SEC-033 implementada certo.

**Total: 8 críticos + 25 melhorias + 9 OKs = 42 achados.**

**Prioridade pra atacar antes da viagem Thales (19/05 já passou — agora foco em estabilidade):**
1. ITEM-001 (CHECK constraint) — 1 SQL de 3 linhas, libera prod
2. ITEM-002 (race aceite) — adiciona `FOR UPDATE` ou guard no UPDATE
3. ITEM-004 (botão PDF sem disable) — fix React 5 min
4. ITEM-008 (edge sem tenant check) — JWT validation
5. ITEM-030 (expiração inconsistente) — front lê `data_expiracao` do RPC
