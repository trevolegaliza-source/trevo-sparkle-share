import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Inactividade vive em useSessionTimeout (role-aware): master=8h,
  // demais=2h, com toast 5min antes. Antes era 8h fixo aqui pra todos.

  useEffect(() => {
    // audit fix #14, #20 — delega criação de profile ao trigger handle_new_user
    // do banco. Antes: este client fazia LIMIT 1 master + insert manual com
    // `as any`, duplicando bug multi-tenant do trigger e mascarando RLS.
    // Agora: o trigger DB já cria profile com empresa_id correto. Aqui só
    // tocamos ultimo_acesso e disparamos notificação se for primeiro login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // REL-019-fix (12/05/2026): quando o user clica num link de recovery
      // do email, supabase-js processa o hash e emite `PASSWORD_RECOVERY`.
      // Sem esse handler, ele virava sessão "logada normal" e caía na home
      // (Dashboard) — sem trocar a senha que era o objetivo do link.
      // Agora redireciona pra /reset-password se ainda não estiver lá.
      if (event === 'PASSWORD_RECOVERY') {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/reset-password')) {
          window.location.replace('/reset-password');
          return;
        }
      }

      setSession(session);

      if (session?.user) {
        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, empresa_id, ativo')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profile) {
              // Trigger DB normalmente cria profile no signup. Se chegou aqui
              // sem profile, é caso raro (signup pré-trigger ou falha).
              // Apenas loga — não tenta criar manualmente (RLS/multi-tenant).
              console.warn(
                '[Auth] Sessão sem profile correspondente. Verifique trigger handle_new_user.',
              );
            } else if (event === 'SIGNED_IN') {
              await supabase
                .from('profiles')
                .update({ ultimo_acesso: new Date().toISOString() } as any)
                .eq('id', session.user.id);

              // SEC-025 (12/05/2026): registra login + alerta IP/device novo.
              // Fire-and-forget: edge function compara com 30d e cria notif
              // tipo `login_novo` se for algo diferente. Falha aqui não
              // bloqueia o login.
              fetch(`${SUPABASE_URL}/functions/v1/registrar-login`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                  apikey: SUPABASE_PUBLISHABLE_KEY,
                },
              }).catch(err => console.warn('[Auth] registrar-login falhou:', err));

              // Se profile foi criado mas ainda inativo, notifica admins
              // (idempotente: notif só conta como nova se ainda não tiver)
              if (profile.ativo === false) {
                const { data: existingNotif } = await supabase
                  .from('notificacoes')
                  .select('id')
                  .eq('tipo', 'aprovacao')
                  .ilike('mensagem', `%${session.user.email}%`)
                  .limit(1)
                  .maybeSingle();

                if (!existingNotif) {
                  await supabase.from('notificacoes').insert({
                    tipo: 'aprovacao',
                    titulo: '👤 NOVO USUÁRIO AGUARDANDO APROVAÇÃO',
                    mensagem: `${session.user.email} solicitou acesso. Vá em Configurações → Usuários para aprovar.`,
                    empresa_id: profile.empresa_id,
                  } as any);
                }
              }
            }
          } catch (err) {
            // Sem console.error — erro aqui não bloqueia auth flow
            console.warn('[Auth] non-fatal profile sync error:', err);
          }
        }, 0);
      }

      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
