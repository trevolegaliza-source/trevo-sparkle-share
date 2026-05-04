import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, ChevronLeft, ChevronRight, Users, CheckSquare, X, Check, MoreHorizontal, CheckCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import FluxoProximos15Dias from '@/components/contas-pagar/FluxoProximos15Dias';
import ContasPagarKPIs, { type KpiFilter } from '@/components/contas-pagar/ContasPagarKPIs';
import CategoriaAccordion from '@/components/contas-pagar/CategoriaAccordion';
import ContasPagarLista from '@/components/contas-pagar/ContasPagarLista';
import RecorrentesTab from '@/components/contas-pagar/RecorrentesTab';
import HistoricoPagamentos from '@/components/contas-pagar/HistoricoPagamentos';
import ProvisaoBarra from '@/components/contas-pagar/ProvisaoBarra';
import DespesaFormModal from '@/components/contas-pagar/DespesaFormModal';
import RecorrenteFormModal from '@/components/contas-pagar/RecorrenteFormModal';
import MarcarPagoModal from '@/components/contas-pagar/MarcarPagoModal';
import MarcarPagoBulkModal from '@/components/contas-pagar/MarcarPagoBulkModal';
import ImportarFolhaModal from '@/components/contas-pagar/ImportarFolhaModal';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';

import {
  useLancamentosPagar,
  useLancamentosPagarByDate,
  useDespesasRecorrentes,
  useCreateDespesa,
  useUpdateDespesa,
  useDeleteDespesa,
  useMarcarPago,
  useCreateRecorrente,
  useUpdateRecorrente,
  useToggleRecorrente,
  useDeleteRecorrente,
  useMarcarPagoBulk,
  gerarLancamentosRecorrentes,
} from '@/hooks/useContasPagar';
import { corrigirDatasExistentes } from '@/lib/gerar-verbas';
import { useColaboradores } from '@/hooks/useColaboradores';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';

const MESES_NAV = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function ContasPagar() {
  const { podeCriar, podeEditar, podeExcluir, podeAprovar } = usePermissions();
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // Queries
  const { data: lancByComp } = useLancamentosPagar(viewMonth, viewYear);
  const { data: lancByDate } = useLancamentosPagarByDate(viewMonth, viewYear);
  const { data: recorrentes = [] } = useDespesasRecorrentes();
  const { data: colaboradores = [] } = useColaboradores();
  const queryClient = useQueryClient();

  // Colaboradores map
  const colabMap = useMemo(() => {
    const m = new Map<string, string>();
    colaboradores.forEach((c: any) => m.set(c.id, c.nome));
    return m;
  }, [colaboradores]);

  // Merge & enrich with colaborador name
  const lancamentos = useMemo(() => {
    const compSet = new Set((lancByComp || []).map(l => l.id));
    const legacy = (lancByDate || []).filter(l => !compSet.has(l.id));
    const all = [...(lancByComp || []), ...legacy];
    return all.map(l => ({
      ...l,
      colaborador_nome: l.colaborador_id ? colabMap.get(l.colaborador_id) || null : null,
    }));
  }, [lancByComp, lancByDate, colabMap]);

  // Mutations
  const createDespesa = useCreateDespesa();
  const updateDespesa = useUpdateDespesa();
  const deleteDespesa = useDeleteDespesa();
  const marcarPago = useMarcarPago();
  const createRecorrente = useCreateRecorrente();
  const updateRecorrente = useUpdateRecorrente();
  const toggleRecorrente = useToggleRecorrente();
  const deleteRecorrente = useDeleteRecorrente();

  // Auto-generate recurring
  const [gerado, setGerado] = useState<string>('');
  useEffect(() => {
    const key = `${viewMonth}-${viewYear}`;
    if (gerado === key) return;
    setGerado(key);
    gerarLancamentosRecorrentes(viewMonth, viewYear)
      .then(count => {
        if (count > 0) {
          toast.success(`${count} lançamento(s) recorrente(s) gerado(s)`);
          queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
          queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
        }
      })
      .catch(() => { /* silent */ });
  }, [viewMonth, viewYear, gerado, queryClient]);

  // Demanda Thales 30/04: corrigir vencimentos pendentes que caíram em
  // feriado/fim-de-semana (ex: 1/5/2026 — Dia do Trabalho). Roda uma vez
  // por sessão. Usa fallback hardcoded em business-days.ts caso BrasilAPI
  // falhe. Idempotente — só shifta pendente/atrasado, nunca toca pago.
  const [datasCorrigidas, setDatasCorrigidas] = useState(false);
  useEffect(() => {
    if (datasCorrigidas) return;
    setDatasCorrigidas(true);
    corrigirDatasExistentes()
      .then(count => {
        if (count > 0) {
          toast.success(`${count} vencimento(s) reagendado(s) por feriado/fim-de-semana`);
          queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
          queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
        }
      })
      .catch(() => { /* silent */ });
  }, [datasCorrigidas, queryClient]);

  // Modal states
  const [despesaModal, setDespesaModal] = useState(false);
  const [editDespesa, setEditDespesa] = useState<any>(null);
  const [recorrenteModal, setRecorrenteModal] = useState(false);
  const [editRecorrente, setEditRecorrente] = useState<any>(null);
  const [pagoModal, setPagoModal] = useState<any>(null);
  const [folhaModal, setFolhaModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkPayModal, setShowBulkPayModal] = useState(false);
  const marcarPagoBulk = useMarcarPagoBulk();
  const [activeTab, setActiveTab] = useState('visao');
  const [diasAlerta, setDiasAlerta] = useState(() => parseInt(localStorage.getItem('trevo_dias_alerta_pagar') || '7'));
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('total');

  const selectableIds = useMemo(() => {
    return lancamentos.filter(l => l.status !== 'pago').map(l => l.id);
  }, [lancamentos]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === selectableIds.length) return new Set();
      return new Set(selectableIds);
    });
  }, [selectableIds]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    // Volta pra Visão se estava em Lista (Lista some do menu sem seleção/filtro)
    setActiveTab(prev => prev === 'lista' ? 'visao' : prev);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('lancamentos').delete().in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} lançamento(s) excluído(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
      exitSelectionMode();
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + e.message);
    } finally {
      setBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }, [selectedIds, queryClient, exitSelectionMode]);

  // KPIs
  const hoje = new Date().toISOString().split('T')[0];
  const totalPrevisto = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const totalPendente = lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const totalVencido = lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento < hoje).reduce((s, l) => s + Number(l.valor), 0);

  // Urgency groups
  // Aplica mergeVtVr ANTES dos filtros pra contadores ((10) → (5)) e
  // ordenação refletirem a tela já agregada. UrgencySection passa a
  // receber items pré-mergidos — não re-mescla.
  const urgencyGroups = useMemo(() => {
    const hojeDate = new Date(); hojeDate.setHours(0, 0, 0, 0);
    const limiteAlerta = new Date(hojeDate);
    limiteAlerta.setDate(limiteAlerta.getDate() + diasAlerta);
    const hojeStr = hojeDate.toISOString().split('T')[0];

    const merged = mergeVtVr(lancamentos);

    const vencidas = merged.filter(l => {
      const v = new Date(l.data_vencimento + 'T00:00:00');
      return l.status !== 'pago' && v < hojeDate;
    }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

    const hojeItems = merged.filter(l => {
      return l.status !== 'pago' && l.data_vencimento === hojeStr;
    }).sort((a, b) => (a.colaborador_nome || a.descricao || '').localeCompare(b.colaborador_nome || b.descricao || ''));

    const proximas = merged.filter(l => {
      const v = new Date(l.data_vencimento + 'T00:00:00');
      return l.status !== 'pago' && v > hojeDate && v <= limiteAlerta;
    }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

    const futuras = merged.filter(l => {
      const v = new Date(l.data_vencimento + 'T00:00:00');
      return l.status !== 'pago' && v > limiteAlerta;
    }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

    const pagas = merged.filter(l => l.status === 'pago')
      .sort((a, b) => (b.data_pagamento || '').localeCompare(a.data_pagamento || ''));

    return { vencidas, hojeItems, proximas, futuras, pagas };
  }, [lancamentos, diasAlerta]);

  // Navigation
  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Handlers
  const handleSaveDespesa = useCallback((lancamento: Record<string, any>, recorrente?: Record<string, any>) => {
    if (lancamento.id) {
      const { id, ...rest } = lancamento;
      updateDespesa.mutate({ id, ...rest });
    } else {
      createDespesa.mutate(lancamento);
    }
    if (recorrente) {
      createRecorrente.mutate(recorrente);
    }
  }, [createDespesa, updateDespesa, createRecorrente]);

  const handleSaveRecorrente = useCallback((data: Record<string, any>) => {
    if (data.id) {
      const { id, ...rest } = data;
      updateRecorrente.mutate({ id, ...rest });
    } else {
      createRecorrente.mutate(data);
    }
  }, [createRecorrente, updateRecorrente]);

  const handleMarcarPago = useCallback((id: string, dataPagamento: string, comprovanteUrl?: string) => {
    marcarPago.mutate({ id, data_pagamento: dataPagamento, comprovante_url: comprovanteUrl });
  }, [marcarPago]);

  const handleImportarFolha = useCallback((lancamentos: Record<string, any>[]) => {
    lancamentos.forEach(l => createDespesa.mutate(l));
  }, [createDespesa]);

  const handleDelete = (l: any) => {
    setDeleteTarget(l);
    setShowPasswordDialog(true);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteDespesa.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleKpiFilter = useCallback((filter: KpiFilter) => {
    setKpiFilter(filter);
    if (filter !== 'total') {
      setActiveTab('lista');
    } else {
      // Limpou filtro → volta pra Visão
      setActiveTab(prev => prev === 'lista' ? 'visao' : prev);
    }
  }, []);

  // Demanda Thales 30/04 (3.1): pagar VT+VR agregado abre o modal bulk
  // pré-selecionado com os 2 IDs. UM PIX, UMA confirmação, mantém histórico
  // contábil separado VT/VR no banco.
  const handlePagarMerged = useCallback((merged: any) => {
    setSelectedIds(new Set(merged.ids));
    setShowBulkPayModal(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Fluxo 15 dias */}
      <FluxoProximos15Dias />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">Gestão de despesas operacionais e provisão</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month Navigation */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg px-2 py-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground min-w-[130px] text-center">
              {MESES_NAV[viewMonth - 1]} {viewYear}
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {selectionMode ? (
            <Button size="sm" variant="outline" onClick={exitSelectionMode}>
              <X className="h-4 w-4 mr-1" />Cancelar
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { setSelectionMode(true); setActiveTab('lista'); }}>
              <CheckSquare className="h-4 w-4 mr-1" />Selecionar
            </Button>
          )}
          {podeCriar('contas_pagar') && (
            <Button size="sm" variant="outline" onClick={() => setFolhaModal(true)}>
              <Users className="h-4 w-4 mr-1" />Importar Folha
            </Button>
          )}
          {podeCriar('contas_pagar') && (
            <Button size="sm" onClick={() => { setEditDespesa(null); setDespesaModal(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nova Despesa
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <ContasPagarKPIs
        totalPrevisto={totalPrevisto}
        totalPago={totalPago}
        totalPendente={totalPendente}
        totalVencido={totalVencido}
        activeFilter={kpiFilter}
        onFilterChange={handleKpiFilter}
      />

      {/* Dias alerta control */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Alertar contas em</span>
          <Input
            type="number"
            value={diasAlerta}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 7;
              setDiasAlerta(v);
              localStorage.setItem('trevo_dias_alerta_pagar', String(v));
            }}
            className="w-16 h-8 text-center text-sm"
            min={1} max={90}
          />
          <span className="text-sm text-muted-foreground">dias</span>
        </div>
      </div>

      {/* Tabs
         Demanda Thales 30/04 (4.1+4.2): aba "Lista" removida do menu (acessada
         só via Selecionar/KPI por código). Urgência+Categoria fundidas em
         "Visão" com 2 colunas lado a lado (Opção C). */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v !== 'lista') { exitSelectionMode(); setKpiFilter('total'); } }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao">Visão</TabsTrigger>
          {/* Aba Lista só aparece quando user entra em modo Seleção ou aplica filtro KPI */}
          {(selectionMode || kpiFilter !== 'total') && (
            <TabsTrigger value="lista">Lista</TabsTrigger>
          )}
          <TabsTrigger value="recorrentes">Recorrentes</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="visao">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Coluna esquerda: Urgência cronológica */}
            <div className="space-y-6">
            {/* VENCIDAS */}
            <UrgencySection
              title={`⚠️ VENCIDAS (${urgencyGroups.vencidas.length})`}
              items={urgencyGroups.vencidas}
              variant="destructive"
              onPagar={podeAprovar('contas_pagar') ? (l: any) => setPagoModal(l) : undefined}
              onPagarMerged={podeAprovar('contas_pagar') ? handlePagarMerged : undefined}
              onEdit={podeEditar('contas_pagar') ? (l: any) => { setEditDespesa(l); setDespesaModal(true); } : undefined}
              onDelete={podeExcluir('contas_pagar') ? handleDelete : undefined}
            />

            {/* HOJE */}
            <UrgencySection
              title={`⏰ HOJE (${urgencyGroups.hojeItems.length})`}
              items={urgencyGroups.hojeItems}
              variant="warning"
              onPagar={podeAprovar('contas_pagar') ? (l: any) => setPagoModal(l) : undefined}
              onPagarMerged={podeAprovar('contas_pagar') ? handlePagarMerged : undefined}
              onEdit={podeEditar('contas_pagar') ? (l: any) => { setEditDespesa(l); setDespesaModal(true); } : undefined}
              onDelete={podeExcluir('contas_pagar') ? handleDelete : undefined}
              alwaysShow
            />

            {/* PRÓXIMOS N DIAS */}
            {urgencyGroups.proximas.length > 0 && (
              <UrgencySection
                title={`📅 PRÓXIMOS ${diasAlerta} DIAS (${urgencyGroups.proximas.length})`}
                items={urgencyGroups.proximas}
                variant="warning"
                onPagar={podeAprovar('contas_pagar') ? (l: any) => setPagoModal(l) : undefined}
                onPagarMerged={podeAprovar('contas_pagar') ? handlePagarMerged : undefined}
                onEdit={podeEditar('contas_pagar') ? (l: any) => { setEditDespesa(l); setDespesaModal(true); } : undefined}
                onDelete={podeExcluir('contas_pagar') ? handleDelete : undefined}
              />
            )}

            {/* DEMAIS */}
            {urgencyGroups.futuras.length > 0 && (
              <UrgencySection
                title={`📋 DEMAIS DO MÊS (${urgencyGroups.futuras.length})`}
                items={urgencyGroups.futuras}
                variant="default"
                onPagar={podeAprovar('contas_pagar') ? (l: any) => setPagoModal(l) : undefined}
                onPagarMerged={podeAprovar('contas_pagar') ? handlePagarMerged : undefined}
                onEdit={podeEditar('contas_pagar') ? (l: any) => { setEditDespesa(l); setDespesaModal(true); } : undefined}
                onDelete={podeExcluir('contas_pagar') ? handleDelete : undefined}
              />
            )}

            {/* PAGAS */}
            {urgencyGroups.pagas.length > 0 && (
              <UrgencySection
                title={`✅ PAGAS ESTE MÊS (${urgencyGroups.pagas.length})`}
                items={urgencyGroups.pagas}
                variant="success"
                onPagar={undefined}
                onEdit={podeEditar('contas_pagar') ? (l: any) => { setEditDespesa(l); setDespesaModal(true); } : undefined}
                onDelete={podeExcluir('contas_pagar') ? handleDelete : undefined}
                groupByDate={false}
              />
            )}

            {lancamentos.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhuma despesa neste período</p>
              </div>
            )}
            </div>

            {/* Coluna direita: Categoria */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">📂 POR CATEGORIA</h3>
              <CategoriaAccordion
                lancamentos={lancamentos}
                onEdit={podeEditar('contas_pagar') ? (l => { setEditDespesa(l); setDespesaModal(true); }) : undefined}
                onMarcarPago={podeAprovar('contas_pagar') ? (l => setPagoModal(l)) : undefined}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lista">
          <ContasPagarLista
            lancamentos={lancamentos}
            onEdit={podeEditar('contas_pagar') ? (l => { setEditDespesa(l); setDespesaModal(true); }) : (() => {})}
            onMarcarPago={podeAprovar('contas_pagar') ? (l => setPagoModal(l)) : (() => {})}
            onDelete={podeExcluir('contas_pagar') ? handleDelete : (() => {})}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            hideEdit={!podeEditar('contas_pagar')}
            hideDelete={!podeExcluir('contas_pagar')}
            hideApprove={!podeAprovar('contas_pagar')}
            kpiFilter={kpiFilter}
          />
        </TabsContent>

        <TabsContent value="recorrentes">
          <RecorrentesTab
            recorrentes={recorrentes}
            onNew={() => { setEditRecorrente(null); setRecorrenteModal(true); }}
            onEdit={r => { setEditRecorrente(r); setRecorrenteModal(true); }}
            onToggle={r => toggleRecorrente.mutate({ id: r.id, ativo: !r.ativo })}
            onDelete={r => deleteRecorrente.mutate(r.id)}
          />
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoPagamentos />
        </TabsContent>
      </Tabs>

      {/* Provisão */}
      <ProvisaoBarra recorrentes={recorrentes} mesAtual={viewMonth} anoAtual={viewYear} />

      {/* Bulk selection bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.size === selectableIds.length && selectableIds.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">Selecionar todos</span>
              <span className="text-sm font-semibold text-foreground ml-4">
                {selectedIds.size} {selectedIds.size === 1 ? 'ITEM SELECIONADO' : 'ITENS SELECIONADOS'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exitSelectionMode}>Cancelar</Button>
              {podeAprovar('contas_pagar') && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() => setShowBulkPayModal(true)}
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Marcar Pagos
                </Button>
              )}
              {podeExcluir('contas_pagar') && (
                <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
                  Excluir Seleção
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <DespesaFormModal
        open={despesaModal}
        onClose={() => { setDespesaModal(false); setEditDespesa(null); }}
        onSave={handleSaveDespesa}
        editData={editDespesa}
        defaultMes={viewMonth}
        defaultAno={viewYear}
      />

      <RecorrenteFormModal
        open={recorrenteModal}
        onClose={() => { setRecorrenteModal(false); setEditRecorrente(null); }}
        onSave={handleSaveRecorrente}
        editData={editRecorrente}
      />

      <MarcarPagoModal
        lancamento={pagoModal}
        open={!!pagoModal}
        onClose={() => setPagoModal(null)}
        onConfirm={handleMarcarPago}
      />

      <ImportarFolhaModal
        open={folhaModal}
        onClose={() => setFolhaModal(false)}
        onConfirm={handleImportarFolha}
        mes={viewMonth}
        ano={viewYear}
      />

      <PasswordConfirmDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onConfirm={confirmDelete}
      />

      {/* Bulk payment modal */}
      <MarcarPagoBulkModal
        open={showBulkPayModal}
        onClose={() => setShowBulkPayModal(false)}
        lancamentos={lancamentos.filter(l => selectedIds.has(l.id))}
        onConfirm={async (ids, dataPagamento, comprovanteUrl) => {
          await marcarPagoBulk.mutateAsync({ ids, data_pagamento: dataPagamento, comprovante_url: comprovanteUrl });
          exitSelectionMode();
        }}
      />

      {/* Bulk delete confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {selectedIds.size} lançamento{selectedIds.size > 1 ? 's' : ''}.
              <br />Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Demanda Thales 30/04 (3.1): VT+VR pagos como UM PIX único por colaborador.
 * Agrega VT (Vale Transporte) + VR (Vale Refeição) do mesmo colaborador na
 * mesma data de vencimento em uma linha única "BENEFÍCIOS — VT+VR". Se só
 * um existir, passa direto sem agregar. Não mexe no DB — agregação apenas
 * visual; pagar marca os 2 IDs simultaneamente via bulk modal.
 */
function mergeVtVr(items: any[]): any[] {
  const out: any[] = [];
  // Map: `${colab_id}::${data_vencimento}` → { vt?, vr? }
  const benefMap = new Map<string, { vt?: any; vr?: any }>();
  for (const l of items) {
    const isVt = l.subcategoria === 'Vale Transporte (VT)';
    const isVr = l.subcategoria === 'Vale Refeição (VR)';
    if ((isVt || isVr) && l.colaborador_id) {
      const key = `${l.colaborador_id}::${l.data_vencimento}`;
      const entry = benefMap.get(key) || {};
      if (isVt) entry.vt = l; else entry.vr = l;
      benefMap.set(key, entry);
    } else {
      out.push(l);
    }
  }
  benefMap.forEach((pair, key) => {
    if (pair.vt && pair.vr) {
      const allPago = pair.vt.status === 'pago' && pair.vr.status === 'pago';
      out.push({
        __merged: true,
        id: `merged-${key}`,
        ids: [pair.vt.id, pair.vr.id],
        colaborador_id: pair.vt.colaborador_id,
        colaborador_nome: pair.vt.colaborador_nome || pair.vr.colaborador_nome,
        valor: Number(pair.vt.valor) + Number(pair.vr.valor),
        vtValor: Number(pair.vt.valor),
        vrValor: Number(pair.vr.valor),
        data_vencimento: pair.vt.data_vencimento,
        data_pagamento: allPago ? (pair.vt.data_pagamento || pair.vr.data_pagamento) : null,
        status: allPago ? 'pago' : 'pendente',
        categoria: 'folha',
        items: [pair.vt, pair.vr],
      });
    } else {
      // Apenas um lado existe — passa direto
      if (pair.vt) out.push(pair.vt);
      if (pair.vr) out.push(pair.vr);
    }
  });
  return out;
}

// ── Urgency Section with day grouping ──
function UrgencySection({ title, items, variant, onPagar, onPagarMerged, onEdit, onDelete, alwaysShow, groupByDate = true }: {
  title: string;
  items: any[];
  variant: 'destructive' | 'warning' | 'default' | 'success';
  onPagar?: (l: any) => void;
  onPagarMerged?: (merged: any) => void;
  onEdit?: (l: any) => void;
  onDelete?: (l: any) => void;
  alwaysShow?: boolean;
  groupByDate?: boolean;
}) {
  const borderClass = {
    destructive: 'border-destructive/30',
    warning: 'border-warning/30',
    default: 'border-border',
    success: 'border-primary/30',
  }[variant];

  const bgClass = {
    destructive: 'bg-destructive/5',
    warning: 'bg-warning/5',
    default: '',
    success: 'bg-primary/5',
  }[variant];

  // items já vem pré-mergido do urgencyGroups (parent). Não re-mescla aqui.
  // Group items by date
  const dayGroups = useMemo(() => {
    if (!groupByDate) return null;
    const groups = new Map<string, any[]>();
    items.forEach(l => {
      const key = l.data_vencimento;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(l);
    });
    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items,
      total: items.reduce((s: number, l: any) => s + Number(l.valor), 0),
    }));
  }, [items, groupByDate]);

  if (!alwaysShow && items.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>

      {items.length === 0 && alwaysShow && (
        <p className="text-sm text-muted-foreground italic pl-2">Nenhum lançamento</p>
      )}

      {groupByDate && dayGroups ? (
        <div className="space-y-4">
          {dayGroups.map(group => {
            const d = new Date(group.date + 'T12:00:00');
            const diaSemana = DIAS_SEMANA[d.getDay()];
            const dataFmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

            return (
              <div key={group.date}>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-xs font-semibold text-foreground">
                    {dataFmt} · {diaSemana}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {fmt(group.total)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map((l: any) => (
                    <LancamentoRow key={l.id} l={l} variant={variant} borderClass={borderClass} bgClass={bgClass} onPagar={onPagar} onPagarMerged={onPagarMerged} onEdit={onEdit} onDelete={onDelete} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(l => (
            <LancamentoRow key={l.id} l={l} variant={variant} borderClass={borderClass} bgClass={bgClass} onPagar={onPagar} onPagarMerged={onPagarMerged} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single row inside urgency section ──
function LancamentoRow({ l, variant, borderClass, bgClass, onPagar, onPagarMerged, onEdit, onDelete }: {
  l: any;
  variant: string;
  borderClass: string;
  bgClass: string;
  onPagar?: (l: any) => void;
  onPagarMerged?: (merged: any) => void;
  onEdit?: (l: any) => void;
  onDelete?: (l: any) => void;
}) {
  const hojeDate = new Date(); hojeDate.setHours(0, 0, 0, 0);
  const venc = new Date(l.data_vencimento + 'T00:00:00');
  const diasAte = Math.ceil((venc.getTime() - hojeDate.getTime()) / 86400000);
  const pago = l.status === 'pago';
  const merged = l.__merged === true;

  const catEmojis: Record<string, string> = {
    folha: '💰', infraestrutura: '🏢', software: '💻', impostos: '📋',
    servicos: '🔧', marketing: '📢', outros: '📌',
  };

  // Title customizado para agregado VT+VR
  const titulo = merged
    ? `BENEFÍCIOS — VT + VR`
    : (l.subcategoria || l.descricao);

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${borderClass} ${bgClass}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base">{merged ? '🍱' : (catEmojis[l.categoria] || '📌')}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {titulo}
            {l.colaborador_nome && (
              <span className="text-muted-foreground font-normal"> — {l.colaborador_nome}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {pago
              ? `Pago em ${l.data_pagamento ? new Date(l.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}`
              : diasAte < 0
                ? `Venceu há ${Math.abs(diasAte)} dia${Math.abs(diasAte) > 1 ? 's' : ''}`
                : diasAte === 0
                  ? `Vence HOJE`
                  : `Vence em ${diasAte} dia${diasAte > 1 ? 's' : ''}`
            }
            {merged
              ? ` · VT ${fmt(l.vtValor)} + VR ${fmt(l.vrValor)}`
              : (l.categoria && ` · ${l.categoria}`)
            }
          </p>
          {l.observacoes_financeiro && <p className="text-xs text-muted-foreground mt-0.5">💬 {l.observacoes_financeiro}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={`text-sm font-bold ${
          pago ? 'text-primary' : variant === 'destructive' ? 'text-destructive' : 'text-foreground'
        }`}>
          {fmt(Number(l.valor))}
        </span>

        {!pago && (merged
          ? (onPagarMerged && (
              <Button size="sm" variant="outline" onClick={() => onPagarMerged(l)} className="h-7 text-xs">
                <Check className="h-3 w-3 mr-1" /> Pagar VT+VR
              </Button>
            ))
          : (onPagar && (
              <Button size="sm" variant="outline" onClick={() => onPagar(l)} className="h-7 text-xs">
                <Check className="h-3 w-3 mr-1" /> Pagar
              </Button>
            ))
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {merged ? (
              <>
                {onEdit && <DropdownMenuItem onClick={() => onEdit(l.items[0])}>Editar VT</DropdownMenuItem>}
                {onEdit && <DropdownMenuItem onClick={() => onEdit(l.items[1])}>Editar VR</DropdownMenuItem>}
              </>
            ) : (
              <>
                {onEdit && <DropdownMenuItem onClick={() => onEdit(l)}>Editar</DropdownMenuItem>}
                {onDelete && <DropdownMenuItem onClick={() => onDelete(l)} className="text-destructive">Excluir</DropdownMenuItem>}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
