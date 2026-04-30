import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, addDays, format, subMonths } from 'date-fns';

function getSaudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getNomeUsuario(email: string | undefined, profileName?: string | null): string {
  if (profileName) return profileName;
  if (!email) return '';
  const parte = email.split('@')[0];
  const nome = parte.charAt(0).toUpperCase() + parte.slice(1).replace(/[._-]/g, ' ');
  return nome.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function abreviar(valor: number): string {
  if (Math.abs(valor) >= 1000) return `R$ ${(valor / 1000).toFixed(1)}k`;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function variacao(atual: number, anterior: number): { texto: string; positivo: boolean } {
  if (anterior === 0) return { texto: atual > 0 ? '↑ 100%' : '—', positivo: atual >= 0 };
  const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
  return { texto: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%`, positivo: pct >= 0 };
}

export { getSaudacao, getNomeUsuario, abreviar, variacao };

export function useLucroMensal(mes: number, ano: number) {
  return useQuery({
    queryKey: ['dashboard_lucro', mes, ano],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd');

      const { data: receber } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .eq('status', 'pago')
        .gte('data_pagamento', inicio)
        .lte('data_pagamento', fim);

      const { data: pagar } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'pagar')
        .eq('status', 'pago')
        .gte('data_pagamento', inicio)
        .lte('data_pagamento', fim);

      const receita = (receber || []).reduce((s, l) => s + Number(l.valor), 0);
      const despesa = (pagar || []).reduce((s, l) => s + Number(l.valor), 0);
      return { receita, despesa, lucro: receita - despesa };
    },
  });
}

export function useLucroMesAnterior(mes: number, ano: number) {
  const prev = subMonths(new Date(ano, mes - 1, 1), 1);
  return useLucroMensal(prev.getMonth() + 1, prev.getFullYear());
}

export function useAReceberMes(mes: number, ano: number) {
  return useQuery({
    queryKey: ['dashboard_a_receber', mes, ano],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd');
      const hoje = format(new Date(), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('lancamentos')
        .select('id, valor, data_vencimento, status')
        .eq('tipo', 'receber')
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim);

      const items = data || [];
      const total = items.reduce((s, l) => s + Number(l.valor), 0);
      const vencidos = items.filter(l => l.data_vencimento < hoje);
      const vencidosTotal = vencidos.reduce((s, l) => s + Number(l.valor), 0);

      return { total, count: items.length, vencidosCount: vencidos.length, vencidosTotal };
    },
  });
}

export function useAPagarMes(mes: number, ano: number) {
  return useQuery({
    queryKey: ['dashboard_a_pagar', mes, ano],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd');
      const hoje = format(new Date(), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('lancamentos')
        .select('id, valor, data_vencimento, status')
        .eq('tipo', 'pagar')
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim);

      const items = data || [];
      const total = items.reduce((s, l) => s + Number(l.valor), 0);
      const vencidos = items.filter(l => l.data_vencimento < hoje);

      return { total, count: items.length, vencidosCount: vencidos.length };
    },
  });
}

export function useTicketMedio(mes: number, ano: number) {
  return useQuery({
    queryKey: ['dashboard_ticket', mes, ano],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim);

      const items = data || [];
      const soma = items.reduce((s, l) => s + Number(l.valor), 0);
      return { ticket: items.length > 0 ? soma / items.length : 0, count: items.length };
    },
  });
}

export function useAgendaSemana() {
  return useQuery({
    queryKey: ['dashboard_agenda'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const em7dias = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      const { data: pagar } = await supabase
        .from('lancamentos')
        .select('*, cliente:clientes(nome, apelido), processo:processos(tipo, razao_social)')
        .eq('tipo', 'pagar')
        .eq('status', 'pendente')
        .gte('data_vencimento', hoje)
        .lte('data_vencimento', em7dias)
        .order('data_vencimento', { ascending: true });

      const { data: receber } = await supabase
        .from('lancamentos')
        .select('*, cliente:clientes(nome, apelido), processo:processos(tipo, razao_social)')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .gte('data_vencimento', hoje)
        .lte('data_vencimento', em7dias)
        .order('data_vencimento', { ascending: true });

      return { pagar: pagar || [], receber: receber || [] };
    },
  });
}

export function useInadimplenciaDashboard() {
  return useQuery({
    queryKey: ['dashboard_inadimplencia'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('lancamentos')
        .select('*, cliente:clientes(nome, apelido)')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .lt('data_vencimento', hoje)
        .order('data_vencimento', { ascending: true })
        .limit(5);

      const items = (data || []).map(l => {
        const diasAtraso = Math.floor((Date.now() - new Date(l.data_vencimento).getTime()) / 86400000);
        return { ...l, diasAtraso };
      });

      const totalValor = items.reduce((s, l) => s + Number(l.valor), 0);

      return { items, totalValor };
    },
  });
}

export function useProcessosParados() {
  return useQuery({
    queryKey: ['dashboard_processos_parados'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('processos')
        .select('*, cliente:clientes(nome, apelido)')
        .not('etapa', 'in', '("finalizados","arquivo")')
        .neq('is_archived', true)
        .order('updated_at', { ascending: true })
        .limit(50);

      const items = (data || [])
        .map(p => {
          const diasParado = Math.floor((Date.now() - new Date(p.updated_at || p.created_at || '').getTime()) / 86400000);
          return { ...p, diasParado };
        })
        .filter(p => p.diasParado >= 5)
        .sort((a, b) => b.diasParado - a.diasParado)
        .slice(0, 5);

      return items;
    },
  });
}

export function useRankingFaturamento(mes: number, ano: number) {
  return useQuery({
    queryKey: ['dashboard_ranking_fat', mes, ano],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('lancamentos')
        .select('valor, cliente_id, cliente:clientes(nome, apelido)')
        .eq('tipo', 'receber')
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim);

      const grouped: Record<string, { nome: string; total: number; clienteId: string }> = {};
      (data || []).forEach(l => {
        if (!l.cliente_id) return;
        const key = l.cliente_id;
        if (!grouped[key]) {
          const c = l.cliente as any;
          grouped[key] = { nome: c?.apelido || c?.nome || 'Sem nome', total: 0, clienteId: key };
        }
        grouped[key].total += Number(l.valor);
      });

      return Object.values(grouped).sort((a, b) => b.total - a.total).slice(0, 5);
    },
  });
}

export function useRankingVolume(mes: number, ano: number) {
  return useQuery({
    queryKey: ['dashboard_ranking_vol', mes, ano],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inicio = startOfMonth(new Date(ano, mes - 1, 1)).toISOString();
      const fim = endOfMonth(new Date(ano, mes - 1, 1)).toISOString();

      const { data } = await supabase
        .from('processos')
        .select('id, cliente_id, cliente:clientes(nome, apelido)')
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .neq('is_archived', true);

      const grouped: Record<string, { nome: string; count: number; clienteId: string }> = {};
      (data || []).forEach(p => {
        const key = p.cliente_id;
        if (!grouped[key]) {
          const c = p.cliente as any;
          grouped[key] = { nome: c?.apelido || c?.nome || 'Sem nome', count: 0, clienteId: key };
        }
        grouped[key].count++;
      });

      return Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 5);
    },
  });
}

export function useResultadoMes(mes: number, ano: number) {
  return useQuery({
    queryKey: ['dashboard_resultado', mes, ano],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd');

      const { data: receber } = await supabase
        .from('lancamentos')
        .select('valor, processo:processos(tipo)')
        .eq('tipo', 'receber')
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim);

      const { data: pagar } = await supabase
        .from('lancamentos')
        .select('valor, categoria')
        .eq('tipo', 'pagar')
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim);

      const receitaPorTipo: Record<string, number> = {};
      (receber || []).forEach(l => {
        const tipo = (l.processo as any)?.tipo || 'outros';
        receitaPorTipo[tipo] = (receitaPorTipo[tipo] || 0) + Number(l.valor);
      });

      const despesaPorCategoria: Record<string, number> = {};
      (pagar || []).forEach(l => {
        const cat = l.categoria || 'outros';
        despesaPorCategoria[cat] = (despesaPorCategoria[cat] || 0) + Number(l.valor);
      });

      const totalReceita = Object.values(receitaPorTipo).reduce((s, v) => s + v, 0);
      const totalDespesa = Object.values(despesaPorCategoria).reduce((s, v) => s + v, 0);

      return { receitaPorTipo, despesaPorCategoria, totalReceita, totalDespesa };
    },
  });
}

export function useProvisaoDashboard() {
  return useQuery({
    queryKey: ['dashboard_provisao'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('despesas_recorrentes')
        .select('valor, categoria')
        .eq('ativo', true);

      const items = data || [];
      const totalMensal = items.reduce((s, d) => s + Number(d.valor), 0);
      const porCategoria: Record<string, number> = {};
      items.forEach(d => {
        const cat = d.categoria || 'outros';
        porCategoria[cat] = (porCategoria[cat] || 0) + Number(d.valor);
      });

      const now = new Date();
      const meses = [1, 2, 3].map(i => {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        return { mes: d.getMonth() + 1, ano: d.getFullYear(), total: totalMensal, porCategoria };
      });

      return meses;
    },
  });
}
