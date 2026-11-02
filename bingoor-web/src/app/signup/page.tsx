'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/client';
import { AuthShell } from '../../components/AuthShell';
import { PasswordField } from '../../components/PasswordField';
import { OrDivider, SocialSignIn } from '../../components/SocialSignIn';
import { Alert, Button, Field, Input, PageLoader } from '../../components/ui';
import ps from './signup.module.css';

function SignupInner() {
  const { register } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [copied, setCopied] = useState(false);
  // Set once the account exists: the login details are shown before the customer moves on.
  const [created, setCreated] = useState<{ phone: string; password: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (password.length < 8 || password.length > 15) {
      setError('Create a password of at least 8 to 15 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), phone.trim(), password);
      setCreated({ phone: phone.trim(), password });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      lead="It takes a few seconds, then you can start ordering."
      footer={
        <>
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`} style={{ color: 'var(--brand-text)', fontWeight: 700 }}>
            Sign in
          </Link>
        </>
      }
    >
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <SocialSignIn next={next} onError={setError} />
      <OrDivider label="or sign up with phone" />
      <form onSubmit={submit}>
        <Field label="Full name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </Field>
        <Field label="Phone number" required>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="9876543210"
            required
          />
        </Field>
        <Field label="Password" required>
          <span className={ps.hintRow}>
            <span className="label" style={{ marginBottom: 0 }}>
              8 to 15 characters
            </span>
            <span className={ps.tip} tabIndex={0} role="img" aria-label="Create at least 8 to 15 character password">
              ?
              <span className={ps.tipBox} role="tooltip">
                Create at least 8 to 15 character password
              </span>
            </span>
          </span>
          <PasswordField
            value={password}
            onChange={setPassword}
            onGenerate={setConfirm}
            minLength={8}
            maxLength={15}
            placeholder="ANKur@1115"
            required
          />
        </Field>
        <Field label="Confirm password" required>
          <PasswordField value={confirm} onChange={setConfirm} id="confirm" minLength={8} maxLength={15} placeholder="Type it again" canGenerate={false} required />
        </Field>
        <Button type="submit" size="lg" full loading={loading}>
          Create an account
        </Button>
      </form>
      {created ? (
        <div className={ps.overlay} role="dialog" aria-modal="true" aria-labelledby="acct-done">
          <div className={ps.dialog}>
            <span className={ps.tick}>✓</span>
            <h2 id="acct-done" className={ps.dialogTitle}>Account Created!</h2>
            <p className={ps.dialogLead}>Save your login details for future access</p>
            <dl className={ps.creds}>
              <div>
                <dt>Mobile</dt>
                <dd>{created.phone}</dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>{created.password}</dd>
              </div>
            </dl>
            <Button
              full
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`Mobile: ${created.phone}\nPassword: ${created.password}`);
                  setCopied(true);
                } catch {
                  /* clipboard blocked: the details are on screen */
                }
              }}
            >
              {copied ? 'Copied — keep it safe' : 'Copy Credentials'}
            </Button>
            <button type="button" className={ps.continueLink} onClick={() => router.replace(next)}>
              Continue to App
            </button>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SignupInner />
    </Suspense>
  );
}
