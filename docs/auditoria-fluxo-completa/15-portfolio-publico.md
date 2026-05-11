# 15 — Portfólio Público (`/portfolio/:token`)

> Arquivo: `src/pages/PortfolioPublico.tsx`

## 🎯 O que é

Página pública que mostra o **portfólio de serviços** da Trevo (preços por estado, modalidades). Token único compartilhável.

**Rota:** `/portfolio/:token` — fora do ProtectedRoute.

## 🗺️ Mapa

```
┌─────────────────────────────────────────────────────────┐
│ Trevo Legaliza · Catálogo de Serviços                   │
│                                                          │
│ Estado: [SP ▾] Categoria: [Todas ▾]                     │
│                                                          │
│ Categoria: Abertura de Empresa                          │
│   • Abertura LTDA SP ............. R$ 580                │
│   • Abertura MEI SP .............. R$ 0 (gratuita)       │
│   ...                                                    │
│                                                          │
│ Categoria: Alteração                                    │
│   • Alteração contratual SP ...... R$ 580                │
│   ...                                                    │
└─────────────────────────────────────────────────────────┘
```

## 🔬 Interações

### 1. Filtros
- Estado (UFs Brasil)
- Categoria
- Subcategoria

### 2. Tabela de preços
- Vem de `catalogo_servicos`
- Preço por UF via `catalogo_precos_uf` (0 rows hoje — pode estar desativado)

### 3. Solicitar orçamento
Botão por serviço que abre WhatsApp deep link com mensagem pré-formatada.

## 🐛 Achados

| ID | Severidade | Resumo |
|---|---|---|
| **UX-122** | 🟢 | `catalogo_precos_uf` tem 0 rows — UI mostra preço genérico de `catalogo_servicos` |
| **UX-123** | 🟢 | Sem CTA "Falar com consultor" persistente |

## 🚦 Verdict release amanhã

**🟢 GO.** Tela de vitrine. Master compartilha link em campanhas/redes sociais. Letícia/secretária não tocam.
