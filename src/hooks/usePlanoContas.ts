import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlanoContas {
  id: string;
  empresa_id: string | null;
  codigo: string;
  nome: string;
  tipo: string;
  grupo: string;
  subgrupo: string | null;
  centro_custo: string | null;
  ativo: boolean;
  parent_id: string | null;
  created_at: string | null;
}

export function usePlanoContas() {
  return useQuery({
    queryKey: ['plano_contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_contas')
        .select('*')
        .order('codigo');
      if (error) throw error;
      return (data || []) as unknown as PlanoContas[];
    },
  });
}

export function useSaveConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conta: Partial<PlanoContas> & { id?: string }) => {
      const { id, ...rest } = conta;
      if (id) {
        const { error } = await supabase.from('plano_contas').update(rest as any).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('plano_contas').insert(rest as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plano_contas'] });
      toast.success('Conta salva');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}

export function useDeleteConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plano_contas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plano_contas'] });
      toast.success('Conta excluída');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}
