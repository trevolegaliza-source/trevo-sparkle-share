import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { empresaPath } from '@/lib/storage-path';
import { abrirArquivoStorage } from '@/lib/storage-utils';
import { toast } from 'sonner';

interface Props {
  lancamento: any | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: string, dataPagamento: string, comprovanteUrl?: string) => void;
}

/**
 * Modal de pagamento — agora também serve pra GERENCIAR comprovante
 * de pagamento JÁ FEITO. Se lancamento.status === 'pago', mostra
 * o comprovante atual com botões de "Ver", "Trocar", "Remover".
 *
 * Pra pagamento novo, comportamento original (data + upload opcional).
 */
export default function MarcarPagoModal({ lancamento, open, onClose, onConfirm }: Props) {
  const [dataPag, setDataPag] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comprovanteAtual, setComprovanteAtual] = useState<string | null>(null);

  // Sincroniza com lancamento ao abrir
  useEffect(() => {
    if (!lancamento) return;
    if (lancamento.data_pagamento) setDataPag(lancamento.data_pagamento);
    else setDataPag(new Date().toISOString().split('T')[0]);
    setComprovanteAtual(lancamento.comprovante_url || null);
    setFile(null);
  }, [lancamento]);

  if (!lancamento) return null;

  const isJaPago = lancamento.status === 'pago';

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let url: string | undefined = comprovanteAtual || undefined;
      if (file) {
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const path = await empresaPath(`comprovantes/${lancamento.id}.${ext}`);
        const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(path, file, { upsert: true });
        if (error) throw error;
        url = path;
      }
      onConfirm(lancamento.id, dataPag, url);
      setFile(null);
      onClose();
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'Desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  // Remove comprovante (apenas no banco — arquivo no storage permanece;
  // upsert=true vai sobrescrever na próxima vez se o path bater)
  const handleRemoveComprovante = async () => {
    if (!confirm('Remover comprovante deste pagamento?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('lancamentos')
        .update({ comprovante_url: null, updated_at: new Date().toISOString() })
        .eq('id', lancamento.id);
      if (error) throw error;
      setComprovanteAtual(null);
      toast.success('Comprovante removido. Você pode anexar outro.');
    } catch (err: any) {
      toast.error('Erro ao remover: ' + (err?.message || 'Desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isJaPago ? 'Editar pagamento' : 'Confirmar Pagamento'}</DialogTitle>
          {isJaPago && (
            <DialogDescription className="text-xs">
              Este lançamento já está pago. Você pode trocar a data ou gerenciar o comprovante.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm text-muted-foreground">{lancamento.descricao}</p>
            <p className="text-lg font-bold">
              {Number(lancamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Data de Pagamento</Label>
            <Input
              type="date"
              value={dataPag}
              onChange={e => setDataPag(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Comprovante atual (se há) */}
          {comprovanteAtual && !file && (
            <div className="grid gap-2">
              <Label className="text-xs">Comprovante atual</Label>
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
                <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-xs flex-1 truncate text-emerald-700 dark:text-emerald-400">
                  {comprovanteAtual.split('/').pop() || 'arquivo anexado'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => abrirArquivoStorage(STORAGE_BUCKETS.CONTRACTS, comprovanteAtual)}
                  title="Ver comprovante"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={handleRemoveComprovante}
                  disabled={submitting}
                  title="Remover comprovante"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label className="text-xs">
              {comprovanteAtual ? 'Trocar comprovante (opcional)' : 'Comprovante (opcional)'}
            </Label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate flex-1">
                {file ? file.name : 'Selecionar arquivo (PDF, PNG, JPG)...'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-[11px] text-muted-foreground underline self-start"
              >
                Cancelar troca
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Enviando...</> : (isJaPago ? 'Salvar' : 'Confirmar Pagamento')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
