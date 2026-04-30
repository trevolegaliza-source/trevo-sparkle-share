import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Colaborador {
  id: string;
  nome: string;
  email: string | null;
  regime: 'CLT' | 'PJ' | 'INDEFINIDO';
  salario_base: number;
  vt_diario: number;
  vr_diario: number;
  status: 'ativo' | 'inativo';
  adiantamento_tipo: 'percentual' | 'fixo';
  adiantamento_valor: number;
  possui_adiantamento: boolean;
  dia_pagamento_integral: number | null;
  pix_tipo: string | null;
  pix_chave: string | null;
  valor_das: number;
  aumento_previsto_valor: number | null;
  aumento_previsto_data: string | null;
  data_inicio: string | null;
  aniversario: string | null;
  // Payment rule fields
  dia_adiantamento: number;
  dia_salario: number;
  dia_vt_vr: number;
  dia_das: number;
  fgts_percentual: number;
  inss_patronal_percentual: number;
  provisionar_13: boolean;
  provisionar_ferias: boolean;
  observacoes_pagamento: string | null;
  tipo_transporte: 'vt' | 'auxilio_combustivel';
  auxilio_combustivel_valor: number;
  trello_username: string | null;
  created_at: string;
  updated_at: string;
}

export function useColaboradores() {
  return useQuery({
    queryKey: ['colaboradores'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('colaboradores')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Colaborador[];
    },
  });
}

export function useCreateColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Colaborador, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await (supabase as any)
        .from('colaboradores')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Colaborador;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success('Colaborador cadastrado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Colaborador> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('colaboradores')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Colaborador;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success('Colaborador atualizado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('colaboradores')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success('Colaborador excluído!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
