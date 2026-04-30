import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';
import * as LucideIcons from 'lucide-react';
import type { DespesaRecorrente } from '@/hooks/useContasPagar';

interface Props {
  recorrentes: DespesaRecorrente[];
  onNew: () => void;
  onEdit: (r: DespesaRecorrente) => void;
  onToggle: (r: DespesaRecorrente) => void;
  onDelete: (r: DespesaRecorrente) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RecorrentesTab({ recorrentes, onNew, onEdit, onToggle, onDelete }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={onNew}><Plus className="h-4 w-4 mr-1" />Nova Recorrente</Button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor Mensal</TableHead>
              <TableHead>Dia Venc.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recorrentes.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma despesa recorrente cadastrada</TableCell></TableRow>
            ) : recorrentes.map(r => {
              const catKey = (r.categoria || 'outros') as CategoriaKey;
              const cat = CATEGORIAS_DESPESAS[catKey] || CATEGORIAS_DESPESAS.outros;
              const IconComp = (LucideIcons as any)[cat.icon] || LucideIcons.Circle;
              return (
                <TableRow key={r.id} className={!r.ativo ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <IconComp className="h-3.5 w-3.5" style={{ color: cat.color }} />
                      <span className="text-xs" style={{ color: cat.color }}>{cat.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{r.descricao}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.fornecedor || '—'}</TableCell>
                  <TableCell className="text-right font-bold text-sm">{fmt(Number(r.valor))}</TableCell>
                  <TableCell className="text-sm">Dia {r.dia_vencimento}</TableCell>
                  <TableCell>
                    {r.ativo
                      ? <Badge className="bg-primary/15 text-primary border-0">Ativa</Badge>
                      : <Badge variant="outline" className="text-muted-foreground">Inativa</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(r)}>
                        {r.ativo ? <Pause className="h-3.5 w-3.5 text-warning" /> : <Play className="h-3.5 w-3.5 text-primary" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(r)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
