import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildWhatsappUrl } from '@/lib/open-whatsapp';
import { gerarMensagemCobranca } from '@/lib/mensagem-cobranca';
import { consolidarObservacoes } from '@/lib/observacao-processo';
import type { LancamentoFinanceiro } from '@/hooks/useFinanceiroClientes';
import { getTipoProcessoLabel } from './utils';
import type { MsgBuilderParams } from './types';

/** Programmatic open via real anchor click (used after WhatsappLinkButton click handlers). */
export function openWhatsApp(phone: string, message: string) {
  navigator.clipboard.writeText(message).catch(() => {});
  const url = buildWhatsappUrl(phone, message);
  if (url === '#') {
    toast.error('Telefone inválido.');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast.success('✅ Mensagem copiada! Abrindo WhatsApp...');
}

export async function getNomeRemetente(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      if (profile?.nome) return (profile.nome as string).split(' ')[0];
    }
  } catch { /* ignore */ }
  return 'Equipe';
}

export async function marcarLancamentosComoEnviados(lancamentoIds: string[]) {
  if (lancamentoIds.length === 0) return true;
  const { error } = await supabase
    .from('lancamentos')
    .update({
      etapa_financeiro: 'cobranca_enviada',
      observacoes_financeiro: `Cobrança enviada em ${new Date().toLocaleDateString('pt-BR')}`,
    } as any)
    .in('id', lancamentoIds);

  if (error) {
    toast.error(error.message);
    return false;
  }

  return true;
}

export async function buildValoresAdicionaisMap(lancamentos: Array<Pick<LancamentoFinanceiro, 'processo_id'>>) {
  const processoIds = [...new Set(lancamentos.map(l => l.processo_id).filter(Boolean))] as string[];
  const vaMap: Record<string, number> = {};
  if (processoIds.length === 0) return vaMap;

  const { data: vas } = await supabase
    .from('valores_adicionais')
    .select('processo_id, valor')
    .in('processo_id', processoIds);

  if (vas) {
    for (const va of vas) {
      vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + va.valor;
    }
  }

  return vaMap;
}

export async function buildValoresAdicionaisDetalhadosMap(
  lancamentos: Array<Pick<LancamentoFinanceiro, 'processo_id'>>,
): Promise<Record<string, Array<{ descricao: string; valor: number }>>> {
  const processoIds = [...new Set(lancamentos.map(l => l.processo_id).filter(Boolean))] as string[];
  const map: Record<string, Array<{ descricao: string; valor: number }>> = {};
  if (processoIds.length === 0) return map;

  const { data: vas } = await supabase
    .from('valores_adicionais')
    .select('processo_id, descricao, valor')
    .in('processo_id', processoIds);

  if (vas) {
    for (const va of vas) {
      // CODE-008 (17/05/2026): skip valor adicional NULL/0.
      const vaValor = Number(va.valor);
      if (!Number.isFinite(vaValor) || vaValor <= 0) continue;
      if (!map[va.processo_id]) map[va.processo_id] = [];
      map[va.processo_id].push({ descricao: va.descricao || 'Taxa', valor: vaValor });
    }
  }

  return map;
}

export function buildMensagemFromLancamentos({ lancamentos, vaMap, vaDetalhadoMap, diasAtraso, nomeRemetente, observacao, dataVencimentoOverride }: MsgBuilderParams): string {
  const l = lancamentos[0];
  if (!l) return '';
  const honorarios = l.valor;
  const taxasExtras = l.processo_id ? (vaMap[l.processo_id] || 0) : 0;
  const taxasDetalhadas = l.processo_id ? (vaDetalhadoMap?.[l.processo_id] || []) : [];
  const valorPrimeiro = honorarios + taxasExtras;
  const adicionais = lancamentos.slice(1).map(item => {
    const h = item.valor;
    const t = item.processo_id ? (vaMap[item.processo_id] || 0) : 0;
    const td = item.processo_id ? (vaDetalhadoMap?.[item.processo_id] || []) : [];
    return {
      tipo: getTipoProcessoLabel(item.processo_tipo),
      razao_social: item.processo_razao_social,
      valor: h + t,
      honorarios: h,
      taxasExtras: t,
      taxasDetalhadas: td,
    };
  });
  // Consolida observações do processo + financeiro filtrando metadados auto-gerados.
  const obsConsolidada =
    observacao ??
    consolidarObservacoes(
      (l as any).processo_notas ?? null,
      l.observacoes_financeiro ?? null,
    ) ??
    undefined;
  return gerarMensagemCobranca({
    tipo: getTipoProcessoLabel(l.processo_tipo),
    razao_social: l.processo_razao_social,
    valor: valorPrimeiro,
    honorarios,
    taxasExtras,
    taxasDetalhadas,
    data_vencimento: dataVencimentoOverride || l.data_vencimento,
    diasAtraso,
    nomeRemetente,
    observacao: obsConsolidada,
    processosAdicionais: adicionais.length > 0 ? adicionais : undefined,
  });
}
