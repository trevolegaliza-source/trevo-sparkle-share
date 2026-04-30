import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard_data'],
    queryFn: async () => {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const inicioMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const fimMesAnt = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      const seisMesesAtras = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
      const seteDiasFrente = new Date();
      seteDiasFrente.setDate(seteDiasFrente.getDate() + 7);

      const [
        { data: lancMes },
        { data: lancMesAnt },
        { data: processos },
        { data: proxVenc },
        { data: lancHist },
        { data: lancPagar },
      ] = await Promise.all([
        supabase
          .from('lancamentos')
          .select('id, valor, status, confirmado_recebimento, data_pagamento, data_vencimento, etapa_financeiro, extrato_id, cliente_id, clientes(nome, apelido)')
          .eq('tipo', 'receber')
          .gte('data_vencimento', inicioMes),
        supabase
          .from('lancamentos')
          .select('id, valor, status, confirmado_recebimento')
          .eq('tipo', 'receber')
          .gte('data_vencimento', inicioMesAnt)
          .lte('data_vencimento', fimMesAnt),
        supabase
          .from('processos')
          .select('id, etapa, created_at, updated_at, cliente_id')
          .neq('is_archived', true),
        supabase
          .from('lancamentos')
          .select('id, valor, data_vencimento, cliente_id, clientes(nome, apelido)')
          .eq('tipo', 'receber')
          .in('status', ['pendente', 'atrasado'])
          .gte('data_vencimento', new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0])
          .lte('data_vencimento', seteDiasFrente.toISOString().split('T')[0])
          .order('data_vencimento', { ascending: true })
          .limit(10),
        supabase
          .from('lancamentos')
          .select('id, valor, status, confirmado_recebimento, data_vencimento, created_at')
          .eq('tipo', 'receber')
          .gte('data_vencimento', seisMesesAtras),
        supabase
          .from('lancamentos')
          .select('id, valor, data_vencimento, status, descricao')
          .eq('tipo', 'pagar')
          .in('status', ['pendente', 'atrasado'])
          .order('data_vencimento', { ascending: true }),
      ]);

      return {
        lancamentosMes: lancMes || [],
        lancamentosMesAnterior: lancMesAnt || [],
        processos: processos || [],
        proximosVencimentos: proxVenc || [],
        lancamentosHistorico: lancHist || [],
        lancamentosPagar: lancPagar || [],
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCountUp(target: number, duration = 800): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const startTime = performance.now();
    let raf: number;
    function update(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(update);
    }
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return count;
}
