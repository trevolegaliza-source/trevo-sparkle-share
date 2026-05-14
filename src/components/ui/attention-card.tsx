import { Card } from './card';
import { LucideIcon, AlertTriangle, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface AttentionCardProps {
  /**
   * Tom da card:
   * - `danger`: vencido, inadimplente, erro crítico
   * - `warning`: aguardando ação, vencendo
   * - `success`: pago, completo, OK
   * - `info`: informativo neutro
   */
  tone: 'danger' | 'warning' | 'success' | 'info';
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Card de "atenção" — usado em Alertas do Dashboard, Auditoria, Histórico, etc.
 * Auditoria visual Q4 (14/05/2026). Substitui o emaranhado de cards inline com
 * cores ad-hoc por sistema consistente.
 */
export function AttentionCard({ tone, icon, title, description, action, onClick, className }: AttentionCardProps) {
  const defaultIcon = {
    danger: AlertCircle,
    warning: AlertTriangle,
    success: CheckCircle2,
    info: Info,
  } as const;

  const Icon = icon ?? defaultIcon[tone];

  const styles = {
    danger: 'bg-destructive/5 border-destructive/30',
    warning: 'bg-amber-500/5 border-amber-500/30',
    success: 'bg-emerald-500/5 border-emerald-500/30',
    info: 'bg-info/5 border-info/30',
  } as const;

  const iconStyles = {
    danger: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    info: 'text-info',
  } as const;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-4 flex items-start gap-3',
        styles[tone],
        onClick && 'cursor-pointer hover:border-primary/40 transition-colors',
        className,
      )}
    >
      <div className={cn('shrink-0 mt-0.5', iconStyles[tone])}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-1">{description}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Card>
  );
}
