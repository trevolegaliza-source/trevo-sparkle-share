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
  // Variantes Linear-like: borda sutil + accent strip lateral, sem fundo pesado
  const variantStyles = {
    hero: 'border-primary/25 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent',
    default: 'border-border',
    success: 'border-emerald-500/20',
    warning: 'border-amber-500/25',
    danger: 'border-destructive/30',
  } as const;

  const accentBarStyles = {
    hero: 'bg-primary',
    default: 'bg-transparent',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-destructive',
  } as const;

  const iconBgStyles = {
    hero: 'bg-primary/15 text-primary',
    default: 'bg-muted/60 text-muted-foreground',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    danger: 'bg-destructive/15 text-destructive',
  } as const;

  const valueStyles = {
    hero: 'text-foreground',
    default: 'text-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-destructive',
  } as const;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-6 transition-all relative overflow-hidden',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:border-primary/40 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]',
        className,
      )}
    >
      {/* Accent bar lateral à esquerda (Linear-like) — só nas variantes coloridas */}
      {variant !== 'default' && (
        <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', accentBarStyles[variant])} />
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="label-uppercase">{label}</span>
        {Icon && (
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', iconBgStyles[variant])}>
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </div>
        )}
      </div>

      <div className={cn('display-2', valueStyles[variant])}>{value}</div>

      {(hint || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-semibold tabular-nums px-1.5 py-0.5 rounded',
                trend.value > 0 && 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
                trend.value < 0 && 'text-destructive bg-destructive/10',
                trend.value === 0 && 'text-muted-foreground bg-muted/40',
              )}
            >
              {trend.value > 0 && '↑'}
              {trend.value < 0 && '↓'}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
          {trend?.label && <span className="text-muted-foreground">{trend.label}</span>}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
