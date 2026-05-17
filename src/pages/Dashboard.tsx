import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData, useCountUp } from '@/hooks/useDashboardData';
import { useDSOData } from '@/hooks/useDSOData';
import { getNomeUsuario, getSaudacao } from '@/hooks/useDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { gerarRelatorioMensal } from '@/lib/relatorio-mensal-pdf';
import { isProcessoFinalizado } from '@/types/process';
import { Card } from '@/components/ui/card';
import { GlassCard } from '@/components/ui/glass-card';
import { KPICard } from '@/components/ui/kpi-card';
import { AttentionCard } from '@/components/ui/attention-card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, Clock, CheckCircle, Activity, TrendingUp, TrendingDown,
  AlertTriangle, FileText, Send, PauseCircle, ChevronRight, Check, CreditCard, Download, ClipboardCheck,
  Hourglass, UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import type { LucideIcon } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Alerta {
  id: string;
  titulo: string;
  descricao: string;
  severity: 'critical' | 'warning' | 'info';
  icon: LucideIcon;
  link: string;
  // UX-018 (12/05/2026): Financeiro só lê `location.state.tab` — querystring
  // `?tab=xxx` no link era silenciosamente ignorada. Padronizamos: link tem
  // só o pathname, e a aba alvo vai em `tabState` (consumido via state).
  tabState?: 'a_fazer' | 'em_andamento' | 'historico';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useDashboardData();
  const { data: dsoData } = useDSOData(90, 5);
  const { podeVer, loading: permsLoading, isMaster } = usePermissions();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [diasAlertaPagar, setDiasAlertaPagar] = useState(() => {
    return parseInt(localStorage.getItem('trevo_dias_alerta_pagar') || '7');
  });
  useEffect(() => {
    localStorage.setItem('trevo_dias_alerta_pagar', String(diasAlertaPagar));
  }, [diasAlertaPagar]);

  // Load profile name
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('nome').eq('id', user.id).single().then(({ data }) => {
      if (data?.nome) setProfileName(data.nome);
    });
  }, [user]);

  // Redirect non-dashboard users
  // UX-063 (12/05/2026): incluído 'cadastro_rapido' como primeira opção —
  // pra role 'operacional' (secretária), essa é a tela mais útil do dia.
  // Antes a lista não tinha cadastro_rapido, então caía em /processos.
  useEffect(() => {
    if (permsLoading) return;
    if (podeVer('dashboard')) return;
    const modules = [
      { mod: 'cadastro_rapido', path: '/cadastro-rapido' },
      { mod: 'processos', path: '/processos-ativos' },
      { mod: 'clientes', path: '/clientes' },
      { mod: 'orcamentos', path: '/orcamentos' },
      { mod: 'financeiro', path: '/financeiro' },
      { mod: 'contas_pagar', path: '/contas-pagar' },
      { mod: 'colaboradores', path: '/colaboradores' },
      { mod: 'configuracoes', path: '/configuracoes' },
    ];
    const first = modules.find(m => podeVer(m.mod));
    if (first) {
      navigate(first.path, { replace: true });
    }
  }, [permsLoading, podeVer, navigate]);


  // Fetch mensalistas without invoice this month
  const [mensalistaAlerts, setMensalistaAlerts] = useState<Array<{ id: string; nome: string; valor_base: number; dia: number }>>([]);
  useEffect(() => {
    async function checkMensalistas() {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: mensalistas } = await supabase
        .from('clientes')
        .select('id, nome, apelido, valor_base, dia_vencimento_mensal')
        .eq('tipo', 'MENSALISTA')
        .neq('is_archived', true);

      if (!mensalistas?.length) return;

      const { data: lancMes } = await supabase
        .from('lancamentos')
        .select('cliente_id')
        .eq('tipo', 'receber')
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', fimMes)
        .in('cliente_id', mensalistas.map(m => m.id));

      // Sprint 4.E (13/05/2026 noite): só alerta mensalista sem fatura
      // SE já passou o dia de vencimento do ciclo. Antes: alerta amarelo
      // aparecia desde dia 1 do mês, gerando falso positivo (mensalista
      // com vencimento dia 10 não tinha por que aparecer no dia 2).
      const comFatura = new Set((lancMes || []).map(l => l.cliente_id));
      const diaHoje = now.getDate();
      setMensalistaAlerts(
        mensalistas
          .filter(m => !comFatura.has(m.id))
          .filter(m => diaHoje >= (m.dia_vencimento_mensal || 10))
          .map(m => ({ id: m.id, nome: m.apelido || m.nome, valor_base: Number(m.valor_base || 0), dia: m.dia_vencimento_mensal || 10 }))
      );
    }
    checkMensalistas();
  }, [data]);

  const calc = useMemo(() => {
    if (!data) return null;
    const { lancamentosMes, lancamentosMesAnterior, processos, proximosVencimentos, lancamentosHistorico, lancamentosPagar } = data;

    const totalFaturado = lancamentosMes.reduce((s, l) => s + Number(l.valor), 0);
    const totalRecebido = lancamentosMes
      .filter(l => l.status === 'pago' && l.confirmado_recebimento === true && l.data_pagamento != null)
      .reduce((s, l) => s + Number(l.valor), 0);
    const totalPendente = totalFaturado - totalRecebido;
    const taxaRecebimento = totalFaturado > 0 ? Math.round(totalRecebido / totalFaturado * 100) : 0;

    const totalFatAnt = lancamentosMesAnterior.reduce((s, l) => s + Number(l.valor), 0);
    const variacaoReceita = totalFatAnt > 0
      ? Math.round((totalFaturado - totalFatAnt) / totalFatAnt * 100)
      : totalFaturado > 0 ? 100 : 0;

    const processosAtivos = processos.filter(p => !isProcessoFinalizado(p.etapa)).length;
    const seteDiasAtras = new Date(); seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const processosNovos = processos.filter(p => new Date(p.created_at || '') >= seteDiasAtras).length;

    // Alertas
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const alertas: Alerta[] = [];

    const vencidas = lancamentosMes.filter(l => {
      const venc = new Date(l.data_vencimento + 'T00:00:00');
      return venc < hoje && l.status !== 'pago';
    });
    if (vencidas.length > 0) {
      const valorVencido = vencidas.reduce((s, l) => s + Number(l.valor), 0);
      alertas.push({ id: 'vencidas', titulo: `${vencidas.length} cobranças vencidas`, descricao: `${fmt(valorVencido)} em atraso`, severity: 'critical', icon: AlertTriangle, link: '/financeiro', tabState: 'em_andamento' });
    }

    const semExtrato = lancamentosMes.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada');
    const clientesSemExtrato = new Set(semExtrato.map(l => l.cliente_id)).size;
    if (clientesSemExtrato > 0) {
      alertas.push({ id: 'sem_extrato', titulo: `${clientesSemExtrato} clientes sem extrato`, descricao: 'Processos aguardando geração de extrato', severity: 'warning', icon: FileText, link: '/financeiro', tabState: 'a_fazer' });
    }

    // REL-015 (12/05/2026): processos `aguardando_deferimento` somem do
    // alerta acima porque o filtro é estrito `solicitacao_criada`. Sem
    // alerta dedicado, Thales perde visibilidade dos clientes
    // `momento_faturamento='no_deferimento'` que ainda estão travados.
    const aguardandoDef = lancamentosMes.filter(l => l.etapa_financeiro === 'aguardando_deferimento');
    const clientesAguardandoDef = new Set(aguardandoDef.map(l => l.cliente_id)).size;
    if (clientesAguardandoDef > 0) {
      alertas.push({ id: 'aguardando_deferimento', titulo: `${clientesAguardandoDef} clientes aguardando deferimento`, descricao: 'Processos travados até deferimento ser marcado', severity: 'info', icon: FileText, link: '/financeiro', tabState: 'a_fazer' });
    }

    const naoEnviados = lancamentosMes.filter(l => l.etapa_financeiro === 'cobranca_gerada');
    const clientesNaoEnviados = new Set(naoEnviados.map(l => l.cliente_id)).size;
    if (clientesNaoEnviados > 0) {
      alertas.push({ id: 'nao_enviadas', titulo: `${clientesNaoEnviados} extratos não enviados`, descricao: 'Extratos gerados aguardando envio', severity: 'warning', icon: Send, link: '/financeiro', tabState: 'em_andamento' });
    }

    const parados = processos.filter(p => {
      const dias = Math.floor((Date.now() - new Date(p.updated_at || p.created_at || '').getTime()) / 86400000);
      return dias >= 7 && !isProcessoFinalizado(p.etapa);
    });

    // Auditoria pendente alert
    const naoAuditados = lancamentosMes.filter(l =>
      l.status !== 'pago' && (l as any).auditado === false && l.etapa_financeiro === 'solicitacao_criada'
    );
    if (naoAuditados.length > 0) {
      alertas.push({
        id: 'auditoria_pendente',
        titulo: `${naoAuditados.length} processos aguardando auditoria`,
        descricao: 'Validar antes de cobrar',
        severity: 'warning',
        icon: ClipboardCheck,
        link: '/financeiro',
      });
    }

    if (parados.length > 0) {
      alertas.push({ id: 'parados', titulo: `${parados.length} processos parados`, descricao: 'Sem movimentação há 7+ dias', severity: 'info', icon: PauseCircle, link: '/processos-ativos' });
    }

    // Contas a pagar alerts
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + diasAlertaPagar);
    const contasVencidas = lancamentosPagar.filter((l: any) => {
      const venc = new Date(l.data_vencimento + 'T00:00:00');
      return venc < hoje;
    });
    const contasAVencer = lancamentosPagar.filter((l: any) => {
      const venc = new Date(l.data_vencimento + 'T00:00:00');
      return venc >= hoje && venc <= limite;
    });
    if (contasVencidas.length > 0) {
      const valorVencido = contasVencidas.reduce((s: number, l: any) => s + Number(l.valor), 0);
      alertas.push({ id: 'contas_pagar_vencidas', titulo: `${contasVencidas.length} contas a pagar vencidas`, descricao: `R$ ${valorVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em atraso`, severity: 'critical', icon: CreditCard, link: '/contas-pagar' });
    }
    if (contasAVencer.length > 0) {
      const valorAVencer = contasAVencer.reduce((s: number, l: any) => s + Number(l.valor), 0);
      alertas.push({ id: 'contas_pagar_proximas', titulo: `${contasAVencer.length} contas a pagar nos próximos ${diasAlertaPagar} dias`, descricao: `R$ ${valorAVencer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a vencer`, severity: 'warning', icon: CreditCard, link: '/contas-pagar' });
    }

    // Mensalistas sem fatura no mês
    for (const m of mensalistaAlerts) {
      // UX-062 (12/05/2026): era 'critical' (vermelho), mas mensalista sem fatura
      // no mês é caso normal — fatura ainda vai ser gerada. 'warning' (amarelo)
      // reflete melhor o estado real.
      alertas.push({
        id: `mensalista_${m.id}`,
        titulo: `Mensalista ${m.nome} sem fatura`,
        descricao: `${fmt(m.valor_base)}/mês — dia ${m.dia}`,
        severity: 'warning',
        icon: CreditCard,
        link: `/clientes/${m.id}`,
      });
    }

    // Gráfico 6 meses
    const dadosMensais: { mes: string; recebido: number; pendente: number; vencido: number; total: number }[] = [];
    const agora = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mes = d.getMonth();
      const ano = d.getFullYear();
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(ano).slice(2);
      const lancMes = lancamentosHistorico.filter(l => {
        const ld = new Date(l.data_vencimento || l.created_at || '');
        return ld.getMonth() === mes && ld.getFullYear() === ano;
      });
      const rec = lancMes.filter(l => l.status === 'pago' && l.confirmado_recebimento === true).reduce((s, l) => s + Number(l.valor), 0);
      const venc = lancMes.filter(l => {
        if (l.status === 'pago') return false;
        const dv = l.data_vencimento ? new Date(l.data_vencimento + 'T00:00:00') : null;
        return dv && dv < hoje;
      }).reduce((s, l) => s + Number(l.valor), 0);
      const pend = lancMes.filter(l => {
        if (l.status === 'pago') return false;
        const dv = l.data_vencimento ? new Date(l.data_vencimento + 'T00:00:00') : null;
        return !dv || dv >= hoje;
      }).reduce((s, l) => s + Number(l.valor), 0);
      dadosMensais.push({ mes: label, recebido: rec, pendente: pend, vencido: venc, total: rec + pend + venc });
    }

    // Top clientes
    const clienteMap: Record<string, { nome: string; total: number; qtd: number; clienteId: string; temVencido: boolean; temExtrato: boolean }> = {};
    lancamentosMes.forEach(l => {
      if (!l.cliente_id) return;
      if (!clienteMap[l.cliente_id]) {
        const c = l.clientes as any;
        clienteMap[l.cliente_id] = { nome: c?.apelido || c?.nome || '—', total: 0, qtd: 0, clienteId: l.cliente_id, temVencido: false, temExtrato: false };
      }
      clienteMap[l.cliente_id].total += Number(l.valor);
      clienteMap[l.cliente_id].qtd++;
      if (l.status === 'pago') clienteMap[l.cliente_id].temExtrato = true;
      const venc = new Date(l.data_vencimento + 'T00:00:00');
      if (venc < hoje && l.status !== 'pago') clienteMap[l.cliente_id].temVencido = true;
      if (l.extrato_id) clienteMap[l.cliente_id].temExtrato = true;
    });
    const topClientes = Object.values(clienteMap).sort((a, b) => b.total - a.total).slice(0, 5).map(c => ({
      ...c,
      status: c.temVencido ? 'vencido' as const : c.temExtrato ? 'pendente' as const : 'sem_extrato' as const,
    }));

    return {
      totalFaturado, totalRecebido, totalPendente, taxaRecebimento, variacaoReceita,
      processosAtivos, processosNovos,
      alertas, dadosMensais, topClientes,
      proximosVencimentos: proximosVencimentos.map(v => ({
        ...v,
        cliente_nome: (v.clientes as any)?.nome || '—',
        cliente_apelido: (v.clientes as any)?.apelido || null,
      })),
    };
  }, [data, diasAlertaPagar, mensalistaAlerts]);

  const animFaturado = useCountUp(calc?.totalFaturado ?? 0);
  const animPendente = useCountUp(calc?.totalPendente ?? 0);
  const animRecebido = useCountUp(calc?.totalRecebido ?? 0);
  const animAtivos = useCountUp(calc?.processosAtivos ?? 0, 500);

  // Show fallback for users with no permissions
  // UX-063 (12/05/2026): mensagem antiga ("Aguarde seu administrador...") era
  // desnimadora pra secretária que já tem acesso — só caiu aqui por race do
  // redirect. Agora: saudação + indicação de que o redirect está acontecendo.
  if (!permsLoading && !podeVer('dashboard') && !isMaster()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          {getSaudacao()}, {getNomeUsuario(user?.email, profileName)} <span className="animate-trevo-wave">🍀</span>
        </h2>
        <p className="text-muted-foreground">Carregando seu painel...</p>
      </div>
    );
  }

  if (isLoading || !calc) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }

  const { alertas, dadosMensais, topClientes, proximosVencimentos, variacaoReceita, taxaRecebimento, processosNovos } = calc;

  return (
    <div className="space-y-6">
      {/* Header — saudação personalizada continua, mas com accent verde Trevo */}
      <PageHeader
        title={`${getSaudacao()}, ${getNomeUsuario(user?.email, profileName)} 🍀`}
        subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          podeVer('financeiro') ? (
            <Button
              variant="outline"
              size="sm"
              disabled={gerandoPdf}
              onClick={async () => {
                setGerandoPdf(true);
                try {
                  await gerarRelatorioMensal();
                } finally {
                  setGerandoPdf(false);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {gerandoPdf ? 'Gerando...' : 'Relatório Mensal'}
            </Button>
          ) : null
        }
      />

      {/* SEÇÃO 1: KPIs — auditoria visual Q3 (14/05/2026): KPICard padronizado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 dashboard-section">
        {podeVer('financeiro') && (
          <KPICard
            variant="hero"
            icon={DollarSign}
            label="Receita do mês"
            value={fmt(animFaturado)}
            trend={{ value: variacaoReceita, label: 'vs mês anterior' }}
            onClick={() => navigate('/financeiro')}
          />
        )}
        {podeVer('financeiro') && (
          <KPICard
            variant="warning"
            icon={Clock}
            label="A receber"
            value={fmt(animPendente)}
            hint="pendente de confirmação"
            onClick={() => navigate('/financeiro')}
          />
        )}
        {podeVer('financeiro') && (
          <KPICard
            variant="success"
            icon={CheckCircle}
            label="Recebido"
            value={fmt(animRecebido)}
            hint={`${taxaRecebimento}% do faturado`}
            onClick={() => navigate('/financeiro', { state: { tab: 'historico' } })}
          />
        )}
        <KPICard
          variant="default"
          icon={Activity}
          label="Processos ativos"
          value={animAtivos}
          hint={`${processosNovos} novos esta semana`}
          onClick={() => navigate('/processos-ativos')}
        />
      </div>

      {/* SEÇÃO 1.5: DSO + Top Inadimplentes — Onda 8 pré-viagem (17/05/2026)
          Só pra quem vê financeiro (sem fazer alarde pra operacional). */}
      {podeVer('financeiro') && dsoData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 dashboard-section">
          <KPICard
            variant={
              dsoData.dso.dso_geral > 30 ? 'danger'
              : dsoData.dso.dso_geral > 15 ? 'warning'
              : 'success'
            }
            icon={Hourglass}
            label="DSO (dias médios pra receber)"
            value={`${Number(dsoData.dso.dso_geral).toFixed(1)} dias`}
            hint={`${dsoData.dso.total_lancamentos} lançamentos últimos ${dsoData.dso.dias_lookback}d · ${Number(dsoData.dso.dso_em_aberto || 0).toFixed(0)}d atraso médio em aberto`}
            onClick={() => navigate('/financeiro', { state: { tab: 'em_andamento' } })}
          />
          <KPICard
            variant={dsoData.top.length > 0 ? 'danger' : 'success'}
            icon={UserX}
            label={dsoData.top.length > 0 ? `Top ${dsoData.top.length} inadimplentes` : 'Sem inadimplentes'}
            value={
              dsoData.top.length > 0
                ? fmt(dsoData.top.reduce((s, t) => s + Number(t.valor_total), 0))
                : '🎉'
            }
            hint={
              dsoData.top.length > 0
                ? `${dsoData.top[0].cliente_apelido || dsoData.top[0].cliente_nome}: ${fmt(dsoData.top[0].valor_total)} (${dsoData.top[0].dias_max_atraso}d)`
                : 'Todo mundo em dia'
            }
            onClick={() => navigate('/financeiro', { state: { tab: 'em_andamento' } })}
          />
        </div>
      )}

      {/* SEÇÃO 2: Ações Urgentes */}
      <div className="space-y-2 dashboard-section">
        <div className="flex items-center justify-between">
          <h3 className="label-uppercase">Ações urgentes</h3>
          {podeVer('contas_pagar') && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Alertar contas em</span>
              <Input
                type="number"
                value={diasAlertaPagar}
                onChange={(e) => setDiasAlertaPagar(parseInt(e.target.value) || 7)}
                className="w-16 h-7 text-xs text-center"
                min={1}
                max={90}
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          )}
        </div>
        {(() => {
          const alertasFiltrados = alertas.filter(a => {
            if (['vencidas', 'sem_extrato', 'nao_enviadas', 'aguardando_deferimento'].includes(a.id)) return podeVer('financeiro');
            if (a.id.startsWith('contas_pagar')) return podeVer('contas_pagar');
            return true;
          });
          // UX-026 (12/05/2026): "Tudo em dia!" enganoso quando o user
          // não-master não tem permissão de financeiro mas existem alertas
          // financeiros mascarados. Mostrar texto honesto.
          const haAlertasMascarados = alertas.length > alertasFiltrados.length;
          if (alertasFiltrados.length === 0) {
            return (
              <AttentionCard
                tone="success"
                icon={Check}
                title={haAlertasMascarados ? 'Sem alertas no seu escopo' : 'Tudo em dia!'}
                description={haAlertasMascarados ? 'Existem alertas em módulos fora da sua permissão.' : 'Nenhuma ação urgente no momento.'}
              />
            );
          }
          const toneMap = {
            critical: 'danger',
            warning: 'warning',
            info: 'info',
          } as const;
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {alertasFiltrados.map(alerta => (
                <AttentionCard
                  key={alerta.id}
                  tone={toneMap[alerta.severity]}
                  icon={alerta.icon}
                  title={alerta.titulo}
                  description={alerta.descricao}
                  action={<ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
                  onClick={() => {
                    if (alerta.id === 'auditoria_pendente') {
                      navigate('/financeiro', { state: { tab: 'auditoria' } });
                    } else if (alerta.tabState) {
                      navigate(alerta.link, { state: { tab: alerta.tabState } });
                    } else {
                      navigate(alerta.link);
                    }
                  }}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* SEÇÃO 3 (Pipeline) removida em DECISION-001 Fase 3 (13/05/2026 noite):
          etapa virou binária no banco — gráfico de 5 fatias agrupando 18 etapas
          perdeu sentido. Quantidade de ativos já aparece no cabeçalho. */}

      {/* SEÇÃO 4: Gráfico de Receita - only for financeiro */}
      {podeVer('financeiro') && (
      <div className="space-y-3 dashboard-section">
        <div className="flex items-baseline justify-between">
          <h3 className="label-uppercase">Receita mensal</h3>
          <span className="caption">últimos 6 meses</span>
        </div>
        <Card className="p-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosMensais}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} className="fill-muted-foreground" tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const recebido = payload.find(p => p.dataKey === 'recebido')?.value as number || 0;
                const pendente = payload.find(p => p.dataKey === 'pendente')?.value as number || 0;
                const vencido = payload.find(p => p.dataKey === 'vencido')?.value as number || 0;
                const total = recebido + pendente + vencido;
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
                    <p className="font-bold text-sm mb-2 text-foreground">{label}</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" />Recebido</span><span className="font-bold text-green-500">{fmt(recebido)}</span></div>
                      <div className="flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />Pendente</span><span className="font-bold text-amber-500">{fmt(pendente)}</span></div>
                      {vencido > 0 && <div className="flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Vencido</span><span className="font-bold text-red-500">{fmt(vencido)}</span></div>}
                      <div className="flex justify-between pt-1.5 border-t border-border"><span className="font-bold text-foreground">Total</span><span className="font-bold text-foreground">{fmt(total)}</span></div>
                    </div>
                  </div>
                );
              }} />
              <Bar dataKey="recebido" stackId="a" fill="#22c55e" name="Recebido" />
              <Bar dataKey="pendente" stackId="a" fill="#f59e0b" name="Pendente" />
              <Bar dataKey="vencido" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Vencido" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-5 mt-2">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-green-500" />Recebido</span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-amber-500" />Pendente</span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-red-500" />Vencido</span>
          </div>
        </Card>
      </div>
      )}

      {/* SEÇÃO 5: Top Clientes + Próximos Vencimentos */}
      {podeVer('financeiro') && (
      <div className="grid gap-6 lg:grid-cols-2 dashboard-section">
        {/* Top Clientes */}
        <Card className="p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="heading-2">Top clientes do mês</h3>
            <span className="caption">por valor faturado</span>
          </div>
          {topClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento neste mês</p>
          ) : (
            <div className="space-y-1">
              {topClientes.map((c, i) => {
                const statusConfig = {
                  vencido: { bg: 'bg-destructive/10 text-destructive', dot: 'bg-destructive', label: 'Vencido' },
                  pendente: { bg: 'bg-blue-500/10 text-blue-500', dot: 'bg-blue-500', label: 'Pendente' },
                  sem_extrato: { bg: 'bg-amber-500/10 text-amber-500', dot: 'bg-amber-500', label: 'Sem extrato' },
                }[c.status];
                return (
                  <button
                    key={c.clienteId}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                    onClick={() => navigate(`/clientes/${c.clienteId}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.nome}</p>
                        <p className="caption">{c.qtd} processo{c.qtd !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{fmt(c.total)}</p>
                      <div className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded mt-0.5 ${statusConfig.bg}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Próximos Vencimentos */}
        <Card className="p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="heading-2">Próximos vencimentos</h3>
            <span className="caption">7 dias</span>
          </div>
          {proximosVencimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum vencimento próximo</p>
          ) : (
            <div className="space-y-1">
              {proximosVencimentos.map(item => {
                const diasAte = Math.ceil((new Date(item.data_vencimento + 'T00:00:00').getTime() - Date.now()) / 86400000);
                const dotColor = diasAte < 0 ? 'bg-destructive' : diasAte <= 2 ? 'bg-amber-500' : 'bg-emerald-500';
                const clienteId = (item as any).cliente_id;
                return (
                  <button
                    key={item.id}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left ${clienteId ? 'cursor-pointer hover:bg-muted/50 transition-colors' : 'cursor-default'}`}
                    onClick={() => clienteId && navigate(`/clientes/${clienteId}`, { state: { tab: 'faturas' } })}
                    disabled={!clienteId}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.cliente_apelido || item.cliente_nome}</p>
                        <p className="caption">
                          {new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          {diasAte < 0 ? ` · Vencido há ${Math.abs(diasAte)}d` : diasAte === 0 ? ' · Hoje' : ` · Em ${diasAte}d`}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">{fmt(Number(item.valor))}</p>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      )}
    </div>
  );
}
