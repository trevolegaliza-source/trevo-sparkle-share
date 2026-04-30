import { TrendingUp, TrendingDown, DollarSign, CreditCard, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { variacao } from '@/hooks/useDashboard';

interface KPIProps {
  lucro: { receita: number; despesa: number; lucro: number } | undefined;
  lucroAnterior: { lucro: number } | undefined;
  aReceber: { total: number; count: number; vencidosCount: number } | undefined;
  aPagar: { total: number; count: number; vencidosCount: number } | undefined;
  ticket: { ticket: number; count: number } | undefined;
  isLoading: boolean;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SaudeFinanceiraKPIs({ lucro, lucroAnterior, aReceber, aPagar, ticket, isLoading }: KPIProps) {
  const navigate = useNavigate();
  const lucroVal = lucro?.lucro ?? 0;
  const vari = lucroAnterior ? variacao(lucroVal, lucroAnterior.lucro) : null;

  const cards = [
    {
      label: 'Lucro do Mês',
      value: lucroVal,
      icon: lucroVal >= 0 ? TrendingUp : TrendingDown,
      iconColor: lucroVal >= 0 ? 'text-primary' : 'text-destructive',
      subtitle: lucro ? `Receita ${fmt(lucro.receita)} - Despesa ${fmt(lucro.despesa)}` : '',
      badge: vari ? { text: vari.texto, positive: vari.positivo } : null,
      onClick: () => navigate('/financeiro'),
    },
    {
      label: 'A Receber',
      value: aReceber?.total ?? 0,
      icon: DollarSign,
      iconColor: 'text-primary',
      subtitle: `${aReceber?.count ?? 0} cobranças pendentes`,
      badge: (aReceber?.vencidosCount ?? 0) > 0 ? { text: `⚠ ${aReceber!.vencidosCount} vencidos`, positive: false } : null,
      onClick: () => navigate('/contas-receber'),
    },
    {
      label: 'A Pagar',
      value: aPagar?.total ?? 0,
      icon: CreditCard,
      iconColor: 'text-yellow-500',
      subtitle: `${aPagar?.count ?? 0} despesas pendentes`,
      badge: (aPagar?.vencidosCount ?? 0) > 0 ? { text: `⚠ ${aPagar!.vencidosCount} vencidos`, positive: false } : null,
      onClick: () => navigate('/contas-pagar'),
    },
    {
      label: 'Ticket Médio',
      value: ticket?.ticket ?? 0,
      icon: BarChart3,
      iconColor: 'text-blue-500',
      subtitle: `${ticket?.count ?? 0} processos no mês`,
      badge: null,
      onClick: () => navigate('/financeiro'),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="border-border cursor-pointer hover:border-primary/40 transition-colors"
          onClick={card.onClick}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              {card.badge && (
                <Badge variant="outline" className={`text-[10px] ${card.badge.positive ? 'text-primary border-primary/30' : 'text-destructive border-destructive/30'}`}>
                  {card.badge.text}
                </Badge>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className={`text-2xl font-extrabold ${card.label === 'Lucro do Mês' ? (lucroVal >= 0 ? 'text-primary' : 'text-destructive') : 'text-foreground'}`}>
                {fmt(card.value)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            {card.subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{card.subtitle}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
