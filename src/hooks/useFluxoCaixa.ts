import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, startOfDay, endOfDay, format, endOfWeek, isWithinInterval, eachWeekOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface SemanaFluxo {
  label: string;
  inicio: Date;
  fim: Date;
  entradas: number;
  saidas: number;
  saldoProjetado: number;
}

export interface FluxoCaixaData {
  semanas: SemanaFluxo[];
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  dailyData: { date: string; entradas: number; saidas: number; saldo: number }[];
}

export function useFluxoCaixa(horizonte: number = 30, incluirRecorrentes: boolean = true) {
  return useQuery({
    queryKey: ['fluxo-caixa', horizonte, incluirRecorrentes],
    queryFn: async (): Promise<FluxoCaixaData> => {
      const hoje = startOfDay(new Date());
      const fim = endOfDay(addDays(hoje, horizonte));
      const fimStr = format(fim, 'yyyy-MM-dd');
      const hojeStr = format(hoje, 'yyyy-MM-dd');

      // Fetch pending receivables
      const { data: receber } = await supabase
        .from('lancamentos')
        .select('valor, data_vencimento')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', fimStr);

      // Fetch pending payables
      const { data: pagar } = await supabase
        .from('lancamentos')
        .select('valor, data_vencimento')
        .eq('tipo', 'pagar')
        .eq('status', 'pendente')
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', fimStr);

      // Fetch recurring expenses
      let recorrentes: { valor: number; dia_vencimento: number }[] = [];
      if (incluirRecorrentes) {
        const { data } = await supabase
          .from('despesas_recorrentes')
          .select('valor, dia_vencimento')
          .eq('ativo', true);
        recorrentes = data || [];
      }

      // Build daily map
      const dailyMap = new Map<string, { entradas: number; saidas: number }>();

      // Init all days
      for (let i = 0; i <= horizonte; i++) {
        const d = format(addDays(hoje, i), 'yyyy-MM-dd');
        dailyMap.set(d, { entradas: 0, saidas: 0 });
      }

      // Add receivables
      (receber || []).forEach(l => {
        const key = l.data_vencimento;
        const entry = dailyMap.get(key);
        if (entry) entry.entradas += Number(l.valor);
      });

      // Add payables
      (pagar || []).forEach(l => {
        const key = l.data_vencimento;
        const entry = dailyMap.get(key);
        if (entry) entry.saidas += Number(l.valor);
      });

      // Project recurring expenses into future months
      if (incluirRecorrentes && recorrentes.length > 0) {
        for (let i = 0; i <= horizonte; i++) {
          const d = addDays(hoje, i);
          const dayOfMonth = d.getDate();
          const key = format(d, 'yyyy-MM-dd');
          recorrentes.forEach(r => {
            if (r.dia_vencimento === dayOfMonth) {
              const entry = dailyMap.get(key);
              if (entry) entry.saidas += Number(r.valor);
            }
          });
        }
      }

      // Build daily cumulative data
      let acumEntradas = 0;
      let acumSaidas = 0;
      const dailyData: FluxoCaixaData['dailyData'] = [];
      const sortedDays = Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      
      for (const [date, vals] of sortedDays) {
        acumEntradas += vals.entradas;
        acumSaidas += vals.saidas;
        dailyData.push({
          date,
          entradas: acumEntradas,
          saidas: acumSaidas,
          saldo: acumEntradas - acumSaidas,
        });
      }

      // Build weekly summary
      const intervalo = { start: hoje, end: fim };
      const weekStarts = eachWeekOfInterval(intervalo, { weekStartsOn: 1 });
      const semanas: SemanaFluxo[] = weekStarts.map(ws => {
        const we = endOfWeek(ws, { weekStartsOn: 1 });
        const weFinal = we > fim ? fim : we;
        let entradas = 0;
        let saidas = 0;

        for (const [date, vals] of sortedDays) {
          const d = new Date(date + 'T12:00:00');
          if (isWithinInterval(d, { start: ws, end: weFinal })) {
            entradas += vals.entradas;
            saidas += vals.saidas;
          }
        }

        return {
          label: `${format(ws, 'dd/MM', { locale: ptBR })} - ${format(weFinal, 'dd/MM', { locale: ptBR })}`,
          inicio: ws,
          fim: weFinal,
          entradas,
          saidas,
          saldoProjetado: entradas - saidas,
        };
      });

      const totalEntradas = sortedDays.reduce((s, [, v]) => s + v.entradas, 0);
      const totalSaidas = sortedDays.reduce((s, [, v]) => s + v.saidas, 0);

      return {
        semanas,
        totalEntradas,
        totalSaidas,
        saldoFinal: totalEntradas - totalSaidas,
        dailyData,
      };
    },
  });
}
