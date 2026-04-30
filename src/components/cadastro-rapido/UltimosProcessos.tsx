import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ExternalLink } from 'lucide-react';
import { TIPO_PROCESSO_LABELS, type TipoProcesso } from '@/types/financial';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  clienteId: string;
}

export default function UltimosProcessos({ clienteId }: Props) {
  const { data: processos } = useQuery({
    queryKey: ['ultimos_processos_cliente', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('id, tipo, razao_social, valor, created_at, notas')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (!processos || processos.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Últimos Processos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {processos.map(p => (
          <div key={p.id} className="text-xs border-b border-border/40 pb-2 last:border-0">
            <div className="flex justify-between">
              <span className="font-medium text-foreground">
                {TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo} - {p.razao_social}
              </span>
              <span className="text-muted-foreground">{fmt(Number(p.valor ?? 0))}</span>
            </div>
            <p className="text-muted-foreground">
              {new Date(p.created_at!).toLocaleDateString('pt-BR')}
              {p.notas?.includes('Valor Manual') && ' • Valor Manual'}
            </p>
          </div>
        ))}
        <a
          href={`/clientes/${clienteId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 pt-1"
        >
          Ver todos <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
