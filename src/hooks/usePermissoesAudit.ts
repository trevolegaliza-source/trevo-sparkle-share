import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PermissaoAuditEntry {
  id: number;
  created_at: string;
  ator_nome: string;
  alvo_nome: string;
  acao: 'role_changed' | 'modulo_added' | 'modulo_removed' | 'perm_updated';
  detalhes: Record<string, any>;
}

/**
 * Histórico de mudanças de permissão (master only).
 * Auditoria 18/05/2026 — feature E.
 */
export function usePermissoesAudit(limit = 50) {
  return useQuery({
    queryKey: ['permissoes_audit', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_permissoes_audit' as any, { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as PermissaoAuditEntry[];
    },
    staleTime: 30_000,
  });
}
