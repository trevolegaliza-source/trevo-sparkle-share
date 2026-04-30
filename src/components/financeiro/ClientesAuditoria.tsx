import { useState, useEffect, useRef, useMemo } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ClipboardCheck, Check, Pencil, Receipt, X, AlertTriangle, Phone, CalendarCheck, Trash2, ArrowDownAZ, CalendarClock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { ClienteFinanceiro, LancamentoFinanceiro } from '@/hooks/useFinanceiroClientes';
import { useAuditarLancamento, useAuditarTodosCliente, useAlterarValorLancamento, ETAPAS_PRE_DEFERIMENTO, invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import ValoresAdicionaisModal from './ValoresAdicionaisModal';
import { useHighlightOnModal } from '@/hooks/useHighlightOnModal';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { clienteTemContatoCobranca } from '@/lib/contato-cobranca';
import { usePermissions } from '@/hooks/usePermissions';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function tipoLabel(c: ClienteFinanceiro): string {
  if (c.cliente_momento_faturamento === 'no_deferimento') return 'No deferimento';
  if (c.cliente_tipo === 'MENSALISTA') return `Mensalista`;
  if (c.cliente_tipo === 'PRE_PAGO') return 'Pré-Pago';
  if (c.cliente_dia_cobranca && c.cliente_dia_cobranca > 0) return `Avulso D+${c.cliente_dia_cobranca}`;
  return 'Avulso';
}

export function ClientesAuditoria({ clientes }: { clientes: ClienteFinanceiro[] }) {
  const [sortMode, setSortMode] = useState<'alpha' | 'deferimento'>('alpha');

  const sortedClientes = useMemo(() => {
    const arr = [...clientes];
    const byName = (a: ClienteFinanceiro, b: ClienteFinanceiro) =>
      (a.cliente_apelido || a.cliente_nome).localeCompare(b.cliente_apelido || b.cliente_nome, 'pt-BR');
    if (sortMode === 'alpha') return arr.sort(byName);
    // Deferimento primeiro: no_deferimento ↑ topo, demais ↓
    return arr.sort((a, b) => {
      const aDef = a.cliente_momento_faturamento === 'no_deferimento' ? 0 : 1;
      const bDef = b.cliente_momento_faturamento === 'no_deferimento' ? 0 : 1;
      if (aDef !== bDef) return aDef - bDef;
      return byName(a, b);
    });
  }, [clientes, sortMode]);

  if (clientes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardCheck className="h-12 w-12 text-emerald-400 mb-3" />
          <p className="font-semibold text-emerald-400">Tudo auditado!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nenhum processo aguardando auditoria. A aba Cobrar está pronta.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalProcessos = clientes.reduce((s, c) => s + c.qtd_nao_auditados, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {clientes.length} clientes · {totalProcessos} processos aguardando
        </p>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setSortMode('alpha')}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 text-xs font-medium transition-colors",
              sortMode === 'alpha'
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <ArrowDownAZ className="h-3.5 w-3.5" /> A-Z
          </button>
          <button
            type="button"
            onClick={() => setSortMode('deferimento')}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 text-xs font-medium transition-colors border-l border-border",
              sortMode === 'deferimento'
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Deferimento primeiro
          </button>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {sortedClientes.map(c => <AuditoriaItem key={c.cliente_id} cliente={c} />)}
      </Accordion>
    </div>
  );
}

function AuditoriaItem({ cliente }: { cliente: ClienteFinanceiro }) {
  const auditarMut = useAuditarLancamento();
  const auditarTodosMut = useAuditarTodosCliente();
  const qc = useQueryClient();
  const [taxaModalOpen, setTaxaModalOpen] = useState(false);
  const [taxaProcessoId, setTaxaProcessoId] = useState('');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAction, setContactAction] = useState<'single' | 'all'>('single');
  const [pendingAuditId, setPendingAuditId] = useState('');

  const lancNaoAuditados = cliente.lancamentos.filter(l => !l.auditado && l.status !== 'pago');
  const totalNaoAuditado = lancNaoAuditados.reduce((s, l) => s + l.valor, 0);
  const totalTaxasNaoAuditado = lancNaoAuditados.reduce((s, l) => s + (l.total_valores_adicionais || 0), 0);

  const temMetodoTrevo = lancNaoAuditados.some(l => l.tem_etiqueta_metodo_trevo);
  const temPrioridade = lancNaoAuditados.some(l => l.tem_etiqueta_prioridade);

  // Check if client has contact info for billing
  const temContato = clienteTemContatoCobranca({
    telefone: cliente.cliente_telefone,
    telefone_financeiro: cliente.cliente_telefone_financeiro,
    nome_contador: cliente.cliente_nome_contador,
    nome_contato_financeiro: cliente.cliente_nome_contato_financeiro,
  });

  // Determine which fields are missing
  const temNome = !!(cliente.cliente_nome_contato_financeiro || cliente.cliente_nome_contador);
  const temTelefone = !!(cliente.cliente_telefone_financeiro || cliente.cliente_telefone);

  // FIX 3: validate no_deferimento — block audit for processes without data_deferimento
  const isNoDeferimento = cliente.cliente_momento_faturamento === 'no_deferimento';
  const aguardandoDeferimento = (l: LancamentoFinanceiro) =>
    isNoDeferimento && !l.processo_data_deferimento;

  const executarAuditarTodos = () => {
    const elegiveis = lancNaoAuditados.filter(l => !aguardandoDeferimento(l));
    const pulados = lancNaoAuditados.length - elegiveis.length;
    if (elegiveis.length === 0) {
      toast.error('Nenhum processo elegível: todos aguardam deferimento. Marque a data antes de auditar.');
      return;
    }
    const ids = elegiveis.map(l => l.id);
    auditarTodosMut.mutate({ lancamentoIds: ids }, {
      onSuccess: () => {
        toast.success(`${ids.length} processos auditados ✅ — movidos para Cobrar`);
        if (pulados > 0) {
          toast.warning(`${pulados} processo(s) pulado(s) — aguardam deferimento.`);
        }
      },
    });
  };

  const executarAuditarUm = (lancamentoId: string) => {
    const l = lancNaoAuditados.find(x => x.id === lancamentoId);
    if (l && aguardandoDeferimento(l)) {
      toast.error(`Processo "${l.processo_razao_social}" aguarda deferimento. Marque como deferido antes de auditar.`);
      return;
    }
    auditarMut.mutate({ lancamentoId, auditado: true }, {
      onSuccess: () => toast.success('Processo auditado ✅ — movido para Cobrar'),
    });
  };

  const openContactModal = (action: 'single' | 'all', lancamentoId?: string) => {
    setContactAction(action);
    setPendingAuditId(lancamentoId || '');
    // Pre-fill name with nome_contador if available
    setContactName(cliente.cliente_nome_contador || '');
    setContactPhone('');
    setContactModalOpen(true);
  };

  const handleAuditarTodos = () => {
    if (!temContato) {
      openContactModal('all');
      return;
    }
    executarAuditarTodos();
  };

  const handleAuditarUm = (lancamentoId: string) => {
    if (!temContato) {
      openContactModal('single', lancamentoId);
      return;
    }
    executarAuditarUm(lancamentoId);
  };

  const handleContactSave = async () => {
    const digits = contactPhone.replace(/\D/g, '');
    if (contactPhone && (digits.length < 10 || digits.length > 11)) {
      toast.error('Telefone inválido. Use (XX) XXXXX-XXXX');
      return;
    }
    try {
      const updates: Record<string, any> = {};
      if (contactName) updates.nome_contato_financeiro = contactName;
      if (contactPhone) {
        updates.telefone_financeiro = contactPhone;
        // Also set main phone if empty
        if (!cliente.cliente_telefone) updates.telefone = contactPhone;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('clientes').update(updates as any).eq('id', cliente.cliente_id);
        qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
        toast.success('Contato salvo!');
      }
    } catch {
      toast.error('Erro ao salvar contato');
    }
    setContactModalOpen(false);
    if (contactAction === 'all') executarAuditarTodos();
    else executarAuditarUm(pendingAuditId);
  };

  const handleContactSkip = () => {
    setContactModalOpen(false);
    if (contactAction === 'all') executarAuditarTodos();
    else executarAuditarUm(pendingAuditId);
  };

  const handlePhoneInput = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.length > 11) digits = digits.slice(0, 11);
    if (digits.length <= 2) setContactPhone(digits.length > 0 ? `(${digits}` : '');
    else if (digits.length <= 7) setContactPhone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
    else setContactPhone(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`);
  };

  // Decide what to show in the modal
  const needsName = !temNome;
  const needsPhone = !temTelefone;

  return (
    <>
      <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-3 sm:gap-3 flex-1 text-left min-w-0">
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="font-semibold text-sm truncate flex items-center gap-2 flex-wrap">
                <span className="truncate">
                  {cliente.cliente_apelido || cliente.cliente_nome}
                  {cliente.cliente_codigo && <span className="text-muted-foreground font-mono font-normal text-xs"> · {cliente.cliente_codigo}</span>}
                </span>
                {cliente.cliente_momento_faturamento === 'no_deferimento' ? (
                  <Badge className="bg-amber-500 text-white border-0 text-[10px] px-1.5 py-0 font-bold whitespace-nowrap">
                    COBRAR NO DEFERIMENTO
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 text-white border-0 text-[10px] px-1.5 py-0 font-bold whitespace-nowrap">
                    COBRAR
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {lancNaoAuditados.length} proc. · {fmt(totalNaoAuditado)}
                {totalTaxasNaoAuditado > 0 && <> + {fmt(totalTaxasNaoAuditado)} taxas</>}
                {' · '}{tipoLabel(cliente)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
              {temMetodoTrevo && (
                <Badge className="bg-emerald-600 text-white border-0 text-xs px-2 py-0.5 font-bold hidden sm:inline-flex">
                  🍀 MÉTODO TREVO
                </Badge>
              )}
              {temPrioridade && (
                <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                  🔴 Prioridade
                </Badge>
              )}
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] sm:text-xs whitespace-nowrap">
                <span className="sm:hidden">{lancNaoAuditados.length} pend.</span>
                <span className="hidden sm:inline">{lancNaoAuditados.length} não auditados</span>
              </Badge>
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-9 w-9 sm:h-7 sm:w-auto sm:px-3 p-0 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); handleAuditarTodos(); }}
                disabled={auditarTodosMut.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1">Auditar Todos</span>
              </Button>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-3">
            {lancNaoAuditados.map(l => (
              <AuditoriaFicha
                key={l.id}
                lancamento={l}
                clienteApelido={cliente.cliente_apelido || cliente.cliente_nome}
                clienteMomentoFaturamento={cliente.cliente_momento_faturamento}
                clienteValorBase={cliente.cliente_valor_base}
                isTaxaSourceOpen={taxaModalOpen && taxaProcessoId === l.processo_id}
                onOpenTaxa={(processoId) => {
                  setTaxaProcessoId(processoId);
                  setTaxaModalOpen(true);
                }}
                onAuditar={() => handleAuditarUm(l.id)}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
      {taxaProcessoId && (
        <ValoresAdicionaisModal
          open={taxaModalOpen}
          onOpenChange={setTaxaModalOpen}
          processoId={taxaProcessoId}
          clienteApelido={cliente.cliente_apelido || cliente.cliente_nome}
        />
      )}
      {/* Contact Modal for Billing */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Contato para cobrança
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              <strong>{cliente.cliente_apelido || cliente.cliente_nome}</strong> não tem {!temTelefone ? 'telefone' : 'contato completo'} cadastrado para cobrança.
            </p>
            <p className="text-xs text-muted-foreground">
              Para quem a Carolina deve enviar a cobrança?
            </p>
            {needsName && (
              <div className="space-y-1.5">
                <Label className="text-sm">Nome do responsável</Label>
                <Input
                  type="text"
                  placeholder="Ex: Fernando Barbosa"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="h-10"
                  style={{ fontSize: 16 }}
                />
              </div>
            )}
            {needsPhone && (
              <div className="space-y-1.5">
                <Label className="text-sm">Telefone (WhatsApp)</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  value={contactPhone}
                  onChange={e => handlePhoneInput(e.target.value)}
                  className="h-10"
                  style={{ fontSize: 16 }}
                  autoFocus={!needsName}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleContactSkip} className="text-muted-foreground">
              Pular
            </Button>
            <Button onClick={handleContactSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Salvar e Auditar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AuditoriaFicha({
  lancamento: l,
  clienteApelido,
  clienteMomentoFaturamento,
  clienteValorBase,
  isTaxaSourceOpen,
  onOpenTaxa,
  onAuditar,
}: {
  lancamento: LancamentoFinanceiro;
  clienteApelido: string;
  clienteMomentoFaturamento: string;
  clienteValorBase: number | null;
  isTaxaSourceOpen: boolean;
  onOpenTaxa: (processoId: string) => void;
  onAuditar: () => void;
}) {
  const auditarMut = useAuditarLancamento();
  const alterarValorMut = useAlterarValorLancamento();
  const qc = useQueryClient();
  const { isMaster } = usePermissions();
  const [editingValor, setEditingValor] = useState(false);
  const [novoValor, setNovoValor] = useState('');
  const [deferidoOpen, setDeferidoOpen] = useState(false);
  const [deferidoData, setDeferidoData] = useState(() => new Date().toISOString().split('T')[0]);
  const [savingDeferido, setSavingDeferido] = useState(false);
  const [trevoOpen, setTrevoOpen] = useState(false);
  const [savingTrevo, setSavingTrevo] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingProcesso, setDeletingProcesso] = useState(false);

  const handleExcluirProcesso = async () => {
    if (!l.processo_id) return;
    setDeletingProcesso(true);
    try {
      // Delete lancamentos first (FK)
      const { error: lancErr } = await supabase
        .from('lancamentos')
        .delete()
        .eq('processo_id', l.processo_id);
      if (lancErr) throw lancErr;
      const { error: procErr } = await supabase
        .from('processos')
        .delete()
        .eq('id', l.processo_id);
      if (procErr) throw procErr;
      toast.success('Processo excluído');
      setConfirmDeleteOpen(false);
      invalidateFinanceiro(qc);
      qc.invalidateQueries({ queryKey: ['processos'] });
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err?.message || 'Erro'));
    } finally {
      setDeletingProcesso(false);
    }
  };

  const alertaTaxas = (l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade) && l.total_valores_adicionais === 0;

  const valorBase = Number(clienteValorBase ?? 0);
  const novoValorTrevo = Math.round(valorBase * 1.5 * 100) / 100;

  // Show "Marcar Deferido" only for no_deferimento clients with processes still in pre-deferimento stage
  const podeMarcarDeferido =
    clienteMomentoFaturamento === 'no_deferimento'
    && ETAPAS_PRE_DEFERIMENTO.includes(l.processo_etapa)
    && !l.processo_data_deferimento
    && !!l.processo_id;

  const handleDesmarcar = () => {
    auditarMut.mutate({ lancamentoId: l.id, auditado: false }, {
      onSuccess: () => toast.success('Auditoria removida'),
    });
  };

  const handleConfirmarDeferido = async () => {
    if (!l.processo_id) return;
    if (!deferidoData) { toast.error('Selecione uma data'); return; }
    setSavingDeferido(true);
    try {
      const { error } = await supabase
        .from('processos')
        .update({ data_deferimento: deferidoData, etapa: 'registro' } as any)
        .eq('id', l.processo_id);
      if (error) throw error;
      toast.success('Processo marcado como deferido');
      setDeferidoOpen(false);
      invalidateFinanceiro(qc);
      qc.invalidateQueries({ queryKey: ['processos'] });
    } catch (err: any) {
      toast.error('Erro ao marcar deferido: ' + (err?.message || 'Erro'));
    } finally {
      setSavingDeferido(false);
    }
  };

  const handleSalvarValor = () => {
    const valor = parseFloat(novoValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) { toast.error('Valor inválido'); return; }
    alterarValorMut.mutate({
      lancamentoId: l.id,
      novoValor: valor,
      valorAtual: l.valor,
    }, {
      onSuccess: () => setEditingValor(false),
    });
  };

  const handleAtivarTrevo = async () => {
    if (!l.processo_id) return;
    if (valorBase <= 0) { toast.error('Cliente sem valor base cadastrado'); return; }
    setSavingTrevo(true);
    try {
      const timestamp = new Date().toISOString();
      // 1. Update processo: append etiqueta + recalc valor
      const { data: procData, error: procFetchErr } = await supabase
        .from('processos')
        .select('etiquetas')
        .eq('id', l.processo_id)
        .single();
      if (procFetchErr) throw procFetchErr;
      const etiquetasAtuais: string[] = (procData?.etiquetas as string[]) || [];
      const novasEtiquetas = etiquetasAtuais.includes('metodo_trevo')
        ? etiquetasAtuais
        : [...etiquetasAtuais, 'metodo_trevo'];

      const { error: procErr } = await supabase
        .from('processos')
        .update({ etiquetas: novasEtiquetas, valor: novoValorTrevo, updated_at: timestamp } as any)
        .eq('id', l.processo_id);
      if (procErr) throw procErr;

      // 2. Update lancamento (only if not pago)
      if (l.status !== 'pago') {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: lancErr } = await supabase
          .from('lancamentos')
          .update({
            valor: novoValorTrevo,
            valor_original: l.valor_original ?? l.valor,
            valor_alterado_por: user?.id,
            valor_alterado_em: timestamp,
            updated_at: timestamp,
          } as any)
          .eq('id', l.id);
        if (lancErr) throw lancErr;
      }

      toast.success(`Método Trevo ativado · ${fmt(novoValorTrevo)}`);
      setTrevoOpen(false);
      invalidateFinanceiro(qc);
      qc.invalidateQueries({ queryKey: ['processos'] });
    } catch (err: any) {
      toast.error('Erro ao ativar Método Trevo: ' + (err?.message || 'Erro'));
    } finally {
      setSavingTrevo(false);
    }
  };

  const handleDesativarTrevo = async () => {
    if (!l.processo_id) return;
    setSavingTrevo(true);
    try {
      const timestamp = new Date().toISOString();

      // 1. Busca etiquetas atuais e remove metodo_trevo
      const { data: procData, error: procFetchErr } = await supabase
        .from('processos')
        .select('etiquetas')
        .eq('id', l.processo_id)
        .single();
      if (procFetchErr) throw procFetchErr;
      const etiquetasAtuais: string[] = (procData?.etiquetas as string[]) || [];
      const novasEtiquetas = etiquetasAtuais.filter(e => e !== 'metodo_trevo');

      // 2. Calcula valor a restaurar.
      //    Prioridade: valor_original do lançamento (se existir) → valor base do cliente
      //    Se nenhum dos dois for válido, não mexe no valor (evita zerar por engano).
      const valorRestaurado: number | null =
        (l.valor_original != null && Number(l.valor_original) > 0)
          ? Number(l.valor_original)
          : (valorBase > 0 ? valorBase : null);

      // 3. Update processo: tira etiqueta + reverte valor (se temos valor válido)
      const processoUpdate: Record<string, any> = {
        etiquetas: novasEtiquetas,
        updated_at: timestamp,
      };
      if (valorRestaurado !== null) processoUpdate.valor = valorRestaurado;

      const { error: procErr } = await supabase
        .from('processos')
        .update(processoUpdate as any)
        .eq('id', l.processo_id);
      if (procErr) throw procErr;

      // 4. Update lancamento (só se pendente E tivermos valor pra restaurar)
      if (valorRestaurado !== null && l.status !== 'pago') {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: lancErr } = await supabase
          .from('lancamentos')
          .update({
            valor: valorRestaurado,
            valor_alterado_por: user?.id,
            valor_alterado_em: timestamp,
            updated_at: timestamp,
          } as any)
          .eq('id', l.id);
        if (lancErr) throw lancErr;
      }

      toast.success(
        valorRestaurado !== null
          ? `Método Trevo removido · valor voltou para ${fmt(valorRestaurado)}`
          : 'Método Trevo removido'
      );
      setTrevoOpen(false);
      invalidateFinanceiro(qc);
      qc.invalidateQueries({ queryKey: ['processos'] });
    } catch (err: any) {
      toast.error('Erro ao remover: ' + (err?.message || 'Erro'));
    } finally {
      setSavingTrevo(false);
    }
  };

  const { highlight, ref: highlightRef } = useHighlightOnModal(isTaxaSourceOpen);

  return (
    <div
      ref={highlightRef}
      className={cn(
        "rounded-lg border p-3 space-y-2 transition-all duration-700",
        l.auditado ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/20",
        highlight && "border-l-4 border-l-primary bg-primary/5 shadow-md"
      )}
    >
      {/* Header */}
      <div>
        <p className="text-sm font-semibold truncate">{l.processo_razao_social}</p>
        <p className="text-xs text-muted-foreground truncate">
          {TIPO_PROCESSO_LABELS[l.processo_tipo as keyof typeof TIPO_PROCESSO_LABELS] || l.processo_tipo}
          {l.processo_etapa && ` · ${l.processo_etapa}`}
          {l.processo_data_deferimento && (
            <span className="ml-2 inline-flex items-center font-mono text-emerald-600 text-[10px]">
              · Deferido {fmtDate(l.processo_data_deferimento)}
            </span>
          )}
        </p>
        {(l as any).etapa_financeiro === 'aguardando_deferimento' && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            🕒 Aguardando deferimento — cobrança bloqueada até marcar deferido
          </div>
        )}
      </div>

      {/* Etiquetas + Switch Método Trevo */}
      <div className="flex gap-3 flex-wrap items-center">
        {l.processo_id && (
          <Popover open={trevoOpen} onOpenChange={setTrevoOpen}>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer select-none">
                <Switch
                  checked={l.tem_etiqueta_metodo_trevo}
                  onCheckedChange={() => setTrevoOpen(true)}
                  className={cn(
                    l.tem_etiqueta_metodo_trevo && "data-[state=checked]:bg-emerald-600"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-bold",
                    l.tem_etiqueta_metodo_trevo
                      ? "text-emerald-500"
                      : "text-muted-foreground"
                  )}
                >
                  {l.tem_etiqueta_metodo_trevo ? '🍀 MÉTODO TREVO' : 'Ativar Método Trevo'}
                </span>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-2" align="start">
              {l.tem_etiqueta_metodo_trevo ? (
                <>
                  <p className="text-sm font-semibold">Remover Método Trevo?</p>
                  {(() => {
                    const valorRestauro =
                      (l.valor_original != null && Number(l.valor_original) > 0)
                        ? Number(l.valor_original)
                        : (valorBase > 0 ? valorBase : null);
                    return (
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor atual:</span>
                          <span className="font-mono">{fmt(l.valor)}</span>
                        </div>
                        {valorRestauro !== null ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Voltará para:</span>
                            <span className="font-mono font-bold text-emerald-500">
                              {fmt(valorRestauro)}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-amber-600">
                            ⚠ Sem valor base cadastrado — valor atual será mantido.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setTrevoOpen(false)}>Cancelar</Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={handleDesativarTrevo} disabled={savingTrevo}>
                      {savingTrevo ? 'Removendo...' : 'Remover'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">Ativar Método Trevo</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor atual:</span><span className="font-mono">{fmt(l.valor)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Novo valor (base × 1.5):</span><span className="font-mono font-bold text-emerald-500">{fmt(novoValorTrevo)}</span></div>
                  </div>
                  <p className="text-[10px] text-amber-600">⚠ O desconto progressivo será removido</p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setTrevoOpen(false)}>Cancelar</Button>
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAtivarTrevo} disabled={savingTrevo || valorBase <= 0}>
                      {savingTrevo ? 'Salvando...' : 'Confirmar'}
                    </Button>
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>
        )}
        {l.tem_etiqueta_prioridade && (
          <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px] px-1.5 py-0">
            🔴 Prioridade
          </Badge>
        )}
      </div>

      {/* Valor + Vencimento */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-primary">{fmt(l.valor + (l.total_valores_adicionais || 0))}</span>
          {l.valor_alterado_em && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-500/30">
              ✏️ Alterado
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">Vence {fmtDate(l.data_vencimento)}</span>
      </div>

      {/* FIX 1 — Subtotal honorário + taxa + total */}
      <div className="text-xs space-y-0.5 rounded bg-muted/30 p-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Honorários:</span>
          <span className="font-mono">
            {fmt(l.valor)}
            {l.valor_original != null && l.valor_original !== l.valor && (
              <span className="ml-1 text-[10px] text-muted-foreground line-through">{fmt(l.valor_original)}</span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxas reembolsáveis:</span>
          <span className="font-mono">{fmt(l.total_valores_adicionais || 0)}</span>
        </div>
        <div className="flex justify-between border-t border-border/40 pt-0.5 mt-0.5 font-semibold">
          <span>Total:</span>
          <span className="font-mono">{fmt(l.valor + (l.total_valores_adicionais || 0))}</span>
        </div>
      </div>

      {/* FIX 3 — Aviso de aguardando deferimento */}
      {clienteMomentoFaturamento === 'no_deferimento' && !l.processo_data_deferimento && (
        <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 text-amber-700 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Aguarda deferimento. Marque a data antes de auditar.</span>
        </div>
      )}

      {/* Alerta de taxas */}
      {alertaTaxas && (
        <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 text-amber-600 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Este processo tem etiqueta especial mas não tem taxas adicionais cadastradas. Verificar antes de auditar.</span>
        </div>
      )}

      {/* Edição de valor inline */}
      {editingValor && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={novoValor}
            onChange={e => setNovoValor(e.target.value)}
            placeholder="Novo valor"
            className="h-8 text-sm w-32"
            style={{ fontSize: 16 }}
            autoFocus
          />
          <Button size="sm" variant="ghost" className="h-8 text-emerald-600" onClick={handleSalvarValor} disabled={alterarValorMut.isPending}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setEditingValor(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* FIX 5 — Observação editável (debounce 1s) */}
      <ObservacaoField lancamentoId={l.id} initialValue={l.observacoes_financeiro || ''} />

      {l.processo_notas && (
        <p className="text-xs text-muted-foreground italic">Notas: {l.processo_notas}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={() => { setNovoValor(String(l.valor)); setEditingValor(true); }}
        >
          <Pencil className="h-3 w-3 mr-1" /> Editar Valor
        </Button>
        {l.processo_id && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => onOpenTaxa(l.processo_id)}
          >
            <Receipt className="h-3 w-3 mr-1" /> Add Taxa
          </Button>
        )}
        {podeMarcarDeferido && (
          <Popover open={deferidoOpen} onOpenChange={setDeferidoOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 border-emerald-600/40 text-emerald-600 hover:bg-emerald-600/10 hover:text-emerald-700"
              >
                <CalendarCheck className="h-3 w-3 mr-1" /> Deferido ✅
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-2" align="start">
              <Label className="text-xs">Data do deferimento</Label>
              <Input
                type="date"
                value={deferidoData}
                onChange={e => setDeferidoData(e.target.value)}
                className="h-9 text-sm"
                style={{ fontSize: 16 }}
              />
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleConfirmarDeferido}
                disabled={savingDeferido}
              >
                {savingDeferido ? 'Salvando...' : 'Confirmar'}
              </Button>
            </PopoverContent>
          </Popover>
        )}
        <Button
          size="sm"
          className={cn(
            "text-xs h-7",
            l.auditado
              ? "bg-emerald-600/20 text-emerald-600 hover:bg-emerald-600/30 border border-emerald-600/30"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
          onClick={l.auditado ? handleDesmarcar : onAuditar}
          disabled={auditarMut.isPending}
        >
          <Check className="h-3 w-3 mr-1" /> {l.auditado ? 'Auditado ✅' : 'Auditar'}
        </Button>
        {isMaster() && l.processo_id && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDeleteOpen(true)}
            title="Excluir processo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir processo <strong>{l.processo_razao_social}</strong>? Esta ação não pode ser desfeita e removerá também o lançamento financeiro vinculado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProcesso}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleExcluirProcesso(); }}
              disabled={deletingProcesso}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProcesso ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// FIX 5 — Editable observação field with debounced autosave
function ObservacaoField({ lancamentoId, initialValue }: { lancamentoId: string; initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialValue);
  const qc = useQueryClient();

  useEffect(() => {
    setValue(initialValue);
    lastSavedRef.current = initialValue;
  }, [initialValue, lancamentoId]);

  useEffect(() => {
    if (value === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from('lancamentos')
        .update({ observacoes_financeiro: value || null } as any)
        .eq('id', lancamentoId);
      setSaving(false);
      if (error) {
        toast.error('Erro ao salvar observação');
        return;
      }
      lastSavedRef.current = value;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      invalidateFinanceiro(qc);
    }, 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, lancamentoId, qc]);

  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Observação (aparecerá no extrato)"
        rows={1}
        className="text-xs min-h-[32px] resize-y"
        style={{ fontSize: 14 }}
      />
      {saving && <p className="text-[10px] text-muted-foreground">Salvando...</p>}
      {savedFlash && !saving && <p className="text-[10px] text-emerald-600">✓ Salvo</p>}
    </div>
  );
}
