/**
 * Build a wa.me URL with prefilled message.
 * Uses anchor href (not window.open) to avoid ERR_BLOCKED_BY_RESPONSE / COEP issues.
 */
export function buildWhatsappUrl(phone: string, message: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone) return '#';
  const tel = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
  return `https://wa.me/${tel}?text=${encodeURIComponent(message)}`;
}
