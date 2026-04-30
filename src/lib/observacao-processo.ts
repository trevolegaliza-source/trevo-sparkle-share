/**
 * Helper para filtrar metadata auto-gerada das observações de processo/financeiro.
 *
 * Observações reais do operador (digitadas manualmente) devem aparecer no PDF
 * de extrato e na página pública de cobrança. Mas o sistema também grava
 * automaticamente algumas linhas de metadata em `processos.notas` e
 * `lancamentos.observacoes_financeiro` (ex.: "Boas-vindas 10%", "Valor manual",
 * "Mudança de UF", "Cortesia", "Extrato emitido em ...", "Cobrança enviada em ...",
 * "Processo nº X do mês"). Essas linhas são usadas internamente como flags e
 * NÃO devem vazar para a comunicação externa com o cliente.
 *
 * Esta função recebe o texto bruto e devolve apenas as linhas que parecem
 * observações reais (sem prefixos/keywords automáticas).
 */

// Patterns de metadata auto-gerada pelo sistema.
// IMPORTANTE: keywords ambíguas (Urgência, Boas-vindas, Cortesia, Método Trevo,
// Valor Manual, Mudança de UF) foram consolidadas numa única regex que exige
// final de linha, valor percentual ou pipe — evitando filtrar observações
// legítimas do operador que começam com essas palavras
// (ex.: "Urgência extrema solicitada pelo cliente" NÃO deve ser filtrado).
const AUTO_META_PATTERNS: RegExp[] = [
  // Audit trail / timestamps — nunca aparecem em texto livre do operador
  /^extrato emitido em\b/i,
  /^cobran[çc]a enviada em\b/i,
  /^cobran[çc]a gerada em\b/i,
  /^processo n[ºo°]\s*\d+\s+do m[êe]s\b/i,
  /^valor alterado manualmente\b/i,
  /^base:\s*r\$/i,
  /^is_manual\b/i,
  // Flags ambíguas — só filtra se for standalone, flag com valor (%), ou dentro de pipe
  /^(valor manual|boas[- ]?vindas|cortesia|mudan[çc]a de uf|urg[êe]ncia|m[ée]todo trevo)(\s*\d+\s*%?)?\s*(\||$)/i,
];

const INLINE_META_TOKENS: RegExp[] = [
  /\|/,                                  // separador de flags inline ("Valor Manual | ...")
];

function isAutoMetaLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (AUTO_META_PATTERNS.some((rx) => rx.test(trimmed))) return true;
  // Linha que é apenas um token de flag inline (ex.: "Valor Manual")
  if (INLINE_META_TOKENS.some((rx) => rx.test(trimmed)) && trimmed.length < 60) {
    // Heurística: linha curta com pipe = sequência de flags
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.every((p) => AUTO_META_PATTERNS.some((rx) => rx.test(p)) || p.length < 25)) {
      return true;
    }
  }
  return false;
}

/**
 * Limpa o texto de observação removendo linhas auto-geradas pelo sistema.
 * Devolve `null` se nada de útil sobrar.
 */
export function limparObservacao(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isAutoMetaLine(l));
  if (lines.length === 0) return null;
  return lines.join('\n');
}

/**
 * Consolida observações do processo (notas) e do financeiro (observacoes_financeiro)
 * em um único bloco de texto pronto para apresentação ao cliente.
 * Retorna `null` se ambas estiverem vazias após limpeza.
 */
export function consolidarObservacoes(
  observacoesProcesso: string | null | undefined,
  observacoesFinanceiro: string | null | undefined,
): string | null {
  const proc = limparObservacao(observacoesProcesso);
  const fin = limparObservacao(observacoesFinanceiro);
  const partes = [proc, fin].filter((p): p is string => Boolean(p));
  if (partes.length === 0) return null;
  // Deduplica caso o operador tenha escrito a mesma coisa nos dois campos
  const unicos = Array.from(new Set(partes.map((p) => p.trim())));
  return unicos.join('\n');
}
