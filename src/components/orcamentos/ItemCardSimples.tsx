import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { type OrcamentoItem, getItemValor } from './types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  item: OrcamentoItem;
  idx: number;
  onChange: (idx: number, field: keyof OrcamentoItem, value: any) => void;
  onRemove: (idx: number) => void;
  /**
   * PRINT 02 #4c (14/05/2026): label do campo de valor varia por modo:
   * - "Trevo → Cliente Final": "Valor R$" (valor final cobrado)
   * - "Trevo → Contador": "Custo Trevo R$" (custo interno, contador adiciona margem depois)
   * - "Contador → Cliente Final": "Custo Trevo R$" (idem, contador define preço)
   */
  labelValor?: string;
}

export function ItemCardSimples({ item, idx, onChange, onRemove, labelValor }: Props) {
  return (
    <div className="p-4 rounded-lg border bg-card space-y-2">
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            value={item.descricao}
            onChange={e => onChange(idx, 'descricao', e.target.value)}
            placeholder="Descrição do serviço"
            className="font-medium"
          />
        </div>
        <div className="w-32">
          <Input
            type="number"
            value={item.honorario || ''}
            onChange={e => onChange(idx, 'honorario', parseFloat(e.target.value) || 0)}
            placeholder={labelValor || 'Valor R$'}
            className="text-right"
            aria-label={labelValor || 'Valor R$'}
          />
        </div>
        <div className="w-16">
          <Input
            type="number"
            value={item.quantidade}
            onChange={e => onChange(idx, 'quantidade', parseInt(e.target.value) || 1)}
            min={1}
            className="text-center"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={() => onRemove(idx)} className="text-destructive shrink-0" aria-label="Remover item">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <RichTextEditor
        value={item.detalhes}
        onChange={(html) => onChange(idx, 'detalhes', html)}
        placeholder="Detalhes, escopo, o que está incluso... (opcional)"
        minHeight="80px"
      />
      <p className="text-right text-sm font-bold text-primary">
        Subtotal: {fmt(getItemValor(item) * item.quantidade)}
      </p>
    </div>
  );
}
