import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Clock, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDashboardStats } from '@/hooks/useProcessos';
import { PROCESS_TYPE_LABELS } from '@/types/process';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProcessosAtivosDetalhe() {
  const { data: stats, isLoading } = useDashboardStats();
  const recentes = stats?.recentes || [];
  const urgentes = stats?.urgentes || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Processos Ativos</h1>
          <p className="text-sm text-muted-foreground">Detalhamento de processos em andamento e SLAs em risco</p>
        </div>
      </div>

      {/* SLA em Risco */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            SLAs em Risco ({urgentes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : urgentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum processo com SLA em risco</p>
          ) : (
            <div className="space-y-2">
              {urgentes.map((proc) => (
                <div key={proc.id} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{proc.razao_social}</p>
                    <p className="text-xs text-muted-foreground">{proc.cliente?.nome || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                      {PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo}
                    </Badge>
                    {proc.responsavel && (
                      <span className="text-xs text-muted-foreground">{proc.responsavel}</span>
                    )}
                    {proc.valor && (
                      <span className="text-xs font-medium">
                        {Number(proc.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Todos os Recentes */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Processos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : recentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum processo encontrado</p>
          ) : (
            <div className="space-y-2">
              {recentes.map((proc) => (
                <div key={proc.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{proc.razao_social}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{proc.cliente?.nome || '-'}</p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <p className="text-xs text-muted-foreground">{proc.etapa}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                      {PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo}
                    </Badge>
                    {proc.valor && (
                      <span className="text-sm font-medium">
                        {Number(proc.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
