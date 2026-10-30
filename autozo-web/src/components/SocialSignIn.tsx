'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getErrorMessage } from '../lib/client';
import { facebookAccessToken, googleAccessToken, startInstagramLogin } from '../lib/social';
import s from './SocialSignIn.module.css';

type Provider = 'google' | 'facebook' | 'instagram';

/** Google's four-colour "G". */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M15.1 12.9l.4-2.8h-2.7V8.3c0-.8.4-1.5 1.6-1.5h1.2V4.4s-1.1-.2-2.2-.2c-2.2 0-3.7 1.4-3.7 3.8v2.1H7.3v2.8h2.4V20h3.1v-7.1h2.3z" />
    </svg>
  );
}

function InstagramMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset="0.05" stopColor="#fdf497" />
          <stop offset="0.45" stopColor="#fd5949" />
          <stop offset="0.6" stopColor="#d6249f" />
          <stop offset="0.9" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#ig-grad)" />
      <rect x="6" y="6" width="12" height="12" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.9" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.3" cy="7.7" r="1" fill="#fff" />
    </svg>
  );
}

/**
 * "Continue with Google / Facebook", used on both login and sign-up: the same
 * call signs an existing customer in or creates the account. The client ids
 * come from Super Admin > Login & Payments through the public settings.
 */
export function SocialSignIn({ next, onError, children }: { next: string; onError: (message: string) => void; children?: React.ReactNode }) {
  const { loginWithSocial } = useAuth();
  const settings = useSettings();
  const router = useRouter();
  const [busy, setBusy] = useState<Provider | null>(null);

  const go = async (provider: Provider) => {
    onError('');
    if (provider === 'instagram') {
      const igId = settings?.social?.instagramAppId;
      if (!igId) {
        onError('Instagram login is coming soon. Please continue with your phone number for now.');
        return;
      }
      setBusy('instagram');
      // Leaves the page for Instagram's own login; /auth/instagram finishes it.
      startInstagramLogin(igId, next);
      return;
    }
    const id = provider === 'google' ? settings?.social?.googleClientId : settings?.social?.facebookAppId;
    if (!id) {
      onError(`${provider === 'google' ? 'Google' : 'Facebook'} login is coming soon. Please continue with your phone number for now.`);
      return;
    }
    setBusy(provider);
    try {
      const token = provider === 'google' ? await googleAccessToken(id) : await facebookAccessToken(id);
      await loginWithSocial(provider, token);
      router.replace(next);
    } catch (err) {
      onError(err instanceof Error && !('isAxiosError' in err) ? err.message : getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={s.methods}>
      <button type="button" className={s.method} onClick={() => go('google')} disabled={busy !== null}>
        <GoogleMark />
        {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <button type="button" className={s.method} onClick={() => go('facebook')} disabled={busy !== null}>
        <FacebookMark />
        {busy === 'facebook' ? 'Opening Facebook…' : 'Continue with Facebook'}
      </button>
      <button type="button" className={s.method} onClick={() => go('instagram')} disabled={busy !== null}>
        <InstagramMark />
        {busy === 'instagram' ? 'Opening Instagram…' : 'Continue with Instagram'}
      </button>
      {children}
    </div>
  );
}

/** "or" line between the social buttons and the phone form. */
export function OrDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className={s.or} role="separator">
      <span>{label}</span>
    </div>
  );
}
