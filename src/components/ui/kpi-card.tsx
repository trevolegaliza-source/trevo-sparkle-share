import { LucideIcon } from 'lucide-react';
import { Card } from './card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /**
   * Variante visual:
   * - `hero`: card principal (verde Trevo sutil, valor grande)
   * - `default`: card secundário (neutro, valor médio)
   * - `success`: tom positivo (pago, recebido)
   * - `warning`: tom atenção (aguardando, vencendo)
   * - `danger`: tom negativo (vencido, inadimplente)
   */
  variant?: 'hero' | 'default' | 'success' | 'warning' | 'danger';
  hint?: ReactNode;
  trend?: { value: number; label?: string };
  onClick?: () => void;
  className?: string;
}

/**
 * KPI Card padronizado — auditoria visual Q3 + Q4 (14/05/2026).
 * Substitui cards inline ad-hoc nos Dashboards/Financeiro.
 */
export function KPICard({ label, value, icon: Icon, variant = 'default', hint, trend, onClick, className }: KPICardProps) {
  const variantStyles = {
    hero: 'bg-primary/5 border-primary/30',
    default: 'bg-card border-border',
    success: 'bg-emerald-500/5 border-emerald-500/20',
    warning: 'bg-amber-500/5 border-amber-500/20',
    danger: 'bg-destructive/5 border-destructive/20',
  } as const;

  const iconBgStyles = {
    hero: 'bg-primary/15 text-primary',
    default: 'bg-muted text-muted-foreground',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    danger: 'bg-destructive/15 text-destructive',
  } as const;

  const valueStyles = {
    hero: 'display-2 text-foreground',
    default: 'display-2 text-foreground',
    success: 'display-2 text-emerald-600 dark:text-emerald-400',
    warning: 'display-2 text-amber-600 dark:text-amber-400',
    danger: 'display-2 text-destructive',
  } as const;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-5 transition-all',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:border-primary/40',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="label-uppercase">{label}</span>
        {Icon && (
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', iconBgStyles[variant])}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
        )}
      </div>
      <div className={cn('tabular-nums', valueStyles[variant])}>{value}</div>
      {(hint || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold tabular-nums',
                trend.value > 0 && 'text-emerald-600 dark:text-emerald-400',
                trend.value < 0 && 'text-destructive',
                trend.value === 0 && 'text-muted-foreground',
              )}
            >
              {trend.value > 0 && '▲'}
              {trend.value < 0 && '▼'}
              {Math.abs(trend.value).toFixed(1)}%
              {trend.label && <span className="text-muted-foreground font-normal ml-1">{trend.label}</span>}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
