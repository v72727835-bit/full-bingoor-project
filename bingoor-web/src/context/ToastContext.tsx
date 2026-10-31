'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Icon, IconName } from '../components/Icon';
import s from './Toast.module.css';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ICONS: Record<Tone, IconName> = { success: 'check-circle', error: 'alert', info: 'info' };

const ToastContext = createContext<{ show: (message: string, tone?: Tone) => void } | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random();
    // Keep at most three on screen; a backlog would outlive its context.
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={s.deck} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={s.toast} data-tone={t.tone}>
            <Icon name={ICONS[t.tone]} size={17} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
