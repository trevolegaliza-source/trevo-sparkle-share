import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Avaliacao {
  id: string;
  colaborador_id: string;
  mes: number;
  ano: number;
  feedback: string | null;
  conclusao_trimestral: string | null;
  created_at: string;
  updated_at: string;
}

export function useAvaliacoes(colaboradorId: string | null) {
  return useQuery({
    queryKey: ['avaliacoes', colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('colaborador_avaliacoes')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });
      if (error) throw error;
      return data as Avaliacao[];
    },
  });
}

export function useUpsertAvaliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { colaborador_id: string; mes: number; ano: number; feedback?: string; conclusao_trimestral?: string }) => {
      const { data, error } = await (supabase as any)
        .from('colaborador_avaliacoes')
        .upsert({
          ...input,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'colaborador_id,mes,ano' })
        .select()
        .single();
      if (error) throw error;
      return data as Avaliacao;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['avaliacoes', vars.colaborador_id] });
      toast.success('Avaliação salva!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
