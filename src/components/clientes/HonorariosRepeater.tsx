import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save } from 'lucide-react';
import { useServiceNegotiations, useUpsertServiceNegotiations } from '@/hooks/useServiceNegotiations';
import type { ServiceNegotiation } from '@/hooks/useServiceNegotiations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NegotiationRow {
  key: string;
  service_name: string;
  fixed_price: string;
  billing_trigger: 'request' | 'approval';
  trigger_days: string;
}

const emptyRow = (): NegotiationRow => ({
  key: crypto.randomUUID(),
  service_name: '',
  fixed_price: '',
  billing_trigger: 'request',
  trigger_days: '5',
});

interface Props {
  clienteId: string;
}

export default function HonorariosRepeater({ clienteId }: Props) {
  const { data: existing, isLoading } = useServiceNegotiations(clienteId);
  const upsert = useUpsertServiceNegotiations();
  const [rows, setRows] = useState<NegotiationRow[]>([]);
  const [showRetroDialog, setShowRetroDialog] = useState(false);
  const [pendingRows, setPendingRows] = useState<NegotiationRow[]>([]);

  useEffect(() => {
    if (existing && existing.length > 0) {
      setRows(existing.map(n => ({
        key: n.id,
        service_name: n.service_name,
        fixed_price: String(n.fixed_price),
        billing_trigger: n.billing_trigger as 'request' | 'approval',
        trigger_days: String(n.trigger_days),
      })));
    } else if (existing) {
      setRows([]);
    }
  }, [existing]);

  const addRow = () => setRows(r => [...r, emptyRow()]);

  const removeRow = (key: string) => setRows(r => r.filter(row => row.key !== key));

  const updateRow = (key: string, field: keyof NegotiationRow, value: string) => {
    setRows(r => r.map(row => row.key === key ? { ...row, [field]: value } : row));
  };

  const handleSave = () => {
    const valid = rows.filter(r => r.service_name.trim() && r.fixed_price);
    if (valid.length === 0 && rows.length > 0) {
      toast.error('Preencha ao menos o nome e valor do serviço');
      return;
    }
    // Check if there are pending processes to update
    setPendingRows(valid);
    setShowRetroDialog(true);
  };

  const doSave = async (applyRetroactive: boolean) => {
    setShowRetroDialog(false);
    const negotiations = pendingRows.map(r => ({
      service_name: r.service_name.trim(),
      fixed_price: Number(r.fixed_price),
      billing_trigger: r.billing_trigger,
      trigger_days: Number(r.trigger_days) || 0,
      is_custom: true as const,
    }));

    await upsert.mutateAsync({ clienteId, negotiations });

    if (applyRetroactive && negotiations.length > 0) {
      // Update pending lancamentos for this client with matching descriptions
      for (const neg of negotiations) {
        const { data: lancamentos } = await supabase
          .from('lancamentos')
          .select('id, descricao')
          .eq('cliente_id', clienteId)
          .eq('tipo', 'receber')
          .in('status', ['pendente'])
          .ilike('descricao', `%${neg.service_name}%`);

        if (lancamentos && lancamentos.length > 0) {
          for (const l of lancamentos) {
            await supabase
              .from('lancamentos')
              .update({
                valor: neg.fixed_price,
                updated_at: new Date().toISOString(),
              } as any)
              .eq('id', l.id);
          }
        }
      }
      toast.success('Valores retroativos atualizados nos processos pendentes!');
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-muted-foreground">Tabela de Honorários Específicos</Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" /> Adicionar Serviço Negociado
          </Button>
          {rows.length > 0 && (
            <Button type="button" size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={upsert.isPending}>
              <Save className="h-3.5 w-3.5" /> Salvar Tabela
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
          Nenhum serviço negociado cadastrado. Clique em "+ Adicionar Serviço Negociado" para começar.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_120px_180px_80px_40px] gap-3 items-end rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Nome do Serviço</Label>
                <Input
                  placeholder="Ex: Alteração Especial"
                  value={row.service_name}
                  onChange={e => updateRow(row.key, 'service_name', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={row.fixed_price}
                  onChange={e => updateRow(row.key, 'fixed_price', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Gatilho de Cobrança</Label>
                <Select value={row.billing_trigger} onValueChange={v => updateRow(row.key, 'billing_trigger', v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="request">Dias após solicitação</SelectItem>
                    <SelectItem value="approval">No Deferimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Dias</Label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  placeholder="5"
                  value={row.trigger_days}
                  onChange={e => updateRow(row.key, 'trigger_days', e.target.value)}
                  disabled={row.billing_trigger === 'approval'}
                  className="h-9 text-sm"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeRow(row.key)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Retroactive update dialog */}
      <Dialog open={showRetroDialog} onOpenChange={setShowRetroDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar novas condições?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja aplicar estas novas condições aos processos <strong>PENDENTES</strong> deste cliente?
          </p>
          <p className="text-xs text-muted-foreground">
            Se "Sim", os valores e gatilhos de cobrança de todos os processos com status diferente de "Concluído" ou "Pago" serão atualizados.
            Se "Não", as regras serão aplicadas apenas para futuras solicitações.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => doSave(false)} disabled={upsert.isPending}>
              Não, apenas futuros
            </Button>
            <Button onClick={() => doSave(true)} disabled={upsert.isPending}>
              Sim, aplicar retroativamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
