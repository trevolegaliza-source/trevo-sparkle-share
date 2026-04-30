import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CATEGORIAS_DESPESAS } from '@/constants/categorias-despesas';
import { abreviar } from '@/hooks/useDashboard';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Props {
  data: { mes: number; ano: number; total: number; porCategoria: Record<string, number> }[] | undefined;
  isLoading: boolean;
}

export default function ProvisaoResumo({ data, isLoading }: Props) {
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-blue-500" />
          Provisão de Despesas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sem despesas recorrentes cadastradas</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {data.map((mes) => (
              <div key={`${mes.mes}-${mes.ano}`} className="text-center space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {MESES[mes.mes - 1]}/{String(mes.ano).slice(2)}
                </p>
                <p className="text-sm font-bold text-foreground">{abreviar(mes.total)}</p>
                <div className="space-y-0.5">
                  {Object.entries(mes.porCategoria).sort(([, a], [, b]) => b - a).slice(0, 3).map(([cat, val]) => (
                    <p key={cat} className="text-[9px] text-muted-foreground truncate">
                      {CATEGORIAS_DESPESAS[cat as keyof typeof CATEGORIAS_DESPESAS]?.label?.split(' ')[0] || cat} {abreviar(val)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mt-2" onClick={() => navigate('/contas-pagar')}>
          Detalhes <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
