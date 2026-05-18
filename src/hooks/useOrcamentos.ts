import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Orcamento {
  id: string;
  numero: number;
  prospect_nome: string;
  prospect_cnpj: string | null;
  prospect_email: string | null;
  prospect_telefone: string | null;
  prospect_contato: string | null;
  tipo_contrato: string;
  servicos: any; // now stores OrcamentoItem[] as jsonb
  naturezas: any;
  escopo: any;
  valor_base: number;
  qtd_processos: number;
  desconto_pct: number;
  valor_final: number;
  desconto_progressivo_ativo: boolean;
  desconto_progressivo_pct: number;
  desconto_progressivo_limite: number;
  validade_dias: number;
  pagamento: string | null;
  sla: string | null;
  observacoes: string | null;
  status: string;
  share_token: string;
  cliente_id: string | null;
  convertido_em: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  prazo_execucao?: string | null;
  contexto?: string | null;
  ordem_execucao?: string | null;
  pacotes?: any;
  secoes?: any;
  destinatario?: string | null;
  riscos?: any;
  etapas_fluxo?: any;
  beneficios_capa?: any;
  headline_cenario?: string | null;
  cenarios?: any;
  observacoes_recusa?: string | null;
  recusado_em?: string | null;
  pago_em?: string | null;
  senha_link?: string | null;
  prazo_pagamento_dias?: number | null;
  itens_selecionados?: any;
  cenario_selecionado?: string | null;
  // INT-001 (12/05/2026): FKs pra processo e lançamento criados na conversão.
  // Permite navegar do orçamento → financeiro e detecta orçamento já convertido.
  processo_id?: string | null;
  lancamento_id?: string | null;
}

export type OrcamentoInsert = Omit<Orcamento, 'id' | 'numero' | 'share_token' | 'created_at' | 'updated_at'>;

// 18/05/2026: simplificacao de tabs de 6 → 3 categorias funcionais.
// Cada categoria mapeia pra um array de status reais do banco.
export const CATEGORIA_STATUS: Record<string, string[]> = {
  em_andamento: ['rascunho', 'enviado', 'aguardando_pagamento'],
  finalizadas: ['convertido', 'recusado'],
  todos: [], // [] = não filtra = traz tudo
};

export function useOrcamentos(filter?: string | string[]) {
  return useQuery({
    queryKey: ['orcamentos', filter],
    queryFn: async () => {
      let q = supabase.from('orcamentos').select('*').order('created_at', { ascending: false });
      // Suporta tanto string (legado: status único) quanto string[] (categorias)
      // ou nome de categoria (mapeia via CATEGORIA_STATUS).
      let statuses: string[] | null = null;
      if (Array.isArray(filter)) {
        statuses = filter;
      } else if (typeof filter === 'string') {
        if (CATEGORIA_STATUS[filter]) {
          statuses = CATEGORIA_STATUS[filter];
        } else if (filter !== 'todos') {
          statuses = [filter]; // legado: status único
        }
      }
      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Orcamento[];
    },
  });
}

export function useOrcamentoKPIs() {
  return useQuery({
    queryKey: ['orcamento_kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orcamentos').select('status, valor_final');
      if (error) throw error;
      const all = (data || []) as unknown as { status: string; valor_final: number }[];
      const total = all.length;
      const enviados = all.filter(o => o.status === 'enviado').length;
      const aprovados = all.filter(o => o.status === 'aprovado').length;
      const aguardandoPgto = all.filter(o => o.status === 'aguardando_pagamento').length;
      const convertidos = all.filter(o => o.status === 'convertido').length;
      const recusados = all.filter(o => o.status === 'recusado').length;
      const taxa = total > 0 ? Math.round(((aprovados + aguardandoPgto + convertidos) / total) * 100) : 0;
      // C47 — guard contra NULL/undefined; antes Number(undefined) = NaN
      // contaminava o reduce e zerava o KPI inteiro silenciosamente.
      const valorTotal = all.reduce((s, o) => s + Number(o.valor_final ?? 0), 0);
      return { total, enviados, aprovados, aguardandoPgto, convertidos, recusados, taxa, valorTotal };
    },
  });
}

export function useSaveOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orcamento: Partial<OrcamentoInsert> & { id?: string }) => {
      const { id, ...rest } = orcamento;
      if (id) {
        const { error } = await supabase.from('orcamentos').update(rest as any).eq('id', id);
        if (error) throw error;
        return id;
      } else {
        const { data, error } = await supabase.from('orcamentos').insert(rest as any).select('id').single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
      qc.invalidateQueries({ queryKey: ['orcamento_kpis'] });
      qc.invalidateQueries({ queryKey: ['sidebar_counts'] });
    },
  });
}

// INT-001 (12/05/2026): converte orçamento aprovado em processo + lançamento.
// Caminho B do roadmap (botão explícito) — master/gerente decide o momento.
// Backend: RPC public.converter_orcamento_em_processo (atômica, tenant check,
// idempotente — se já convertido, retorna referências existentes).
export function useConverterOrcamentoEmProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orcamentoId: string) => {
      const { data, error } = await supabase.rpc('converter_orcamento_em_processo' as any, {
        p_orcamento_id: orcamentoId,
      });
      if (error) throw error;
      return data as { ok: boolean; processo_id: string; lancamento_id: string; ja_convertido?: boolean };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
      qc.invalidateQueries({ queryKey: ['orcamento_kpis'] });
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      if (data?.ja_convertido) {
        toast.info('Orçamento já estava convertido — processo existente vinculado.');
      } else {
        toast.success('Orçamento convertido! Processo + lançamento criados no Financeiro.');
      }
    },
    onError: (e: Error) => toast.error('Erro ao converter: ' + e.message),
  });
}

export function useDeleteOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('orcamentos').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para excluir esse orçamento. Apenas o master pode excluir.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
      qc.invalidateQueries({ queryKey: ['orcamento_kpis'] });
      toast.success('Orçamento excluído');
    },
  });
}
