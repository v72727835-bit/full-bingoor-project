'use client';

import { useEffect } from 'react';
import { api } from '../lib/client';
import { getWebPushToken, onForegroundPush } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';

const KEY = 'autozo_push_token';

/** Once a customer is signed in and push is switched on, registers this browser so order updates arrive as notifications. */
export function PushRegister() {
  const { user } = useAuth();
  const fb = useSettings()?.firebase;
  const toast = useToast();
  const userId = user?.id;
  const on = !!fb?.pushEnabled;

  useEffect(() => {
    if (!userId || !fb || !on) return;
    let stop: () => void = () => undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = await getWebPushToken(fb);
        if (token && !cancelled) {
          await api.post('/devices', { token, platform: 'web', app: 'web' });
          try {
            localStorage.setItem(KEY, token);
          } catch {
            /* private mode */
          }
        }
        const off = await onForegroundPush(fb, (m) => toast.show(`${m.title}: ${m.body}`));
        if (cancelled) off();
        else stop = off;
      } catch {
        /* push is a bonus: never block the site */
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, on]);

  return null;
}

/** Called on logout: this browser stops receiving the previous customer's notifications. */
export async function unregisterPush() {
  try {
    const token = localStorage.getItem(KEY);
    if (!token) return;
    await api.delete('/devices', { data: { token } });
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
