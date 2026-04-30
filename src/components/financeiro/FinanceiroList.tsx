import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, FileText, Clock, MoreHorizontal, Undo2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { EtapaFinanceiro } from '@/types/financial';
import { ETAPA_FINANCEIRO_LABELS, STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import { supabase } from '@/integrations/supabase/client';
import { useExtratos } from '@/hooks/useExtratos';
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
import { useQueryClient } from '@tanstack/react-query';
import ProcessoEditModal from './ProcessoEditModal';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';

const ETAPAS_DEFERIDAS = ['registro', 'finalizados'];

interface DeferimentoAlertData {
  clienteNome: string;
  naoDeferidos: ProcessoFinanceiro[];
  todosSelecionados: ProcessoFinanceiro[];
}

interface FinanceiroListProps {
  processos: ProcessoFinanceiro[];
}

export default function FinanceiroList({ processos }: FinanceiroListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [lastPdfBlob, setLastPdfBlob] = useState<Blob | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProcesso, setEditProcesso] = useState<ProcessoFinanceiro | null>(null);
  const [showDeferimentoAlert, setShowDeferimentoAlert] = useState(false);
  const [deferimentoAlertData, setDeferimentoAlertData] = useState<DeferimentoAlertData | null>(null);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [undoProcesso, setUndoProcesso] = useState<ProcessoFinanceiro | null>(null);
  const [undoing, setUndoing] = useState(false);
  const qc = useQueryClient();
  const { salvarExtrato } = useExtratos();

  async function handleDesfazerPagamento() {
    if (!undoProcesso) return;
    setUndoing(true);
    try {
      const { error } = await supabase
        .from('lancamentos')
        .update({
          status: 'pendente' as const,
          etapa_financeiro: 'solicitacao_criada',
          data_pagamento: null,
          confirmado_recebimento: false,
        })
        .eq('processo_id', undoProcesso.id)
        .eq('status', 'pago');

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
      toast.success('Pagamento revertido. Processo voltou para A Cobrar.');
    } catch (err: any) {
      toast.error('Erro ao desfazer pagamento: ' + err.message);
    } finally {
      setUndoing(false);
      setShowUndoDialog(false);
      setUndoProcesso(null);
    }
  }

  const allChecked = processos.length > 0 && selected.size === processos.length;

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(processos.map(p => p.id)));
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function gerarExtratoParaProcessos(processosParaGerar: ProcessoFinanceiro[]) {
    setGenerating(true);
    try {
      const clienteId = processosParaGerar[0].cliente_id;
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, email, nome_contador, dia_cobranca, dia_vencimento_mensal')
        .eq('id', clienteId)
        .single();

      if (clienteData?.dia_vencimento_mensal && clienteData.dia_vencimento_mensal > 0 && !clienteData.dia_cobranca) {
        toast.info(`Atenção: o cliente ${clienteData.apelido || clienteData.nome} tem vencimento fixo no dia ${clienteData.dia_vencimento_mensal} de cada mês.`);
      }

      const [valoresAdicionais, allCompetencia] = await Promise.all([
        fetchValoresAdicionaisMulti(processosParaGerar.map(p => p.id)),
        fetchCompetenciaProcessos(clienteId, processosParaGerar),
      ]);

      const result = await gerarExtratoPDF({
        processos: processosParaGerar,
        allCompetencia,
        valoresAdicionais,
        cliente: clienteData as any,
      });

      const blob = result.doc.output('blob');
      setLastPdfBlob(blob);

      const clienteName = (clienteData as any)?.apelido || (clienteData as any)?.nome || 'extrato';
      const filename = `extrato_${clienteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save extrato to system
      const now = new Date();
      try {
        await salvarExtrato.mutateAsync({
          clienteId,
          pdfBlob: blob,
          filename,
          totalHonorarios: result.totalHonorarios,
          totalTaxas: result.totalTaxas,
          totalGeral: result.totalGeral,
          processoIds: processosParaGerar.map(p => p.id),
          competenciaMes: now.getMonth() + 1,
          competenciaAno: now.getFullYear(),
        });
      } catch (saveErr) {
        console.warn('Extrato gerado mas não salvo:', saveErr);
      }

      toast.success('Extrato gerado com sucesso!');
      setShowMarkDialog(true);
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGerarExtrato() {
    const selectedProcessos = processos.filter(p => selected.has(p.id));
    if (selectedProcessos.length === 0) {
      toast.warning('Selecione ao menos um processo.');
      return;
    }

    const clienteIds = new Set(selectedProcessos.map(p => p.cliente_id));
    if (clienteIds.size > 1) {
      toast.error('Apenas processos do mesmo cliente podem compor um extrato único.');
      return;
    }

    const clienteId = selectedProcessos[0].cliente_id;
    const { data: clienteCheck } = await supabase
      .from('clientes')
      .select('momento_faturamento, nome')
      .eq('id', clienteId)
      .single();

    if (clienteCheck?.momento_faturamento === 'no_deferimento') {
      const naoDeferidos = selectedProcessos.filter(p => !ETAPAS_DEFERIDAS.includes(p.etapa));

      if (naoDeferidos.length > 0) {
        setDeferimentoAlertData({
          clienteNome: clienteCheck.nome || 'Cliente',
          naoDeferidos,
          todosSelecionados: selectedProcessos,
        });
        setShowDeferimentoAlert(true);
        return;
      }
    }

    await gerarExtratoParaProcessos(selectedProcessos);
  }

  async function handleDeferimentoApenasDeferidos() {
    setShowDeferimentoAlert(false);

    const deferidos = deferimentoAlertData?.todosSelecionados?.filter(p => ETAPAS_DEFERIDAS.includes(p.etapa)) || [];
    if (deferidos.length === 0) {
      toast.warning('Nenhum processo deferido para gerar extrato.');
      return;
    }

    await gerarExtratoParaProcessos(deferidos);
  }

  async function handleDeferimentoTodos() {
    setShowDeferimentoAlert(false);
    if (!deferimentoAlertData) return;
    await gerarExtratoParaProcessos(deferimentoAlertData.todosSelecionados);
  }

  async function handleMarcarFaturado() {
    const selectedProcessos = processos.filter(p => selected.has(p.id));
    const now = new Date().toISOString();
    const dateStr = new Date().toLocaleDateString('pt-BR');

    try {
      for (const p of selectedProcessos) {
        if (p.lancamento) {
          await supabase
            .from('lancamentos')
            .update({
              etapa_financeiro: 'cobranca_gerada',
              updated_at: now,
            })
            .eq('id', p.lancamento.id);
        }
      }

      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
      toast.success('Processos marcados como faturados!');
      setSelected(new Set());
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setShowMarkDialog(false);
  }

  // Check which clients have deferimento
  const clienteMomentoMap = new Map<string, string>();
  processos.forEach(p => {
    if (!clienteMomentoMap.has(p.cliente_id)) {
      const momento = (p.cliente as any)?.momento_faturamento;
      if (momento) clienteMomentoMap.set(p.cliente_id, momento);
    }
  });

  return (
    <div className="space-y-3">
      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selected.size} processo{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            onClick={handleGerarExtrato}
            disabled={generating}
            className="gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            {generating ? 'Gerando...' : 'Gerar Extrato de Cobrança'}
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-3 py-2.5 w-10">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Cliente</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Razão Social</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Valor</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Vencimento</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Etapa</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {processos.map((p) => {
              const isOverdue = p.etapa_financeiro === 'honorario_vencido';
              const lanc = p.lancamento;
              const total = Number(lanc?.valor ?? p.valor ?? 0) + Number(lanc?.honorario_extra || 0);
              const status = (lanc?.status || 'pendente') as StatusFinanceiro;
              const isDeferimentoCliente = clienteMomentoMap.get(p.cliente_id) === 'no_deferimento';
              const isAguardandoDeferimento = isDeferimentoCliente && !ETAPAS_DEFERIDAS.includes(p.etapa);

              return (
                <tr key={p.id} className={cn('border-t border-border/30 cursor-pointer hover:bg-muted/30', isOverdue && 'bg-destructive/5')} onDoubleClick={() => { setEditProcesso(p); setEditModalOpen(true); }}>
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-foreground flex items-center gap-1.5">
                    {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {(p.cliente as any)?.apelido || (p.cliente as any)?.nome || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">{p.razao_social}</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {lanc?.data_vencimento ? new Date(lanc.data_vencimento).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {ETAPA_FINANCEIRO_LABELS[p.etapa_financeiro]}
                      </Badge>
                      {isAguardandoDeferimento && (
                        <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[9px] gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          Ag. Deferimento
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={cn(STATUS_STYLES[status], 'border-0 text-[10px]')}>
                      {STATUS_LABELS[status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.etapa_financeiro === 'honorario_pago' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUndoProcesso(p);
                              setShowUndoDialog(true);
                            }}
                          >
                            <Undo2 className="h-4 w-4 mr-2" />
                            Desfazer Pagamento
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
            {processos.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum processo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mark as billed dialog */}
      <AlertDialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extrato gerado com sucesso!</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja marcar os {selected.size} processo(s) selecionado(s) como "Faturado"?
              Isso registrará a data de emissão e atualizará a etapa financeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarcarFaturado}>
              Marcar como Faturado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deferimento warning dialog */}
      <AlertDialog open={showDeferimentoAlert} onOpenChange={setShowDeferimentoAlert}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Cliente com Faturamento no Deferimento
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  O cliente <strong>{deferimentoAlertData?.clienteNome}</strong> está configurado para faturar apenas no deferimento.
                </p>
                <p className="font-medium text-foreground">Os seguintes processos ainda não foram deferidos:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {deferimentoAlertData?.naoDeferidos.map(p => (
                    <li key={p.id}>
                      {TIPO_PROCESSO_LABELS[p.tipo] || p.tipo} — {p.razao_social}{' '}
                      <span className="text-muted-foreground">(Etapa: {p.etapa})</span>
                    </li>
                  ))}
                </ul>
                <p>Deseja gerar o extrato mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={handleDeferimentoApenasDeferidos}>
              Gerar Apenas Deferidos
            </Button>
            <AlertDialogAction onClick={handleDeferimentoTodos}>
              Gerar Todos Mesmo Assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo payment dialog */}
      <AlertDialog open={showUndoDialog} onOpenChange={setShowUndoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O processo voltará para "A Cobrar" e a data de pagamento será removida. Esta ação não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDesfazerPagamento}
              disabled={undoing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {undoing ? 'Revertendo...' : 'Sim, desfazer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProcessoEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        processo={editProcesso}
      />
    </div>
  );
}
