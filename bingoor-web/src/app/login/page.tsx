'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { OrDivider, SocialSignIn } from '../../components/SocialSignIn';
import { getErrorMessage } from '../../lib/client';
import { otpRequiredPhone } from '../../lib/otp';
import { OtpDialog } from '../../components/OtpDialog';
import { AuthShell } from '../../components/AuthShell';
import { Alert, Button, Field, Input, PageLoader } from '../../components/ui';

function LoginInner() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // The server asks for an OTP on this number before it lets the customer in.
  const [otpPhone, setOtpPhone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      router.replace(next);
    } catch (err) {
      const needOtp = otpRequiredPhone(err);
      if (needOtp !== null) setOtpPhone(needOtp || identifier.trim());
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
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
      <SocialSignIn next={next} onError={setError} />
      <OrDivider label="or sign in with phone" />
      {/* The phone / password form is always open (the client asked for it). */}
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
      {otpPhone ? (
        <OtpDialog
          phone={otpPhone}
          onClose={() => setOtpPhone(null)}
          onVerified={async (token) => {
            try {
              await login(identifier.trim(), password, token);
              router.replace(next);
            } catch (err) {
              setOtpPhone(null);
              setError(getErrorMessage(err));
            }
          }}
        />
      ) : null}
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
