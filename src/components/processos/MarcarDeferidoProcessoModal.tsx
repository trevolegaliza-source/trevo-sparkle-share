import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMarcarDeferimento } from '@/hooks/useFinanceiro';
import { TIPO_PROCESSO_LABELS, type TipoProcesso } from '@/types/financial';

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

// FEAT-002 (11/05/2026): marcar processo deferido direto no ClienteDetalhe,
// sem precisar passar pelo DeferimentoModal do /financeiro → Auditoria.
// Backend: RPC public.marcar_deferimento — atômica, tenant check.
// Espelha o que o DeferimentoModal faz, mas pra 1 processo de cada vez na
// tela onde o usuário já está olhando.
export default function MarcarDeferidoProcessoModal({ processo, open, onOpenChange, onSuccess }: Props) {
  const [dataDeferimento, setDataDeferimento] = useState(() => new Date().toISOString().split('T')[0]);
  const marcar = useMarcarDeferimento();

  useEffect(() => {
    if (open) setDataDeferimento(new Date().toISOString().split('T')[0]);
  }, [open, processo?.id]);

  if (!processo) return null;

  const handleConfirm = () => {
    marcar.mutate(
      { processoId: processo.id, dataDeferimento },
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
          <DialogTitle>Marcar processo como deferido</DialogTitle>
          <DialogDescription>
            O lançamento sai de "aguardando deferimento" e entra na fila de cobrança com vencimento real.
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
            <Label>Data do deferimento</Label>
            <Input
              type="date"
              value={dataDeferimento}
              onChange={(e) => setDataDeferimento(e.target.value)}
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
            <Button onClick={handleConfirm} disabled={marcar.isPending || !dataDeferimento}>
              {marcar.isPending ? 'Confirmando…' : 'Confirmar deferimento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
