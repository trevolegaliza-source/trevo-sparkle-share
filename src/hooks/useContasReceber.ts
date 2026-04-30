import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LancamentoReceber {
  id: string;
  tipo: string;
  cliente_id: string | null;
  processo_id: string | null;
  descricao: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  is_taxa_reembolsavel: boolean;
  comprovante_url: string | null;
  confirmado_recebimento: boolean;
  etapa_financeiro: string;
  boleto_url: string | null;
  tentativas_cobranca: number;
  data_ultimo_contato: string | null;
  notas_cobranca: string | null;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
    cnpj: string | null;
    email: string | null;
    telefone: string | null;
  };
  processo?: {
    id: string;
    tipo: string;
    razao_social: string;
  };
}

export interface ValorAdicionalSimple {
  id: string;
  processo_id: string;
  descricao: string;
  valor: number;
}

export function diasAtraso(dataVencimento: string, status: string): number {
  if (status === 'pago') return 0;
  const venc = new Date(dataVencimento + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function useLancamentosReceber(dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: ['lancamentos_receber', dataInicio, dataFim],
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*, cliente:clientes(id, nome, cnpj, email, telefone), processo:processos(id, tipo, razao_social)')
        .eq('tipo', 'receber')
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim)
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return (data || []) as LancamentoReceber[];
    },
  });
}

export function useValoresAdicionaisBatch(processoIds: string[]) {
  return useQuery({
    queryKey: ['valores_adicionais_batch', processoIds],
    queryFn: async () => {
      if (!processoIds.length) return {} as Record<string, ValorAdicionalSimple[]>;
      const { data, error } = await supabase
        .from('valores_adicionais')
        .select('id, processo_id, descricao, valor')
        .in('processo_id', processoIds);
      if (error) throw error;
      const grouped: Record<string, ValorAdicionalSimple[]> = {};
      (data || []).forEach(t => {
        if (!grouped[t.processo_id]) grouped[t.processo_id] = [];
        grouped[t.processo_id].push(t as ValorAdicionalSimple);
      });
      return grouped;
    },
    enabled: processoIds.length > 0,
  });
}

export function useMarcarRecebido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data_pagamento, comprovante_url }: { id: string; data_pagamento: string; comprovante_url?: string | null }) => {
      const { error } = await supabase.from('lancamentos').update({
        status: 'pago',
        data_pagamento,
        comprovante_url: comprovante_url || null,
        confirmado_recebimento: true,
        updated_at: new Date().toISOString(),
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos_receber'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Recebimento confirmado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarcarRecebidoLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, data_pagamento }: { ids: string[]; data_pagamento: string }) => {
      const { error } = await supabase.from('lancamentos').update({
        status: 'pago',
        data_pagamento,
        confirmado_recebimento: true,
        updated_at: new Date().toISOString(),
      } as any).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos_receber'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Pagamentos confirmados em lote!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRegistrarContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, meio, observacao, tentativas_atual, notas_atual }: {
      id: string;
      meio: string;
      observacao: string;
      tentativas_atual: number;
      notas_atual: string | null;
    }) => {
      const hoje = new Date().toLocaleDateString('pt-BR');
      const novaLinha = `${hoje} - ${meio}: ${observacao}`;
      const notasNovas = notas_atual ? `${novaLinha}\n${notas_atual}` : novaLinha;
      const { error } = await supabase.from('lancamentos').update({
        tentativas_cobranca: (tentativas_atual || 0) + 1,
        data_ultimo_contato: new Date().toISOString().split('T')[0],
        notas_cobranca: notasNovas,
        updated_at: new Date().toISOString(),
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos_receber'] });
      toast.success('Contato registrado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
