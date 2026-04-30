import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceNegotiationRecord {
  id: string;
  cliente_id: string;
  service_name: string;
  fixed_price: number;
  billing_trigger: string;
  trigger_days: number | null;
  is_custom: boolean;
}

/** Fetch ALL service_negotiations (for cross-referencing in Kanban cards) */
export function useAllServiceNegotiations() {
  return useQuery({
    queryKey: ['all_service_negotiations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_negotiations')
        .select('*');
      if (error) throw error;
      return (data || []) as ServiceNegotiationRecord[];
    },
    staleTime: 60_000,
  });
}

/** Build a lookup: clienteId -> Map<service_name, negotiation> */
export function buildNegotiationLookup(negotiations: ServiceNegotiationRecord[]) {
  const map = new Map<string, Map<string, ServiceNegotiationRecord>>();
  for (const n of negotiations) {
    if (!map.has(n.cliente_id)) map.set(n.cliente_id, new Map());
    map.get(n.cliente_id)!.set(n.service_name.toLowerCase(), n);
  }
  return map;
}
