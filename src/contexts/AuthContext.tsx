import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

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
  const lastActivityRef = useRef(Date.now());

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Track user activity for session timeout
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    const interval = setInterval(() => {
      if (session && (Date.now() - lastActivityRef.current) > SESSION_TIMEOUT_MS) {
        signOut();
        // Toast will show after redirect
      }
    }, 60_000);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [session, signOut]);

  useEffect(() => {
    // audit fix #14, #20 — delega criação de profile ao trigger handle_new_user
    // do banco. Antes: este client fazia LIMIT 1 master + insert manual com
    // `as any`, duplicando bug multi-tenant do trigger e mascarando RLS.
    // Agora: o trigger DB já cria profile com empresa_id correto. Aqui só
    // tocamos ultimo_acesso e disparamos notificação se for primeiro login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
