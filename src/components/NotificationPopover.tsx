import { useState } from 'react';
import { Bell, CheckCircle, XCircle, CreditCard, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Notificacao {
  id: string;
  tipo: 'aprovacao' | 'recusa' | 'assinatura' | 'cobranca' | 'pagamento';
  titulo: string;
  mensagem: string;
  lida: boolean;
  orcamento_id: string | null;
  created_at: string;
}

const iconMap = {
  aprovacao: CheckCircle,
  recusa: XCircle,
  assinatura: FileText,
  cobranca: AlertTriangle,
  pagamento: CreditCard,
};

const colorMap = {
  aprovacao: 'text-emerald-500',
  recusa: 'text-destructive',
  assinatura: 'text-blue-500',
  cobranca: 'text-amber-500',
  pagamento: 'text-violet-500',
};

const bgMap = {
  aprovacao: 'bg-emerald-500/10',
  recusa: 'bg-destructive/10',
  assinatura: 'bg-blue-500/10',
  cobranca: 'bg-amber-500/10',
  pagamento: 'bg-violet-500/10',
};

export function NotificationPopover() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as Notificacao[];
    },
    refetchInterval: 15000,
  });

  const naoLidas = notificacoes.filter(n => !n.lida);

  async function marcarComoLida(id: string) {
    await supabase.from('notificacoes').update({ lida: true } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['notificacoes'] });
  }

  async function marcarTodasComoLidas() {
    const ids = naoLidas.map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from('notificacoes').update({ lida: true } as any).in('id', ids);
    qc.invalidateQueries({ queryKey: ['notificacoes'] });
  }

  function handleClick(n: Notificacao) {
    marcarComoLida(n.id);
    if (n.orcamento_id) {
      navigate(`/orcamentos/novo?id=${n.orcamento_id}`);
    } else {
      navigate('/orcamentos');
    }
    setOpen(false);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4.5 w-4.5" />
          {naoLidas.length > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 h-5 min-w-[20px] rounded-full px-1 text-[10px] bg-destructive text-destructive-foreground border-0 animate-pulse">
              {naoLidas.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Notificações</h4>
            <p className="text-xs text-muted-foreground">
              {naoLidas.length > 0 ? `${naoLidas.length} não lidas` : 'Tudo em dia'}
            </p>
          </div>
          {naoLidas.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={marcarTodasComoLidas}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {notificacoes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma notificação ainda
            </div>
          ) : (
            <div className="divide-y">
              {notificacoes.map((n) => {
                const Icon = iconMap[n.tipo] || FileText;
                return (
                  <button
                    key={n.id}
                    className={`flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${!n.lida ? 'bg-primary/5' : ''}`}
                    onClick={() => handleClick(n)}
                  >
                    <div className={`rounded-lg p-1.5 mt-0.5 ${bgMap[n.tipo] || 'bg-muted'}`}>
                      <Icon className={`h-4 w-4 ${colorMap[n.tipo] || 'text-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold ${!n.lida ? 'text-foreground' : 'text-muted-foreground'}`}>{n.titulo}</p>
                        {!n.lida && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-1 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
