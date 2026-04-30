import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ValorAdicional {
  id: string;
  processo_id: string;
  descricao: string;
  valor: number;
  anexo_url: string | null;
  comprovante_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useValoresAdicionais(processoId: string) {
  return useQuery({
    queryKey: ['valores_adicionais', processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('valores_adicionais')
        .select('*')
        .eq('processo_id', processoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ValorAdicional[];
    },
    enabled: !!processoId,
  });
}

export function useAddValorAdicional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { processo_id: string; descricao: string; valor: number; anexo_url?: string }) => {
      const { error } = await supabase.from('valores_adicionais').insert(item);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['valores_adicionais', vars.processo_id] });
      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_receber'] });
      qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateValorAdicional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, processo_id, updates }: { id: string; processo_id: string; updates: Partial<ValorAdicional> }) => {
      const { error } = await supabase
        .from('valores_adicionais')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['valores_adicionais', vars.processo_id] });
      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_receber'] });
      qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteValorAdicional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, processo_id }: { id: string; processo_id: string }) => {
      const { error } = await supabase.from('valores_adicionais').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['valores_adicionais', vars.processo_id] });
      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_receber'] });
      qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
