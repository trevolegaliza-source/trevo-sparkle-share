import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Package } from 'lucide-react';
import { type OrcamentoItem, type OrcamentoPacote, getItemValor, createPacote } from './types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  pacotes: OrcamentoPacote[];
  itens: OrcamentoItem[];
  onChange: (pacotes: OrcamentoPacote[]) => void;
}

export function PacotesEditor({ pacotes, itens, onChange }: Props) {
  const validItens = itens.filter(i => i.descricao.trim());

  function addPacote() {
    onChange([...pacotes, createPacote()]);
  }

  function removePacote(idx: number) {
    onChange(pacotes.filter((_, i) => i !== idx));
  }

  function updatePacote(idx: number, field: keyof OrcamentoPacote, value: any) {
    onChange(pacotes.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function toggleItem(pacoteIdx: number, itemId: string) {
    const p = pacotes[pacoteIdx];
    const ids = p.itens_ids.includes(itemId)
      ? p.itens_ids.filter(id => id !== itemId)
      : [...p.itens_ids, itemId];
    updatePacote(pacoteIdx, 'itens_ids', ids);
  }

  function calcPacote(p: OrcamentoPacote) {
    const selected = validItens.filter(i => p.itens_ids.includes(i.id));
    const honorarioTotal = selected.reduce((s, i) => s + getItemValor(i) * i.quantidade, 0);
    const honorarioDesc = honorarioTotal * (1 - p.desconto_pct / 100);
    const taxaMin = selected.reduce((s, i) => s + i.taxa_min, 0);
    const taxaMax = selected.reduce((s, i) => s + i.taxa_max, 0);
    return { honorarioTotal, honorarioDesc, taxaMin, taxaMax };
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" /> Pacotes com Desconto
        </h3>
        <Button variant="outline" size="sm" onClick={addPacote}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Pacote
        </Button>
      </div>

      {pacotes.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum pacote. Crie pacotes para oferecer descontos agrupados.
        </p>
      )}

      <div className="space-y-4">
        {pacotes.map((pac, pidx) => {
          const calc = calcPacote(pac);
          return (
            <div key={pac.id} className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Nome do Pacote</Label>
                  <Input
                    value={pac.nome}
                    onChange={e => updatePacote(pidx, 'nome', e.target.value)}
                    placeholder="ESSENCIAL"
                    className="font-medium"
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Desconto %</Label>
                  <Input
                    type="number"
                    value={pac.desconto_pct || ''}
                    onChange={e => updatePacote(pidx, 'desconto_pct', parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="text-center"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removePacote(pidx)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={pac.descricao}
                  onChange={e => updatePacote(pidx, 'descricao', e.target.value)}
                  placeholder="Inclui todos itens obrigatórios"
                />
              </div>

              <div>
                <Label className="text-xs mb-2 block">Itens incluídos:</Label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {validItens.map((item, iidx) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                      <Checkbox
                        checked={pac.itens_ids.includes(item.id)}
                        onCheckedChange={() => toggleItem(pidx, item.id)}
                      />
                      <span className="text-muted-foreground">{item.ordem || iidx + 1}.</span>
                      <span className="truncate">{item.descricao}</span>
                      <span className="ml-auto font-medium text-primary">{fmt(getItemValor(item))}</span>
                    </label>
                  ))}
                </div>
              </div>

              {pac.itens_ids.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Honorário total:</span>
                    <span>{fmt(calc.honorarioTotal)} → <strong className="text-primary">{fmt(calc.honorarioDesc)}</strong> (-{pac.desconto_pct}%)</span>
                  </div>
                  {(calc.taxaMin > 0 || calc.taxaMax > 0) && (
                    <div className="flex justify-between">
                      <span>Taxas externas:</span>
                      <span>{fmt(calc.taxaMin)} a {fmt(calc.taxaMax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1">
                    <span>Investimento total:</span>
                    <span>{fmt(calc.honorarioDesc + calc.taxaMin)} a {fmt(calc.honorarioDesc + calc.taxaMax)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
