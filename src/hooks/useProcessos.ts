import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KanbanStage, ProcessType } from '@/types/process';
import { toast } from 'sonner';

export interface ProcessoDB {
  id: string;
  cliente_id: string;
  razao_social: string;
  tipo: ProcessType;
  etapa: KanbanStage;
  prioridade: string;
  responsavel: string | null;
  valor: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
    codigo_identificador: string;
    tipo: string;
    nome_contador: string | null;
    apelido: string | null;
  };
}

export function useProcessosDB() {
  return useQuery({
    queryKey: ['processos_db'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProcessoDB[];
    },
  });
}

export function useUpdateProcessoEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: KanbanStage }) => {
      const { error } = await supabase
        .from('processos')
        .update({ etapa, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related lancamentos first to avoid FK constraint
      const { error: lancError } = await supabase
        .from('lancamentos')
        .delete()
        .eq('processo_id', id);
      if (lancError) throw lancError;

      const { error } = await supabase
        .from('processos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast.success('Processo excluído com sucesso');
    },
    onError: (e: Error) => toast.error('Erro ao excluir: ' + e.message),
  });
}

export function useClientesDB() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfMonthDate = startOfMonth.split('T')[0];

      const { count: processosAtivos } = await supabase
        .from('processos')
        .select('*', { count: 'exact', head: true })
        .not('etapa', 'in', '("finalizados","arquivo")');

      const { count: totalClientes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true });

      // Faturamento realizado (paid this month)
      const { data: fatRealizadoData } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .eq('status', 'pago')
        .gte('data_vencimento', startOfMonthDate);
      const faturamentoRealizado = (fatRealizadoData || []).reduce((s, r) => s + Number(r.valor), 0);

      // Faturamento total do mês (all receivables)
      const { data: fatTotalData } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .gte('created_at', startOfMonth);
      const faturamentoMes = (fatTotalData || []).reduce((s, r) => s + Number(r.valor), 0);

      // Faturamento potencial
      const { data: allActiveProcs } = await supabase
        .from('processos')
        .select('id, cliente_id, valor, cliente:clientes(*)')
        .not('etapa', 'in', '("finalizados","arquivo")');

      let faturamentoPotencial = 0;
      if (allActiveProcs && allActiveProcs.length > 0) {
        const procIds = allActiveProcs.map(p => p.id);
        const { data: existingLanc } = await supabase
          .from('lancamentos')
          .select('processo_id')
          .eq('tipo', 'receber')
          .in('processo_id', procIds);
        const billedIds = new Set((existingLanc || []).map(l => l.processo_id));

        for (const proc of allActiveProcs) {
          const momento = (proc.cliente as any)?.momento_faturamento;
          if (momento === 'no_deferimento' && !billedIds.has(proc.id)) {
            faturamentoPotencial += Number(proc.valor) || 0;
          }
        }
      }

      // COBRANÇAS A GERAR: lancamentos in 'solicitacao_criada' stage + processos in registro/finalizados without billing
      const { data: cobrancasGerar } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .eq('etapa_financeiro', 'solicitacao_criada');
      let totalCobrancasGerar = (cobrancasGerar || []).reduce((s, r) => s + Number(r.valor), 0);

      // Also add processos in registro/finalizados stages
      const { data: procsRegistro } = await supabase
        .from('processos')
        .select('id, valor')
        .in('etapa', ['registro', 'finalizados']);
      if (procsRegistro && procsRegistro.length > 0) {
        const regIds = procsRegistro.map(p => p.id);
        const { data: existingBilled } = await supabase
          .from('lancamentos')
          .select('processo_id')
          .eq('tipo', 'receber')
          .in('processo_id', regIds);
        const billedSet = new Set((existingBilled || []).map(l => l.processo_id));
        for (const p of procsRegistro) {
          if (!billedSet.has(p.id)) {
            totalCobrancasGerar += Number(p.valor) || 0;
          }
        }
      }

      // Also count processos without lancamento (they default to solicitacao_criada)

      // VALORES REEMBOLSÁVEIS: sum of all valores_adicionais not yet paid
      const { data: valoresReemb } = await supabase
        .from('valores_adicionais')
        .select('valor');
      const totalValoresReembolsaveis = (valoresReemb || []).reduce((s, r) => s + Number(r.valor), 0);

      const { data: urgentes } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .eq('prioridade', 'urgente')
        .not('etapa', 'in', '("finalizados","arquivo")');

      const { data: recentes } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false })
        .limit(6);

      // Pipeline counts and values by stage
      const { data: allProcessos } = await supabase
        .from('processos')
        .select('id, etapa, cliente_id, valor, cliente:clientes(nome, apelido, valor_base)')
        .not('etapa', 'in', '("finalizados","arquivo")');

      const pipelineCounts: Record<string, number> = {};
      const pipelineValues: Record<string, number> = {};
      (allProcessos || []).forEach((p: any) => {
        pipelineCounts[p.etapa] = (pipelineCounts[p.etapa] || 0) + 1;
        const val = Number(p.valor) || Number((p.cliente as any)?.valor_base) || 0;
        pipelineValues[p.etapa] = (pipelineValues[p.etapa] || 0) + val;
      });

      // Top clientes by financial volume this month
      const { data: lancMes } = await supabase
        .from('lancamentos')
        .select('cliente_id, valor, cliente:clientes(nome, apelido)')
        .eq('tipo', 'receber')
        .gte('created_at', startOfMonth);

      const clientFinancials: Record<string, { nome: string; apelido: string | null; total: number }> = {};
      (lancMes || []).forEach((l: any) => {
        const nome = l.cliente?.nome || 'Desconhecido';
        const apelido = l.cliente?.apelido || null;
        if (!clientFinancials[l.cliente_id]) clientFinancials[l.cliente_id] = { nome, apelido, total: 0 };
        clientFinancials[l.cliente_id].total += Number(l.valor);
      });
      const topClientes = Object.entries(clientFinancials)
        .map(([id, v]) => ({ id, nome: v.apelido || v.nome, total: v.total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // SLA proximity
      const { data: slaProcs } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .not('etapa', 'in', '("finalizados","arquivo")')
        .order('created_at', { ascending: true })
        .limit(3);

      // Contas a Pagar do mês (pendentes)
      const { data: contasPagarData } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'pagar')
        .eq('status', 'pendente')
        .gte('data_vencimento', startOfMonth);
      const contasPagarMes = (contasPagarData || []).reduce((s: number, r: any) => s + Number(r.valor), 0);

      return {
        processosAtivos: processosAtivos || 0,
        totalClientes: totalClientes || 0,
        faturamentoMes,
        faturamentoRealizado,
        faturamentoPotencial,
        totalCobrancasGerar,
        totalValoresReembolsaveis,
        contasPagarMes,
        urgentes: (urgentes || []) as ProcessoDB[],
        recentes: (recentes || []) as ProcessoDB[],
        topClientes,
        pipelineCounts,
        pipelineValues,
        slaProximos: (slaProcs || []) as ProcessoDB[],
      };
    },
  });
}
