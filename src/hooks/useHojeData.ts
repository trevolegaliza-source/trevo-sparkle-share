import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook do "Hoje" view (doc 06 #6).
 *
 * 4 categorias agregadas que respondem "o que importa hoje?":
 *  - PRECISA AGIR HOJE: cobranças vencendo, mensalidades D-5 a gerar
 *  - EM RISCO: inadimplentes, contestações abertas
 *  - OPORTUNIDADES: orçamentos parados >5d, mensalistas sem fatura
 *  - CELEBRAR: pagamentos hoje, deferimentos hoje, clientes novos semana
 */

export interface HojeItem {
  id: string;
  titulo: string;
  descricao: string;
  valor?: number;
  link?: string;
  link_state?: any;
}

export interface HojeData {
  precisa_agir: HojeItem[];
  em_risco: HojeItem[];
  oportunidades: HojeItem[];
  celebrar: HojeItem[];
  totais: {
    receita_hoje: number;
    vencendo_hoje_valor: number;
    inadimplente_total: number;
    pagamentos_hoje_valor: number;
  };
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function isoToday(): string {
  return new Date().toISOString().split('T')[0];
}

function isoWeekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export function useHojeData() {
  return useQuery<HojeData>({
    queryKey: ['hoje-data'],
    staleTime: 60_000,
    queryFn: async () => {
      const hoje = isoToday();
      const semana_atras = isoWeekAgo();
      const cinco_dias_atras = isoDaysAgo(5);
      const inicio_hoje = `${hoje}T00:00:00`;
      const fim_hoje = `${hoje}T23:59:59`;

      // 1. Cobranças vencendo HOJE
      const cobrancasHojePromise = supabase
        .from('lancamentos')
        .select('id, descricao, valor, data_vencimento, cliente_id, processo_id')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .eq('data_vencimento', hoje);

      // 2. Cobranças vencidas (atrasadas, ainda pendentes) — em risco
      const cobrancasVencidasPromise = supabase
        .from('lancamentos')
        .select('id, descricao, valor, data_vencimento, cliente_id')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .lt('data_vencimento', hoje);

      // 3. Contestações abertas
      const contestadosPromise = supabase
        .from('lancamentos')
        .select('id, descricao, valor, cliente_id, contestacao_motivo, contestacao_data')
        .eq('etapa_financeiro', 'contestado')
        .neq('status', 'pago');

      // 4. Orçamentos enviados há mais de 5d sem resposta
      const orcamentosParadosPromise = supabase
        .from('orcamentos')
        .select('id, numero, prospect_nome, valor_final, enviado_em, share_token')
        .eq('status', 'enviado')
        .lt('enviado_em', cinco_dias_atras);

      // 5. Mensalistas a gerar fatura D-5 (recurring billing)
      const mensalistasPromise = supabase
        .from('clientes')
        .select('id, nome, apelido, mensalidade, dia_vencimento_mensal')
        .eq('tipo', 'MENSALISTA')
        .eq('is_archived', false)
        .not('mensalidade', 'is', null)
        .gt('mensalidade', 0);

      // 6. Contas a pagar vencendo hoje
      const contasPagarHojePromise = supabase
        .from('lancamentos')
        .select('id, descricao, valor, fornecedor, categoria')
        .eq('tipo', 'pagar')
        .neq('status', 'pago')
        .eq('data_vencimento', hoje);

      // 7. Pagamentos confirmados HOJE (celebrar)
      const pagamentosHojePromise = supabase
        .from('lancamentos')
        .select('id, descricao, valor, cliente_id, data_pagamento')
        .eq('tipo', 'receber')
        .eq('status', 'pago')
        .gte('data_pagamento', hoje)
        .lte('data_pagamento', hoje);

      // 8. Processos deferidos HOJE
      const deferidosHojePromise = supabase
        .from('processos')
        .select('id, razao_social, cliente_id, data_deferimento')
        .gte('data_deferimento', hoje)
        .lte('data_deferimento', hoje);

      // 9. Clientes novos esta semana
      const clientesNovosPromise = supabase
        .from('clientes')
        .select('id, nome, apelido, created_at')
        .gte('created_at', `${semana_atras}T00:00:00`)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      // Resolve tudo em paralelo
      const [
        cobrancasHoje, cobrancasVencidas, contestados, orcamentosParados,
        mensalistas, contasPagarHoje, pagamentosHoje, deferidosHoje, clientesNovos,
      ] = await Promise.all([
        cobrancasHojePromise, cobrancasVencidasPromise, contestadosPromise,
        orcamentosParadosPromise, mensalistasPromise, contasPagarHojePromise,
        pagamentosHojePromise, deferidosHojePromise, clientesNovosPromise,
      ]);

      // Enriquece com nomes de clientes (1 lookup batch)
      const todosClienteIds = new Set<string>();
      (cobrancasHoje.data ?? []).forEach(l => l.cliente_id && todosClienteIds.add(l.cliente_id));
      (cobrancasVencidas.data ?? []).forEach(l => l.cliente_id && todosClienteIds.add(l.cliente_id));
      (contestados.data ?? []).forEach(l => l.cliente_id && todosClienteIds.add(l.cliente_id));
      (pagamentosHoje.data ?? []).forEach(l => l.cliente_id && todosClienteIds.add(l.cliente_id));
      (deferidosHoje.data ?? []).forEach(p => p.cliente_id && todosClienteIds.add(p.cliente_id));

      let clientesMap = new Map<string, { nome: string; apelido: string | null }>();
      if (todosClienteIds.size > 0) {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, nome, apelido')
          .in('id', Array.from(todosClienteIds));
        clientesMap = new Map((clis ?? []).map(c => [c.id, { nome: c.nome ?? '', apelido: c.apelido }]));
      }

      const nomeCliente = (id: string | null) => {
        if (!id) return 'Cliente';
        const c = clientesMap.get(id);
        return c?.apelido || c?.nome || 'Cliente';
      };

      // ─── PRECISA AGIR HOJE ─────────────────────────────────────────
      const precisa_agir: HojeItem[] = [];

      for (const l of (cobrancasHoje.data ?? [])) {
        precisa_agir.push({
          id: `cob-${l.id}`,
          titulo: nomeCliente(l.cliente_id),
          descricao: `${l.descricao || 'Cobrança'} · vence hoje`,
          valor: Number(l.valor),
          link: `/clientes/${l.cliente_id}`,
          link_state: { tab: 'faturas' },
        });
      }
      for (const l of (contasPagarHoje.data ?? [])) {
        precisa_agir.push({
          id: `pgr-${l.id}`,
          titulo: l.fornecedor || l.descricao || 'Conta a pagar',
          descricao: `${l.categoria || 'Despesa'} · vence hoje`,
          valor: Number(l.valor),
          link: '/contas-pagar',
        });
      }
      // Mensalidades pra gerar hoje (D-5)
      for (const m of (mensalistas.data ?? [])) {
        if (!m.dia_vencimento_mensal) continue;
        const hojeDate = new Date();
        const venc = new Date(hojeDate.getFullYear(), hojeDate.getMonth(), m.dia_vencimento_mensal);
        if (venc < hojeDate) continue;
        const diasAte = Math.ceil((venc.getTime() - hojeDate.getTime()) / 86400000);
        if (diasAte === 5) {
          precisa_agir.push({
            id: `mns-${m.id}`,
            titulo: m.apelido || m.nome || 'Mensalista',
            descricao: `Gerar mensalidade hoje (D-5 do venc. dia ${m.dia_vencimento_mensal})`,
            valor: Number(m.mensalidade),
            link: `/clientes/${m.id}`,
          });
        }
      }

      // ─── EM RISCO ──────────────────────────────────────────────────
      const em_risco: HojeItem[] = [];
      // Agrupa vencidas por cliente
      const vencidasPorCliente = new Map<string, { total: number; qtd: number; max_atraso: number }>();
      for (const l of (cobrancasVencidas.data ?? [])) {
        if (!l.cliente_id) continue;
        const dias = Math.floor((Date.now() - new Date(l.data_vencimento!).getTime()) / 86400000);
        const prev = vencidasPorCliente.get(l.cliente_id) ?? { total: 0, qtd: 0, max_atraso: 0 };
        vencidasPorCliente.set(l.cliente_id, {
          total: prev.total + Number(l.valor),
          qtd: prev.qtd + 1,
          max_atraso: Math.max(prev.max_atraso, dias),
        });
      }
      Array.from(vencidasPorCliente.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6)
        .forEach(([cliId, info]) => {
          em_risco.push({
            id: `risk-${cliId}`,
            titulo: nomeCliente(cliId),
            descricao: `${info.qtd} pendência${info.qtd !== 1 ? 's' : ''} · atraso máx ${info.max_atraso}d`,
            valor: info.total,
            link: `/clientes/${cliId}`,
            link_state: { tab: 'faturas' },
          });
        });
      for (const c of (contestados.data ?? [])) {
        em_risco.push({
          id: `cnt-${c.id}`,
          titulo: nomeCliente(c.cliente_id),
          descricao: `Contestou: ${c.contestacao_motivo?.slice(0, 60) || 'sem motivo'}${(c.contestacao_motivo?.length ?? 0) > 60 ? '…' : ''}`,
          valor: Number(c.valor),
          link: '/financeiro',
          link_state: { tab: 'em_andamento' },
        });
      }

      // ─── OPORTUNIDADES ─────────────────────────────────────────────
      const oportunidades: HojeItem[] = [];
      for (const o of (orcamentosParados.data ?? [])) {
        const diasParado = o.enviado_em
          ? Math.floor((Date.now() - new Date(o.enviado_em).getTime()) / 86400000)
          : 0;
        oportunidades.push({
          id: `orc-${o.id}`,
          titulo: o.prospect_nome,
          descricao: `Orçamento #${String(o.numero).padStart(3, '0')} · parado há ${diasParado}d`,
          valor: Number(o.valor_final),
          link: `/orcamentos/novo?id=${o.id}`,
        });
      }
      // Mensalistas SEM fatura no mês corrente (falha do cron ou caso edge)
      // Esta query é mais cara; fazemos só se há mensalistas
      if ((mensalistas.data?.length ?? 0) > 0) {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        const inicioMesIso = inicioMes.toISOString().split('T')[0];
        for (const m of mensalistas.data!) {
          const { data: lancMes } = await supabase
            .from('lancamentos')
            .select('id')
            .eq('cliente_id', m.id)
            .eq('tipo', 'receber')
            .gte('data_vencimento', inicioMesIso)
            .ilike('descricao', 'Mensalidade%')
            .limit(1);
          if (!lancMes || lancMes.length === 0) {
            // Verifica se já passou D-5 (deveria ter rolado)
            if (m.dia_vencimento_mensal) {
              const hojeDate = new Date();
              const venc = new Date(hojeDate.getFullYear(), hojeDate.getMonth(), m.dia_vencimento_mensal);
              const diasParaVenc = Math.ceil((venc.getTime() - hojeDate.getTime()) / 86400000);
              if (diasParaVenc < 5 && diasParaVenc >= 0) {
                oportunidades.push({
                  id: `mens-${m.id}`,
                  titulo: m.apelido || m.nome || 'Mensalista',
                  descricao: `Sem fatura no mês · vence dia ${m.dia_vencimento_mensal} (${diasParaVenc}d)`,
                  valor: Number(m.mensalidade),
                  link: `/clientes/${m.id}`,
                });
              }
            }
          }
        }
      }

      // ─── CELEBRAR ──────────────────────────────────────────────────
      const celebrar: HojeItem[] = [];
      for (const l of (pagamentosHoje.data ?? [])) {
        celebrar.push({
          id: `pag-${l.id}`,
          titulo: nomeCliente(l.cliente_id),
          descricao: `Pagou ${l.descricao || 'cobrança'} hoje`,
          valor: Number(l.valor),
          link: `/clientes/${l.cliente_id}`,
        });
      }
      for (const p of (deferidosHoje.data ?? [])) {
        celebrar.push({
          id: `def-${p.id}`,
          titulo: nomeCliente(p.cliente_id),
          descricao: `Processo "${p.razao_social || 'sem nome'}" deferido hoje 🎉`,
          link: `/clientes/${p.cliente_id}`,
        });
      }
      for (const c of (clientesNovos.data ?? []).slice(0, 5)) {
        celebrar.push({
          id: `cli-${c.id}`,
          titulo: c.apelido || c.nome || 'Novo cliente',
          descricao: `Cadastrado em ${new Date(c.created_at).toLocaleDateString('pt-BR')}`,
          link: `/clientes/${c.id}`,
        });
      }

      // ─── Totais ────────────────────────────────────────────────────
      const totais = {
        receita_hoje: (pagamentosHoje.data ?? []).reduce((s, l) => s + Number(l.valor), 0),
        vencendo_hoje_valor: (cobrancasHoje.data ?? []).reduce((s, l) => s + Number(l.valor), 0),
        inadimplente_total: Array.from(vencidasPorCliente.values()).reduce((s, i) => s + i.total, 0),
        pagamentos_hoje_valor: (pagamentosHoje.data ?? []).reduce((s, l) => s + Number(l.valor), 0),
      };

      return { precisa_agir, em_risco, oportunidades, celebrar, totais };
    },
  });
}

export { fmt as fmtBRL };
