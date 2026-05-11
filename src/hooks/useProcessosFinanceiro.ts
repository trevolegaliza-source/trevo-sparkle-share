import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProcessoDB, EtapaFinanceiro, Lancamento } from '@/types/financial';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface ProcessoFinanceiro extends ProcessoDB {
  lancamento?: Lancamento | null;
  etapa_financeiro: EtapaFinanceiro;
}

/** Fetch all non-archived processos with their first 'receber' lancamento */
export function useProcessosFinanceiro() {
  const qc = useQueryClient();

  // Realtime subscription for sync
  useEffect(() => {
    const channel = supabase
      .channel('financeiro_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processos' }, () => {
        qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, () => {
        qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
        qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'valores_adicionais' }, () => {
        qc.invalidateQueries({ queryKey: ['valores_adicionais'] });
        qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: ['processos_financeiro'],
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const { data: processos, error: pErr } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;

      const { data: lancamentos, error: lErr } = await supabase
        .from('lancamentos')
        .select('*, cliente:clientes(*)')
        .eq('tipo', 'receber');
      if (lErr) throw lErr;

      const lancMap = new Map<string, any>();
      (lancamentos || []).forEach((l: any) => {
        if (!lancMap.has(l.processo_id)) {
          lancMap.set(l.processo_id, l);
        }
      });

      const today = new Date().toISOString().split('T')[0];

      return ((processos || []) as ProcessoDB[])
        .filter((p) => !(p as any).is_archived)
        .map((p): ProcessoFinanceiro => {
          const lanc = lancMap.get(p.id) || null;

          let etapa: EtapaFinanceiro = 'solicitacao_criada';
          if (lanc) {
            etapa = lanc.etapa_financeiro || 'solicitacao_criada';
            if (
              lanc.status !== 'pago' &&
              etapa !== 'honorario_vencido' &&
              etapa !== 'honorario_pago' &&
              lanc.data_vencimento < today
            ) {
              etapa = 'honorario_vencido';
            }
          }

          return { ...p, lancamento: lanc, etapa_financeiro: etapa };
        });
    },
  });
}

// REMOVIDO 11/05/2026 (REL-009) — `useMoveEtapaFinanceiro` era código morto
// (zero importações em todo o repo) e era o único caminho do front que escrevia
// `processos.etapa = 'concluido'`. Ele tinha um bug latente: o INSERT do
// lancamento e o UPDATE da etapa do processo NÃO eram atômicos — se o INSERT
// falhasse silenciosamente OU o lancamento fosse deletado depois, o processo
// ficava em 'concluido' SEM lancamento (estado zumbi).
//
// Caso histórico real (consertado): processo SEPI/ASLAN
// (id 201233c9-71aa-47f5-8e2f-444ca48e09e3) ficou zumbi e não aparecia no
// Financeiro. Auditoria via SQL confirmou n=1 no banco inteiro — não é bug
// sistêmico ativo, mas o código morto era uma arma carregada. Removido para
// fechar essa porta. Sentinela: view `public.processos_zombies` no banco
// (MON-001) lista qualquer processo em etapa 'concluido' / 'finalizados' sem
// lancamento — checar periodicamente.

/** Update lancamento fields */
export function useUpdateLancamentoFinanceiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      processoId,
      lancamentoId,
      clienteId,
      valor,
      updates,
    }: {
      processoId: string;
      lancamentoId?: string;
      clienteId: string;
      valor: number;
      updates: Record<string, any>;
    }) => {
      if (lancamentoId) {
        const { error } = await supabase
          .from('lancamentos')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', lancamentoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lancamentos').insert({
          tipo: 'receber' as const,
          cliente_id: clienteId,
          processo_id: processoId,
          descricao: 'Lançamento automático',
          valor,
          status: 'pendente' as const,
          data_vencimento: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
          etapa_financeiro: 'solicitacao_criada',
          ...updates,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
