import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /**
   * Variante visual.
   * - `default`: card sutil (cinza claro)
   * - `inline`: sem fundo, pra uso dentro de Cards ou Drawers
   */
  variant?: 'default' | 'inline';
}

/**
 * Empty state padronizado — substitui o emaranhado de "Nenhum X cadastrado"
 * espalhados pelas telas. Auditoria visual Q2 (14/05/2026).
 *
 * Uso típico:
 *   <EmptyState
 *     icon={Users}
 *     title="Nenhum cliente ainda"
 *     description="Cadastre seu primeiro cliente pra começar"
 *     action={<Button onClick={...}>+ Novo Cliente</Button>}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12',
        variant === 'default' && 'rounded-lg border border-dashed border-border bg-muted/30',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="heading-2 text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
