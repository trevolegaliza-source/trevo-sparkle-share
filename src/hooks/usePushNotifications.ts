import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getEmpresaId } from '@/lib/storage-path';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushStatus = 'unsupported' | 'denied' | 'default' | 'subscribed' | 'unsubscribed';

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>('default');
  const [busy, setBusy] = useState(false);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const refresh = useCallback(async () => {
    if (!isSupported) { setStatus('unsupported'); return; }
    if (Notification.permission === 'denied') { setStatus('denied'); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'subscribed' : (Notification.permission === 'granted' ? 'unsubscribed' : 'default'));
    } catch {
      setStatus('default');
    }
  }, [isSupported]);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return { ok: false, error: 'not-supported' };
    if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'vapid-key-missing' };
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default');
        return { ok: false, error: 'permission-' + permission };
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON();
      const empresa_id = getEmpresaId();
      const { error } = await supabase.from('push_subscriptions' as any).upsert({
        user_id: user.id,
        empresa_id,
        endpoint: sub.endpoint,
        keys_p256dh: json.keys?.p256dh,
        keys_auth: json.keys?.auth,
        device_label: detectDeviceLabel(),
        user_agent: navigator.userAgent.slice(0, 500),
        last_used_at: new Date().toISOString(),
        error_count: 0,
        last_error_at: null,
      }, { onConflict: 'endpoint' });
      if (error) {
        await sub.unsubscribe().catch(() => {});
        return { ok: false, error: error.message };
      }
      setStatus('subscribed');
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return { ok: false };
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions' as any).delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('unsubscribed');
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  return { status, isSupported, busy, subscribe, unsubscribe, refresh };
}

function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Dispositivo';
}
