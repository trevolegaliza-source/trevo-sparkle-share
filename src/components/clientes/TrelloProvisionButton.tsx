import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trello, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import type { ClienteDB } from '@/types/financial';

interface Props {
  cliente: ClienteDB;
  onProvisioned: () => void;
}

export default function TrelloProvisionButton({ cliente, onProvisioned }: Props) {
  const [loading, setLoading] = useState(false);
  const { isMaster, isGerente } = usePermissions();

  const canProvision = isMaster() || (typeof isGerente === 'function' ? isGerente() : false);
  if (!canProvision) return null;

  const boardUrl = (cliente as any).trello_board_url as string | null;

  if (boardUrl) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs text-foreground"
        onClick={() => window.open(boardUrl, '_blank', 'noopener,noreferrer')}
      >
        <Trello className="h-3.5 w-3.5" /> Abrir Board Trello
        <ExternalLink className="h-3 w-3" />
      </Button>
    );
  }

  const handleProvision = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('provisionar-cliente-trello', {
        body: {
          cliente_id: cliente.id,
          cliente_nome: cliente.apelido || cliente.nome,
          cliente_codigo: cliente.codigo_identificador,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success('Board provisionado com sucesso!');
      onProvisioned();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao provisionar board');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs text-foreground"
      onClick={handleProvision}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trello className="h-3.5 w-3.5" />}
      Provisionar Board Trello
    </Button>
  );
}
