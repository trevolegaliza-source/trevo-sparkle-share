import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMarcarProcessoPago } from '@/hooks/useFinanceiro';
import { TIPO_PROCESSO_LABELS } from '@/types/process';
import type { TipoProcesso } from '@/types/financial';

interface Props {
  processo: {
    id: string;
    razao_social: string;
    tipo: string;
    valor: number | null;
  } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

// FEAT-001 (11/05/2026): permite marcar processo como pago DEPOIS de criado.
// Antes só era possível no momento do cadastro (checkbox ja_pago). Espelha o
// comportamento de ja_pago=true: lancamento vira 'pago' + 'honorario_pago' +
// confirmado_recebimento=true, e processo é promovido a etapa='finalizados'.
// Backend: RPC public.marcar_processo_pago (atômica, com tenant check).
export default function MarcarPagoProcessoModal({ processo, open, onOpenChange, onSuccess }: Props) {
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().split('T')[0]);
  const marcar = useMarcarProcessoPago();

  // Reseta data pra hoje quando o modal abre com outro processo
  useEffect(() => {
    if (open) setDataPagamento(new Date().toISOString().split('T')[0]);
  }, [open, processo?.id]);

  if (!processo) return null;

  const handleConfirm = () => {
    marcar.mutate(
      { processoId: processo.id, dataPagamento },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar processo como pago</DialogTitle>
          <DialogDescription>
            O lançamento financeiro será confirmado e o processo será movido para "Finalizados".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm space-y-1 rounded-md border border-border/60 bg-muted/30 p-3">
            <p><span className="text-muted-foreground">Razão social:</span> {processo.razao_social}</p>
            <p>
              <span className="text-muted-foreground">Tipo:</span>{' '}
              {TIPO_PROCESSO_LABELS[processo.tipo as TipoProcesso] || processo.tipo}
            </p>
            <p>
              <span className="text-muted-foreground">Valor:</span>{' '}
              {processo.valor
                ? Number(processo.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '—'}
            </p>
          </div>
          <div>
            <Label>Data do pagamento</Label>
            <Input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Pode ser retroativa. Padrão: hoje.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={marcar.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={marcar.isPending || !dataPagamento}>
              {marcar.isPending ? 'Confirmando…' : 'Confirmar pagamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
