import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileCheck } from 'lucide-react';
import { useRegistrarRecarga } from '@/hooks/usePrepagoMovimentacoes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
  saldoAtual: number;
  onSuccess?: () => void;
}

export default function RecargaModal({ open, onOpenChange, clienteId, clienteNome, saldoAtual, onSuccess }: Props) {
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const recarga = useRegistrarRecarga();
  const valorNum = Number(valor) || 0;
  const novoSaldo = saldoAtual + valorNum;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo: 10MB');
        return;
      }
      setFile(f);
    }
  }, []);

  const handleConfirm = async () => {
    if (valorNum <= 0) return;

    let comprovanteUrl: string | undefined;

    // Upload comprovante if provided
    if (file) {
      setUploading(true);
      try {
        const ext = file.name.split('.').pop();
        const { empresaPath } = await import('@/lib/storage-path');
        const path = await empresaPath(`comprovantes/recarga_${clienteId}_${Date.now()}.${ext}`);
        const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
        if (error) throw error;
        comprovanteUrl = path;
      } catch (err: any) {
        toast.error('Erro no upload do comprovante: ' + err.message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    await recarga.mutateAsync({
      clienteId,
      valor: valorNum,
      saldoAtual,
      nomeCliente: clienteNome,
      comprovanteUrl,
      observacao: observacao || undefined,
    });
    setValor('');
    setObservacao('');
    setFile(null);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Recarga — Pré-Pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Cliente: <span className="font-medium text-foreground">{clienteNome}</span></p>
            <p className="text-sm text-muted-foreground">Saldo atual: <span className="font-medium text-foreground">{fmt(saldoAtual)}</span></p>
          </div>
          <div className="space-y-2">
            <Label>Valor da recarga *</Label>
            <Input type="number" step="0.01" min="0" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Comprovante</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">
                {file ? <FileCheck className="h-4 w-4 text-success" /> : <Upload className="h-4 w-4" />}
                {file ? file.name : 'Selecionar arquivo'}
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
              </label>
              {file && (
                <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="text-xs text-muted-foreground">
                  Remover
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea placeholder="Opcional..." value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} />
          </div>
          {valorNum > 0 && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-sm font-medium">Novo saldo: <span className="text-success">{fmt(novoSaldo)}</span></p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={valorNum <= 0 || recarga.isPending || uploading}>
            {recarga.isPending || uploading ? 'Processando...' : 'Confirmar Recarga'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
