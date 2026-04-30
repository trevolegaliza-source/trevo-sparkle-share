import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ServiceNegotiation {
  id: string;
  cliente_id: string;
  service_name: string;
  fixed_price: number;
  billing_trigger: 'request' | 'approval';
  trigger_days: number;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceNegotiationInsert = Omit<ServiceNegotiation, 'id' | 'created_at' | 'updated_at'>;

export function useServiceNegotiations(clienteId?: string) {
  return useQuery({
    queryKey: ['service_negotiations', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_negotiations')
        .select('*')
        .eq('cliente_id', clienteId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ServiceNegotiation[];
    },
  });
}

export function useUpsertServiceNegotiations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clienteId, negotiations }: { clienteId: string; negotiations: Omit<ServiceNegotiationInsert, 'cliente_id'>[] }) => {
      // Delete existing
      const { error: delError } = await supabase
        .from('service_negotiations')
        .delete()
        .eq('cliente_id', clienteId);
      if (delError) throw delError;

      if (negotiations.length === 0) return [];

      const rows = negotiations.map(n => ({
        cliente_id: clienteId,
        service_name: n.service_name,
        fixed_price: n.fixed_price,
        billing_trigger: n.billing_trigger,
        trigger_days: n.trigger_days,
        is_custom: true,
      }));

      const { data, error } = await supabase
        .from('service_negotiations')
        .insert(rows)
        .select('*');
      if (error) throw error;
      return data as unknown as ServiceNegotiation[];
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['service_negotiations', variables.clienteId] });
      toast.success('Tabela de honorários atualizada!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar honorários: ' + e.message),
  });
}
