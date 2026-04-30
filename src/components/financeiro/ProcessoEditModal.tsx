import { useState, useRef, useMemo, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Upload, CheckCircle2, Trash2, PlusCircle, Download, Eye, Loader2, Save,
} from 'lucide-react';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useUpdateLancamentoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useValoresAdicionais } from '@/hooks/useValoresAdicionais';
import { useAllServiceNegotiations, buildNegotiationLookup } from '@/hooks/useAllServiceNegotiations';
import { uploadFile, viewFile, getSignedUrl } from '@/hooks/useStorageUpload';
import { formatBRL } from '@/lib/pricing-engine';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import ValoresAdicionaisModal from './ValoresAdicionaisModal';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import { useDeleteProcesso } from '@/hooks/useProcessos';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import DocRow from './DocRow';

interface ProcessoEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: ProcessoFinanceiro | null;
}

export default function ProcessoEditModal({ open, onOpenChange, processo }: ProcessoEditModalProps) {
  const queryClient = useQueryClient();
  const updateLanc = useUpdateLancamentoFinanceiro();
  const deleteProcesso = useDeleteProcesso();
  const { data: allNegotiations = [] } = useAllServiceNegotiations();

  // Editable form states
  const [editValor, setEditValor] = useState(0);
  const [editObservacoes, setEditObservacoes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showSavePassword, setShowSavePassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [valoresOpen, setValoresOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Sync form when processo changes
  useEffect(() => {
    if (processo) {
      const lanc = processo.lancamento;
      setEditValor(Number(lanc?.valor ?? processo.valor ?? 0));
      setEditObservacoes(lanc?.observacoes_financeiro || '');
      setHasChanges(false);
    }
  }, [processo?.id, processo?.lancamento?.observacoes_financeiro, processo?.lancamento?.valor, processo?.valor]);

  const boletoRef = useRef<HTMLInputElement>(null);
  const comprovanteRef = useRef<HTMLInputElement>(null);
  const reciboRef = useRef<HTMLInputElement>(null);

  const { data: valoresAdicionais = [] } = useValoresAdicionais(processo?.id ?? '');

  // Retroactive negotiation detection
  const negotiationLookup = useMemo(() => buildNegotiationLookup(allNegotiations), [allNegotiations]);

  const matchedNeg = useMemo(() => {
    if (!processo) return null;
    const clientMap = negotiationLookup.get(processo.cliente_id);
    if (!clientMap) return null;
    const descricao = processo.lancamento?.descricao || '';
    for (const [name, neg] of clientMap) {
      if (descricao.toLowerCase().includes(name)) return neg;
    }
    return null;
  }, [processo, negotiationLookup]);

  if (!processo) return null;

  const lanc = processo.lancamento;
  const cliente = processo.cliente as any;
  const clienteApelido = cliente?.apelido || cliente?.nome || '-';
  const isNegociado = !!matchedNeg;
  const serviceName = matchedNeg?.service_name || lanc?.descricao || TIPO_PROCESSO_LABELS[processo.tipo] || processo.tipo;
  const createdAt = processo.created_at ? new Date(processo.created_at).toLocaleDateString('pt-BR') : null;

  const mutateField = (updates: Record<string, any>) => {
    updateLanc.mutate({
      processoId: processo.id,
      lancamentoId: lanc?.id,
      clienteId: processo.cliente_id,
      valor: Number(lanc?.valor ?? processo.valor ?? 0),
      updates,
    });
  };

  const handleUpload = async (field: string, file: File, folder: string) => {
    try {
      setUploading(field);
      const path = await uploadFile(file, folder, processo.id);
      mutateField({ [field]: path });
      toast.success('Arquivo enviado com sucesso');
    } catch {
      // error handled in uploadFile
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (storagePath: string) => {
    const url = await getSignedUrl(storagePath);
    const a = document.createElement('a');
    a.href = url;
    a.download = storagePath.split('/').pop() || 'arquivo';
    a.target = '_blank';
    a.click();
  };

  const handleDeleteConfirm = () => {
    deleteProcesso.mutate(processo.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  // Save all changes after password validation
  const handleSalvarComSenha = async () => {
    setIsSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const valorAnterior = Number(lanc?.valor ?? processo.valor ?? 0);
      const valorMudou = editValor !== valorAnterior;
      let currentUserId: string | null = null;

      if (valorMudou) {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id ?? null;
      }

      // Build notas for processo
      let notasProcesso = processo.notas || '';
      if (valorMudou) {
        const dateStr = new Date().toLocaleDateString('pt-BR');
        const registro = `Valor alterado manualmente de R$ ${valorAnterior.toFixed(2)} para R$ ${editValor.toFixed(2)} em ${dateStr}`;
        if (!notasProcesso.includes('Valor Manual')) {
          notasProcesso = `Valor Manual | ${notasProcesso}\n${registro}`.trim();
        } else {
          notasProcesso = `${notasProcesso}\n${registro}`.trim();
        }
      }

      // 1. Update processo
      const procUpdates: Record<string, any> = { updated_at: timestamp };
      if (valorMudou) {
        procUpdates.valor = editValor;
        procUpdates.notas = notasProcesso;
      }
      const { error: errProc } = await supabase
        .from('processos')
        .update(procUpdates as any)
        .eq('id', processo.id);
      if (errProc) throw errProc;

      // 2. Update lancamento
      if (lanc?.id) {
        const lancUpdates: Record<string, any> = {
          observacoes_financeiro: editObservacoes,
          updated_at: timestamp,
        };
        if (valorMudou) {
          lancUpdates.valor = editValor;
          lancUpdates.valor_original = (lanc as any)?.valor_original ?? valorAnterior;
          lancUpdates.valor_alterado_em = timestamp;
          lancUpdates.valor_alterado_por = currentUserId;
        }
        const { error: errLanc } = await supabase
          .from('lancamentos')
          .update(lancUpdates as any)
          .eq('id', lanc.id);
        if (errLanc) console.warn('Erro ao atualizar lançamento:', errLanc);
      }

      // 3. Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['processos_financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      queryClient.invalidateQueries({ queryKey: ['processos_db'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['contas_receber'] });

      toast.success('Alterações salvas com sucesso!');
      setHasChanges(false);
    } catch (err: any) {
      console.error('Erro ao salvar alterações:', err);
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsSaving(false);
    }
  };

  const somaAdicionais = valoresAdicionais.reduce((s, i) => s + Number(i.valor), 0);
  const totalValue = editValor + somaAdicionais;

  // Discount info from notas
  const discountMatch = processo.notas?.match(/Base: R\$ ([\d.,]+) \| Desconto: R\$ ([\d.,]+)/);
  const valorBaseOriginal = discountMatch ? parseFloat(discountMatch[1].replace(',', '.')) : null;
  const descontoAcum = discountMatch ? parseFloat(discountMatch[2].replace(',', '.')) : 0;
  const processNumMatch = processo.notas?.match(/Processo nº (\d+) do mês/);
  const processNum = processNumMatch ? processNumMatch[1] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col bg-background text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {serviceName}
              <Badge variant="outline" className="text-[10px] border-border">{processo.tipo}</Badge>
              {cliente?.tipo === 'MENSALISTA' && (
                <Badge variant="outline" className="text-[10px] border-info text-info">Mensalista</Badge>
              )}
              {isNegociado && (
                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                  Negociado
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {processo.razao_social} — <span className="font-semibold text-foreground">{clienteApelido}</span>
              {createdAt && <span className="ml-2 text-xs">📅 {createdAt}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Value — editable */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Valor do Processo</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editValor}
                  onChange={(e) => {
                    setEditValor(Number(e.target.value));
                    setHasChanges(true);
                  }}
                  className="w-32 text-lg font-bold bg-background border-border"
                />
              </div>

              {valorBaseOriginal && descontoAcum > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Original</span>
                    <span className="text-foreground">{formatBRL(valorBaseOriginal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-info">Desconto Acumulado {processNum && `(nº ${processNum} do mês)`}</span>
                    <span className="text-info">-{formatBRL(descontoAcum)}</span>
                  </div>
                </>
              )}

              {somaAdicionais > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valores Adicionais ({valoresAdicionais.length})</span>
                  <span className="text-primary">{formatBRL(somaAdicionais)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{formatBRL(totalValue)}</span>
              </div>
              {isNegociado && (
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  ⚠️ Valor definido conforme Tabela de Honorários Específicos
                </p>
              )}
            </div>

            {/* Observações — editable */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Observações</label>
              <Textarea
                value={editObservacoes}
                onChange={(e) => {
                  setEditObservacoes(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Anotações sobre este processo..."
                className="text-sm min-h-[60px] bg-background border-border text-foreground"
                rows={3}
              />
            </div>

            {/* Valores Adicionais */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Valores Adicionais</label>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 justify-start border-border"
                onClick={() => setValoresOpen(true)}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Gerenciar Valores Adicionais
                {somaAdicionais > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                    {valoresAdicionais.length} itens · {formatBRL(somaAdicionais)}
                  </Badge>
                )}
              </Button>
            </div>

            <Separator className="bg-border" />

            {/* Documents */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Documentos Anexados</label>
              <DocRow label="Boleto" storagePath={lanc?.boleto_url} field="boleto_url" inputRef={boletoRef} folder="boletos" uploading={uploading} onUpload={handleUpload} onView={viewFile} onDownload={handleDownload} />
              <DocRow label="Comprovante de Pagamento" storagePath={(lanc as any)?.url_comprovante} field="url_comprovante" inputRef={comprovanteRef} folder="comprovantes" uploading={uploading} onUpload={handleUpload} onView={viewFile} onDownload={handleDownload} />
              <DocRow label="Guia / Recibo de Taxa" storagePath={(lanc as any)?.url_recibo_taxa} field="url_recibo_taxa" inputRef={reciboRef} folder="recibos" uploading={uploading} onUpload={handleUpload} onView={viewFile} onDownload={handleDownload} />
            </div>

            <Separator className="bg-border" />

            {/* Save button — visible only when there are changes */}
            {hasChanges && (
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setShowSavePassword(true)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="h-3.5 w-3.5 mr-1.5" /> Salvar Alterações</>
                )}
              </Button>
            )}

            {/* Delete */}
            <Button variant="destructive" size="sm" className="w-full" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir Processo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ValoresAdicionaisModal open={valoresOpen} onOpenChange={setValoresOpen} processoId={processo.id} clienteApelido={clienteApelido} />

      <PasswordConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Processo"
        description="Esta ação é irreversível. Confirme a senha master para excluir."
      />

      <PasswordConfirmDialog
        open={showSavePassword}
        onOpenChange={setShowSavePassword}
        onConfirm={handleSalvarComSenha}
        title="Confirmar Alterações"
        description="Digite a senha de administração para salvar as alterações."
      />
    </>
  );
}
