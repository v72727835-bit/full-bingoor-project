'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { resetPassword } from '../../api/auth';
import { AuthShell } from '../../components/AuthShell';
import { OtpDialog } from '../../components/OtpDialog';
import { getErrorMessage } from '../../lib/client';
import { Alert, Button, Field, Input } from '../../components/ui';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState(false);
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10))) return setError('Enter a valid 10-digit mobile number.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setOtp(true);
  };

  return (
    <AuthShell
      title="Forgot password?"
      lead="Enter your phone number, choose a new password and confirm it with an OTP."
      footer={
        <Link href="/login" style={{ color: 'var(--brand-text)', fontWeight: 700 }}>
          Back to login
        </Link>
      }
    >
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {done ? <Alert tone="ok">Password changed. Taking you to login…</Alert> : null}
      <form onSubmit={submit}>
        <Field label="Your phone number" required>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="username" placeholder="9876543210" required />
        </Field>
        <Field label="New password" required>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" required />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </Field>
        <Button type="submit" size="lg" full disabled={done}>
          Send OTP
        </Button>
      </form>
      {otp ? (
        <OtpDialog
          phone={phone}
          onClose={() => setOtp(false)}
          onVerified={async (token) => {
            try {
              await resetPassword(phone.replace(/\D/g, '').slice(-10), password, token);
              setOtp(false);
              setDone(true);
              setTimeout(() => router.replace('/login'), 1500);
            } catch (err) {
              setOtp(false);
              setError(getErrorMessage(err));
            }
          }}
        />
      ) : null}
    </AuthShell>
  );
}
