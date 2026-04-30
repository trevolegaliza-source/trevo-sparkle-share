import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMarcarRecebido } from '@/hooks/useContasReceber';
import type { LancamentoReceber } from '@/hooks/useContasReceber';

interface Props {
  lancamento: LancamentoReceber | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function MarcarRecebidoModal({ lancamento, open, onOpenChange }: Props) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const marcar = useMarcarRecebido();

  if (!lancamento) return null;

  const handleConfirm = () => {
    marcar.mutate({ id: lancamento.id, data_pagamento: dataPagamento }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Recebimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Descrição:</span> {lancamento.descricao}</p>
            <p><span className="text-muted-foreground">Cliente:</span> {lancamento.cliente?.nome || '-'}</p>
            <p><span className="text-muted-foreground">Valor:</span> {Number(lancamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div>
            <Label>Data do recebimento</Label>
            <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={marcar.isPending}>Confirmar Pagamento</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
