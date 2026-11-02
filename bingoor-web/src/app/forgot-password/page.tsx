'use client';

import Link from 'next/link';
import React from 'react';
import { AuthShell } from '../../components/AuthShell';
import { useSettings } from '../../context/SettingsContext';

/** Bingoor has no OTP service, so support resets a forgotten password after checking the account. */
export default function ForgotPasswordPage() {
  const phone = (useSettings()?.supportPhone ?? '').trim();
  return (
    <AuthShell
      title="Forgot password?"
      lead="Call Bingoor support from your registered mobile number. They will check your account and set a new password for you."
      footer={
        <Link href="/login" style={{ color: 'var(--brand-text)', fontWeight: 700 }}>
          Back to login
        </Link>
      }
    >
      {phone ? (
        <a href={`tel:${phone}`} className="btn btn-lg btn-primary btn-full">
          Call support · {phone}
        </a>
      ) : (
        <p style={{ color: 'var(--ink-3)', textAlign: 'center' }}>Please contact Bingoor support to reset your password.</p>
      )}
    </AuthShell>
  );
}
