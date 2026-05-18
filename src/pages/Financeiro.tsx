import { useState, useMemo, useEffect } from 'react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { GlassCard } from '@/components/ui/glass-card';
import { KPICard } from '@/components/ui/kpi-card';
import { SkeletonKPIs, SkeletonList } from '@/components/ui/skeleton-patterns';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Download, FileText, Send, Clock, CheckCircle, AlertCircle, AlertTriangle, DollarSign, TrendingUp, Search, TrendingDown, ClipboardCheck, History } from 'lucide-react';
import { useFinanceiroClientes, type LancamentoFinanceiro, isLancamentoVencidoReal } from '@/hooks/useFinanceiroClientes';
import {
  ClientesFaturar,
  ClientesAguardando,
  ClientesRecebidos,
  ModalPosExtrato,
} from '@/components/financeiro/ClienteAccordionFinanceiro';
import type { ExtratoGeradoPayload } from '@/components/financeiro/ClienteAccordionFinanceiro';
import { ClientesAuditoria } from '@/components/financeiro/ClientesAuditoria';
import ClientesContestados from '@/components/financeiro/ClientesContestados';
import { formatBRL } from '@/lib/pricing-engine';
import { downloadCSV, formatBRLPlain, formatDateBR } from '@/lib/export-utils';
import { ETAPA_FINANCEIRO_LABELS } from '@/types/financial';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

function toISO(d: Date) { return d.toISOString().split('T')[0]; }

// Aceita os 3 valores de aba novos. Mapeamento legado (6 abas antigas) removido
// na auditoria 13/05/2026 noite — nenhuma navegação ativa dispara nomes antigos.
const TABS_VALIDAS = new Set(['a_fazer', 'em_andamento', 'historico']);
const TAB_DEFAULT = 'a_fazer';
function resolveTab(tab: unknown): string {
  return typeof tab === 'string' && TABS_VALIDAS.has(tab) ? tab : TAB_DEFAULT;
}

type PeriodoPreset = 'este_mes' | 'mes_anterior' | 'ultimos_3' | 'custom';

function getPeriodoDates(preset: PeriodoPreset): { inicio: string; fim: string } {
  const now = new Date();
  switch (preset) {
    case 'este_mes':
      return { inicio: toISO(startOfMonth(now)), fim: toISO(endOfMonth(now)) };
    case 'mes_anterior': {
      const prev = subMonths(now, 1);
      return { inicio: toISO(startOfMonth(prev)), fim: toISO(endOfMonth(prev)) };
    }
    case 'ultimos_3': {
      const m3 = subMonths(now, 2);
      return { inicio: toISO(startOfMonth(m3)), fim: toISO(endOfMonth(now)) };
    }
    default:
      return { inicio: toISO(startOfMonth(now)), fim: toISO(endOfMonth(now)) };
  }
}

export default function Financeiro() {
  const { role, isMaster, podeVerValores } = usePermissions();
  // 18/05/2026: operacional/visualizador acessam financeiro mas valores monetarios
  // do panorama (KPIs, falta cobrar/receber, projeção) saem mascarados.
  const fmtMoney = (v: number) => podeVerValores() ? formatBRL(v) : '•••••';
  const isFinanceiro = role === 'financeiro';
  const masterBypassJanela = isMaster();
  const [periodo, setPeriodo] = useState<PeriodoPreset>('este_mes');
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => resolveTab((location.state as any)?.tab));
  const [searchTodos, setSearchTodos] = useState('');
  const [extratoGerado, setExtratoGerado] = useState<ExtratoGeradoPayload | null>(null);
  useEffect(() => {
    const stateTab = (location.state as any)?.tab;
    if (stateTab) setActiveTab(resolveTab(stateTab));
  }, [location.state]);

  const dates = periodo === 'custom'
    ? { inicio: customInicio, fim: customFim }
    : getPeriodoDates(periodo);

  const {
    clientes,
    clientesCobrar,
    clientesFuturaFatura,
    clientesAguardandoAuditoria,
    clientesContestados,
    clientesAguardando,
    clientesPagos,
    mensalistasSemFatura,
    metricas,
    isLoading,
    contestarLancamento,
    resolverContestacao,
  } = useFinanceiroClientes(dates.inicio, dates.fim);

  const { data: despesasPagas = 0 } = useQuery({
    queryKey: ['despesas_pagas_periodo', dates.inicio, dates.fim],
    queryFn: async () => {
      const { data } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'pagar')
        .eq('status', 'pago')
        .gte('data_pagamento', dates.inicio)
        .lte('data_pagamento', dates.fim);
      return (data || []).reduce((s, l) => s + Number(l.valor), 0);
    },
    staleTime: 60_000,
  });

  const inadimplenciaCalc = useMemo(() => {
    const allLanc = clientes.flatMap(c => c.lancamentos);
    const inadimplentes = allLanc.filter(l => isLancamentoVencidoReal(l));
    const total = inadimplentes.reduce((s, l) => s + l.valor, 0);
    const clienteIds = new Set(
      clientes
        .filter(c => c.lancamentos.some(l => isLancamentoVencidoReal(l)))
        .map(c => c.cliente_id)
    );
    return { total, qtdClientes: clienteIds.size };
  }, [clientes]);

  const resultado = metricas.totalRecebido - despesasPagas;

  const qtdAguardandoAuditoria = clientesAguardandoAuditoria.reduce((s, c) => s + c.qtd_nao_auditados, 0);

  const totalLancamentosContestados = clientesContestados.reduce((s, c) => s + c.qtd_processos, 0);

  const resumoMes = useMemo(() => {
    const now = new Date();
    const mesNome = format(
      periodo === 'mes_anterior' ? subMonths(now, 1) : now,
      'MMMM yyyy',
      { locale: ptBR }
    );
    const qtdClientes = new Set(clientes.map(c => c.cliente_id)).size;
    const qtdProcessos = metricas.totalProcessos;
    const qtdSemExtrato = clientes.reduce((s, c) => s + c.qtd_sem_extrato, 0);
    const faltaCobrar = metricas.totalFaturado - metricas.totalCobrado;
    const faltaReceber = metricas.totalCobrado - metricas.totalRecebido;

    return {
      mesNome: mesNome.charAt(0).toUpperCase() + mesNome.slice(1),
      qtdClientes,
      qtdProcessos,
      qtdSemExtrato,
      qtdInadimplentes: inadimplenciaCalc.qtdClientes,
      faltaCobrar: Math.max(0, faltaCobrar),
      faltaReceber: Math.max(0, faltaReceber),
    };
  }, [clientes, metricas, inadimplenciaCalc, periodo]);

  // Busca livre nas abas A Fazer / Em Andamento (R1.1).
  // Filtra clientes por apelido/nome ou por razão social de algum processo.
  const [searchAFazer, setSearchAFazer] = useState('');
  const [searchEmAndamento, setSearchEmAndamento] = useState('');

  const todosLancamentos = useMemo(() => {
    const all: Array<LancamentoFinanceiro & { cliente_nome: string; cliente_apelido: string | null }> = [];
    for (const c of clientes) {
      for (const l of c.lancamentos) {
        all.push({ ...l, cliente_nome: c.cliente_nome, cliente_apelido: c.cliente_apelido });
      }
    }
    if (searchTodos) {
      const q = searchTodos.toLowerCase();
      return all.filter(l =>
        (l.cliente_apelido || l.cliente_nome).toLowerCase().includes(q) ||
        l.processo_razao_social.toLowerCase().includes(q) ||
        l.descricao.toLowerCase().includes(q)
      );
    }
    return all;
  }, [clientes, searchTodos]);

  // R1.5 — Projeção dos próximos 30 dias.
  // Lança que estão pendentes E têm vencimento entre hoje e hoje+30 (inclusive).
  // Não é "Falta receber" (que olha cobrado-recebido no período do filtro);
  // é o que vai entrar nos próximos 30 dias se ninguém atrasar.
  const projecao30d = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 30);
    const limiteStr = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    const porCliente = new Map<string, { nome: string; valor: number; qtd: number }>();
    let total = 0;
    let qtdLancs = 0;
    for (const c of clientes) {
      const nome = c.cliente_apelido || c.cliente_nome;
      let valorCli = 0;
      let qtdCli = 0;
      for (const l of c.lancamentos) {
        if (l.status === 'pago') continue;
        if (!l.data_vencimento) continue;
        const venc = l.data_vencimento.slice(0, 10);
        if (venc < hojeStr || venc > limiteStr) continue;
        valorCli += l.valor;
        qtdCli++;
      }
      if (qtdCli > 0) {
        porCliente.set(c.cliente_id, { nome, valor: valorCli, qtd: qtdCli });
        total += valorCli;
        qtdLancs += qtdCli;
      }
    }
    const top = Array.from(porCliente.values()).sort((a, b) => b.valor - a.valor).slice(0, 3);
    return { total, qtdLancs, qtdClientes: porCliente.size, top };
  }, [clientes]);

  // R0.2 — CSV respeita aba ativa + filtros, em vez de exportar tudo cru.
  // R1.1 — Helper de filtro por nome/apelido do cliente ou razão social do processo.
  const matchClienteSearch = (
    c: import('@/hooks/useFinanceiroClientes').ClienteFinanceiro,
    q: string
  ) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    const nome = (c.cliente_apelido || c.cliente_nome).toLowerCase();
    if (nome.includes(ql)) return true;
    return c.lancamentos.some(l =>
      (l.processo_razao_social || '').toLowerCase().includes(ql)
    );
  };

  const filterMensalista = (
    m: import('@/hooks/useFinanceiroClientes').MensalistaSemFatura,
    q: string
  ) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return (m.apelido || m.nome).toLowerCase().includes(ql);
  };

  const clientesAguardandoAuditoriaFiltered = useMemo(
    () => clientesAguardandoAuditoria.filter(c => matchClienteSearch(c, searchAFazer)),
    [clientesAguardandoAuditoria, searchAFazer]
  );
  const clientesCobrarFiltered = useMemo(
    () => clientesCobrar.filter(c => matchClienteSearch(c, searchAFazer)),
    [clientesCobrar, searchAFazer]
  );
  const mensalistasSemFaturaFiltered = useMemo(
    () => mensalistasSemFatura.filter(m => filterMensalista(m, searchAFazer)),
    [mensalistasSemFatura, searchAFazer]
  );
  const clientesFuturaFaturaFiltered = useMemo(
    () => clientesFuturaFatura.filter(c => matchClienteSearch(c, searchAFazer)),
    [clientesFuturaFatura, searchAFazer]
  );
  const clientesAguardandoFiltered = useMemo(
    () => clientesAguardando.filter(c => matchClienteSearch(c, searchEmAndamento)),
    [clientesAguardando, searchEmAndamento]
  );
  const clientesContestadosFiltered = useMemo(
    () => clientesContestados.filter(c => matchClienteSearch(c, searchEmAndamento)),
    [clientesContestados, searchEmAndamento]
  );

  // R2.4 — Ranking dos top pagadores no período do filtro.
  // Considera só lançamentos pagos. Computa total recebido e atraso médio
  // (data_pagamento - data_vencimento). Atraso negativo = pagou adiantado.
  const rankingPagadores = useMemo(() => {
    const ranking = clientesPagos.map(c => {
      const lancsPagos = c.lancamentos.filter(l => l.status === 'pago' && l.data_pagamento);
      const total = lancsPagos.reduce((s, l) => s + l.valor, 0);
      let somaAtraso = 0;
      let qtdComAtraso = 0;
      for (const l of lancsPagos) {
        if (!l.data_pagamento || !l.data_vencimento) continue;
        const venc = new Date(l.data_vencimento + 'T00:00:00').getTime();
        const pago = new Date(l.data_pagamento + 'T00:00:00').getTime();
        const dias = Math.round((pago - venc) / (1000 * 60 * 60 * 24));
        somaAtraso += dias;
        qtdComAtraso++;
      }
      const atrasoMedio = qtdComAtraso > 0 ? Math.round(somaAtraso / qtdComAtraso) : 0;
      return {
        cliente_id: c.cliente_id,
        nome: c.cliente_apelido || c.cliente_nome,
        total,
        qtd: lancsPagos.length,
        atrasoMedio,
      };
    });
    ranking.sort((a, b) => b.total - a.total);
    return ranking.slice(0, 5);
  }, [clientesPagos]);

  const lancamentosParaExport = useMemo(() => {
    const enriquecer = (lancs: LancamentoFinanceiro[], cliNome: string, cliApelido: string | null) =>
      lancs.map(l => ({ ...l, cliente_nome: cliNome, cliente_apelido: cliApelido }));

    if (activeTab === 'a_fazer') {
      const out: typeof todosLancamentos = [];
      const baseClientes = [
        ...clientesAguardandoAuditoria,
        ...clientesCobrar,
      ];
      for (const c of baseClientes) {
        out.push(...enriquecer(c.lancamentos, c.cliente_nome, c.cliente_apelido));
      }
      const q = searchAFazer.toLowerCase();
      return q
        ? out.filter(l => (l.cliente_apelido || l.cliente_nome).toLowerCase().includes(q) ||
            l.processo_razao_social.toLowerCase().includes(q))
        : out;
    }
    if (activeTab === 'em_andamento') {
      const out: typeof todosLancamentos = [];
      const baseClientes = [...clientesAguardando, ...clientesContestados];
      for (const c of baseClientes) {
        out.push(...enriquecer(c.lancamentos, c.cliente_nome, c.cliente_apelido));
      }
      const q = searchEmAndamento.toLowerCase();
      return q
        ? out.filter(l => (l.cliente_apelido || l.cliente_nome).toLowerCase().includes(q) ||
            l.processo_razao_social.toLowerCase().includes(q))
        : out;
    }
    // historico
    return todosLancamentos;
  }, [activeTab, clientesAguardandoAuditoria, clientesCobrar, clientesAguardando, clientesContestados,
      todosLancamentos, searchAFazer, searchEmAndamento]);

  const handleExportCSV = () => {
    if (lancamentosParaExport.length === 0) { toast.info('Sem dados para exportar'); return; }
    const rows = lancamentosParaExport.map(l => ({
      Cliente: l.cliente_apelido || l.cliente_nome,
      'Razão Social': l.processo_razao_social,
      Tipo: l.processo_tipo,
      Valor: formatBRLPlain(l.valor),
      Vencimento: formatDateBR(l.data_vencimento),
      Etapa: ETAPA_FINANCEIRO_LABELS[l.etapa_financeiro as keyof typeof ETAPA_FINANCEIRO_LABELS] || l.etapa_financeiro,
      Status: l.status,
      Pagamento: formatDateBR(l.data_pagamento),
    }));
    const sufixo = activeTab === 'a_fazer' ? 'a_fazer'
      : activeTab === 'em_andamento' ? 'em_andamento'
      : 'historico';
    downloadCSV(rows, `financeiro_${sufixo}_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success(`Relatório exportado (${rows.length} lançamentos da aba ${sufixo.replace('_', ' ')}).`);
  };

  const periodoLabel = periodo === 'este_mes' ? 'Este Mês'
    : periodo === 'mes_anterior' ? 'Mês Anterior'
    : periodo === 'ultimos_3' ? 'Últimos 3 Meses'
    : 'Personalizado';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        subtitle="Centro de cobranças e recebimentos"
        actions={
          <>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoPreset)}>
              <SelectTrigger className="w-40">
                <SelectValue>{periodoLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="este_mes">Este Mês</SelectItem>
                <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                <SelectItem value="ultimos_3">Últimos 3 Meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {periodo === 'custom' && (
              <div className="flex items-center gap-1">
                <Input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)} className="w-36 h-9" />
                <span className="text-xs text-muted-foreground">a</span>
                <Input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className="w-36 h-9" />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
            </Button>
          </>
        }
      />

      {isLoading ? (
        // UX-Onda10 (17/05/2026): Skeleton mais informativo que "Carregando..."
        <div className="space-y-4">
          <SkeletonKPIs count={5} />
          <SkeletonList rows={4} />
        </div>
      ) : (
        <>
          {/* 5 KPIs — auditoria visual Q3 (14/05/2026): KPICard componente unificado */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <KPICard
              variant="hero"
              icon={DollarSign}
              label="Faturado"
              value={fmtMoney(metricas.totalFaturado)}
              hint={`${metricas.totalProcessos} processos`}
            />
            <KPICard
              variant="default"
              icon={Send}
              label="Cobrado"
              value={fmtMoney(metricas.totalCobrado)}
              hint={`${metricas.clientesCobrados} clientes`}
              onClick={() => setActiveTab('em_andamento')}
            />
            <KPICard
              variant="success"
              icon={CheckCircle}
              label="Recebido"
              value={fmtMoney(metricas.totalRecebido)}
              hint={`${metricas.taxaRecebimento}% do faturado`}
              onClick={() => setActiveTab('historico')}
            />
            <KPICard
              variant={inadimplenciaCalc.total > 0 ? 'danger' : 'default'}
              icon={AlertTriangle}
              label="Inadimplente"
              value={fmtMoney(inadimplenciaCalc.total)}
              hint={`${inadimplenciaCalc.qtdClientes} clientes`}
              onClick={() => setActiveTab('em_andamento')}
            />
            <KPICard
              variant={resultado >= 0 ? 'success' : 'danger'}
              icon={resultado >= 0 ? TrendingUp : TrendingDown}
              label="Resultado"
              value={fmtMoney(resultado)}
              hint="Receita - Despesas"
              className="col-span-2 lg:col-span-1"
            />
          </div>

          {/* Resumo do Mês */}
          <Card className="bg-muted/30 border-border/60">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Resumo de {resumoMes.mesNome}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {resumoMes.qtdClientes} clientes · {resumoMes.qtdProcessos} processos
                    {resumoMes.qtdSemExtrato > 0 && (
                      <span className="text-amber-500"> · {resumoMes.qtdSemExtrato} sem extrato</span>
                    )}
                    {resumoMes.qtdInadimplentes > 0 && (
                      <span className="text-red-500"> · {resumoMes.qtdInadimplentes} inadimplentes</span>
                    )}
                    {qtdAguardandoAuditoria > 0 && (
                      <span className="text-amber-500"> · ⏳ {qtdAguardandoAuditoria} aguardando auditoria</span>
                    )}
                    {resumoMes.qtdSemExtrato === 0 && resumoMes.qtdInadimplentes === 0 && qtdAguardandoAuditoria === 0 && (
                      <span className="text-emerald-500"> · Tudo em dia ✓</span>
                    )}
                  </p>
                </div>
                {/* R1.2 — antes mostrava Faturado + Recebido + Falta cobrar + Falta receber.
                    Faturado e Recebido já aparecem nos KPIs em cima; aqui só os 2 deltas. */}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-6 text-left sm:text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Falta cobrar</p>
                    <p className="text-sm font-bold text-amber-500">{fmtMoney(resumoMes.faltaCobrar)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Falta receber</p>
                    <p className="text-sm font-bold text-red-500">{fmtMoney(resumoMes.faltaReceber)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* R1.5 — Projeção dos próximos 30 dias.
              Não substitui "Falta receber" (que olha o mês escolhido); este olha pra frente. */}
          {projecao30d.qtdLancs > 0 && (
            <Card className="bg-blue-500/5 border-blue-500/30">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-400" />
                      Projeção · próximos 30 dias
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {projecao30d.qtdLancs} lançamento{projecao30d.qtdLancs > 1 ? 's' : ''} pendente{projecao30d.qtdLancs > 1 ? 's' : ''} ·{' '}
                      {projecao30d.qtdClientes} cliente{projecao30d.qtdClientes > 1 ? 's' : ''}
                      {projecao30d.top.length > 0 && (
                        <>
                          {' · top: '}
                          {projecao30d.top.map((t, i) => (
                            <span key={i} className="text-muted-foreground/90">
                              {i > 0 ? ', ' : ''}{t.nome} <span className="text-foreground/70">({fmtMoney(t.valor)})</span>
                            </span>
                          ))}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Total previsto</p>
                    <p className="text-lg font-bold text-blue-400">{fmtMoney(projecao30d.total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs — 3 abas principais com sub-seções colapsáveis */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full overflow-x-auto overflow-y-hidden no-scrollbar gap-1 h-auto flex-nowrap justify-start">
              {/* UX-104 (12/05/2026): adicionado title (tooltip nativo) explicando
                  o que cada aba representa. Pra usuário novo (Letícia/secretária)
                  saber o que esperar antes de clicar. */}
              <TabsTrigger
                value="a_fazer"
                className="whitespace-nowrap flex-shrink-0 gap-1.5 text-xs px-3 py-2 data-[state=active]:text-amber-500"
                title="Processos aguardando auditoria, prontos para cobrar e contestados — ação pendente sua"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                A Fazer
                {(qtdAguardandoAuditoria + clientesCobrar.length) > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[18px] bg-amber-500/15 text-amber-500 border-amber-500/30">
                    {qtdAguardandoAuditoria + clientesCobrar.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="em_andamento"
                className="whitespace-nowrap flex-shrink-0 gap-1.5 text-xs px-3 py-2 data-[state=active]:text-blue-400"
                title="Cobranças enviadas e aguardando pagamento do cliente — bola está com o cliente"
              >
                <Clock className="h-3.5 w-3.5" />
                Em Andamento
                {(clientesAguardando.length + clientesContestados.length) > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[18px] bg-blue-500/15 text-blue-400 border-blue-500/30">
                    {clientesAguardando.length + clientesContestados.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="historico"
                className="whitespace-nowrap flex-shrink-0 gap-1.5 text-xs px-3 py-2 data-[state=active]:text-emerald-400"
                title="Lançamentos pagos no período selecionado + ranking de pagadores"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Histórico
                {clientesPagos.length > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 min-w-[18px] text-emerald-500 border-emerald-500/30">
                    {clientesPagos.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ABA 1 — A FAZER */}
            <TabsContent value="a_fazer" className="mt-4 space-y-3">
              {/* R1.1 — busca livre por cliente/razão social */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou processo..."
                  value={searchAFazer}
                  onChange={e => setSearchAFazer(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Accordion
                type="multiple"
                defaultValue={[
                  ...(!isFinanceiro && qtdAguardandoAuditoria > 0 ? ['auditoria'] : []),
                  ...(clientesCobrar.length > 0 || mensalistasSemFatura.length > 0 ? ['cobrar'] : []),
                ]}
                className="space-y-3"
              >
                {!isFinanceiro && (
                  <AccordionItem value="auditoria" className="border rounded-lg bg-card">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-lg">🔍</span>
                        <ClipboardCheck className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-sm">Aguardando Auditoria</span>
                        <Badge variant="secondary" className="ml-auto mr-2 bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px]">
                          {qtdAguardandoAuditoria}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {clientesAguardandoAuditoriaFiltered.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {searchAFazer ? 'Nenhum cliente bate com a busca.' : 'Nada por aqui ✨'}
                        </p>
                      ) : (
                        <ClientesAuditoria clientes={clientesAguardandoAuditoriaFiltered} />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="cobrar" className="border rounded-lg bg-card">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-lg">📄</span>
                      <FileText className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-sm">Prontos para Cobrar</span>
                      <Badge variant="secondary" className="ml-auto mr-2 bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px]">
                        {clientesCobrar.length + mensalistasSemFatura.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {clientesCobrarFiltered.length === 0 && mensalistasSemFaturaFiltered.length === 0 && !masterBypassJanela ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {searchAFazer ? 'Nenhum cliente bate com a busca.' : 'Nada por aqui ✨'}
                      </p>
                    ) : (
                      <ClientesFaturar
                        clientes={masterBypassJanela ? [...clientesCobrarFiltered, ...clientesFuturaFaturaFiltered] : clientesCobrarFiltered}
                        mensalistasSemFatura={mensalistasSemFaturaFiltered}
                        onExtratoGerado={setExtratoGerado}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Sprint 4.D (13/05/2026 noite): accordion "Próximas faturas"
                    removido — era info-only sem ação, polui a aba A Fazer.
                    Master bypass de qualquer forma já via essas linhas merged
                    em "Prontos pra cobrar" (vide linha 637). */}
              </Accordion>
            </TabsContent>

            {/* ABA 2 — EM ANDAMENTO */}
            <TabsContent value="em_andamento" className="mt-4 space-y-3">
              {/* R1.1 — busca livre por cliente/razão social */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou processo..."
                  value={searchEmAndamento}
                  onChange={e => setSearchEmAndamento(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Accordion
                type="multiple"
                defaultValue={[
                  ...(clientesAguardando.length > 0 ? ['aguardando'] : []),
                  ...(!isFinanceiro && clientesContestados.length > 0 ? ['contestados'] : []),
                ]}
                className="space-y-4"
              >
                {/* R0.1 — Accordion "Enviados" removido. Era hardcoded com 0 e
                    mensagem "Nada por aqui ✨" — placeholder de feature que nunca
                    foi implementada. Quando/se reativar, fluxo correto é:
                    cobrança_gerada → cobranca_enviada (já tracked em
                    etapa_financeiro). Não precisa accordion separado. */}

                <AccordionItem value="aguardando" className="border rounded-lg px-4 bg-card data-[state=closed]:bg-muted/30">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 flex-1 pr-2">
                      <Send className="h-4 w-4 text-blue-400" />
                      <span className="font-medium text-sm">Aguardando Pagamento</span>
                      <Badge variant="secondary" className="ml-auto bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                        {clientesAguardando.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {clientesAguardandoFiltered.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {searchEmAndamento ? 'Nenhum cliente bate com a busca.' : 'Nada por aqui ✨'}
                      </p>
                    ) : (
                      <ClientesAguardando clientes={clientesAguardandoFiltered} contestarLancamento={contestarLancamento} />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {!isFinanceiro && (
                  <AccordionItem value="contestados" className="border rounded-lg px-4 bg-card data-[state=closed]:bg-muted/30">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2 flex-1 pr-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-sm">Contestados</span>
                        <Badge variant="secondary" className="ml-auto bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">
                          {totalLancamentosContestados}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {clientesContestadosFiltered.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {searchEmAndamento ? 'Nenhum cliente bate com a busca.' : 'Nada por aqui ✨'}
                        </p>
                      ) : (
                        <ClientesContestados
                          clientes={clientesContestadosFiltered}
                          onResolver={(params) => resolverContestacao.mutate(params)}
                          userRole={role}
                        />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </TabsContent>

            {/* ABA 3 — HISTÓRICO */}
            <TabsContent value="historico" className="mt-4">
              <Accordion
                type="multiple"
                defaultValue={[
                  ...(clientesPagos.length > 0 ? ['pagos'] : []),
                ]}
                className="space-y-3"
              >
                <AccordionItem value="pagos" className="border rounded-lg px-4 bg-card">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 flex-1 pr-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span className="font-medium text-sm">Pagos no período</span>
                      <Badge variant="outline" className="ml-auto text-emerald-500 border-emerald-500/30 text-[10px]">
                        {clientesPagos.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {clientesPagos.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nada por aqui ✨</p>
                    ) : (
                      <ClientesPagos clientes={clientesPagos} />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* R2.4 — Ranking dos top pagadores no período */}
                {rankingPagadores.length > 0 && (
                  <AccordionItem value="ranking" className="border rounded-lg px-4 bg-card">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2 flex-1 pr-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="font-medium text-sm">Top pagadores do período</span>
                        <Badge variant="outline" className="ml-auto text-emerald-500 border-emerald-500/30 text-[10px]">
                          {rankingPagadores.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ol className="space-y-2 py-2">
                        {rankingPagadores.map((r, i) => (
                          <li key={r.cliente_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40">
                            <span className="text-xs font-semibold w-6 text-center text-muted-foreground">
                              {i + 1}º
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{r.nome}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {r.qtd} lançamento{r.qtd > 1 ? 's' : ''} · {' '}
                                {r.atrasoMedio === 0
                                  ? 'em dia'
                                  : r.atrasoMedio < 0
                                  ? `pagou ${Math.abs(r.atrasoMedio)}d adiantado`
                                  : `${r.atrasoMedio}d de atraso médio`}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-emerald-500">{formatBRL(r.total)}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="todos" className="border rounded-lg px-4 bg-card">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 flex-1 pr-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Buscar no histórico</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {todosLancamentos.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <TabTodos
                      lancamentos={todosLancamentos}
                      search={searchTodos}
                      onSearchChange={setSearchTodos}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Modal pós-extrato — lives OUTSIDE Tabs, survives query invalidation */}
      {extratoGerado && (
        <ModalPosExtrato
          extratoGerado={extratoGerado}
          onClose={() => setExtratoGerado(null)}
        />
      )}
    </div>
  );
}

function ClientesPagos({ clientes }: { clientes: import('@/hooks/useFinanceiroClientes').ClienteFinanceiro[] }) {
  return <ClientesRecebidos clientes={clientes} />;
}

function TabTodos({ lancamentos, search, onSearchChange }: {
  lancamentos: Array<LancamentoFinanceiro & { cliente_nome: string; cliente_apelido: string | null }>;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou processo..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">{lancamentos.length} lançamentos</span>
      </div>
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium">Descrição</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="text-left p-3 font-medium">Vencimento</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</td></tr>
              ) : lancamentos.map(l => {
                const isPago = l.status === 'pago';
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                const venc = new Date(l.data_vencimento + 'T00:00:00');
                const isVenc = !isPago && venc < hoje;
                return (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium truncate max-w-[160px]">{l.cliente_apelido || l.cliente_nome}</td>
                    <td className="p-3 truncate max-w-[200px] text-muted-foreground">{l.processo_razao_social || l.descricao}</td>
                    <td className="p-3 text-right font-medium">{formatBRL(l.valor)}</td>
                    <td className="p-3">{formatDateBR(l.data_vencimento)}</td>
                    <td className="p-3">
                      {isPago ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">Pago</Badge>
                      ) : isVenc ? (
                        <Badge variant="destructive" className="text-xs">Vencido</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDateBR(l.data_pagamento)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
