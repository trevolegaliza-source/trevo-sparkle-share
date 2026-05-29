import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useProfileNames } from '@/hooks/useProfileNames';
import HistoricoEntidadeModal from '@/components/historico/HistoricoEntidadeModal';
import { useParams, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, FileText, DollarSign, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUpsertServiceNegotiations } from '@/hooks/useServiceNegotiations';
import ServicosPreAcordados from '@/components/clientes/ServicosPreAcordados';
import PrepagoTab from '@/components/clientes/PrepagoTab';
import PrecosPorTipoDialog from '@/components/financeiro/PrecosPorTipoDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
// CLI-005 fix: useDeleteCliente removido (botão duplicado eliminado)
import { useUpdateCliente, useCreateProcesso, useArchiveCliente, useUnarchiveCliente } from '@/hooks/useFinanceiro';
import { isProcessoFinalizado } from '@/types/process';
import type { ProcessoDB } from '@/types/financial';
import { cn } from '@/lib/utils';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import ContractPreviewModal from '@/components/contratos/ContractPreviewModal';
import { useServiceNegotiations } from '@/hooks/useServiceNegotiations';
import ProcessoEditModal from '@/components/financeiro/ProcessoEditModal';
import ProcessoConfigEditModal from '@/components/processos/ProcessoConfigEditModal';
import MarcarPagoProcessoModal from '@/components/processos/MarcarPagoProcessoModal';
import MarcarDeferidoProcessoModal from '@/components/processos/MarcarDeferidoProcessoModal';
import { useDesfazerDeferimento } from '@/hooks/useFinanceiro';
import { useColaboradores } from '@/hooks/useColaboradores';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';

import HeaderCliente from '@/components/clientes/detalhe/HeaderCliente';
import TabFinanceiroConfig from '@/components/clientes/detalhe/TabFinanceiroConfig';
import TabProcessos from '@/components/clientes/detalhe/TabProcessos';
import TabFaturas from '@/components/clientes/detalhe/TabFaturas';
import TabContratos from '@/components/clientes/detalhe/TabContratos';
import EditCadastroDialog from '@/components/clientes/detalhe/EditCadastroDialog';
import NovoProcessoDialog from '@/components/clientes/detalhe/NovoProcessoDialog';
import {
  RelatorioDialog,
  CobrancaDialog,
  MarkFaturadoDialog,
  DeferimentoAlertDialog,
} from '@/components/clientes/detalhe/DialogsAcoes';
import type { DeferimentoAlertData } from '@/components/clientes/detalhe/types';
import { useClienteDetalheData } from '@/components/clientes/detalhe/useClienteDetalheData';
import { useDescontoPreview } from '@/components/clientes/detalhe/useDescontoPreview';
import { useContratosHandlers } from '@/components/clientes/detalhe/useContratosHandlers';
import { useCadastroHandlers } from '@/components/clientes/detalhe/useCadastroHandlers';
import { useNovoProcessoHandlers } from '@/components/clientes/detalhe/useNovoProcessoHandlers';
import { gerarExtratoClienteDetalhe, marcarProcessosFaturado } from '@/components/clientes/detalhe/extratoHelpers';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const qcRef = useQueryClient();
  const { isMaster: permIsMasterFn } = usePermissions();
  const { data: profileNames = {} } = useProfileNames();
  const permIsMaster = permIsMasterFn();

  // Data + cliente carregado via hook (loadAll, contracts, paidIds, processos
  // ordenados, etc).
  const {
    cliente, processos, lancamentos, contracts, loading, editForm, setEditForm,
    loadAll, loadContracts, isProcessoPago, processosOrdenados,
    processosPagosCount, processosPendentesCount,
  } = useClienteDetalheData(id);

  const reload = () => cliente && loadAll(cliente.id, { silent: true });

  const [editing, setEditing] = useState(false);
  const [precosTipoOpen, setPrecosTipoOpen] = useState(false);
  // Bug-006 (17/05/2026): guard contra double-click no botão Gerar Fatura Mensal.
  const [gerandoFaturaMensal, setGerandoFaturaMensal] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);
  const upsertNegotiations = useUpsertServiceNegotiations();
  const updateCliente = useUpdateCliente();
  const createProcesso = useCreateProcesso();
  const { data: negotiations } = useServiceNegotiations(id);
  const { data: colaboradores } = useColaboradores();
  // CLI-005 fix: deleteCliente removido
  const archiveCliente = useArchiveCliente();
  const unarchiveCliente = useUnarchiveCliente();

  // Action dialogs
  const [showArchivePassword, setShowArchivePassword] = useState(false);
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [showCobrancaDialog, setShowCobrancaDialog] = useState(false);
  const [selectedRelatorioProcessos, setSelectedRelatorioProcessos] = useState<Set<string>>(new Set());
  const [selectedCobrancaProcessos, setSelectedCobrancaProcessos] = useState<Set<string>>(new Set());
  const [selectedProcessosTab, setSelectedProcessosTab] = useState<Set<string>>(new Set());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProcesso, setEditProcesso] = useState<ProcessoFinanceiro | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configEditProcesso, setConfigEditProcesso] = useState<ProcessoDB | null>(null);
  // Histórico campo-por-campo (18/05/2026)
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoProcessoId, setHistoricoProcessoId] = useState<string | null>(null);
  const [historicoLabel, setHistoricoLabel] = useState<string>('');
  // FEAT-001/002/003 (11/05/2026): marcar pago / deferido / desfazer deferimento.
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [markPaidProcesso, setMarkPaidProcesso] = useState<ProcessoDB | null>(null);
  const [markDeferidoModalOpen, setMarkDeferidoModalOpen] = useState(false);
  const [markDeferidoProcesso, setMarkDeferidoProcesso] = useState<ProcessoDB | null>(null);
  const desfazerDeferimento = useDesfazerDeferimento();
  const [generatingExtrato, setGeneratingExtrato] = useState(false);
  const [showMarkFaturadoDialog, setShowMarkFaturadoDialog] = useState(false);
  // UX-014 (12/05/2026): guarda os processos que ACABARAM de receber extrato.
  // Antes o dialog lia selectedProcessosTab — quando chamado do DeferimentoAlert
  // (com lista diferente), o dialog mostrava count errado e processava o set
  // global em vez dos processos do fluxo atual.
  const [pendingFaturadoProcs, setPendingFaturadoProcs] = useState<ProcessoDB[]>([]);
  const [showDeferimentoAlert, setShowDeferimentoAlert] = useState(false);
  const [deferimentoAlertData, setDeferimentoAlertData] = useState<DeferimentoAlertData | null>(null);

  // UX-010 (11/05/2026): aba controlada pra preservar contexto após refresh.
  // Sprint 4.B (13/05 noite): aceita tab via location.state pra deep-link
  // (Dashboard > Próximos Vencimentos abre direto na aba Faturas).
  const location = useLocation();
  const stateTab = (location.state as any)?.tab;
  const TABS_VALIDAS = ['financeiro-config', 'honorarios', 'processos', 'faturas', 'contratos', 'prepago'];
  const [activeTab, setActiveTab] = useState(
    typeof stateTab === 'string' && TABS_VALIDAS.includes(stateTab) ? stateTab : 'financeiro-config'
  );

  const isMensalista = cliente?.tipo === 'MENSALISTA';
  const isPrePago = cliente?.tipo === 'PRE_PAGO';
  const isArchived = !!(cliente as any)?.is_archived;

  // ── Hooks orquestradores (dependem de cliente/negotiations) ──
  const novoProcesso = useNovoProcessoHandlers({
    cliente, isMensalista, negotiations, createProcesso, reload,
  });

  const cadastro = useCadastroHandlers({
    cliente, negotiations, updateCliente, upsertNegotiations, reload,
  });

  const contratos = useContratosHandlers({
    cliente, loadContracts, setPendingDeleteAction, setShowDeletePassword,
  });

  // Desconto progressivo preview (real-time) — extraído em useDescontoPreview
  const descontoPreview = useDescontoPreview({
    cliente,
    processos,
    mudancaUf: novoProcesso.processoForm.mudanca_uf,
    prioridade: novoProcesso.processoForm.prioridade,
    isManualPrice: novoProcesso.isManualPrice,
    isNegotiatedService: novoProcesso.isNegotiatedService,
    aplicarBoasVindas: novoProcesso.aplicarBoasVindas,
    boasVindasPct: novoProcesso.boasVindasPct,
  });

  const handleGerarExtrato = async (procsToGenerate: ProcessoDB[]) => {
    if (!cliente) return;
    setGeneratingExtrato(true);
    const ok = await gerarExtratoClienteDetalhe({ cliente, procsToGenerate, lancamentos });
    setGeneratingExtrato(false);
    if (ok) {
      // UX-014: passa explicitamente os procs deste fluxo pro dialog
      setPendingFaturadoProcs(procsToGenerate);
      setShowMarkFaturadoDialog(true);
    }
  };

  const handleSaveParams = () => {
    if (!cliente) return;
    const payload: Record<string, any> = { id: cliente.id };
    const fields = ['valor_base', 'desconto_progressivo', 'dia_cobranca', 'valor_limite_desconto', 'mensalidade', 'vencimento', 'qtd_processos', 'momento_faturamento', 'dia_vencimento_mensal', 'franquia_processos'] as const;
    for (const f of fields) {
      if ((editForm as any)[f] !== undefined) payload[f] = (editForm as any)[f];
    }
    updateCliente.mutate(payload as any, {
      onSuccess: () => {
        setEditing(false);
        // CODE-006 (17/05/2026): invalidate amplo. Antes só ['financeiro_clientes']
        // — outros componentes (lista de clientes, cards no Dashboard, useProcessos
        // que carrega cliente_*) ficavam stale até refresh manual.
        qcRef.invalidateQueries({ queryKey: ['financeiro_clientes'] });
        qcRef.invalidateQueries({ queryKey: ['clientes'] });
        qcRef.invalidateQueries({ queryKey: ['cliente_processos'] });
        qcRef.invalidateQueries({ queryKey: ['cliente_lancamentos'] });
        qcRef.invalidateQueries({ queryKey: ['cliente_financeiro'] });
        reload();
        toast.success('Parâmetros atualizados!');
      },
      onError: (err: any) => { toast.error('Erro ao salvar: ' + (err?.message || 'Erro desconhecido')); },
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button variant="link" asChild><Link to="/clientes">Voltar</Link></Button>
      </div>
    );
  }

  const momentoFat = (cliente as any).momento_faturamento || 'na_solicitacao';
  const isDeferimento = momentoFat === 'no_deferimento';
  const totalProcessos = processos.length;
  const processosAtivos = processos.filter(p => !isProcessoFinalizado(p.etapa)).length;
  const totalFaturado = lancamentos.filter(l => l.tipo === 'receber').reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const totalPendente = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const lancNaoAuditados = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pendente' && !(l as any).auditado && (l as any).etapa_financeiro === 'solicitacao_criada');
  const lancAuditadosPendentes = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pendente' && (l as any).auditado);
  const qtdNaoAuditados = lancNaoAuditados.length;
  const formatCurrencyOrZero = (value: number | null | undefined) =>
    Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatValueOrZero = (value: number | null | undefined) =>
    value == null ? '0,00' : String(value);

  // DECISION-001 Fase 3 (13/05/2026): "deferido" = data_deferimento setada.
  // Antes filtrava por etapa específica ('registro'/'finalizados') — etapa
  // binária agora, fonte de verdade é data_deferimento.
  const billedProcessIds = new Set(lancamentos.filter(l => l.tipo === 'receber' && l.processo_id).map(l => l.processo_id));
  const aguardandoDeferimento = isDeferimento
    ? processos.filter(p => !(p as any).data_deferimento && !isProcessoFinalizado(p.etapa) && !billedProcessIds.has(p.id))
    : [];

  // Handler for gerar extrato button in TabProcessos
  const handleGerarExtratoFromTab = async () => {
    if (!cliente) return;
    const selectedProcs = processos.filter(p => selectedProcessosTab.has(p.id));
    if (selectedProcs.length === 0) return;

    const { data: clienteCheck } = await supabase
      .from('clientes')
      .select('momento_faturamento, nome')
      .eq('id', selectedProcs[0].cliente_id)
      .single();

    if (clienteCheck?.momento_faturamento === 'no_deferimento') {
      // PROC-001 fix (26/05): pós DECISION-001 Fase 3, deferimento é
      // identificado por data_deferimento (não mais por etapa específica
      // — banco migrou pra binário ativo/finalizado). DEFER_STAGES virou
      // dead enum — usava ['registro', 'finalizados'] (plural) que NÃO
      // existem mais. Resultado: alerta disparava sempre, abortando
      // todo extrato pra cliente no_deferimento.
      const naoDeferidos = selectedProcs.filter((p: any) => !p.data_deferimento);

      if (naoDeferidos.length > 0) {
        setDeferimentoAlertData({
          clienteNome: clienteCheck.nome || cliente.nome,
          naoDeferidos,
          todosSelecionados: selectedProcs,
        });
        setShowDeferimentoAlert(true);
        return;
      }
    }

    handleGerarExtrato(selectedProcs);
  };

  const handleMarkFaturadoConfirm = async () => {
    try {
      await marcarProcessosFaturado(pendingFaturadoProcs, lancamentos);
      toast.success('Processos marcados como faturados!');
      setSelectedProcessosTab(new Set());
      setPendingFaturadoProcs([]);
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setShowMarkFaturadoDialog(false);
  };

  return (
    <div className="space-y-6">
      <HeaderCliente
        cliente={cliente}
        isMensalista={isMensalista}
        isPrePago={isPrePago}
        isDeferimento={isDeferimento}
        isArchived={isArchived}
        totalProcessos={totalProcessos}
        processosAtivos={processosAtivos}
        totalFaturado={totalFaturado}
        totalPendente={totalPendente}
        onEditCadastro={cadastro.openEditCadastro}
        onOpenRelatorio={() => { setSelectedRelatorioProcessos(new Set()); setShowRelatorioDialog(true); }}
        onOpenCobranca={() => { setSelectedCobrancaProcessos(new Set()); setShowCobrancaDialog(true); }}
        onToggleArchive={() => setShowArchivePassword(true)}
        onProvisioned={reload}
      />

      {/* Tabs — UX-010: controlado pra preservar aba após refresh do loadAll */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={cn("grid w-full", isPrePago ? "grid-cols-6" : "grid-cols-5")}>
          <TabsTrigger value="financeiro-config" className="text-xs gap-1"><Settings className="h-3.5 w-3.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="honorarios" className="text-xs gap-1"><List className="h-3.5 w-3.5" />Serviços</TabsTrigger>
          <TabsTrigger value="processos" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Processos</TabsTrigger>
          <TabsTrigger value="faturas" className="text-xs gap-1">
            <DollarSign className="h-3.5 w-3.5" />Faturas
            {qtdNaoAuditados > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0 min-w-[16px]">{qtdNaoAuditados}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contratos" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Contratos</TabsTrigger>
          {isPrePago && <TabsTrigger value="prepago" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Pré-Pago</TabsTrigger>}
          {/* Tab "Observações" consolidada no Edit Cadastro em 13/05/2026 noite (auditoria). */}
        </TabsList>

        <TabsContent value="financeiro-config">
          <TabFinanceiroConfig
            cliente={cliente}
            isMensalista={isMensalista}
            isPrePago={isPrePago}
            isDeferimento={isDeferimento}
            editing={editing}
            editForm={editForm}
            isSaving={updateCliente.isPending}
            onStartEditing={() => setEditing(true)}
            onCancelEditing={() => { setEditing(false); setEditForm(cliente); }}
            onChangeEditForm={(updater) => setEditForm(updater)}
            onSaveParams={handleSaveParams}
            onOpenPrecosTipo={() => setPrecosTipoOpen(true)}
            formatCurrencyOrZero={formatCurrencyOrZero}
            formatValueOrZero={formatValueOrZero}
          />
        </TabsContent>

        <TabsContent value="honorarios">
          <ServicosPreAcordados clienteId={cliente.id} isPrePago={isPrePago} />
        </TabsContent>

        <TabsContent value="processos">
          <TabProcessos
            cliente={cliente}
            processos={processos}
            processosOrdenados={processosOrdenados}
            lancamentos={lancamentos}
            aguardandoDeferimento={aguardandoDeferimento}
            isMensalista={isMensalista}
            totalProcessos={totalProcessos}
            processosPagosCount={processosPagosCount}
            processosPendentesCount={processosPendentesCount}
            selectedProcessosTab={selectedProcessosTab}
            setSelectedProcessosTab={setSelectedProcessosTab}
            generatingExtrato={generatingExtrato}
            isProcessoPago={isProcessoPago}
            profileNames={profileNames}
            isDesfazerDeferimentoPending={desfazerDeferimento.isPending}
            onGerarExtrato={handleGerarExtratoFromTab}
            onNovoProcesso={novoProcesso.handleNovoProcesso}
            onEditProcesso={(fin) => { setEditProcesso(fin); setEditModalOpen(true); }}
            onMarkPaid={(p) => { setMarkPaidProcesso(p); setMarkPaidModalOpen(true); }}
            onMarkDeferido={(p) => { setMarkDeferidoProcesso(p); setMarkDeferidoModalOpen(true); }}
            onDesfazerDeferimento={(p) => desfazerDeferimento.mutate(
              { processoId: p.id },
              { onSuccess: reload },
            )}
            onAbrirHistorico={(processoId, label) => {
              setHistoricoProcessoId(processoId);
              setHistoricoLabel(label);
              setHistoricoOpen(true);
            }}
            onAbrirConfig={(p) => { setConfigEditProcesso(p); setConfigModalOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="faturas">
          <TabFaturas
            cliente={cliente}
            lancamentos={lancamentos}
            lancNaoAuditados={lancNaoAuditados}
            lancAuditadosPendentes={lancAuditadosPendentes}
            isMensalista={isMensalista}
            totalPago={totalPago}
            totalPendente={totalPendente}
            permIsMaster={permIsMaster}
            gerandoFaturaMensal={gerandoFaturaMensal}
            setGerandoFaturaMensal={setGerandoFaturaMensal}
            onReload={reload}
          />
        </TabsContent>

        <TabsContent value="contratos">
          <TabContratos
            cliente={cliente}
            contracts={contracts}
            uploadingContract={contratos.uploadingContract}
            permIsMaster={permIsMaster}
            onPreview={contratos.handlePreview}
            onViewContract={contratos.handleViewContract}
            onDownload={contratos.handleDownload}
            onDelete={contratos.handleDeleteContract}
            onUpload={contratos.handleUpload}
          />
        </TabsContent>

        {isPrePago && (
          <TabsContent value="prepago">
            <PrepagoTab cliente={cliente} onReload={reload} />
          </TabsContent>
        )}

      </Tabs>

      {/* CODE-001 (17/05/2026): reset form ao fechar pra não mostrar dado antigo
          ao reabrir. Antes, fechar sem salvar + reabrir mostrava state da edição
          anterior — confundia o user achando que mudanças foram salvas. */}
      <EditCadastroDialog
        open={cadastro.showEditCadastro}
        onOpenChange={(o) => {
          cadastro.setShowEditCadastro(o);
          if (!o) cadastro.setEditCadastroForm({});
        }}
        editCadastroForm={cadastro.editCadastroForm}
        setEditCadastroForm={cadastro.setEditCadastroForm}
        buscandoCep={cadastro.buscandoCep}
        setBuscandoCep={cadastro.setBuscandoCep}
        editHonorariosRows={cadastro.editHonorariosRows}
        setEditHonorariosRows={cadastro.setEditHonorariosRows}
        savingCadastro={cadastro.savingCadastro}
        onCnpjEditChange={cadastro.handleCnpjEditChange}
        onSaveCadastro={cadastro.handleSaveCadastro}
      />

      <ContractPreviewModal
        open={!!contratos.previewUrl}
        onOpenChange={(o) => { if (!o) contratos.closePreview(); }}
        url={contratos.previewUrl}
        fileName={contratos.previewFileName}
        clienteName={cliente?.nome || ''}
      />

      {/* Histórico campo-por-campo (18/05/2026) */}
      <HistoricoEntidadeModal
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        entidadeTipo="processo"
        entidadeId={historicoProcessoId}
        entidadeLabel={historicoLabel}
      />

      <PasswordConfirmDialog
        open={showDeletePassword}
        onOpenChange={setShowDeletePassword}
        onConfirm={() => { pendingDeleteAction?.(); setPendingDeleteAction(null); }}
      />

      {/* AlertDialog "Boas-vindas" removido em Sprint 4.G (13/05/2026 noite):
          setShowBoasVindasAlert(true) nunca era chamado em lugar nenhum —
          era código morto. handleNovoProcesso abre direto o Dialog Novo Processo,
          que tem card inline de boas-vindas quando isFirstProcessNovo=true. */}

      <NovoProcessoDialog
        open={novoProcesso.showNovoProcesso}
        onOpenChange={novoProcesso.handleCloseNovoProcesso}
        cliente={cliente}
        isMensalista={isMensalista}
        processoForm={novoProcesso.processoForm}
        setProcessoForm={novoProcesso.setProcessoForm}
        isManualPrice={novoProcesso.isManualPrice}
        isNegotiatedService={novoProcesso.isNegotiatedService}
        isFirstProcessNovo={novoProcesso.isFirstProcessNovo}
        aplicarBoasVindas={novoProcesso.aplicarBoasVindas}
        setAplicarBoasVindas={novoProcesso.setAplicarBoasVindas}
        boasVindasPct={novoProcesso.boasVindasPct}
        setBoasVindasPct={novoProcesso.setBoasVindasPct}
        descontoPreview={descontoPreview}
        negotiations={negotiations}
        colaboradores={colaboradores}
        isCreating={createProcesso.isPending}
        onCreate={novoProcesso.handleCreateProcesso}
      />

      <PasswordConfirmDialog
        open={showArchivePassword}
        onOpenChange={setShowArchivePassword}
        title={isArchived ? 'Desarquivar Cliente' : 'Arquivar Cliente'}
        description={isArchived ? 'Digite a senha para desarquivar este cliente e seus processos.' : 'Digite a senha para arquivar este cliente e seus processos. Eles ficarão ocultos mas não serão excluídos.'}
        onConfirm={() => {
          if (!cliente) return;
          if (isArchived) {
            unarchiveCliente.mutate(cliente.id, { onSuccess: reload });
          } else {
            archiveCliente.mutate(cliente.id, { onSuccess: reload });
          }
        }}
      />

      {/* CLI-005 fix (26/05): dialog removido junto com o botão duplicado.
          Arquivamento agora é só via o botão Archive (showArchivePassword). */}

      <RelatorioDialog
        open={showRelatorioDialog}
        onOpenChange={setShowRelatorioDialog}
        cliente={cliente}
        processos={processos}
        selectedRelatorioProcessos={selectedRelatorioProcessos}
        setSelectedRelatorioProcessos={setSelectedRelatorioProcessos}
      />

      <CobrancaDialog
        open={showCobrancaDialog}
        onOpenChange={setShowCobrancaDialog}
        cliente={cliente}
        lancamentos={lancamentos}
        selectedCobrancaProcessos={selectedCobrancaProcessos}
        setSelectedCobrancaProcessos={setSelectedCobrancaProcessos}
      />

      <ProcessoEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        processo={editProcesso}
      />

      <ProcessoConfigEditModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        processo={configEditProcesso}
      />

      {/* FEAT-001 (11/05/2026): Marcar processo como pago. */}
      <MarcarPagoProcessoModal
        open={markPaidModalOpen}
        onOpenChange={setMarkPaidModalOpen}
        processo={markPaidProcesso}
        onSuccess={reload}
      />

      {/* FEAT-002 (11/05/2026): Marcar processo como deferido. */}
      <MarcarDeferidoProcessoModal
        open={markDeferidoModalOpen}
        onOpenChange={setMarkDeferidoModalOpen}
        processo={markDeferidoProcesso}
        onSuccess={reload}
      />

      {/* Mark as Faturado after extrato — UX-014: usa pendingFaturadoProcs
          (passado por handleGerarExtrato), não selectedProcessosTab.
          Cobre os 3 caminhos: tabela de Processos (selectedProcs),
          DeferimentoAlert (deferidos), DeferimentoAlert (todosSelecionados). */}
      <MarkFaturadoDialog
        open={showMarkFaturadoDialog}
        onOpenChange={setShowMarkFaturadoDialog}
        pendingFaturadoProcs={pendingFaturadoProcs}
        setPendingFaturadoProcs={setPendingFaturadoProcs}
        onConfirm={handleMarkFaturadoConfirm}
      />

      <DeferimentoAlertDialog
        open={showDeferimentoAlert}
        onOpenChange={setShowDeferimentoAlert}
        deferimentoAlertData={deferimentoAlertData}
        onGerarApenasDeferidos={() => {
          const deferidos = deferimentoAlertData?.todosSelecionados.filter(p => !!(p as any).data_deferimento) || [];
          setShowDeferimentoAlert(false);
          if (deferidos.length > 0) {
            handleGerarExtrato(deferidos);
          } else {
            toast.warning('Nenhum processo deferido para gerar extrato.');
          }
        }}
        onGerarTodos={() => {
          if (!deferimentoAlertData) return;
          setShowDeferimentoAlert(false);
          handleGerarExtrato(deferimentoAlertData.todosSelecionados);
        }}
      />

      <PrecosPorTipoDialog
        open={precosTipoOpen}
        onOpenChange={setPrecosTipoOpen}
        clienteId={cliente.id}
        clienteNome={cliente.apelido || cliente.nome}
        valorBase={Number((cliente as any).valor_base ?? 0)}
      />
    </div>
  );
}
