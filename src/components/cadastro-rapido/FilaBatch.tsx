import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListChecks, Trash2, X, Save } from 'lucide-react';
import { TIPO_PROCESSO_LABELS, type TipoProcesso } from '@/types/financial';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ProcessoNaFila {
  id: string;
  razaoSocial: string;
  tipo: string;
  responsavel: string;
  prioridade: 'normal' | 'urgente';
  mudancaUF: boolean;
  metodoPreco: 'automatico' | 'manual' | 'servico_preacordado';
  valorManual: string;
  motivoManual: string;
  boasVindas: boolean;
  boasVindasPct: string;
  jaPago: boolean;
  observacoes: string;
  descricaoAvulso: string;
  dataEntrada: string;
  dentroDoPlano: boolean;
  valorAvulso: number;
  justificativaAvulso: string;
  etiquetas: string[];
  viaAnalise: 'matriz' | 'regional' | 'metodo_trevo';
  // calculated
  valorFinal: number;
  slotNumero: number;
  descontoAplicado: number;
}

interface Props {
  fila: ProcessoNaFila[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onSaveAll: () => void;
  isSaving: boolean;
}

export default function FilaBatch({ fila, onRemove, onClear, onSaveAll, isSaving }: Props) {
  if (fila.length === 0) return null;

  const total = fila.reduce((s, p) => s + p.valorFinal, 0);

  return (
    <Card className="border-info/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-info" />
          Fila de Processos ({fila.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {fila.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between text-xs border-b border-border/40 pb-2 last:border-0">
            <div>
              <p className="font-medium text-foreground">
                {i + 1}. {TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo} - {p.razaoSocial}
              </p>
              <p className="text-muted-foreground">{fmt(p.valorFinal)} (slot {p.slotNumero})</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onRemove(p.id)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}

        <div className="h-px bg-border" />
        <div className="flex justify-between text-sm font-bold">
          <span>Total da fila</span>
          <span className="text-primary">{fmt(total)}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClear} className="gap-1 flex-1">
            <Trash2 className="h-3 w-3" /> Limpar
          </Button>
          <Button size="sm" onClick={onSaveAll} disabled={isSaving} className="gap-1 flex-1">
            <Save className="h-3 w-3" /> {isSaving ? 'Salvando...' : `Salvar Todos (${fila.length})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
