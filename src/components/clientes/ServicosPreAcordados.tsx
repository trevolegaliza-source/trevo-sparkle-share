import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Save } from 'lucide-react';
import { useServiceNegotiations, useUpsertServiceNegotiations } from '@/hooks/useServiceNegotiations';
import ServicoPreAcordadoModal from './ServicoPreAcordadoModal';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ServicoRow {
  key: string;
  service_name: string;
  fixed_price: number;
  valor_prepago: number;
  billing_trigger: 'request' | 'approval';
  trigger_days: number;
  observacoes: string;
  is_custom: boolean;
}

interface Props {
  clienteId: string;
  isPrePago: boolean;
}

export default function ServicosPreAcordados({ clienteId, isPrePago }: Props) {
  const { data: existing, isLoading } = useServiceNegotiations(clienteId);
  const upsert = useUpsertServiceNegotiations();
  const [rows, setRows] = useState<ServicoRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ServicoRow | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (existing) {
      setRows(existing.map(n => ({
        key: n.id,
        service_name: n.service_name,
        fixed_price: n.fixed_price,
        valor_prepago: (n as any).valor_prepago ?? 0,
        billing_trigger: n.billing_trigger as 'request' | 'approval',
        trigger_days: n.trigger_days,
        observacoes: (n as any).observacoes ?? '',
        is_custom: n.is_custom,
      })));
      setDirty(false);
    }
  }, [existing]);

  const handleSave = async () => {
    const negotiations = rows.map(r => ({
      service_name: r.service_name.trim(),
      fixed_price: r.fixed_price,
      billing_trigger: r.billing_trigger,
      trigger_days: r.trigger_days,
      is_custom: true as const,
    }));
    await upsert.mutateAsync({ clienteId, negotiations });
    setDirty(false);
  };

  const handleAdd = (row: ServicoRow) => {
    setRows(prev => [...prev, row]);
    setDirty(true);
    setModalOpen(false);
  };

  const handleEdit = (row: ServicoRow) => {
    setRows(prev => prev.map(r => r.key === row.key ? row : r));
    setDirty(true);
    setEditingRow(null);
    setModalOpen(false);
  };

  const handleDelete = (key: string) => {
    setRows(prev => prev.filter(r => r.key !== key));
    setDirty(true);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Serviços Pré-Acordados</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setEditingRow(null); setModalOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Novo Serviço
          </Button>
          {dirty && (
            <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={upsert.isPending}>
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
            Nenhum serviço pré-acordado. Clique em "+ Novo Serviço" para começar.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Serviço</TableHead>
                <TableHead className="text-xs text-right">Valor Normal</TableHead>
                {isPrePago && <TableHead className="text-xs text-right">Valor Pré-Pago</TableHead>}
                <TableHead className="text-xs">Gatilho</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.key}>
                  <TableCell className="text-sm font-medium">{row.service_name}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(row.fixed_price)}</TableCell>
                  {isPrePago && (
                    <TableCell className="text-sm text-right">
                      {row.valor_prepago > 0 ? fmt(row.valor_prepago) : '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-xs">
                    {row.billing_trigger === 'approval' ? 'No Deferimento' : `D+${row.trigger_days}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingRow(row); setModalOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(row.key)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          Valor Normal: usado para Avulso e Mensalista excedente.
          {isPrePago && ' Valor Pré-Pago: usado quando o cliente é Pré-Pago. Se vazio, usa o Valor Normal.'}
        </p>
      </CardContent>

      <ServicoPreAcordadoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        row={editingRow}
        isPrePago={isPrePago}
        onSave={editingRow ? handleEdit : handleAdd}
      />
    </Card>
  );
}
