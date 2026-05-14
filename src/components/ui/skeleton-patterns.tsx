import { Skeleton } from './skeleton';
import { Card } from './card';
import { cn } from '@/lib/utils';

/**
 * Skeletons padronizados pra substituir spinners <Loader2> em listas/cards/tabelas.
 * Auditoria visual Q7 (14/05/2026). Spinners isolados parecem amador; skeleton
 * com formato do conteúdo final sinaliza melhor "carregando estrutura X".
 */

/** Card placeholder — usar dentro de grids de KPIs/cards. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={cn('p-5 space-y-3', className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-24" />
    </Card>
  );
}

/** Lista de N linhas (Cliente, Processo, Lancamento, etc). */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 shrink-0" />
        </Card>
      ))}
    </div>
  );
}

/** Tabela com header + N linhas. */
export function SkeletonTable({ rows = 6, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', className)}>
      <div className="flex gap-4 px-4 py-3 bg-muted/40 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-border/50 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Grid de N cards KPI lado a lado. */
export function SkeletonKPIs({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4', count === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Tela cheia (página inteira carregando). */
export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <SkeletonKPIs count={4} />
      <SkeletonList rows={4} />
    </div>
  );
}
