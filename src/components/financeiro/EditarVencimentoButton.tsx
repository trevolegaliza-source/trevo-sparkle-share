import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';

interface Props {
  cobrancaId: string | null | undefined;
  dataAtual?: string | null;
  size?: 'sm' | 'default';
  className?: string;
}

export function EditarVencimentoButton({ cobrancaId, dataAtual, size = 'sm', className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [novaData, setNovaData] = useState<string>(dataAtual?.slice(0, 10) || '');
  const qc = useQueryClient();

  async function handleSubmit() {
    if (!cobrancaId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
      toast.error('Data inválida');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-atualizar-vencimento', {
        body: { cobranca_id: cobrancaId, nova_data_vencimento: novaData },
      });
      if (error) {
        toast.error('Erro ao atualizar: ' + (error.message || 'desconhecido'));
        return;
      }
      if (data?.error) {
        const msg = data.detalhe || data.message || data.error;
        toast.error('Asaas rejeitou: ' + msg);
        return;
      }
      invalidateFinanceiro(qc);
      qc.invalidateQueries({ queryKey: ['cobrancas'] });
      toast.success('Vencimento atualizado! Asaas regenerou boleto/PIX. Link continua o mesmo.');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size={size}
        variant="outline"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        disabled={!cobrancaId}
        className={className}
        title="Alterar a data de vencimento dessa cobrança no Asaas e no ERP"
      >
        <CalendarClock className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Editar vencimento</span>
        <span className="sm:hidden">Vencimento</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar vencimento da cobrança</DialogTitle>
            <DialogDescription>
              Altera no Asaas (boleto/PIX são regerados) e no ERP atomicamente.
              O <strong>mesmo link</strong> que você compartilhou com o cliente
              passa a mostrar a nova data — não precisa enviar novo link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="nova-data">Nova data de vencimento</Label>
            <Input
              id="nova-data"
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
            {dataAtual && (
              <p className="text-xs text-muted-foreground">
                Atual: {new Date(dataAtual + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={busy || !novaData}>
              {busy ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Atualizando…</>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
