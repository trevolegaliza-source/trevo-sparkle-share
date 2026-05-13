# Auditoria: Telas "Documentos", "Inteligência Geográfica", "EstadoDetalhe" e "Catálogo"

**Data:** 13/05/2026  
**Contexto:** ERP com ~50 clientes SP. Foco em **código inútil** e dados reais vs vazios.

---

## 1. DOCUMENTOS (`/documentos`)

### Layout/Seções
- Header: "Estação de Validação"
- Stats cards: Total, Aprovados, Pendentes, Rejeitados (4 cards)
- Filtros: Search + Select por status
- Tabela: Processo, Cliente, Tipo Documento, Status, Ações (Aprovar/Rejeitar)

### Botões/Ações Principais
- ✅ Aprovar documento (status = 'aprovado')
- ❌ Rejeitar documento (status = 'rejeitado', com observação padrão)

### Achados

#### 🟡 **UX RUIM**
1. **Mensagem de "Execução SQL" na tabela vazia** (linha 199)
   - Exibe: "Nenhum documento cadastrado. Execute o SQL de migração para criar a tabela documentos."
   - ⚠️ Problema: Tabela EXISTS (BD tem `documentos` com 0 registros). Mensagem confusa para usuário final — parece error handler de desenvolvimento.
   - Sugestão: Simples "Nenhum documento para validar" ou "Aguarde upload de documentos pelos clientes".

2. **Código de decisão comentado** (linhas 53-56)
   - Referencia "DECISION-001 Fase 3": processo não muda etapa ao rejeitar — apenas `documento.status` muda.
   - ✓ OK se implementado, mas comentário deveria estar num doc de decisões, não inline.

#### ⚫ **INÚTIL**
1. **Tab "Documentos" no menu — nunca é usado**
   - ✅ Rota existe em App.tsx (line 141–145)
   - ✅ Requer permissão `documentos`
   - ✅ Aparece no Dashboard redirect (line 78)
   - **MAS:** BD tem 0 documentos reais em produção.
   - **Custo:** 1 tab de menu, ~210 linhas de código, 2 hooks (useDocumentos, useUpdateDocumento), queries RPC.
   - **Fato:** Thales citou "tem coisa inútil ali" — provavelmente refere-se a isso.

---

## 2. INTELIGÊNCIA GEOGRÁFICA (`/inteligencia-geografica`)

### Layout/Seções
- Header com icon + descrição: "CRM Territorial"
- KPIs dinâmicas (Estados Ativos / Estado selecionado + clientes/processos/receita)
- Mapa Brasil (D3) com hover interativo
- Ranking lado-direito: top 12 estados por clientes + receita + rating

### Botões/Ações Principais
- 🖱️ Hover estado → zoom em KPIs + link "Ver detalhes"
- Click estado → navega `/inteligencia-geografica/{uf}`
- Click ranking item → drill-in

### Dados Reais
- `contatos_estado`: 45 registros ✅
- `notas_estado`: 0 registros
- Cobre **todos os UFs do Brasil** (27 states)

### Achados

#### 🔴 **BUG / PROBLEMA CRÍTICO**
1. **Indefinida: `GREEN_BRIGHT` não importada**
   - Linha 129: `style={{ color: GREEN_BRIGHT }}`
   - Linha 219: `const GREEN_BRIGHT = '#22c55e';` (definida no **fim do arquivo**)
   - ✓ Funciona (hoisting), mas está fora de padrão.
   - 🟡 Deveria estar em `constants/` ou topo do arquivo.

#### 🟡 **UX RUIM**
1. **Fetch de ratings duplica query inteligenciaGeografica**
   - Linhas 23–42: `useQuery('ratings_por_estado')` faz full scan de `contatos_estado` **a cada render**.
   - Já há `useEstadosResumo()` que carrega dados agregados.
   - **Problema:** Overhead desnecessário se ratings podem ser calculados backend.

2. **Mapa Brasil para ERP SP-only**
   - ❌ Exibe 27 UFs (incluindo RR, AP, AC, AM, PA...)
   - ✅ Mas: Thales tem clientes **só em SP**.
   - **Pergunta:** Por que gastar pixels + D3 em 26 UFs vazios?
   - **Ranking mostra:** Apenas 1–2 UFs têm dados (SP provavelmente dominante).

#### ⚫ **INÚTIL**
1. **CRM Territorial para ERP sem CRM**
   - Contexto: Feature chamada "Inteligência Geográfica", carrega órgãos + contatos por estado.
   - **Uso real:** Armazenar telefones de JUCESP, cartórios, prefeituras.
   - **Problema:** Dashboard **não refere** CRM, clientes não consultam estado de outro, Thales não mencionou uso.
   - **Custo:** 3 componentes mapa (MapaBrasilEnterprise, MapaEstadoMunicipios, RatingStars), ~220 linhas + hooks complexos, queries RPC estudo + thema custom colors, glass cards.
   - **Candidato a deletar?** Talvez. Pergunte a Thales: "Você realmente usa contatos de estado (JUCESP, cartórios) na operação diária?"

---

## 3. ESTADO DETALHE (`/inteligencia-geografica/:uf`)

### Layout/Seções
- Breadcrumb: Brasil > {UF} > {Município}
- Header com nome estado + KPIs (Clientes, Processos, Receita, Contatos)
- Tabs: Mapa | Órgãos e Contatos | Clientes | Municípios | Notas
- Modal para criar/editar contatos com 10+ campos

### Buttons/Ações
- Adicionar contato por tipo (Junta, Cartório, etc)
- Edit/Delete contatos + rating stars
- Filtros de legenda (visibilidade, rating mínimo, "apenas com contato")
- Busca município + drill-in

### Dados
- `contatos_estado`: 45 registros (shared com pai)
- `notas_estado`: 0 registros (autosave textarea)
- Municipios IBGE: ~5.000+ nomes (loaded on-demand)

### Achados

#### 🔴 **BUG**
1. **useEstadoDetalhe hook não verificada (não-exibida)**
   - Assume que hook carrega corretamente com JOINs de cliente.
   - Se hook falha, página quebra silenciosamente.

#### 🟡 **UX RUIM**
1. **Autosave nota com timeout (linhas 126–133)**
   - `useEffect` dispara em `nota` + `notaDirty` → setTimeout 1500ms.
   - ✓ OK, mas sem feedback visual de "saving..." / "saved ✓".
   - Usuário não sabe se mudança foi persistida.

2. **Legenda com 3 configurações por tipo** (linhas 110–116)
   ```javascript
   legendaConfig[item.tipo]: { 
     visivel: boolean,      // Mostrar no mapa?
     ratingMin: number,     // Filtrar por rating?
     apenasComContato: bool // Apenas com contato_interno?
   }
   ```
   - ⚠️ Complexidade: 3 checkboxes + 6 radio buttons (0-5) × 5 tipos = overhead UI.
   - Pergunta: **Quem usa isso?** (Thales não mencionou filtros de mapa.)
   - **Resultado:** Mapa é recomputed, estado local cresce.

3. **100 municípios truncados** (linhas 605–609)
   - "Mostrando 100 de {total} municípios. Refine a busca."
   - São Paulo tem ~645 municípios → usuário vê só 100 até buscar.
   - Solução: Pagination ou lazy-load, não truncate.

#### ⚫ **INÚTIL**
1. **Mapa de Municípios + contatos em chip**
   - Componente `MapaEstadoMunicipios` renderiza:
     - Mapa SVG do estado com municípios coloridos
     - Pins de contatos com emoji
     - Legenda customizável
   - **Custo:** ~200 linhas (MapaEstadoMunicipios.tsx não lida, mas importada linha 6).
   - **Uso:** Olhar geograficamente onde estão órgãos em SP.
   - **Realidade:** Thales já SABE que JUCESP fica em SP capital, cartórios em bairros, etc.
   - **Pergunta:** Qual é o caso de uso? "Descobrir onde procurar um cartório"?
     - Se sim: Um **index list** (São Paulo, Campinas, ...) é mais rápido que D3.

2. **Tab "Notas" — autosave em tabela vazia**
   - `notas_estado` = 0 registros
   - Textarea para "Observações operacionais sobre {UF}" com autosave.
   - ✓ Feature OK, mas **nunca é usado** (BD: 0 rows).
   - Custo: Extra state, effect, mutation + RPC saves no Supabase.

3. **Rating stars em chips**
   - Linhas 436, 540: `RatingStars rating={c.rating || 0} onChange={(r) => handleUpdateRating(c.id, r)}`
   - Permite marcar órgão com 1–5 ⭐.
   - **Uso:** "Essa JUCESP é boa, 5 ⭐. Esse cartório é lento, 2 ⭐."
   - **Pergunta:** Thales usa isso? Não foi mencionado.
   - **Ícone que aparece:** `{'⭐'.repeat(Math.round(ratingMedio))}` — emoji inline é fragile.

---

## 4. CATÁLOGO (`/catalogo`)

### Layout/Seções
- Header: "Portfólio de Serviços" + Admin toggle + Search
- Breadcrumb dinâmica (hierarquia 3 níveis: Group > Child > Service)
- Level 0: Mega-cards (12 grupos com glowColor, count)
- Level 1: Smaller cards (children de 1 grupo)
- Level 2: Service grid (3 cols, admin mode mostra edit/delete/preços)
- Level 3: Service detail (hero card + edição inline + preços por UF em tabela)
- Tabela preços: 27 UFs × 2 colunas (honorário + taxa órgão) = 54 inputs

### Botões/Ações
- ✏️ Editar serviço (admin)
- 💰 Gerenciar preços por UF (modal com 27 UFs × 3 campos)
- 🗑️ Deletar serviço
- 🔗 "Copiar link público" (portfólio para clientes)
- Toggle Admin mode

### Dados
- `catalogo_servicos`: 126 registros ✅ (dados reais)
- `catalogo_precos_uf`: 0 registros ❌ (vazio)
- CATALOG_HIERARCHY: 12 grupos fixos em `constants/catalogo-hierarchy`

### Achados

#### 🔴 **BUG**
1. **PrecosUFModal não salva corretamente**
   - Linhas 948–964: Loop `for (const uf of UFS_BRASIL)` chama `upsertMut.mutateAsync()` **em série**.
   - ⚠️ Se 1 mutation falha, resto não executa (não há error handling).
   - Solução: `Promise.all()` ou try/catch com fallback.

2. **Admin toggle sem persistência**
   - Linha 99: `const [adminMode, setAdminMode] = useState(false);`
   - Refresh página → volta a `false` (não salvo em localStorage ou profile).
   - ✓ OK para segurança, mas UX chata se Thales testa edições e página recarrega.

#### 🟡 **UX RUIM**
1. **Hierarquia fixa em constant, serviços em BD**
   - `CATALOG_HIERARCHY` (constants/catalogo-hierarchy.ts):
     ```javascript
     [{ key: 'abertura', label: 'Aberturas', children: [...] }, ...]
     ```
   - `catalogo_servicos.categoria` referencia essas keys.
   - **Problema:** Se Thales quer adicionar novo grupo, precisa editar código + deploy (não é UI).
   - **Solução:** Migrar hierarquia para BD (nova tabela `catalogo_grupos`).

2. **Preços por UF nunca salvos**
   - `catalogo_precos_uf` = 0 registros em BD.
   - Modal `PrecosUFModal` é renderizado mas **dados estão sempre vazios**.
   - Pergunta: **Thales NUNCA clicou em "Gerenciar Preços por UF"?** Ou função está quebrada?
   - Se nunca usa: Deletar modal, simplificar.

3. **Tabela preços com 27 linhas toda vez**
   - Todas 27 UFs aparecem, mesmo que Thales só trabalhe em SP.
   - UFs vazias (RR, AP, etc) mostram "—" (linhas 1027).
   - **Cosmético:** Filtrar por "estados com atividade" ou input "filtrar UF".

#### 🟢 **POLISH**
1. **GlassCard animations**
   - Linhas 382, 439, 501: `style={{ animationDelay: '${i * 60}ms' }}`
   - Cards entram com fade + scale (CSS `@keyframes catalogFadeIn`).
   - ✓ Bonito mas não essencial; pode ser removido se performance sofre.

2. **Breadcrumb com "🍀 Portfólio"**
   - Linha 170: Label hardcoded com emoji.
   - Funciona, mas emojis em breadcrumb é incomum (UX).

#### ⚫ **INÚTIL**
1. **Tabela preços por UF — estrutura obsoleta**
   - Dados: 0 registros em BD.
   - Lógica: Carrega todos os 27 UFs, inicializa form vazio para todos.
   - **Custo:** ScrollArea + 27 × 3 inputs (salva via `upsertMut` 1-by-1).
   - **Pergunta:** 
     - Thales tem clientes em outros estados? **Não mencionado.**
     - Precisa de tabelas de preço por UF? **Não usado (0 registros).**
   - **Suspeita:** Feature "boa ideia na época", nunca implementada.
   - **Solução:** Deletar modal ou mover para "Admin setup" (não principal).

2. **"Copiar Link Público" — portfolio para quem?**
   - Linhas 102–114: Button copia `${origin}/portfolio/{empresa_id}`.
   - ✓ Funciona (fetches enterprise_id da profile).
   - **Pergunta:** Thales vende portfólio público para clientes?
   - **Se não:** Botão inútil.
   - **Sugestão:** Verificar analytics ou perguntar.

3. **Hierarquia hardcoded com 12 grupos**
   - CATALOG_HIERARCHY importada (line 34) tem:
     - Abertura, Alteração, Transformação, Baixa, Licença, Certidão, Regularização, Registros Especiais, Marcas/Patentes, Cartorário, Consultoria, Recorrentes, Outros
   - **126 serviços espalhados** entre essas categorias.
   - **Problema:** Se quer reordenar ou renomear grupo, edita constant + deploy.
   - **Custo:** ~50 linhas de constant definition.
   - **Verdade:** Talvez seja OK se estável há 6+ meses.

---

## RESUMO EXECUTIVO

### 🎯 **ACHADOS CRÍTICOS — Código Inútil (⚫)**

| Tela | Componente | Status | Custo | Recomendação |
|------|-----------|--------|-------|--------------|
| Documentos | Tab + validação | 0 registros BD | 210 loc + 2 hooks | **DELETE** — nunca usado |
| Intel Geo | Mapa Brasil (27 UFs) | 1–2 com dados | 3 componentes + 220 loc | **REDUZIR** — mostrar só SP? |
| EstadoDetalhe | Mapa Municípios | Visível mas inútil? | ~200 loc (external) | **QUESTIONAR** — use case? |
| EstadoDetalhe | Tab Notas | 0 registros BD | 1 tab + autosave effect | **DELETE** — não usado |
| EstadoDetalhe | Rating stars | 0 ratings real | Badge render | **DELETE** se Thales não avalia |
| Catálogo | Preços por UF | 0 registros BD | Modal + 27-UF table | **DELETE** — nunca salvou |
| Catálogo | "Copiar Link" | ? (unknown) | 12 linhas | **VERIFY** — realmente usa? |
| Catálogo | Hierarquia hardcoded | Fixo | 50 linhas constant | **MIGRAR** para BD se precisa editar |

### 🔴 **BUGS ENCONTRADOS**

1. **Documentos:** Mensagem "Execute SQL" confusa (tabela exists, 0 rows).
2. **Intel Geo:** `GREEN_BRIGHT` não importado (usa hoisting, mas pattern ruim).
3. **Catálogo:** `PrecosUFModal` não faz error handling em loop upsert.

### 🟡 **UX FRACO**

1. Autosave nota sem feedback visual.
2. Legenda mapa com 3 configs = UI complexa.
3. 100 municípios truncados (não pagina).
4. Fetch ratings duplica query.
5. Hierarquia fixa (não editável sem código).

### 📊 **DADOS REAIS vs VAZIOS**

- ✅ `catalogo_servicos`: 126 registros (ativo)
- ✅ `contatos_estado`: 45 registros (ativo)
- ❌ `documentos`: 0 registros
- ❌ `notas_estado`: 0 registros
- ❌ `catalogo_precos_uf`: 0 registros (?) — não existe tabela, ou existe mas vazia?

---

## RECOMENDAÇÕES PARA THALES

1. **Deletar `Documentos` tab imediatamente** — 0 registros em BD, nunca foi usado. Feature "nice-to-have" que viralizou.

2. **Simplificar "Inteligência Geográfica":**
   - Se só SP → exibir mapa SP em vez de Brasil.
   - Se mantém Brasil → remover municípios (redundante com EstadoDetalhe).

3. **Questionar EstadoDetalhe:**
   - "Você usa a aba 'Mapa' pra achar órgãos, ou sabe o endereço de cor?"
   - Se sabe de cor → deletar mapa, manter lista simples.

4. **Catálogo — preços por UF:**
   - Realmente precisa de tabela de preços multiestado?
   - Se não → deletar modal + coluna de preços.
   - Se sim → corrigir upsert error handling + salvar dados.

5. **Rotas sem permissão:**
   - Verificar se algum usuário (não-master) tem permissão `documentos`, `intel_geografica`.
   - Se não → remover do Dashboard redirect.

---

## ESTATÍSTICAS

- **Linhas de código afetadas:** ~700–900 loc
- **Componentes:** 8–10 (MapaBrasilEnterprise, MapaEstadoMunicipios, RatingStars, GlassCard usadas múltiplas vezes)
- **Queries RPC:** 5+ (useDocumentos, useEstadosResumo, usePrecosUF, useServicos, rating aggregation)
- **Hooks customizados:** useDocumentos, useUpdateDocumento, useEstadoDetalhe, useServicos, usePrecosUF, etc.
- **Potencial remoção:** 200–300 loc de código inútil imediato (Documentos + notas_estado + ratings)

