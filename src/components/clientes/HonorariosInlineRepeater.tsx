import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export interface InlineNegotiationRow {
  key: string;
  service_name: string;
  fixed_price: string;
  billing_trigger: 'request' | 'approval';
  trigger_days: string;
}

export const emptyNegotiationRow = (): InlineNegotiationRow => ({
  key: crypto.randomUUID(),
  service_name: '',
  fixed_price: '',
  billing_trigger: 'request',
  trigger_days: '5',
});

interface Props {
  rows: InlineNegotiationRow[];
  onChange: (rows: InlineNegotiationRow[]) => void;
}

export default function HonorariosInlineRepeater({ rows, onChange }: Props) {
  const addRow = () => onChange([...rows, emptyNegotiationRow()]);
  const removeRow = (key: string) => onChange(rows.filter(r => r.key !== key));
  const updateRow = (key: string, field: keyof InlineNegotiationRow, value: string) => {
    onChange(rows.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-muted-foreground">Tabela de Honorários Específicos</Label>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" /> Adicionar Serviço Negociado
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
          Nenhum serviço negociado. Clique em "+ Adicionar" para começar.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_100px_160px_60px_36px] gap-2 items-end rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Serviço</Label>
                <Input
                  placeholder="Ex: Alteração Especial"
                  value={row.service_name}
                  onChange={e => updateRow(row.key, 'service_name', e.target.value)}
                  className="h-8 text-sm"
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
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Gatilho</Label>
                <Select value={row.billing_trigger} onValueChange={v => updateRow(row.key, 'billing_trigger', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                  className="h-8 text-sm"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRow(row.key)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
