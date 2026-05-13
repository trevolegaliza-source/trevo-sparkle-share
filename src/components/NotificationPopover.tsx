import { useEffect, useState } from 'react';
import { Bell, CheckCircle, XCircle, CreditCard, AlertTriangle, FileText, ChevronRight, ShieldAlert } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getEmpresaId } from '@/lib/storage-path';
import { usePermissions } from '@/hooks/usePermissions';
import { canSeeNotificacao, type NotificacaoTipo } from '@/lib/notificacao-filter';

interface Notificacao {
  id: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  lida: boolean;
  orcamento_id: string | null;
  created_at: string;
}

// SEC-019 / SEC-025 filtro extraído pra @/lib/notificacao-filter (testável).

const iconMap = {
  aprovacao: CheckCircle,
  recusa: XCircle,
  assinatura: FileText,
  cobranca: AlertTriangle,
  pagamento: CreditCard,
  login_novo: ShieldAlert,
};

const colorMap = {
  aprovacao: 'text-emerald-500',
  recusa: 'text-destructive',
  assinatura: 'text-blue-500',
  cobranca: 'text-amber-500',
  pagamento: 'text-violet-500',
  login_novo: 'text-orange-500',
};

const bgMap = {
  aprovacao: 'bg-emerald-500/10',
  recusa: 'bg-destructive/10',
  assinatura: 'bg-blue-500/10',
  cobranca: 'bg-amber-500/10',
  pagamento: 'bg-violet-500/10',
  login_novo: 'bg-orange-500/10',
};

export function NotificationPopover() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { loading: permsLoading, role, podeVer, isMaster } = usePermissions();

  const permCtx = {
    isMaster: isMaster(),
    podeVerFinanceiro: podeVer('financeiro'),
    podeVerOrcamentos: podeVer('orcamentos'),
  };

  const { data: notificacoesRaw = [] } = useQuery({
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
    // Só faz fetch depois que perms carregaram, pra evitar flash de
    // notificação que será escondida em seguida.
    enabled: !permsLoading && role !== null,
  });

  const notificacoes = notificacoesRaw.filter(n => canSeeNotificacao(n, permCtx));
  const naoLidas = notificacoes.filter(n => !n.lida);

  // Realtime — escuta INSERTs em notificacoes da empresa atual.
  // REL-013 (11/05/2026): antes filtrava só por RLS no SELECT. Realtime
  // passa o payload do INSERT direto pelo WebSocket — RLS não bloqueia
  // payload (só bloqueia SELECT). Em multi-tenant, isso vazaria toast
  // pra usuário de outra empresa.
  // Fix: filter='empresa_id=eq.{id}' no channel.on(). Resolve no servidor.
  useEffect(() => {
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      let empresaId: string;
      try {
        empresaId = await getEmpresaId();
      } catch {
        // Sem sessão (ex: rotas públicas tipo /cobranca/:token) — sem realtime
        return;
      }
      if (cancelled) return;

      channelRef = supabase
        .channel(`notificacoes_realtime_${empresaId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificacoes',
            filter: `empresa_id=eq.${empresaId}`,
          },
          (payload) => {
            const n = payload.new as Notificacao;
            qc.invalidateQueries({ queryKey: ['notificacoes'] });

            // SEC-019: descarta toast se este usuário não deveria ver
            // (ex: gerente recebendo INSERT de cobrança/pagamento).
            if (!canSeeNotificacao(n, permCtx)) return;

            if (n.tipo === 'pagamento') {
              toast.success(n.titulo, { description: n.mensagem, duration: 8000 });
            } else if (n.tipo === 'cobranca' || n.tipo === 'recusa' || n.tipo === 'login_novo') {
              toast.warning(n.titulo, { description: n.mensagem, duration: 8000 });
            } else {
              toast(n.titulo, { description: n.mensagem, duration: 6000 });
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelRef) supabase.removeChannel(channelRef);
    };
    // permCtx muda quando role/perms carregam — reassina pra capturar
    // o filtro correto. role é a chave estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, role, permCtx.isMaster, permCtx.podeVerFinanceiro, permCtx.podeVerOrcamentos]);

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
    // Rotear por tipo. Notificações de pagamento/cobrança vivem no /financeiro;
    // aprovação/recusa/assinatura vêm do fluxo de orçamento.
    if (n.tipo === 'login_novo') {
      // SEC-025: leva pra Gestão de Usuários (lá master pode resetar 2FA
      // se for login suspeito).
      navigate('/configuracoes');
    } else if (n.tipo === 'pagamento' || n.tipo === 'cobranca') {
      navigate('/financeiro');
    } else if (n.orcamento_id) {
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
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações${naoLidas.length > 0 ? ` (${naoLidas.length} não lidas)` : ''}`}>
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
        {/* UX-007 (11/05/2026): trocado max-h-[420px] por h-[420px].
            Radix ScrollArea Viewport usa h-full; sem altura concreta no Root
            o overflow interno não calcula e o scroll trava. */}
        <ScrollArea className="h-[420px]">
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
