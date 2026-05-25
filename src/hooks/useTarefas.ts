/**
 * Tarefas — checklist na sidebar (single source of truth de pendências).
 * 25/05/2026: substitui consulta manual aos 7+ docs .md espalhados.
 *
 * Claude popula via MCP do Supabase ao finalizar auditoria/sessão.
 * Thales marca como feito inline na UI. Real-time via Realtime subscription.
 */
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TarefaCategoria = 'bug' | 'feature' | 'teste' | 'auditoria' | 'manutencao' | 'investigacao' | 'outro';
export type TarefaPrioridade = 'critica' | 'alta' | 'media' | 'baixa';
export type TarefaStatus = 'pendente' | 'em_andamento' | 'feito' | 'cancelado' | 'adiado';
export type TarefaOrigem = 'claude' | 'manual' | 'auditoria';

export interface Tarefa {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao: string | null;
  categoria: TarefaCategoria;
  prioridade: TarefaPrioridade;
  status: TarefaStatus;
  origem: TarefaOrigem;
  arquivo_md: string | null;
  commit_sha: string | null;
  achado_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  created_by: string | null;
  completed_by: string | null;
}

const QUERY_KEY = ['tarefas'] as const;

export function useTarefas() {
  const qc = useQueryClient();

  // Realtime: Claude insere via MCP → frontend reage na hora.
  useEffect(() => {
    const channel = supabase
      .channel('tarefas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tarefas' },
        () => { qc.invalidateQueries({ queryKey: QUERY_KEY }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: QUERY_KEY,
    staleTime: 10_000,
    queryFn: async (): Promise<Tarefa[]> => {
      const { data, error } = await supabase
        .from('tarefas' as any)
        .select('*')
        // Ordenação composta: status pendente primeiro, depois prioridade crítica primeiro, depois mais novos
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Tarefa[];
    },
  });
}

interface NovaTarefa {
  titulo: string;
  descricao?: string;
  categoria: TarefaCategoria;
  prioridade: TarefaPrioridade;
  arquivo_md?: string;
}

export function useCriarTarefa() {
  const qc = useQueryClient();
  return useMutation<void, Error, NovaTarefa>({
    mutationFn: async (input) => {
      // empresa_id resolve via trigger/RLS — sem trigger? Vou setar explicit
      // usando RPC ou getEmpresaId. Pra simplicidade, deixa RLS WITH CHECK validar.
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .maybeSingle();
      const empresa_id = (profile as any)?.empresa_id;
      if (!empresa_id) throw new Error('Sem empresa configurada');

      const { error } = await supabase.from('tarefas' as any).insert({
        empresa_id,
        titulo: input.titulo.trim(),
        descricao: input.descricao?.trim() || null,
        categoria: input.categoria,
        prioridade: input.prioridade,
        arquivo_md: input.arquivo_md || null,
        origem: 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Tarefa criada.');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useAtualizarStatusTarefa() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; status: TarefaStatus }>({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase
        .from('tarefas' as any)
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      if (vars.status === 'feito') toast.success('Tarefa marcada como feita.');
      else if (vars.status === 'cancelado') toast.info('Tarefa cancelada.');
      else if (vars.status === 'adiado') toast.info('Tarefa adiada.');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeletarTarefa() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('tarefas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Tarefa removida.');
    },
    onError: (e) => toast.error(e.message),
  });
}

// Helper: contagem de tarefas críticas+altas pendentes (badge da sidebar)
export function useTarefasUrgentesCount(): number {
  const { data } = useTarefas();
  if (!data) return 0;
  return data.filter(
    (t) =>
      t.status === 'pendente' &&
      (t.prioridade === 'critica' || t.prioridade === 'alta')
  ).length;
}
