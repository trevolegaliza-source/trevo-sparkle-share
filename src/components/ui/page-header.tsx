import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Header padrão de página — Linear-like.
 * Auditoria visual 14/05/2026: headers das telas estavam inconsistentes
 * (uns `text-2xl font-bold`, outros `text-xl`). Agora todos usam o mesmo
 * componente com accent verde Trevo sutil à esquerda.
 *
 * Uso:
 *   <PageHeader
 *     title="Financeiro"
 *     subtitle="Centro de cobranças e recebimentos"
 *     actions={<Button>Exportar</Button>}
 *   />
 */
export function PageHeader({ title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 flex-wrap', className)}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Accent bar verde Trevo */}
        <div className="w-[3px] self-stretch bg-primary rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="heading-1 text-foreground truncate">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="caption mt-1 leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
