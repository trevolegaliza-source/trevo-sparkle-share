const PRODUCTION_BASE = 'https://cobranca.trevolegaliza.com';

export function getCobrancaPublicUrl(token: string): string {
  return `${PRODUCTION_BASE}/cobranca/${token}`;
}
