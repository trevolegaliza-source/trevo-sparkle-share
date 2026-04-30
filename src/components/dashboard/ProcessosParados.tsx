import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

function corDias(dias: number) {
  if (dias >= 14) return 'text-destructive border-destructive/30';
  if (dias >= 7) return 'text-orange-500 border-orange-500/30';
  return 'text-yellow-500 border-yellow-500/30';
}

interface Props {
  items: any[];
  isLoading: boolean;
}

export default function ProcessosParados({ items, isLoading }: Props) {
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Processos Parados
          </span>
          {items.length > 0 && (
            <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">
              {items.length} alertas
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum processo parado</p>
        ) : (
          <>
            {items.map((proc) => {
              const clienteNome = (proc.cliente as any)?.apelido || (proc.cliente as any)?.nome || '';
              return (
                <div
                  key={proc.id}
                  className="py-1.5 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                  onClick={() => navigate('/processos')}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground truncate">{proc.razao_social}</p>
                    <Badge variant="outline" className={`text-[9px] ${corDias(proc.diasParado)}`}>
                      {proc.diasParado}d
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Etapa: {proc.etapa} · {clienteNome}
                  </p>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => navigate('/processos')}>
              Ver todos <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
