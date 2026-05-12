import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from './usePermissions';
import { toast } from 'sonner';

// SEC-022 (12/05/2026): timeout por inatividade por role.
// Master = 8h (HANDOFF: trabalha 20h/dia). Demais = 2h. Toast de
// aviso 5min antes; qualquer interação resseta. Antes vivia em
// AuthContext com 8h fixo pra todos.
const TIMEOUTS_MS = {
  master: 8 * 60 * 60 * 1000,
  default: 2 * 60 * 60 * 1000,
};
const WARNING_BEFORE_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 30_000;
const WARNING_TOAST_ID = 'session-expiry-warning';

export function useSessionTimeout() {
  const { session, signOut } = useAuth();
  const { role } = usePermissions();
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);

  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (warnedRef.current) {
        warnedRef.current = false;
        toast.dismiss(WARNING_TOAST_ID);
      }
    };
    const events = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const timeoutMs = role === 'master' ? TIMEOUTS_MS.master : TIMEOUTS_MS.default;

    const interval = setInterval(() => {
      const inactivity = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - inactivity;

      if (remaining <= 0) {
        toast.dismiss(WARNING_TOAST_ID);
        toast.warning('Sessão expirada por inatividade. Faça login novamente.');
        signOut();
        return;
      }

      if (remaining <= WARNING_BEFORE_MS && !warnedRef.current) {
        warnedRef.current = true;
        const minutos = Math.max(1, Math.ceil(remaining / 60_000));
        toast.warning('Sua sessão vai expirar', {
          id: WARNING_TOAST_ID,
          description: `Sem atividade nos últimos minutos. Você será desconectada em ${minutos}min. Qualquer clique renova.`,
          duration: WARNING_BEFORE_MS,
        });
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session, role, signOut]);
}
