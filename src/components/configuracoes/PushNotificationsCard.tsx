import { Bell, BellOff, Smartphone, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export function PushNotificationsCard() {
  const { status, isSupported, busy, subscribe, unsubscribe } = usePushNotifications();

  const handleAtivar = async () => {
    const result = await subscribe();
    if (result.ok) {
      toast.success('Notificações ativadas neste dispositivo');
    } else if (result.error === 'vapid-key-missing') {
      toast.error('Configuração do servidor incompleta — avise o suporte');
    } else if (result.error?.startsWith('permission-denied')) {
      toast.error('Você bloqueou notificações no navegador. Libere nas configurações do app/Safari.');
    } else if (result.error?.startsWith('permission-')) {
      toast.error('Permissão não concedida');
    } else if (result.error === 'not-supported') {
      toast.error('Dispositivo não suporta notificações push');
    } else {
      toast.error('Erro ao ativar: ' + result.error);
    }
  };

  const handleDesativar = async () => {
    const result = await unsubscribe();
    if (result.ok) toast.success('Notificações desativadas neste dispositivo');
  };

  if (!isSupported) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Notificações push não suportadas</p>
            <p className="text-xs text-muted-foreground">
              Esse dispositivo/navegador não suporta. No iPhone, instale o app via Safari → Compartilhar → "Adicionar à Tela de Início" (precisa iOS 16.4+).
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium">Notificações neste dispositivo</p>
            <p className="text-xs text-muted-foreground">
              Receber notificações no celular/computador quando rolar algo importante (novo processo criado por funcionário, pendência antiga, cobrança paga).
            </p>
          </div>
          {status === 'subscribed' ? (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Bell className="h-3.5 w-3.5" /> Ativadas
              </span>
              <Button size="sm" variant="outline" onClick={handleDesativar} disabled={busy}>
                <BellOff className="h-3.5 w-3.5 mr-1" />
                Desativar aqui
              </Button>
            </div>
          ) : status === 'denied' ? (
            <p className="text-xs text-destructive pt-1">
              Bloqueadas no navegador. Libere em Ajustes &gt; Safari &gt; Avançado &gt; Dados de Sites (iPhone) ou no cadeado da URL (desktop).
            </p>
          ) : (
            // UX-151 (25/05/2026): distingue "unsubscribed" (permissão já dada,
            // dispositivo só não tá inscrito) de "default" (nunca pediu). Antes
            // ambos viam "Ativar neste dispositivo" — confundia quem desativou
            // antes e queria reativar.
            <div className="space-y-1.5 pt-1">
              <Button size="sm" onClick={handleAtivar} disabled={busy}>
                <Bell className="h-3.5 w-3.5 mr-1" />
                {status === 'unsubscribed' ? 'Reativar neste dispositivo' : 'Ativar neste dispositivo'}
              </Button>
              {status === 'unsubscribed' && (
                <p className="text-[11px] text-muted-foreground">
                  Permissão já dada — só falta reinscrever este dispositivo.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
