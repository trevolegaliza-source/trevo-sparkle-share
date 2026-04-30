import { useState, useCallback, useMemo, useEffect } from 'react';
import { ValorProtegido } from '@/components/auth/ValorProtegido';
import { KANBAN_STAGES, PROCESS_TYPE_LABELS, type KanbanStage } from '@/types/process';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Filter, GripVertical, LayoutGrid, List, MoreHorizontal, Receipt, EyeOff, Trash2, Pencil, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { EtiquetasDisplay } from '@/components/EtiquetasBadges';
import { ETIQUETAS_PROCESSO, type EtiquetaProcesso } from '@/constants/etiquetas';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useProcessosDB, useUpdateProcessoEtapa, useDeleteProcesso, type ProcessoDB } from '@/hooks/useProcessos';
import { gerarFaturamentoDeferimento } from '@/hooks/useFinanceiro';
import { useProcessosFinanceiro, type ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import ProcessoEditModal from '@/components/financeiro/ProcessoEditModal';
import ValoresAdicionaisModal from '@/components/financeiro/ValoresAdicionaisModal';
import { Skeleton } from '@/components/ui/skeleton';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { downloadCSV, formatBRLPlain, formatDateBR } from '@/lib/export-utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type ViewMode = 'kanban' | 'list';
type GroupBy = 'none' | 'cliente' | 'mes' | 'etapa';
type FilterPagamento = 'all' | 'pago' | 'pendente' | 'vencido';

// Classifica status de pagamento a partir de um lançamento
function classificarPagamento(lanc: any): 'pago' | 'pendente' | 'vencido' | 'sem-lancamento' {
  if (!lanc) return 'sem-lancamento';
  if (lanc.status === 'pago') return 'pago';
  if (lanc.status === 'cancelado') return 'sem-lancamento';
  // pendente → verifica se vencido
  if (lanc.data_vencimento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(lanc.data_vencimento);
    venc.setHours(0, 0, 0, 0);
    if (venc < hoje) return 'vencido';
  }
  return 'pendente';
}

function QuickActionsMenu({
  process,
  onDelete,
  onEdit,
  onHonorarioExtra,
}: {
  process: ProcessoDB;
  onDelete: (id: string) => void;
  onEdit: (process: ProcessoDB) => void;
  onHonorarioExtra: (process: ProcessoDB) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onEdit(process)}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onHonorarioExtra(process)}>
          <Receipt className="h-3.5 w-3.5 mr-2" /> Honorário Extra
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info('Processo ocultado')}>
          <EyeOff className="h-3.5 w-3.5 mr-2" /> Ocultar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(process.id)} className="text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProcessCard({
  process,
  index,
  onDelete,
  onDoubleClick,
  onEdit,
  onHonorarioExtra,
}: {
  process: ProcessoDB;
  index: number;
  onDelete: (id: string) => void;
  onDoubleClick: (process: ProcessoDB) => void;
  onEdit: (process: ProcessoDB) => void;
  onHonorarioExtra: (process: ProcessoDB) => void;
}) {
  const clientName = process.cliente?.apelido || process.cliente?.nome || 'Cliente';
  const avulsoMatch = process.notas?.match(/\[AVULSO:(.+?)\]/);
  const typeLabel = avulsoMatch ? avulsoMatch[1] : (PROCESS_TYPE_LABELS[process.tipo] || process.tipo);

  return (
    <Draggable draggableId={process.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onDoubleClick={() => onDoubleClick(process)}
          className={cn(
            'group rounded-lg border border-border bg-card p-3 shadow-sm cursor-pointer transition-all hover:border-primary/40 hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.25)]',
            snapshot.isDragging && 'shadow-lg ring-2 ring-primary/30'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate leading-tight text-foreground">{clientName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">📅 {new Date(process.created_at).toLocaleDateString('pt-BR')}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{process.razao_social}</p>
              <p className="text-[12px] font-semibold text-primary mt-0.5 truncate">{typeLabel}</p>
              {(process as any).etiquetas?.length > 0 && (
                <div className="mt-1">
                  <EtiquetasDisplay etiquetas={(process as any).etiquetas || []} size="compact" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <QuickActionsMenu process={process} onDelete={onDelete} onEdit={onEdit} onHonorarioExtra={onHonorarioExtra} />
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            {process.prioridade === 'urgente' && (
              <Badge className="text-[9px] px-1.5 py-0 h-[18px] bg-destructive/10 text-destructive border-0 font-medium">
                Urgente
              </Badge>
            )}
          </div>
          {process.responsavel && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-[9px] font-semibold text-primary">{process.responsavel[0]}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{process.responsavel}</span>
            </div>
          )}
          {process.valor && (
            <p className="text-sm font-semibold text-foreground mt-1.5">
              <ValorProtegido valor={Number(process.valor)} />
            </p>
          )}
          {(() => {
            const daysSince = Math.floor((Date.now() - new Date(process.created_at).getTime()) / 86400000);
            const slaMax = process.prioridade === 'urgente' ? 5 : 10;
            const pct = Math.min((daysSince / slaMax) * 100, 100);
            const color = pct >= 80 ? 'bg-destructive' : pct >= 50 ? 'bg-warning' : 'bg-primary';
            return (
              <div className="mt-2 w-full h-1 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
              </div>
            );
          })()}
        </div>
      )}
    </Draggable>
  );
}

export default function Processos() {
  const { data: processos, isLoading } = useProcessosDB();
  const { data: processosFinanceiro } = useProcessosFinanceiro();
  const updateEtapa = useUpdateProcessoEtapa();
  const deleteProcesso = useDeleteProcesso();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEtiquetas, setFilterEtiquetas] = useState<Set<EtiquetaProcesso>>(new Set());
  const [filterPagamento, setFilterPagamento] = useState<FilterPagamento>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [groupBy, setGroupBy] = useState<GroupBy>('cliente');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [valoresOpen, setValoresOpen] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirmId) {
      deleteProcesso.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, deleteProcesso]);

  // Map processo_id → status de pagamento derivado do lançamento
  const pagamentoStatusMap = useMemo(() => {
    const m = new Map<string, 'pago' | 'pendente' | 'vencido' | 'sem-lancamento'>();
    (processosFinanceiro || []).forEach((pf: ProcessoFinanceiro) => {
      m.set(pf.id, classificarPagamento((pf as any).lancamento));
    });
    return m;
  }, [processosFinanceiro]);

  const filtered = useMemo(() => {
    let result = filterType === 'all'
      ? (processos || [])
      : (processos || []).filter((p) => p.tipo === filterType);

    if (filterMonth !== 'all') {
      const [fYear, fMonth] = filterMonth.split('-').map(Number);
      result = result.filter(p => {
        const d = new Date(p.created_at);
        return d.getFullYear() === fYear && d.getMonth() + 1 === fMonth;
      });
    }

    if (filterEtiquetas.size > 0) {
      result = result.filter(p => {
        const tags: string[] = (p as any).etiquetas || [];
        return Array.from(filterEtiquetas).every(e => tags.includes(e));
      });
    }

    if (filterPagamento !== 'all') {
      result = result.filter(p => pagamentoStatusMap.get(p.id) === filterPagamento);
    }

    return result;
  }, [processos, filterType, filterMonth, filterEtiquetas, filterPagamento, pagamentoStatusMap]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    (processos || []).forEach(p => {
      const d = new Date(p.created_at);
      months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    });
    return Array.from(months).sort().reverse().map(m => {
      const [y, mo] = m.split('-').map(Number);
      const label = new Date(y, mo - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return { value: m, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, [processos]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: Record<string, { label: string; processes: typeof filtered }> = {};
    filtered.forEach(p => {
      let key: string;
      let label: string;
      if (groupBy === 'cliente') {
        key = p.cliente?.nome || 'Sem cliente';
        label = (p.cliente?.apelido || p.cliente?.nome || 'Sem cliente').toUpperCase();
      } else if (groupBy === 'mes') {
        const d = new Date(p.created_at);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        label = label.charAt(0).toUpperCase() + label.slice(1);
      } else {
        key = p.etapa;
        label = (KANBAN_STAGES.find(s => s.key === p.etapa)?.label || p.etapa).toUpperCase();
      }
      if (!groups[key]) groups[key] = { label, processes: [] };
      groups[key].processes.push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [filtered, groupBy]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Auto-collapse when many groups
  useEffect(() => {
    if (groupedData && groupedData.length > 5) {
      setCollapsedGroups(new Set(groupedData.map(([k]) => k)));
    } else {
      setCollapsedGroups(new Set());
    }
  }, [groupBy, filterMonth, filterType, filterPagamento]);

  const selectedFinanceiroProcess = useMemo<ProcessoFinanceiro | null>(() => {
    if (!selectedProcessId) return null;
    return (processosFinanceiro || []).find((p) => p.id === selectedProcessId) || null;
  }, [processosFinanceiro, selectedProcessId]);

  const openEditModal = useCallback((proc: ProcessoDB) => {
    setSelectedProcessId(proc.id);
    setEditModalOpen(true);
  }, []);

  const openHonorarioExtra = useCallback((proc: ProcessoDB) => {
    setSelectedProcessId(proc.id);
    setValoresOpen(true);
  }, []);

  const DEFERIMENTO_STAGES: KanbanStage[] = ['registro', 'finalizados'];

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const newEtapa = result.destination.droppableId as KanbanStage;
    const procId = result.draggableId;
    updateEtapa.mutate({ id: procId, etapa: newEtapa });

    if (DEFERIMENTO_STAGES.includes(newEtapa)) {
      const proc = (processos || []).find(p => p.id === procId);
      if (proc) {
        await gerarFaturamentoDeferimento(proc as any);
      }
    }
  }, [updateEtapa, processos]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Processos</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? '...' : `${filtered.length} processos no pipeline`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border/60 p-0.5">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setViewMode('kanban')}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setViewMode('list')}
              >
                <List className="h-3.5 w-3.5 mr-1" /> Lista
              </Button>
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Filtrar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="abertura">Abertura</SelectItem>
                <SelectItem value="alteracao">Alteração</SelectItem>
                <SelectItem value="transformacao">Transformação</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="avulso">Avulso</SelectItem>
                <SelectItem value="orcamento">Orçamento</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por status de pagamento (A10) */}
            <div className="flex items-center gap-1">
              {([
                { k: 'all',      label: 'Todos',    cls: '' },
                { k: 'pago',     label: '✓ Pagos',   cls: 'bg-green-600 hover:bg-green-700' },
                { k: 'pendente', label: '⏳ Pendentes', cls: 'bg-amber-500 hover:bg-amber-600' },
                { k: 'vencido',  label: '⚠ Vencidos', cls: 'bg-red-600 hover:bg-red-700' },
              ] as const).map(opt => {
                const active = filterPagamento === opt.k;
                return (
                  <Button
                    key={opt.k}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    className={cn('h-9 px-2.5 text-xs', active && opt.cls)}
                    onClick={() => setFilterPagamento(opt.k)}
                    title={`Filtrar por status financeiro: ${opt.label}`}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-1">
              {ETIQUETAS_PROCESSO.map(etiq => {
                const active = filterEtiquetas.has(etiq.value as EtiquetaProcesso);
                return (
                  <Button
                    key={etiq.value}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    className={cn('h-7 px-2 text-[10px]', active && etiq.color)}
                    onClick={() => {
                      setFilterEtiquetas(prev => {
                        const next = new Set(prev);
                        if (next.has(etiq.value as EtiquetaProcesso)) next.delete(etiq.value as EtiquetaProcesso);
                        else next.add(etiq.value as EtiquetaProcesso);
                        return next;
                      });
                    }}
                  >
                    {etiq.label}
                  </Button>
                );
              })}
            </div>

            <Button size="sm" variant="outline" className="h-9" onClick={() => {
              if (filtered.length === 0) { toast.info('Sem dados'); return; }
              downloadCSV(filtered.map(p => ({
                'Razão Social': p.razao_social,
                'Cliente': p.cliente?.apelido || p.cliente?.nome || '-',
                'Tipo': PROCESS_TYPE_LABELS[p.tipo] || p.tipo,
                'Etapa': KANBAN_STAGES.find(s => s.key === p.etapa)?.label || p.etapa,
                'Prioridade': p.prioridade,
                'Valor': p.valor ? formatBRLPlain(Number(p.valor)) : '-',
                'Criado em': formatDateBR(p.created_at),
              })), `processos_${new Date().toISOString().split('T')[0]}.csv`);
              toast.success('Exportado!');
            }}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>

            <Button size="sm" className="h-9" asChild>
              <a href="/cadastro-rapido">
                <Plus className="h-4 w-4 mr-1" />
                Novo Processo
              </a>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-[230px] h-[300px] shrink-0 rounded-xl" />
            ))}
          </div>
        ) : viewMode === 'kanban' ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto scrollbar-thin pb-4 -mx-6 px-6">
              <div className="flex gap-3" style={{ minWidth: KANBAN_STAGES.length * 240 }}>
                {KANBAN_STAGES.map((stage) => {
                  const stageProcesses = filtered.filter((p) => p.etapa === stage.key);
                  return (
                    <Droppable droppableId={stage.key} key={stage.key}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            'w-[230px] shrink-0 rounded-xl bg-muted/40 border border-border/40 transition-colors',
                            snapshot.isDraggingOver && 'border-primary/40 bg-primary/5'
                          )}
                        >
                          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{stage.label}</span>
                              <span className={cn(
                                'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                                stageProcesses.length > 0 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                              )}>
                                {stageProcesses.length}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 p-2 min-h-[120px]">
                            {stageProcesses.map((proc, idx) => (
                              <ProcessCard
                                key={proc.id}
                                process={proc}
                                index={idx}
                                onDelete={handleDeleteRequest}
                                onDoubleClick={openEditModal}
                                onEdit={openEditModal}
                                onHonorarioExtra={openHonorarioExtra}
                              />
                            ))}
                            {provided.placeholder}
                            {stageProcesses.length === 0 && (
                              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/30">
                                <span className="text-[11px] text-muted-foreground/50">Vazio</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </div>
          </DragDropContext>
        ) : (
          <div className="space-y-3">
            {/* Grouping controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase">Agrupar por:</span>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="mes">Mês de criação</SelectItem>
                    <SelectItem value="etapa">Etapa</SelectItem>
                    <SelectItem value="none">Sem agrupamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {monthOptions.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grouped or flat list */}
            <div className="rounded-xl border border-border/60 overflow-hidden">
              {groupedData ? (
                <>
                  {groupedData.map(([key, group]) => {
                    const isCollapsed = collapsedGroups.has(key);
                    return (
                      <div key={key}>
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border/40 hover:bg-muted/70 transition-colors"
                          onClick={() => toggleGroup(key)}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-xs font-bold text-foreground uppercase tracking-wide">{group.label}</span>
                            <Badge variant="outline" className="text-[10px] border-border/60">{group.processes.length} {group.processes.length === 1 ? 'processo' : 'processos'}</Badge>
                          </div>
                        </button>
                        {!isCollapsed && (
                          <Table>
                            <TableBody>
                              {group.processes.map((proc) => (
                                <TableRow
                                  key={proc.id}
                                  className="cursor-pointer hover:bg-muted/50 border-t border-border/30"
                                  onDoubleClick={() => openEditModal(proc)}
                                >
                                  <TableCell className="font-medium text-foreground">
                                    <div className="flex items-center gap-2">
                                      <span>{proc.razao_social}</span>
                                      <EtiquetasDisplay etiquetas={(proc as any).etiquetas || []} size="compact" />
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-foreground">{proc.cliente?.apelido || proc.cliente?.nome || '-'}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                                      {(() => {
                                        const m = proc.notas?.match(/\[AVULSO:(.+?)\]/);
                                        return m ? m[1] : (PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo);
                                      })()}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-foreground">{KANBAN_STAGES.find(s => s.key === proc.etapa)?.label || proc.etapa}</TableCell>
                                  <TableCell>
                                    {proc.prioridade === 'urgente' ? (
                                      <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">Urgente</Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Normal</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-sm font-semibold text-foreground">
                                    {proc.valor ? <ValorProtegido valor={Number(proc.valor)} /> : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <QuickActionsMenu process={proc} onDelete={handleDeleteRequest} onEdit={openEditModal} onHonorarioExtra={openHonorarioExtra} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    );
                  })}
                  {groupedData.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhum processo encontrado</div>
                  )}
                </>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Razão Social</TableHead>
                      <TableHead className="text-xs font-semibold">Cliente</TableHead>
                      <TableHead className="text-xs font-semibold">Tipo</TableHead>
                      <TableHead className="text-xs font-semibold">Etapa</TableHead>
                      <TableHead className="text-xs font-semibold">Prioridade</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Valor</TableHead>
                      <TableHead className="text-center text-xs font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((proc) => (
                      <TableRow
                        key={proc.id}
                        className="cursor-pointer hover:bg-muted/50 border-t border-border/30"
                        onDoubleClick={() => openEditModal(proc)}
                      >
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{proc.razao_social}</span>
                            <EtiquetasDisplay etiquetas={(proc as any).etiquetas || []} size="compact" />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{proc.cliente?.apelido || proc.cliente?.nome || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                            {(() => {
                              const m = proc.notas?.match(/\[AVULSO:(.+?)\]/);
                              return m ? m[1] : (PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo);
                            })()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{KANBAN_STAGES.find(s => s.key === proc.etapa)?.label || proc.etapa}</TableCell>
                        <TableCell>
                          {proc.prioridade === 'urgente' ? (
                            <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">Urgente</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Normal</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-foreground">
                          {proc.valor ? <ValorProtegido valor={Number(proc.valor)} /> : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <QuickActionsMenu process={proc} onDelete={handleDeleteRequest} onEdit={openEditModal} onHonorarioExtra={openHonorarioExtra} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum processo encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border/30">
                💡 Dê um duplo-clique em qualquer processo para abrir a edição completa
              </p>
            </div>
          </div>
        )}
      </div>

      <ProcessoEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        processo={selectedFinanceiroProcess}
      />

      <ValoresAdicionaisModal
        open={valoresOpen}
        onOpenChange={setValoresOpen}
        processoId={selectedFinanceiroProcess?.id || ''}
        clienteApelido={(selectedFinanceiroProcess?.cliente as any)?.apelido || (selectedFinanceiroProcess?.cliente as any)?.nome || '-'}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Processo</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir este processo? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
