import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Mapa { uuid → nome } pros profiles da empresa do user logado.
 * Usado pra mostrar "Marcado por Letícia" em badges sem precisar query
 * por linha.
 *
 * staleTime longo porque nome de profile muda raramente.
 */
export function useProfileNames() {
  return useQuery({
    queryKey: ['profile_names_map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('ativo', true);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of (data ?? []) as any[]) {
        if (p?.id) map[p.id] = p.nome || 'Usuário';
      }
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });
}
