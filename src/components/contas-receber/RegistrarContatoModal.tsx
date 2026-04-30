import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRegistrarContato, diasAtraso } from '@/hooks/useContasReceber';
import type { LancamentoReceber } from '@/hooks/useContasReceber';

interface Props {
  lancamento: LancamentoReceber | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function RegistrarContatoModal({ lancamento, open, onOpenChange }: Props) {
  const [meio, setMeio] = useState('WhatsApp');
  const [obs, setObs] = useState('');
  const registrar = useRegistrarContato();

  if (!lancamento) return null;

  const dias = diasAtraso(lancamento.data_vencimento, lancamento.status);

  const handleSalvar = () => {
    registrar.mutate({
      id: lancamento.id,
      meio,
      observacao: obs,
      tentativas_atual: lancamento.tentativas_cobranca || 0,
      notas_atual: lancamento.notas_cobranca || null,
    }, {
      onSuccess: () => { onOpenChange(false); setObs(''); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Tentativa de Cobrança</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Cliente:</span> {lancamento.cliente?.nome || '-'}</p>
            <p><span className="text-muted-foreground">Valor:</span> {Number(lancamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            <p><span className="text-muted-foreground">Dias em atraso:</span> {dias}</p>
          </div>
          <div>
            <Label>Meio de contato</Label>
            <Select value={meio} onValueChange={setMeio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Ligação">Ligação</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Descreva o contato..." rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={registrar.isPending || !obs.trim()}>Registrar Contato</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
