/**
 * Returns the correct contact for billing.
 * Priority: financial contact > accountant/default phone
 */
export function getContatoCobranca(cliente: {
  nome_contador?: string | null;
  telefone?: string | null;
  nome_contato_financeiro?: string | null;
  telefone_financeiro?: string | null;
}) {
  const nome = cliente.nome_contato_financeiro || cliente.nome_contador || null;
  const telefone = cliente.telefone_financeiro || cliente.telefone || null;
  return { nome, telefone };
}

/**
 * Check if a client has any contact info for billing (phone required).
 */
export function clienteTemContatoCobranca(cliente: {
  telefone?: string | null;
  telefone_financeiro?: string | null;
  nome_contador?: string | null;
  nome_contato_financeiro?: string | null;
}): boolean {
  const tel = cliente.telefone_financeiro || cliente.telefone;
  return !!tel && tel.replace(/\D/g, '').length >= 10;
}
