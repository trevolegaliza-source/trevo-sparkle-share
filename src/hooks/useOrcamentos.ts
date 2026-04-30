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
}

export type OrcamentoInsert = Omit<Orcamento, 'id' | 'numero' | 'share_token' | 'created_at' | 'updated_at'>;

export function useOrcamentos(statusFilter?: string) {
  return useQuery({
    queryKey: ['orcamentos', statusFilter],
    queryFn: async () => {
      let q = supabase.from('orcamentos').select('*').order('created_at', { ascending: false });
      if (statusFilter && statusFilter !== 'todos') {
        q = q.eq('status', statusFilter);
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
      const valorTotal = all.reduce((s, o) => s + Number(o.valor_final), 0);
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

export function useDeleteOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orcamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
      qc.invalidateQueries({ queryKey: ['orcamento_kpis'] });
      toast.success('Orçamento excluído');
    },
  });
}
