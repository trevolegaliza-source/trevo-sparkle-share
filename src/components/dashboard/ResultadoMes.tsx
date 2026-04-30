import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { CATEGORIAS_DESPESAS } from '@/constants/categorias-despesas';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const TIPO_LABELS: Record<string, string> = {
  abertura: 'Abertura',
  alteracao: 'Alteração',
  transformacao: 'Transformação',
  baixa: 'Baixa',
  avulso: 'Avulso',
  orcamento: 'Orçamento',
  outros: 'Outros',
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  data: {
    receitaPorTipo: Record<string, number>;
    despesaPorCategoria: Record<string, number>;
    totalReceita: number;
    totalDespesa: number;
  } | undefined;
  isLoading: boolean;
}

export default function ResultadoMes({ data, isLoading }: Props) {
  const [open, setOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-40" />;

  const receita = data?.totalReceita ?? 0;
  const despesa = data?.totalDespesa ?? 0;
  const lucro = receita - despesa;
  const max = Math.max(receita, despesa, 1);
  const margem = receita > 0 ? ((lucro / receita) * 100).toFixed(1) : '0';

  return (
    <Card className="border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="w-full">
            <CardTitle className="flex items-center gap-2 text-sm cursor-pointer">
              <BarChart3 className="h-4 w-4 text-primary" />
              Resultado do Mês
              <ChevronDown className={`h-4 w-4 ml-auto text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Receita</span>
              <span className="font-semibold text-primary">{fmt(receita)}</span>
            </div>
            <Progress value={(receita / max) * 100} className="h-2 [&>div]:bg-primary" />

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Despesa</span>
              <span className="font-semibold text-destructive">{fmt(despesa)}</span>
            </div>
            <Progress value={(despesa / max) * 100} className="h-2 [&>div]:bg-destructive" />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Lucro líquido</span>
            <span className={`text-sm font-bold ${lucro >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {fmt(lucro)} ({margem}%)
            </span>
          </div>

          <CollapsibleContent className="space-y-4 pt-2">
            {/* Receita por tipo */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase">Receita por tipo de processo</p>
              <div className="space-y-1">
                {Object.entries(data?.receitaPorTipo ?? {}).sort(([, a], [, b]) => b - a).map(([tipo, val]) => (
                  <div key={tipo} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{TIPO_LABELS[tipo] || tipo}</span>
                    <span className="text-muted-foreground">
                      {fmt(val)} ({receita > 0 ? ((val / receita) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Despesa por categoria */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase">Despesa por categoria</p>
              <div className="space-y-1">
                {Object.entries(data?.despesaPorCategoria ?? {}).sort(([, a], [, b]) => b - a).map(([cat, val]) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{CATEGORIAS_DESPESAS[cat as keyof typeof CATEGORIAS_DESPESAS]?.label || cat}</span>
                    <span className="text-muted-foreground">
                      {fmt(val)} ({despesa > 0 ? ((val / despesa) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
