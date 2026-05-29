# AUDIT-044 — Portfolio share token legado (29/05/2026)

## Estado

A única empresa em produção (Trevo Legaliza) **já tem `portfolio_share_token` configurado**.
Portanto, o fallback legado que aceita `empresa_id` como token **pode ser removido sem impacto operacional**.

## Como remover o fallback (não tem source no repo)

A edge function `portfolio-publico` está em produção mas não está versionada
em `docs/edge/`. Pra remover o fallback:

1. Pegar source atual via MCP:
   ```ts
   mcp__supabase__get_edge_function({ function_slug: "portfolio-publico" })
   ```
2. Versionar em `docs/edge/portfolio-publico-FULL.ts`
3. Localizar bloco de comentário "remover em ~30 dias" (comentário de 17/05)
4. Deletar o fallback `profileRow.empresa_id`
5. Redeploy

## Verificação pós-fix

```sql
-- Confirma que ninguém depende do fallback (deve retornar 0)
SELECT COUNT(*) FROM empresas_config WHERE portfolio_share_token IS NULL;
```
