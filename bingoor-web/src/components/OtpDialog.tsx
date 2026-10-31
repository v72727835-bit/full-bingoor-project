'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { startPhoneOtp, OtpSession } from '../lib/firebase';
import { useSettings } from '../context/SettingsContext';
import { Alert, Button, Field, Input } from './ui';
import s from './OtpDialog.module.css';

/** Sends a Firebase SMS code to `phone`, asks for it, and hands back the verified ID token. */
export function OtpDialog({ phone, onVerified, onClose }: { phone: string; onVerified: (idToken: string) => Promise<void> | void; onClose: () => void }) {
  const fb = useSettings()?.firebase;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(true);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const session = useRef<OtpSession | null>(null);
  const started = useRef(false);

  const send = useCallback(async () => {
    if (!fb?.config) {
      setError('Phone verification is not available right now. Please try again in a moment.');
      setSending(false);
      return;
    }
    setError('');
    setSending(true);
    session.current?.cleanup();
    // The reCAPTCHA needs a fresh element each time.
    const host = document.getElementById('otp-recaptcha-host');
    if (host) host.innerHTML = '<div id="otp-recaptcha"></div>';
    try {
      session.current = await startPhoneOtp(fb, phone, 'otp-recaptcha');
      setWait(30);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }, [fb, phone]);

  useEffect(() => {
    if (!fb || started.current) return;
    started.current = true;
    void send();
  }, [fb, send]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => () => session.current?.cleanup(), []);

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!session.current || busy) return;
    setBusy(true);
    setError('');
    try {
      const token = await session.current.confirm(code);
      await onVerified(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the code.');
    } finally {
      setBusy(false);
    }
  };

  // Sign in as soon as the 6th digit is typed (or auto-filled from the SMS).
  useEffect(() => {
    if (code.length === 6 && !sending && !busy && !error) void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="otp-title">
      <form className={s.dialog} onSubmit={verify}>
        <h2 id="otp-title" className={s.title}>Verify your phone</h2>
        <p className={s.lead}>{sending ? 'Sending a code' : 'We sent a 6-digit code'} to +91 {phone.replace(/\D/g, '').slice(-10)}.</p>
        {error ? <Alert tone="bad">{error}</Alert> : null}
        <Field label="Enter the code" required>
          <Input
            className={s.code}
            value={code}
            onChange={(e) => { setError(''); setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            autoFocus
            required
          />
        </Field>
        <Button type="submit" size="lg" full loading={busy} disabled={sending || code.length !== 6}>
          Verify
        </Button>
        <div className={s.row}>
          <button type="button" className={s.link} disabled={sending || wait > 0} onClick={() => void send()}>
            {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
          </button>
          <button type="button" className={s.link} onClick={onClose}>
            Cancel
          </button>
        </div>
        <div id="otp-recaptcha-host">
          <div id="otp-recaptcha" />
        </div>
      </form>
    </div>
  );
}
