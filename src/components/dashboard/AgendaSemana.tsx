import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Banknote, HandCoins, CheckCircle2 } from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgendaProps {
  pagar: any[];
  receber: any[];
  isLoading: boolean;
}

function groupByDay(items: any[]) {
  const groups: Record<string, any[]> = {};
  items.forEach(item => {
    const key = item.data_vencimento;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function dayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'HOJE';
  if (isTomorrow(d)) return 'AMANHÃ';
  return format(d, "EEE (dd/MM)", { locale: ptBR }).toUpperCase();
}

function dayBorder(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'border-l-yellow-500 bg-yellow-500/5';
  if (isTomorrow(d)) return 'border-l-orange-500';
  return 'border-l-muted-foreground/30';
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function AgendaSection({ title, icon: Icon, items, tipo }: { title: string; icon: any; items: any[]; tipo: 'pagar' | 'receber' }) {
  const total = items.reduce((s, l) => s + Number(l.valor), 0);
  const groups = groupByDay(items);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${tipo === 'pagar' ? 'text-yellow-500' : 'text-primary'}`} />
            {title}
          </span>
          <span className="text-xs font-normal text-muted-foreground">Total: {fmt(total)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Nenhum {tipo === 'pagar' ? 'pagamento' : 'recebimento'} nos próximos 7 dias
          </div>
        ) : (
          groups.map(([date, dateItems]) => (
            <div key={date} className={`border-l-2 pl-3 py-1.5 rounded-r ${dayBorder(date)}`}>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">{dayLabel(date)}</p>
              {dateItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-0.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {item.descricao}
                    </p>
                    {tipo === 'receber' && item.cliente && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {(item.cliente as any)?.apelido || (item.cliente as any)?.nome}
                      </p>
                    )}
                    {tipo === 'pagar' && item.fornecedor && (
                      <p className="text-[10px] text-muted-foreground truncate">{item.fornecedor}</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-foreground ml-2 whitespace-nowrap">
                    {fmt(Number(item.valor))}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function AgendaSemana({ pagar, receber, isLoading }: AgendaProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AgendaSection title="A Pagar esta Semana" icon={Banknote} items={pagar} tipo="pagar" />
      <AgendaSection title="A Receber esta Semana" icon={HandCoins} items={receber} tipo="receber" />
    </div>
  );
}
