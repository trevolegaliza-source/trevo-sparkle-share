import type { ClienteFinanceiro } from '@/hooks/useFinanceiroClientes';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';

export function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function getTipoProcessoLabel(tipo: string) {
  return TIPO_PROCESSO_LABELS[tipo as keyof typeof TIPO_PROCESSO_LABELS] || (tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Processo');
}

export function sanitizeFileNamePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase();
}

export function buildExtratoFilename(clienteNome: string, date = new Date()) {
  const safeName = sanitizeFileNamePart(clienteNome) || 'CLIENTE';
  return `extrato_${safeName}_${date.toISOString().split('T')[0]}.pdf`;
}

export function getExtratoIdAtual(cliente: ClienteFinanceiro) {
  return cliente.extrato_mais_recente?.id || cliente.lancamentos.find(l => l.extrato_id)?.extrato_id || null;
}

export function getLancamentosDoExtrato(cliente: ClienteFinanceiro, extratoId?: string | null) {
  if (!extratoId) return cliente.lancamentos;
  const lancamentos = cliente.lancamentos.filter(l => l.extrato_id === extratoId);
  return lancamentos.length > 0 ? lancamentos : cliente.lancamentos;
}

// FIN-001 (27/05 noite): formata "há Xh / há X dias" relativo a NOW.
export function fmtTempoAtras(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d}d`;
  if (d < 30) return `há ${Math.floor(d / 7)}sem`;
  return `há ${Math.floor(d / 30)}m`;
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  // BUG 18/05/2026: new Date('2026-05-18') interpreta UTC midnight; toLocaleDateString
  // converte pra timezone local (BR=UTC-3) e renderiza 1 dia antes (17/05).
  // Fix: se for YYYY-MM-DD puro (sem hora), parseia componentes manualmente
  // pra criar Date na timezone local sem shift. Strings com timestamp/tz seguem o
  // caminho normal (já corretas).
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString('pt-BR');
  }
  return new Date(d).toLocaleDateString('pt-BR');
}

export function diasAtraso(vencimento: string): number {
  const diff = Date.now() - new Date(vencimento).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function diasParaVencer(vencimento: string): number {
  const diff = new Date(vencimento).getTime() - Date.now();
  return Math.floor(diff / 86400000);
}

export function parseBadges(notas: string | null): string[] {
  if (!notas) return [];
  const badges: string[] = [];
  const lower = notas.toLowerCase();
  if (lower.includes('boas-vindas') || lower.includes('boas vindas')) badges.push('Boas-vindas');
  if (lower.includes('mudança de uf') || lower.includes('mudanca de uf')) badges.push('Mudança UF');
  if (lower.includes('urgência') || lower.includes('urgencia') || lower.includes('método trevo')) badges.push('Urgência');
  if (lower.includes('valor manual')) badges.push('Valor Manual');
  if (lower.includes('cortesia')) badges.push('Cortesia');
  return badges;
}

export const BADGE_COLORS: Record<string, string> = {
  'Boas-vindas': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'Mudança UF': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  'Urgência': 'bg-red-500/15 text-red-500 border-red-500/30',
  'Valor Manual': 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  'Cortesia': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
};

export function tipoLabel(c: ClienteFinanceiro): string {
  if (c.cliente_momento_faturamento === 'no_deferimento') return 'No deferimento';

  if (c.cliente_tipo === 'MENSALISTA') {
    return `Mensalista${c.cliente_dia_vencimento_mensal ? ` — dia ${c.cliente_dia_vencimento_mensal}` : ''}`;
  }

  if (c.cliente_tipo === 'PRE_PAGO') return 'Pré-Pago';

  if (c.cliente_dia_vencimento_mensal && c.cliente_dia_vencimento_mensal > 0 && !c.cliente_dia_cobranca) {
    return `Fatura mensal — dia ${c.cliente_dia_vencimento_mensal}`;
  }

  if (c.cliente_dia_cobranca && c.cliente_dia_cobranca > 0) {
    return `Avulso D+${c.cliente_dia_cobranca}`;
  }

  return 'Avulso';
}
