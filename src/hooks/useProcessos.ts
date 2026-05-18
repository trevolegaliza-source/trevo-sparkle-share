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

// DECISION-001 Fase 3 (13/05/2026): useUpdateProcessoEtapa removido junto
// com Processos.tsx (kanban). Etapa virou binária no banco — mudança de
// etapa hoje só acontece via RPC (marcar_processo_pago, desfazer_marcar_pago,
// marcar_pago_em_lote) que setam 'finalizado' ou 'ativo' atomicamente.

export function useDeleteProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // 15/05/2026: NAO deletar lancamentos manualmente aqui — RLS
      // lancamentos_delete_role so permite master, entao operacional
      // ficava bloqueado. Solucao: FK lancamentos.processo_id agora e
      // ON DELETE CASCADE (docs/sql/fix-fk-lancamentos-processo-cascade.sql)
      // e cascade roda no engine bypassando RLS. Junction cobrancas_lancamentos
      // tambem ja era CASCADE — sai junto. Cobranca propria fica preservada
      // (lancamento_id vira NULL).

      // Bloqueia se houver documentos ou valores_adicionais (FK RESTRICT).
      // Mostra mensagem clara em vez de erro tecnico de FK.
      const { count: docsCount } = await supabase
        .from('documentos')
        .select('id', { count: 'exact', head: true })
        .eq('processo_id', id);
      if ((docsCount ?? 0) > 0) {
        throw new Error(`Processo tem ${docsCount} documento(s) anexado(s). Remova os documentos antes de excluir.`);
      }
      const { count: vaCount } = await supabase
        .from('valores_adicionais')
        .select('id', { count: 'exact', head: true })
        .eq('processo_id', id);
      if ((vaCount ?? 0) > 0) {
        throw new Error(`Processo tem ${vaCount} valor(es) adicional(is). Remova antes de excluir.`);
      }

      // .select() no DELETE confirma que algo foi deletado de fato.
      // Sem isso, RLS bloqueando silenciosamente retorna error=null + 0 rows,
      // e o onSuccess dispara toast "excluído com sucesso" mentindo
      // (CODE-009 jogou DELETE pra master-only — operacional/gerente tomam RLS).
      const { data, error } = await supabase
        .from('processos')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Sem permissão para excluir esse processo. Apenas o master pode excluir.');
      }
    },
    onSuccess: () => {
      // Invalida tudo que pode estar mostrando o processo/lancamento deletados
      // BUG 14/05/2026: antes invalidava só processos_db e dashboard_stats.
      // Financeiro/Clientes ficavam stale → processo "fantasma" na tela.
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] });
      qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
      qc.invalidateQueries({ queryKey: ['cliente_processos'] });
      qc.invalidateQueries({ queryKey: ['cliente_lancamentos'] });
      qc.invalidateQueries({ queryKey: ['cliente_financeiro'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['cobrancas'] });
      qc.invalidateQueries({ queryKey: ['hoje-data'] });
      qc.invalidateQueries({ queryKey: ['mrr-data'] });
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
        .not('etapa', 'in', '("finalizado","finalizados","arquivo","concluido")');

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
        .not('etapa', 'in', '("finalizado","finalizados","arquivo","concluido")');

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

      // DECISION-001 Fase 3: deferidos identificados por data_deferimento
      // (não mais por etapa específica — banco migrou pra binário).
      const { data: procsRegistro } = await supabase
        .from('processos')
        .select('id, valor')
        .not('data_deferimento', 'is', null);
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
        .not('etapa', 'in', '("finalizado","finalizados","arquivo","concluido")');

      const { data: recentes } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false })
        .limit(6);

      // Pipeline counts and values by stage
      const { data: allProcessos } = await supabase
        .from('processos')
        .select('id, etapa, cliente_id, valor, cliente:clientes(nome, apelido, valor_base)')
        .not('etapa', 'in', '("finalizado","finalizados","arquivo","concluido")');

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
        .not('etapa', 'in', '("finalizado","finalizados","arquivo","concluido")')
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
