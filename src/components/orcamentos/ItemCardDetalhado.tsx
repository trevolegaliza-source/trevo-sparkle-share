import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { type OrcamentoItem, type OrcamentoSecao } from './types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  item: OrcamentoItem;
  idx: number;
  secoes: OrcamentoSecao[];
  modoContador?: boolean;
  onChange: (idx: number, field: keyof OrcamentoItem, value: any) => void;
  onRemove: (idx: number) => void;
  onAddSecao: () => void;
}

export function ItemCardDetalhado({ item, idx, secoes, modoContador, onChange, onRemove, onAddSecao }: Props) {
  const totalMin = item.honorario * item.quantidade + item.taxa_min;
  const totalMax = item.honorario * item.quantidade + item.taxa_max;

  return (
    <div className="p-4 rounded-lg border bg-card space-y-3">
      {/* Top row: seção + ordem */}
      <div className="flex gap-3 items-end">
        <div className="w-48">
          <Label className="text-xs">Seção</Label>
          <Select value={item.secao} onValueChange={v => {
            if (v === '__new__') { onAddSecao(); return; }
            onChange(idx, 'secao', v);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {secoes.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
              <SelectItem value="__new__">+ Nova Seção</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-20">
          <Label className="text-xs">Ordem</Label>
          <Input
            type="number"
            value={item.ordem || ''}
            onChange={e => onChange(idx, 'ordem', parseInt(e.target.value) || 0)}
            min={1}
            className="text-center"
          />
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={() => onRemove(idx)} className="text-destructive shrink-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Serviço */}
      <div>
        <Label className="text-xs">Serviço *</Label>
        <Input
          value={item.descricao}
          onChange={e => onChange(idx, 'descricao', e.target.value)}
          placeholder="Ex: Licença Bombeiros (CBMSC)"
          className="font-medium"
        />
      </div>

      {/* Detalhes */}
      <div>
        <Label className="text-xs">Detalhes / Escopo</Label>
        <RichTextEditor
          value={item.detalhes}
          onChange={(html) => onChange(idx, 'detalhes', html)}
          placeholder="Inclui adequações, questionário, vistorias..."
          minHeight="80px"
        />
      </div>

      {/* Valores financeiros - 4 colunas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Honorário Trevo R$</Label>
          <p className="text-[10px] text-muted-foreground/60">O que você paga à Trevo</p>
          <Input
            type="number"
            value={item.honorario || ''}
            onChange={e => onChange(idx, 'honorario', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
        <div>
          <Label className="text-xs">Sugestão Mínima R$</Label>
          <p className="text-[10px] text-muted-foreground/60">Mínimo para cobrar do seu cliente</p>
          <Input
            type="number"
            value={item.honorario_minimo_contador || ''}
            onChange={e => onChange(idx, 'honorario_minimo_contador', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
        <div>
          <Label className="text-xs">Valor de Mercado R$</Label>
          <p className="text-[10px] text-muted-foreground/60">Referência do mercado</p>
          <Input
            type="number"
            value={item.valor_mercado || ''}
            onChange={e => onChange(idx, 'valor_mercado', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
        <div>
          <Label className="text-xs">Valor Premium R$</Label>
          <p className="text-[10px] text-muted-foreground/60">Acima disso fica caro</p>
          <Input
            type="number"
            value={item.valor_premium || ''}
            onChange={e => onChange(idx, 'valor_premium', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
      </div>

      {/* Taxas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Taxa Órgão Mín R$</Label>
          <Input
            type="number"
            value={item.taxa_min || ''}
            onChange={e => onChange(idx, 'taxa_min', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
        <div>
          <Label className="text-xs">Taxa Órgão Máx R$</Label>
          <Input
            type="number"
            value={item.taxa_max || ''}
            onChange={e => onChange(idx, 'taxa_max', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
      </div>

      {/* Margin display */}
      {item.honorario > 0 && item.honorario_minimo_contador > 0 && (
        <div className="mt-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Margem mínima do contador:</span>
            <span className="font-bold text-emerald-500">
              {fmt(item.honorario_minimo_contador - item.honorario)}{' '}
              ({((item.honorario_minimo_contador / item.honorario - 1) * 100).toFixed(0)}%)
            </span>
          </div>
          {item.valor_mercado > 0 && (
            <div className="flex justify-between text-xs mt-1">
              <span className="text-muted-foreground">Margem valor de mercado:</span>
              <span className="font-bold text-blue-500">
                {fmt(item.valor_mercado - item.honorario)}{' '}
                ({((item.valor_mercado / item.honorario - 1) * 100).toFixed(0)}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Prazo + Docs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Prazo</Label>
          <Input
            value={item.prazo}
            onChange={e => onChange(idx, 'prazo', e.target.value)}
            placeholder="15-45 dias"
          />
        </div>
        <div>
          <Label className="text-xs">Docs Necessários</Label>
          <Input
            value={item.docs_necessarios}
            onChange={e => onChange(idx, 'docs_necessarios', e.target.value)}
            placeholder="CNPJ, planta, ART..."
          />
        </div>
      </div>

      {/* Subtotal */}
      <div className="text-right text-sm">
        <span className="font-bold text-primary">
          Honorário: {fmt(item.honorario * item.quantidade)}
        </span>
        {item.honorario_minimo_contador > 0 && (
          <span className="text-amber-500 ml-3">
            Sugerido: {fmt(item.honorario_minimo_contador * item.quantidade)}
          </span>
        )}
        {(item.taxa_min > 0 || item.taxa_max > 0) && (
          <span className="text-muted-foreground ml-3">
            Taxas: {fmt(item.taxa_min)} a {fmt(item.taxa_max)}
          </span>
        )}
        {(item.taxa_min > 0 || item.taxa_max > 0) && (
          <span className="ml-3 font-semibold">
            Total: {fmt(totalMin)} a {fmt(totalMax)}
          </span>
        )}
      </div>
    </div>
  );
}
