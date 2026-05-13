# 🌅 RETOMADA — Sessão autônoma 13/05/2026 noite

> Thales: *"Eu vou sai do escritorio agora, voce terá umas 10h sozinho para trabalhar. O que quer fazer?"*
>
> Este doc é o **primeiro lugar** pra ler quando voltar. Tudo do que foi feito + o que precisa rodar + próximos passos.

---

## 🚦 AÇÕES IMEDIATAS QUANDO VOLTAR (em ordem)

### 1️⃣ **Rodar SQL pendente (1 min)**

⚠️ **Tem 1 SQL desde a tarde que ainda não foi rodado:**
```
docs/sql/sprint-2.A.4-HOTFIX-respeitar-itens-selecionados.sql
```

**Por quê:** sem esse fix, a RPC `aprovar_orcamento_e_gerar_cobranca` ainda usa o `valor_final` cheio (mesmo bug que tu reportou — cliente marca 1 item de R$ 1.000 mas cobrança sai R$ 1.470). O hotfix já foi commitado mas o SQL precisa ser executado manualmente.

**Como verificar se já rodou:**
```sql
SELECT
  count(*) AS num_caracteres
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname='aprovar_orcamento_e_gerar_cobranca'
  AND length(pg_get_functiondef(p.oid)) > 6000;
```
Se retornar `num_caracteres: 1` (versão nova grande), já rodou. Se `0`, precisa rodar.

### 2️⃣ **Publish no Lovable (5 min)**

Subir 10 commits da noite:
```
c87b883 sprint-4-DG: remove Proximas faturas + AlertDialog morto
3619685 docs(mapa-mental): MASTER consolida 5 mapas (~6700 linhas)
042750c docs(visual): auditoria visual + design system + roadmap
3190e25 docs(features-gestor): 30 features priorizadas mindset CEO/CFO
fc106f7 feat(orcamento-status): fluxo de status totalmente na tela do OrcamentoNovo
cc6602a fix(sprint-2.A.4): RPC respeita itens marcados
a33c510 feat(orcamento-fixes): 3 fixes pos-smoke test
4a74f0b fix(orcamento): Copiar Link dominio correto
8b20503 fix(build): remove d3-vendor de manualChunks
21e4a1e docs(auditoria-master): atualiza MASTER
```

Confirma build sem erros. Se quebrar, me chama.

### 3️⃣ **Smoke test rápido (10 min)** — valida tudo da sessão noturna

**Teste A — fluxo status na própria tela:**
1. Abre `/orcamentos/novo`, cria com 1 cliente real, 1 item obrigatório, 1 opcional
2. Vê o **toggle de Opcional** novo, mais visível e com explicação
3. Clica **"Salvar e Enviar"** → status badge deve virar "📤 Enviado" SEM voltar pra lista
4. **Sem fechar a tela**, clica "Mudar status →" → "✏️ Voltar pra Rascunho" → badge muda direto
5. Clica "Copiar Link" → toast aparece, mesmo em rascunho (avisa que cliente vai ver 404)

**Teste B — cobrança respeita itens marcados (precisa SQL hotfix #1):**
1. Marca como "Enviado", copia link
2. Aba anônima, abre link, marca SÓ 1 dos 2 itens opcionais
3. Aprova
4. `/cobranca/...` deve mostrar valor **só do item marcado** (não o total cheio)

**Teste C — financeiro Próximas faturas (Sprint 4.D):**
1. Abre `/financeiro` aba "A Fazer"
2. Não deve aparecer mais o accordion "Próximas faturas" (estava info-only sem ação)

---

## 📚 DOCUMENTOS NOVOS PRA LEITURA (em ordem)

### 1. [`docs/mapa-mental/00-MAPA-MASTER.md`](docs/mapa-mental/00-MAPA-MASTER.md) — **LEIA PRIMEIRO**
Índice executivo dos 7 docs do mapa mental + features de gestor + auditoria visual. Cabe numa tela.

### 2. [`docs/mapa-mental/06-features-gestor.md`](docs/mapa-mental/06-features-gestor.md) — **30 features priorizadas**
TOP 10 features que eu colocaria primeiro pensando como CEO/CFO. Cada uma com problema atual, solução, valor, esforço. Tem decisões tuas pendentes pra cada uma.

### 3. [`docs/mapa-mental/07-auditoria-visual.md`](docs/mapa-mental/07-auditoria-visual.md) — **Visual / design system**
10 problemas visuais detectados + 8 quick wins (~8h pra polish notável) + 5 refactors amplos (~25h pra "produto de design").

### 4. Mapas técnicos (1000-1500 linhas cada — referência detalhada)
- [`01-cliente.md`](docs/mapa-mental/01-cliente.md) — fluxo cliente clique-a-clique
- [`02-orcamento.md`](docs/mapa-mental/02-orcamento.md) — fluxo orçamento clique-a-clique
- [`03-contas-pagar-cartao-colaboradores.md`](docs/mapa-mental/03-contas-pagar-cartao-colaboradores.md)
- [`04-financeiro.md`](docs/mapa-mental/04-financeiro.md)
- [`05-config-auth-permissoes.md`](docs/mapa-mental/05-config-auth-permissoes.md)

Não precisa ler tudo. Usa como referência quando for atacar uma frente específica.

---

## ✅ O QUE FOI ENTREGUE NA SESSÃO AUTÔNOMA (10h)

### 🐛 Bug fix (item 3 do teu pedido)
- **Fluxo de status do orçamento na própria tela** ([`fc106f7`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/fc106f7))
  - Antes: 3 telas pra mudar status (criar → voltar lista → marcar enviado)
  - Agora: badge de status + dropdown "Mudar status →" + Copiar Link sempre disponível
  - Atende exatamente o que tu reclamou: *"qualquer um ali feito sempre fica em RASCUNHO mesmo nao sendo mais"*

### 🧹 Sprint 4 D + G (cleanup UX)
- **D:** accordion "Próximas faturas" no Financeiro removido (info-only sem ação)
- **G:** AlertDialog "Boas-vindas" código morto removido (-85 LOC)
- **F:** "Gerar Verbas" wizard 6→3 cliques — **deferido** (toca folha, precisa sessão acompanhada)

### 📚 4 documentos novos (item 1, 2, 4 do teu pedido)
- **Mapa mental EXTREMAMENTE COMPLETO:** 5 docs cobrindo cliente / orçamento / contas a pagar / financeiro / config — **6.700+ linhas** de mapeamento clique-a-clique gerado por 5 agents em paralelo
- **Features de gestor:** 30 propostas com ROI estimado, mindset CEO/CFO
- **Auditoria visual:** 10 problemas + 8 quick wins + 5 refactors amplos

---

## 🎯 PRÓXIMAS FRENTES (decisão tua)

### 🔥 Atacáveis autônomas em próxima sessão (não precisam de ti)

1. **Sprint 4.F — Gerar Verbas wizard** (1-1.5h) — deferido hoje, mas atacável com cuidado
2. **Quick wins visuais Q1-Q8 do doc 07** (~8h total) — design system polish notável
3. **Bugs médios da tabela em MAPA-MASTER** — 10 bugs detectados pelos mapeamentos

### 💼 Features de gestor (precisam de ti pra OK em 1 frente)

Vide doc `06-features-gestor.md`. Recomendado começar por:

1. **MRR Dashboard + Predição mensal** (3-4h)
2. **Recurring billing auto pra mensalistas** (4-5h) — elimina 1h/mês manual
3. **Lembretes Dani WhatsApp inteligentes** (3h)
4. **"Hoje" view** (3h)
5. **Notificações auto pro cliente** (2h)

Cada uma é uma sessão dedicada. Tu escolhe a sequência.

### 🎨 Visual polish (1 sessão dedicada)

Q1-Q8 do doc 07. ~8h total. Sistema fica notavelmente mais polido.

### 🏗️ Refactor god components (sessão grande)

`ClienteDetalhe.tsx` 2549 linhas + `ClienteAccordionFinanceiro.tsx` 2300 linhas. Sessão acompanhada com tu testando após cada batch.

---

## 📊 Stats da sessão autônoma

- **11 commits novos** pushed
- **~7.000 LOC de documentação** (mapa mental + features + visual)
- **~135 LOC deletadas** (Sprint 4 D + G)
- **1 bug crítico fixado** (fluxo status orçamento)
- **TypeScript clean** em todos os commits
- **5 agents Explore em paralelo** mapeando o sistema

---

## ❓ Coisas que tu precisa decidir (vide doc 06 + 07)

### Features (doc 06):
- **Recurring billing:** Mensalista vence dia 10. Gera dia 10 ou D-5 pra cliente pagar antes?
- **Lembretes Dani:** Quais templates? Quão "agressivo" pode ser? (D-3, D-0, D+3?)
- **Notif auto cliente:** Email + WhatsApp ou só email? Quais eventos triggam?
- **"Hoje" view:** Substitui Dashboard ou adiciona como aba?
- **Template processos:** Master only cria ou qualquer perfil?
- **Import OFX:** Algum banco específico (Inter, Itaú)?

### Visual (doc 07):
- **Cor primária:** verde Trevo está bom ou outro tom?
- **Tipografia:** Inter ok ou testar Manrope/Plus Jakarta Sans?
- **Estilo geral:** minimalista corporativo (Linear/Stripe) ou colorido amigável (Notion/Asana)?
- **Dani no ERP interno:** aparecer no header, empty states, etc?

---

## 🍀 Mensagem final

Foi uma sessão produtiva. Documentei o sistema inteiro — qualquer dev novo entende em 1 dia lendo `docs/mapa-mental/`. Listei 30 features que eu como CEO colocaria no roadmap. Auditei o visual com critério. Fixei o bug que tu reclamou.

Não tem urgência em testar tudo agora. Lê o **`MAPA-MASTER.md`** com calma, decide a próxima frente, e na próxima sessão a gente ataca com foco.

Bom descanso (mesmo que tu trabalhe 20h/dia 🍀).

— Claude

*Gerado 13/05/2026 noite — última atualização ~~horário do último commit~~ ao terminar a sessão autônoma.*
