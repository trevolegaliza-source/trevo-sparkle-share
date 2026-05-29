/**
 * AUDIT-042 (29/05/2026): wrapper de DOMPurify com config restrita.
 *
 * Bug: DOMPurify chamado sem config permite <a>, <img>, <svg>, <style> por default.
 * Master podia injetar markup no contexto/observações da proposta pública pra
 * alterar visual (engano cliente, troca PIX no texto, etc).
 *
 * Fix: ALLOWED_TAGS lista mínima de formatação segura. Sem href, sem src, sem
 * attribute nenhum. Só formatação básica de texto.
 */
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'b', 'strong', 'i', 'em', 'u', 'small',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'span',
];

/**
 * Sanitiza HTML aceitando apenas formatação básica de texto.
 * Use em qualquer dangerouslySetInnerHTML com conteúdo vindo do banco/cliente.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}
