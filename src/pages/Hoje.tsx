import { useNavigate } from 'react-router-dom';
import { useHojeData, fmtBRL, type HojeItem } from '@/hooks/useHojeData';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton-patterns';
import {
  Flame, AlertTriangle, Sparkles, PartyPopper, ArrowRight, Sun,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'urgent' | 'risk' | 'opportunity' | 'celebrate';

const toneStyles: Record<Tone, {
  bgCard: string;
  bgIcon: string;
  textIcon: string;
  accent: string;
}> = {
  urgent: {
    bgCard: 'border-amber-500/30',
    bgIcon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    textIcon: 'text-amber-600 dark:text-amber-400',
    accent: 'bg-amber-500',
  },
  risk: {
    bgCard: 'border-destructive/30',
    bgIcon: 'bg-destructive/15 text-destructive',
    textIcon: 'text-destructive',
    accent: 'bg-destructive',
  },
  opportunity: {
    bgCard: 'border-info/30',
    bgIcon: 'bg-info/15 text-info',
    textIcon: 'text-info',
    accent: 'bg-info',
  },
  celebrate: {
    bgCard: 'border-emerald-500/30',
    bgIcon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    textIcon: 'text-emerald-600 dark:text-emerald-400',
    accent: 'bg-emerald-500',
  },
};

interface SectionProps {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  items: HojeItem[];
  emptyText: string;
}

function Section({ tone, icon: Icon, title, subtitle, items, emptyText }: SectionProps) {
  const navigate = useNavigate();
  const styles = toneStyles[tone];

  return (
    <Card className={cn('p-5 relative overflow-hidden', styles.bgCard)}>
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', styles.accent)} />
      <div className="flex items-start gap-3 mb-4">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', styles.bgIcon)}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="heading-2">{title}</h3>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{items.length}</span>
          </div>
          <p className="caption">{subtitle}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => item.link && navigate(item.link, { state: item.link_state })}
              disabled={!item.link}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-left transition-colors',
                item.link ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{item.titulo}</div>
                <div className="caption truncate">{item.descricao}</div>
              </div>
              {item.valor !== undefined && (
                <div className={cn('text-sm font-semibold tabular-nums shrink-0', styles.textIcon)}>
                  {fmtBRL(item.valor)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Hoje() {
  const navigate = useNavigate();
  const { data, isLoading } = useHojeData();

  const dataFmt = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Hoje" subtitle={dataFmt} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonList rows={3} />
          <SkeletonList rows={3} />
          <SkeletonList rows={3} />
          <SkeletonList rows={3} />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hoje"
        subtitle={dataFmt}
        badge={
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
            Beta
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <Sun className="h-4 w-4 mr-1.5" />
            Dashboard completo
          </Button>
        }
      />

      {/* Resumo do dia */}
      {(data.totais.receita_hoje > 0 || data.totais.vencendo_hoje_valor > 0 || data.totais.inadimplente_total > 0) && (
        <Card className="p-5 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent border-primary/25">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.totais.receita_hoje > 0 && (
              <div>
                <div className="label-uppercase">Recebido hoje</div>
                <div className="display-2 text-emerald-600 dark:text-emerald-400 mt-1">{fmtBRL(data.totais.receita_hoje)}</div>
              </div>
            )}
            {data.totais.vencendo_hoje_valor > 0 && (
              <div>
                <div className="label-uppercase">Vencendo hoje</div>
                <div className="display-2 text-amber-600 dark:text-amber-400 mt-1">{fmtBRL(data.totais.vencendo_hoje_valor)}</div>
              </div>
            )}
            {data.totais.inadimplente_total > 0 && (
              <div>
                <div className="label-uppercase">Inadimplente</div>
                <div className="display-2 text-destructive mt-1">{fmtBRL(data.totais.inadimplente_total)}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 4 cards principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          tone="urgent"
          icon={Flame}
          title="Precisa agir hoje"
          subtitle="Vencimentos, ações urgentes"
          items={data.precisa_agir}
          emptyText="Nenhuma ação urgente. Aproveita pra atacar oportunidades 👇"
        />
        <Section
          tone="risk"
          icon={AlertTriangle}
          title="Em risco"
          subtitle="Atrasados, contestações"
          items={data.em_risco}
          emptyText="Sem risco no radar. Bora!"
        />
        <Section
          tone="opportunity"
          icon={Sparkles}
          title="Oportunidades"
          subtitle="Propostas paradas, follow-ups"
          items={data.oportunidades}
          emptyText="Sem oportunidades pendentes."
        />
        <Section
          tone="celebrate"
          icon={PartyPopper}
          title="Celebrar"
          subtitle="Pagamentos, deferimentos, novos clientes"
          items={data.celebrar}
          emptyText="Ainda não, mas o dia tá só começando 🌱"
        />
      </div>

      <div className="text-center pt-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/financeiro')}>
          Ver tudo no Financeiro <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}
