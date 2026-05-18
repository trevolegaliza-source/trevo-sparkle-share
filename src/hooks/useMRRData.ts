import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que agrega todas as métricas do MRR Dashboard.
 * Doc 06 feature #1 — auditoria 14/05/2026.
 *
 * MRR = Monthly Recurring Revenue. Soma das mensalidades dos clientes
 * tipo='MENSALISTA' ativos. Representa receita previsível mês a mês.
 */
export interface MRRClienteTop {
  id: string;
  nome: string;
  apelido: string | null;
  mensalidade: number;
  dia_vencimento: number | null;
}

export interface MRRClienteRisco {
  id: string;
  nome: string;
  apelido: string | null;
  total_vencido: number;
  dias_atraso_max: number;
  qtd_lancamentos: number;
}

export interface MRRMensalidadeProxima {
  id: string;
  nome: string;
  apelido: string | null;
  mensalidade: number;
  dia_vencimento: number;
  data_vencimento: string; // YYYY-MM-DD
  dias_ate_vencimento: number;
  ja_gerada_no_mes: boolean;
}

export interface MRRReceitaMes {
  mes: string;           // 'YYYY-MM'
  mes_label: string;     // 'jan/26'
  receita: number;
}

export interface MRRData {
  // Cards principais
  mrr_atual: number;
  qtd_mensalistas: number;
  mensalidade_media: number;
  pipeline_valor: number;
  pipeline_qtd: number;
  taxa_conversao: number; // 0-100
  // Histórico
  receita_6m: MRRReceitaMes[];
  receita_mes_atual: number;
  receita_mes_anterior: number;
  variacao_pct: number;
  // Listas
  top_mensalistas: MRRClienteTop[];
  clientes_risco: MRRClienteRisco[];
  proximas_mensalidades: MRRMensalidadeProxima[];
}

export function useMRRData() {
  return useQuery<MRRData>({
    queryKey: ['mrr-data'],
    // Agent 3 BUG 3 (17/05/2026 noite): refetchOnWindowFocus pra alinhar com DSO/Previsao.
    // Antes inconsistente — DSO atualizava ao voltar pra aba, MRR não.
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Mensalistas ativos + soma de mensalidade
      const { data: mensalistas, error: mensaErr } = await supabase
        .from('clientes')
        .select('id, nome, apelido, mensalidade, dia_vencimento_mensal')
        .eq('tipo', 'MENSALISTA')
        .eq('is_archived', false)
        .not('mensalidade', 'is', null)
        .gt('mensalidade', 0)
        .order('mensalidade', { ascending: false });
      if (mensaErr) throw mensaErr;

      const lista = mensalistas ?? [];
      const mrr_atual = lista.reduce((s, c) => s + Number(c.mensalidade || 0), 0);
      const qtd_mensalistas = lista.length;
      const mensalidade_media = qtd_mensalistas > 0 ? mrr_atual / qtd_mensalistas : 0;
      const top_mensalistas: MRRClienteTop[] = lista.slice(0, 5).map(c => ({
        id: c.id,
        nome: c.nome ?? '',
        apelido: c.apelido,
        mensalidade: Number(c.mensalidade || 0),
        dia_vencimento: c.dia_vencimento_mensal,
      }));

      // 2. Pipeline — orçamentos enviados em aberto
      const { data: pipeline } = await supabase
        .from('orcamentos')
        .select('valor_final')
        .in('status', ['enviado', 'aguardando_pagamento'])
        .eq('is_archived', false);
      const pipeline_valor = (pipeline ?? []).reduce((s, o) => s + Number(o.valor_final || 0), 0);
      const pipeline_qtd = (pipeline ?? []).length;

      // 3. Taxa de conversão histórica últimos 6 meses
      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
      const { data: historico } = await supabase
        .from('orcamentos')
        .select('status')
        .gte('created_at', seisMesesAtras.toISOString())
        .in('status', ['convertido', 'recusado', 'aguardando_pagamento']);
      const convertidos = (historico ?? []).filter(o => o.status === 'convertido').length;
      const total_hist = (historico ?? []).length;
      const taxa_conversao = total_hist > 0 ? (convertidos / total_hist) * 100 : 0;

      // 4. Receita últimos 6 meses (lancamentos.tipo=receber, status=pago)
      const { data: lancsPagos } = await supabase
        .from('lancamentos')
        .select('valor, data_pagamento')
        .eq('tipo', 'receber')
        .eq('status', 'pago')
        .gte('data_pagamento', seisMesesAtras.toISOString().split('T')[0])
        .not('data_pagamento', 'is', null);

      const mesesMap = new Map<string, number>();
      // Pre-popula últimos 6 meses pra mostrar 0 se vazio
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mesesMap.set(key, 0);
      }
      for (const l of lancsPagos ?? []) {
        if (!l.data_pagamento) continue;
        const d = new Date(l.data_pagamento);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (mesesMap.has(key)) {
          mesesMap.set(key, (mesesMap.get(key) || 0) + Number(l.valor || 0));
        }
      }
      const mesesNomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const receita_6m: MRRReceitaMes[] = Array.from(mesesMap.entries()).map(([mes, receita]) => {
        const [y, m] = mes.split('-');
        const yy = y.slice(2);
        return { mes, mes_label: `${mesesNomes[parseInt(m, 10) - 1]}/${yy}`, receita };
      });

      const receita_mes_atual = receita_6m[receita_6m.length - 1]?.receita ?? 0;
      const receita_mes_anterior = receita_6m[receita_6m.length - 2]?.receita ?? 0;
      const variacao_pct = receita_mes_anterior > 0
        ? ((receita_mes_atual - receita_mes_anterior) / receita_mes_anterior) * 100
        : 0;

      // 5. Clientes em risco (com lancamentos vencidos)
      const hoje = new Date().toISOString().split('T')[0];
      const { data: vencidos } = await supabase
        .from('lancamentos')
        .select('cliente_id, valor, data_vencimento')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .lt('data_vencimento', hoje);

      const riscoMap = new Map<string, { total: number; dias_max: number; qtd: number }>();
      for (const l of vencidos ?? []) {
        if (!l.cliente_id) continue;
        const dias = Math.floor((Date.now() - new Date(l.data_vencimento!).getTime()) / 86400000);
        const prev = riscoMap.get(l.cliente_id) ?? { total: 0, dias_max: 0, qtd: 0 };
        riscoMap.set(l.cliente_id, {
          total: prev.total + Number(l.valor || 0),
          dias_max: Math.max(prev.dias_max, dias),
          qtd: prev.qtd + 1,
        });
      }

      let clientes_risco: MRRClienteRisco[] = [];
      if (riscoMap.size > 0) {
        const { data: clientesInfo } = await supabase
          .from('clientes')
          .select('id, nome, apelido')
          .in('id', Array.from(riscoMap.keys()));
        clientes_risco = (clientesInfo ?? [])
          .map(c => {
            const r = riscoMap.get(c.id)!;
            return {
              id: c.id,
              nome: c.nome ?? '',
              apelido: c.apelido,
              total_vencido: r.total,
              dias_atraso_max: r.dias_max,
              qtd_lancamentos: r.qtd,
            };
          })
          .sort((a, b) => b.total_vencido - a.total_vencido)
          .slice(0, 5);
      }

      // 6. Próximas mensalidades a gerar (recurring billing D-5)
      const hojeDate = new Date();
      const proximas_mensalidades: MRRMensalidadeProxima[] = [];
      for (const c of lista) {
        if (!c.dia_vencimento_mensal) continue;
        // Calcula próxima data de vencimento (no mês atual, ou próximo se já passou)
        let venc = new Date(hojeDate.getFullYear(), hojeDate.getMonth(), c.dia_vencimento_mensal);
        if (venc < hojeDate) {
          venc = new Date(hojeDate.getFullYear(), hojeDate.getMonth() + 1, c.dia_vencimento_mensal);
        }
        const diasAte = Math.ceil((venc.getTime() - hojeDate.getTime()) / 86400000);
        // Só interessam os 30 dias seguintes (próximo ciclo)
        if (diasAte > 30 || diasAte < 0) continue;

        // Checa se já existe lancamento desse cliente nesse mês de competência
        const mesVenc = venc.getMonth() + 1;
        const anoVenc = venc.getFullYear();
        const { data: lancsExist } = await supabase
          .from('lancamentos')
          .select('id')
          .eq('cliente_id', c.id)
          .eq('tipo', 'receber')
          .eq('competencia_mes', mesVenc)
          .eq('competencia_ano', anoVenc)
          .ilike('descricao', 'Mensalidade%')
          .limit(1);

        proximas_mensalidades.push({
          id: c.id,
          nome: c.nome ?? '',
          apelido: c.apelido,
          mensalidade: Number(c.mensalidade || 0),
          dia_vencimento: c.dia_vencimento_mensal,
          data_vencimento: venc.toISOString().split('T')[0],
          dias_ate_vencimento: diasAte,
          ja_gerada_no_mes: (lancsExist?.length ?? 0) > 0,
        });
      }
      proximas_mensalidades.sort((a, b) => a.dias_ate_vencimento - b.dias_ate_vencimento);

      return {
        mrr_atual,
        qtd_mensalistas,
        mensalidade_media,
        pipeline_valor,
        pipeline_qtd,
        taxa_conversao,
        receita_6m,
        receita_mes_atual,
        receita_mes_anterior,
        variacao_pct,
        top_mensalistas,
        clientes_risco,
        proximas_mensalidades,
      };
    },
  });
}
