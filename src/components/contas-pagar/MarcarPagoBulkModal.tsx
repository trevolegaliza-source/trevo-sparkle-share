import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { empresaPath } from '@/lib/storage-path';
import { toast } from 'sonner';

interface Props {
  lancamentos: any[]; // selecionados (já filtrados — só pendentes)
  open: boolean;
  onClose: () => void;
  onConfirm: (ids: string[], dataPagamento: string, comprovanteUrl?: string) => Promise<void>;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Modal pra marcar VÁRIOS lançamentos como pagos de uma vez só.
 * Caso de uso clássico: Carolina/Thales fizeram pagamentos em lote no
 * banco e agora querem dar baixa em N contas com 1 clique.
 *
 * Comprovante é único pro lote (todos os lançamentos selecionados ganham
 * a mesma URL). Se Thales precisa anexar comprovantes diferentes pra
 * cada um, ainda pode marcar individual — esse modal é pra simplicidade.
 */
export default function MarcarPagoBulkModal({ lancamentos, open, onClose, onConfirm }: Props) {
  const [dataPag, setDataPag] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = lancamentos.reduce((s, l) => s + Number(l.valor || 0), 0);

  const handleConfirm = async () => {
    if (lancamentos.length === 0) {
      toast.error('Nada selecionado.');
      return;
    }
    setSubmitting(true);
    try {
      let comprovanteUrl: string | undefined;
      if (file) {
        // Mesmo comprovante pra todos. Path único baseado em timestamp pra evitar colisão.
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const stamp = Date.now();
        const path = await empresaPath(`comprovantes/bulk_${stamp}.${ext}`);
        const { error } = await supabase.storage
          .from(STORAGE_BUCKETS.CONTRACTS)
          .upload(path, file, { upsert: false });
        if (error) throw error;
        comprovanteUrl = path;
      }
      await onConfirm(lancamentos.map(l => l.id), dataPag, comprovanteUrl);
      setFile(null);
      onClose();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  // Detecta se há VT/VR no lote — alerta porque eles vão cascatear (ver useMarcarPago)
  const temVtVr = lancamentos.some(l => {
    const sub = String(l.subcategoria || '').toLowerCase();
    return sub.includes('vt') || sub.includes('vr')
      || sub.includes('vale transporte') || sub.includes('vale refeição')
      || sub.includes('transporte') || sub.includes('refeição');
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Marcar {lancamentos.length} pagamento(s) como pago
          </DialogTitle>
          <DialogDescription>
            Confirma que estes lançamentos foram efetivamente pagos. Comprovante opcional vale pra todos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Lista resumida */}
          <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-1">
            {lancamentos.map(l => (
              <div key={l.id} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate flex-1 text-foreground/85">{l.descricao}</span>
                <span className="font-mono tabular-nums shrink-0">{fmt(Number(l.valor || 0))}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-sm font-medium">Total do lote:</span>
            <span className="text-base font-bold tabular-nums text-emerald-600">{fmt(total)}</span>
          </div>

          {temVtVr && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Há VT/VR neste lote. Marcar 1 desses faz com que TODOS os VT/VR
                do mesmo colaborador no mesmo mês sejam marcados juntos
                (comportamento esperado, mas avise se precisar separar).
              </span>
            </div>
          )}

          <div className="grid gap-2">
            <Label className="text-xs">Data do pagamento</Label>
            <Input
              type="date"
              value={dataPag}
              onChange={e => setDataPag(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs">Comprovante (opcional, vale pra todos)</Label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                {file ? file.name : 'Selecionar arquivo (PDF, PNG, JPG)...'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-[10px] text-muted-foreground">
              Se cada pagamento tem comprovante diferente, marque individual
              em vez de em lote.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? 'Enviando...' : `Marcar ${lancamentos.length} como pago(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
