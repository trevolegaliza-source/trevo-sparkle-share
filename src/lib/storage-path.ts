import { supabase } from '@/integrations/supabase/client';

// Cache + TTL e amarração ao user.id, para que após troca de conta
// (ou expiração de sessão longa) o empresa_id seja revalidado.
const TTL_MS = 5 * 60 * 1000; // 5 min
let cachedEmpresaId: string | null = null;
let cachedUserId: string | null = null;
let cachedAt = 0;

/**
 * Get the current user's empresa_id for storage path scoping.
 * Cacheia por 5 min e amarra ao user.id atual.
 */
export async function getEmpresaId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const fresh = Date.now() - cachedAt < TTL_MS;
  if (cachedEmpresaId && cachedUserId === user.id && fresh) {
    return cachedEmpresaId;
  }

  const { data } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single();

  if (!data?.empresa_id) throw new Error('empresa_id não encontrado');

  cachedEmpresaId = data.empresa_id;
  cachedUserId = user.id;
  cachedAt = Date.now();
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
  cachedUserId = null;
  cachedAt = 0;
}
