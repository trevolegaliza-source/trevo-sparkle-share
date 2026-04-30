import { supabase } from '@/integrations/supabase/client';

let cachedEmpresaId: string | null = null;

/**
 * Get the current user's empresa_id for storage path scoping.
 * Caches the value for the session lifetime.
 */
export async function getEmpresaId(): Promise<string> {
  if (cachedEmpresaId) return cachedEmpresaId;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single();

  if (!data?.empresa_id) throw new Error('empresa_id não encontrado');

  cachedEmpresaId = data.empresa_id;
  return cachedEmpresaId;
}

/**
 * Prefix a storage path with the empresa_id for tenant isolation.
 * e.g. "recibos/abc.pdf" → "{empresaId}/recibos/abc.pdf"
 */
export async function empresaPath(path: string): Promise<string> {
  const empresaId = await getEmpresaId();
  return `${empresaId}/${path}`;
}

/** Clear cached empresa_id (call on sign-out) */
export function clearEmpresaIdCache() {
  cachedEmpresaId = null;
}
