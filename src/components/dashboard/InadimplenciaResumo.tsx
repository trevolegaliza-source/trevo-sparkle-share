import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function classificacao(dias: number) {
  if (dias >= 30) return { label: 'Crítico', color: 'border-red-900 text-red-400' };
  if (dias >= 16) return { label: 'Alerta', color: 'border-destructive text-destructive' };
  if (dias >= 8) return { label: 'Atenção', color: 'border-orange-500 text-orange-500' };
  return { label: 'Acompanhar', color: 'border-yellow-500 text-yellow-500' };
}

interface Props {
  items: any[];
  totalValor: number;
  isLoading: boolean;
}

export default function InadimplenciaResumo({ items, totalValor, isLoading }: Props) {
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-48" />;
  if (items.length === 0) return null;

  return (
    <Card className="border-border border-l-4 border-l-destructive">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Inadimplência
          </span>
          <span className="text-xs font-normal text-destructive">{fmt(totalValor)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const cls = classificacao(item.diasAtraso);
          const clienteNome = (item.cliente as any)?.apelido || (item.cliente as any)?.nome || 'Sem nome';
          return (
            <div key={item.id} className={`border-l-2 pl-3 py-1 ${cls.color}`}>
              <p className="text-xs font-semibold text-foreground">{clienteNome}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {fmt(Number(item.valor))} — {item.diasAtraso} dias
                </span>
                <Badge variant="outline" className={`text-[9px] ${cls.color}`}>
                  {cls.label}
                </Badge>
              </div>
              {item.data_ultimo_contato && (
                <p className="text-[10px] text-muted-foreground">Último contato: {new Date(item.data_ultimo_contato).toLocaleDateString('pt-BR')}</p>
              )}
            </div>
          );
        })}
        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => navigate('/contas-receber')}>
          Ver todos <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
