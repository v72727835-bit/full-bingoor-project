'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { googleAccessToken, facebookAccessToken, startInstagramLogin } from '../../lib/social';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/client';
import { AuthShell } from '../../components/AuthShell';
import { FacebookMark, GoogleMark, InstagramMark } from '../../components/SocialSignIn';
import { Alert, Button, Field, Input, PageLoader } from '../../components/ui';

function LoginInner() {
  const { login, loginWithSocial } = useAuth();
  const settings = useSettings();
  const router = useRouter();
  const requestedNext = useSearchParams().get('next') || '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // The server asks for an OTP on this number before it lets the customer in.

  const social = async (provider: 'google' | 'facebook' | 'instagram') => {
    setError('');
    const ids = settings?.social;
    const id = provider === 'google' ? ids?.googleClientId : provider === 'facebook' ? ids?.facebookAppId : ids?.instagramAppId;
    if (!id) { setError(`${provider} login is not configured yet. Please use your phone or email.`); return; }
    setLoading(true);
    try {
      if (provider === 'instagram') { startInstagramLogin(id, next); return; }
      const token = provider === 'google' ? await googleAccessToken(id) : await facebookAccessToken(id);
      await loginWithSocial(provider, token);
      router.replace(next);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Log in to bingoor.com"
      lead="Sign in with your phone number or email."
      footer={
        <>
          New to Bingoor?{' '}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} style={{ color: 'var(--brand-text)', fontWeight: 700 }}>
            Create an account
          </Link>
        </>
      }
    >
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        <Button full variant="outline" disabled={loading} onClick={() => void social('google')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><GoogleMark /> Continue with Google</span>
        </Button>
        <Button full variant="outline" disabled={loading} onClick={() => void social('facebook')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><FacebookMark /> Continue with Facebook</span>
        </Button>
        <Button full variant="outline" disabled={loading} onClick={() => void social('instagram')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><InstagramMark /> Continue with Instagram</span>
        </Button>
        <small>Instagram login supports Business and Creator accounts.</small>
      </div>
      <form onSubmit={submit}>
        <Field label="Your phone number" required>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            placeholder="9876543210"
            required
          />
        </Field>
        <Field label="Password" required>
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" size="lg" full loading={loading}>
          Login
        </Button>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link href="/forgot-password" style={{ color: 'var(--brand-text)', fontWeight: 700 }}>
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginInner />
    </Suspense>
  );
}
