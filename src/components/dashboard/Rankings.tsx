import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  faturamento: { nome: string; total: number; clienteId: string }[] | undefined;
  volume: { nome: string; count: number; clienteId: string }[] | undefined;
  isLoading: boolean;
}

export default function Rankings({ faturamento, volume, isLoading }: Props) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Top Clientes (Faturamento)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(faturamento || []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sem dados no período</p>
          ) : (
            faturamento!.map((item, i) => (
              <div
                key={item.clienteId}
                className="flex items-center justify-between text-xs py-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                onClick={() => navigate(`/clientes/${item.clienteId}`)}
              >
                <span className="flex items-center gap-2 text-foreground">
                  <span className="text-muted-foreground w-4 text-right">{i + 1}.</span>
                  <span className="truncate">{item.nome}</span>
                </span>
                <span className="font-semibold text-foreground whitespace-nowrap">{fmt(item.total)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-blue-500" />
            Top Clientes (Processos)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(volume || []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sem dados no período</p>
          ) : (
            volume!.map((item, i) => (
              <div
                key={item.clienteId}
                className="flex items-center justify-between text-xs py-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                onClick={() => navigate(`/clientes/${item.clienteId}`)}
              >
                <span className="flex items-center gap-2 text-foreground">
                  <span className="text-muted-foreground w-4 text-right">{i + 1}.</span>
                  <span className="truncate">{item.nome}</span>
                </span>
                <span className="font-semibold text-foreground whitespace-nowrap">{item.count} proc</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
