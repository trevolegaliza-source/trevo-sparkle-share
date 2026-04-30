import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData, useCountUp } from '@/hooks/useDashboardData';
import { getNomeUsuario, getSaudacao } from '@/hooks/useDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { gerarRelatorioMensal } from '@/lib/relatorio-mensal-pdf';
import { Card } from '@/components/ui/card';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, Clock, CheckCircle, Activity, TrendingUp, TrendingDown,
  AlertTriangle, FileText, Send, PauseCircle, ChevronRight, Check, CreditCard, Download, ClipboardCheck,
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
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useDashboardData();
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
  useEffect(() => {
    if (permsLoading) return;
    if (podeVer('dashboard')) return;
    const modules = [
      { mod: 'processos', path: '/processos' },
      { mod: 'clientes', path: '/clientes' },
      { mod: 'orcamentos', path: '/orcamentos' },
      { mod: 'financeiro', path: '/financeiro' },
      { mod: 'contas_pagar', path: '/contas-pagar' },
      { mod: 'colaboradores', path: '/colaboradores' },
      { mod: 'documentos', path: '/documentos' },
      { mod: 'intel_geografica', path: '/inteligencia-geografica' },
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

      const comFatura = new Set((lancMes || []).map(l => l.cliente_id));
      setMensalistaAlerts(
        mensalistas
          .filter(m => !comFatura.has(m.id))
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

    const processosAtivos = processos.filter(p => !['finalizados', 'arquivo'].includes(p.etapa)).length;
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
      alertas.push({ id: 'vencidas', titulo: `${vencidas.length} cobranças vencidas`, descricao: `${fmt(valorVencido)} em atraso`, severity: 'critical', icon: AlertTriangle, link: '/financeiro?tab=vencidos' });
    }

    const semExtrato = lancamentosMes.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada');
    const clientesSemExtrato = new Set(semExtrato.map(l => l.cliente_id)).size;
    if (clientesSemExtrato > 0) {
      alertas.push({ id: 'sem_extrato', titulo: `${clientesSemExtrato} clientes sem extrato`, descricao: 'Processos aguardando geração de extrato', severity: 'warning', icon: FileText, link: '/financeiro?tab=cobrar' });
    }

    const naoEnviados = lancamentosMes.filter(l => l.etapa_financeiro === 'cobranca_gerada');
    const clientesNaoEnviados = new Set(naoEnviados.map(l => l.cliente_id)).size;
    if (clientesNaoEnviados > 0) {
      alertas.push({ id: 'nao_enviadas', titulo: `${clientesNaoEnviados} extratos não enviados`, descricao: 'Extratos gerados aguardando envio', severity: 'warning', icon: Send, link: '/financeiro?tab=enviados' });
    }

    const parados = processos.filter(p => {
      const dias = Math.floor((Date.now() - new Date(p.updated_at || p.created_at || '').getTime()) / 86400000);
      return dias >= 7 && !['finalizados', 'arquivo'].includes(p.etapa);
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
      alertas.push({ id: 'parados', titulo: `${parados.length} processos parados`, descricao: 'Sem movimentação há 7+ dias', severity: 'info', icon: PauseCircle, link: '/processos' });
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
      alertas.push({
        id: `mensalista_${m.id}`,
        titulo: `Mensalista ${m.nome} sem fatura`,
        descricao: `${fmt(m.valor_base)}/mês — dia ${m.dia}`,
        severity: 'critical',
        icon: CreditCard,
        link: `/clientes/${m.id}`,
      });
    }

    const fases = [
      { id: 'entrada', nome: 'Entrada', etapas: ['recebidos', 'analise_documental'], cor: 'bg-blue-500' },
      { id: 'andamento', nome: 'Em andamento', etapas: ['contrato', 'viabilidade', 'dbe', 'vre', 'em_analise'], cor: 'bg-teal-500' },
      { id: 'pendencias', nome: 'Pendências', etapas: ['aguardando_pagamento', 'taxa_paga', 'assinaturas', 'assinado'], cor: 'bg-amber-500' },
      { id: 'finalizacao', nome: 'Finalização', etapas: ['registro', 'mat', 'inscricao_me', 'alvaras', 'conselho'], cor: 'bg-purple-500' },
      { id: 'concluido', nome: 'Concluídos', etapas: ['finalizados'], cor: 'bg-green-500' },
    ].map(f => ({ ...f, qtd: processos.filter(p => f.etapas.includes(p.etapa)).length }));

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
      alertas, fases, dadosMensais, topClientes,
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
  if (!permsLoading && !podeVer('dashboard') && !isMaster()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Bem-vindo ao sistema.</h2>
        <p className="text-muted-foreground">Aguarde seu administrador configurar seu acesso.</p>
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

  const { alertas, fases, dadosMensais, topClientes, proximosVencimentos, variacaoReceita, taxaRecebimento, processosNovos } = calc;
  const totalPipeline = fases.reduce((s, f) => s + f.qtd, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dashboard-section flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {getSaudacao()}, {getNomeUsuario(user?.email, profileName)} <span className="animate-trevo-wave">🍀</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {podeVer('financeiro') && (
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
        )}
      </div>

      {/* SEÇÃO 1: KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 dashboard-section">
        {/* Receita */}
        {podeVer('financeiro') && (
          <GlassCard variant="service" glowColor="rgba(34, 197, 94, 0.12)" onClick={() => navigate('/financeiro')}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Receita do mês</span>
              <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">{fmt(animFaturado)}</p>
            <div className="flex items-center gap-1 mt-2">
              {variacaoReceita >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
              <span className={`text-xs ${variacaoReceita >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {variacaoReceita >= 0 ? '+' : ''}{variacaoReceita}% vs mês anterior
              </span>
            </div>
          </GlassCard>
        )}

        {/* A Receber */}
        {podeVer('financeiro') && (
          <GlassCard variant="service" glowColor="rgba(245, 158, 11, 0.12)" onClick={() => navigate('/financeiro')}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">A receber</span>
              <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-amber-400">{fmt(animPendente)}</p>
            <p className="text-xs text-muted-foreground mt-2">pendente de confirmação</p>
          </GlassCard>
        )}

        {/* Recebido */}
        {podeVer('financeiro') && (
          <GlassCard variant="service" glowColor="rgba(59, 130, 246, 0.12)">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Recebido</span>
              <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-400">{fmt(animRecebido)}</p>
            <div className="w-full bg-foreground/10 rounded-full h-2 mt-2">
              <div className="bg-emerald-400 h-2 rounded-full transition-all duration-500" style={{ width: `${taxaRecebimento}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{taxaRecebimento}% do faturado</p>
          </GlassCard>
        )}

        {/* Processos Ativos */}
        <GlassCard variant="service" glowColor="rgba(59, 130, 246, 0.12)" onClick={() => navigate('/processos')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Processos ativos</span>
            <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground">{animAtivos}</p>
          <p className="text-xs text-muted-foreground mt-2">{processosNovos} novos esta semana</p>
        </GlassCard>
      </div>

      {/* SEÇÃO 2: Ações Urgentes */}
      <div className="space-y-2 dashboard-section">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações urgentes</h3>
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
            if (['vencidas', 'sem_extrato', 'nao_enviadas'].includes(a.id)) return podeVer('financeiro');
            if (a.id.startsWith('contas_pagar')) return podeVer('contas_pagar');
            return true;
          });
          if (alertasFiltrados.length === 0) {
            return (
              <GlassCard variant="service" glowColor="rgba(34, 197, 94, 0.15)">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-emerald-400">Tudo em dia!</p>
                    <p className="text-xs text-muted-foreground">Nenhuma ação urgente no momento.</p>
                  </div>
                </div>
              </GlassCard>
            );
          }
          const glowMap = {
            critical: 'rgba(239, 68, 68, 0.12)',
            warning: 'rgba(245, 158, 11, 0.12)',
            info: 'rgba(59, 130, 246, 0.12)',
          };
          const iconColorMap = {
            critical: 'text-red-400',
            warning: 'text-amber-400',
            info: 'text-blue-400',
          };
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {alertasFiltrados.map(alerta => (
                <GlassCard key={alerta.id} variant="service" glowColor={glowMap[alerta.severity]} onClick={() => {
                  if (alerta.id === 'auditoria_pendente') {
                    navigate('/financeiro', { state: { tab: 'auditoria' } });
                  } else {
                    navigate(alerta.link);
                  }
                }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center">
                        <alerta.icon className={`h-4 w-4 ${iconColorMap[alerta.severity]}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{alerta.titulo}</p>
                        <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </GlassCard>
              ))}
            </div>
          );
        })()}
      </div>

      {/* SEÇÃO 3: Pipeline */}
      {totalPipeline > 0 && (
        <div className="space-y-3 dashboard-section">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline de processos</h3>
          <div className="flex gap-0.5 h-8 rounded-lg overflow-hidden">
            {fases.filter(f => f.qtd > 0).map(fase => (
              <div
                key={fase.id}
                className={`flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 ${fase.cor}`}
                style={{ flex: fase.qtd }}
                onClick={() => navigate('/processos')}
                title={`${fase.nome}: ${fase.qtd}`}
              >
                <span className="text-[10px] font-bold text-foreground drop-shadow-sm">{fase.qtd}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {fases.map(fase => (
              <span key={fase.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${fase.cor}`} />
                {fase.nome} ({fase.qtd})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO 4: Gráfico de Receita - only for financeiro */}
      {podeVer('financeiro') && (
      <div className="space-y-3 dashboard-section">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita mensal</h3>
        <Card className="p-4">
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
        <Card className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Top clientes do mês</h3>
          {topClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum lançamento neste mês</p>
          ) : (
            <div className="space-y-3">
              {topClientes.map((c, i) => {
                const statusConfig = {
                  vencido: { bg: 'bg-destructive/10 text-destructive', dot: 'bg-destructive', label: 'Vencido' },
                  pendente: { bg: 'bg-blue-500/10 text-blue-500', dot: 'bg-blue-500', label: 'Pendente' },
                  sem_extrato: { bg: 'bg-amber-500/10 text-amber-500', dot: 'bg-amber-500', label: 'Sem extrato' },
                }[c.status];
                return (
                  <div key={c.clienteId} className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors" onClick={() => navigate(`/clientes/${c.clienteId}`)}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.qtd} processos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fmt(c.total)}</p>
                      <div className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${statusConfig.bg}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Próximos Vencimentos */}
        <Card className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Próximos vencimentos</h3>
          {proximosVencimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum vencimento próximo</p>
          ) : (
            <div className="space-y-2">
              {proximosVencimentos.map(item => {
                const diasAte = Math.ceil((new Date(item.data_vencimento + 'T00:00:00').getTime() - Date.now()) / 86400000);
                const dotColor = diasAte < 0 ? 'bg-destructive' : diasAte <= 2 ? 'bg-amber-500' : 'bg-green-500';
                return (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                      <div>
                        <p className="text-sm">{item.cliente_apelido || item.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          {diasAte < 0 ? ` · Vencido há ${Math.abs(diasAte)}d` : diasAte === 0 ? ' · Hoje' : ` · Em ${diasAte}d`}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium">{fmt(Number(item.valor))}</p>
                  </div>
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
