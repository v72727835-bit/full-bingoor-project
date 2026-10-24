'use client';

import React, { useState } from 'react';
import { notifyWhenBack } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/client';
import { Alert, Button } from './ui';
import s from './NotifyMe.module.css';

/**
 * Out of stock, but the customer still wants it. We take a mobile number and
 * the admin sees the request in Notifications, so the item comes back for a
 * demand we can actually count.
 */
export function NotifyMe({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setDone(await notifyWhenBack(productId, phone.trim()));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Alert tone="ok" icon="check-circle">{done}</Alert>;

  return (
    <div className={s.wrap}>
      {/* The out-of-stock notice steps aside once the form is open, so the
          customer is looking at one thing and not a message behind it. */}
      {open ? null : (
        <Alert tone="bad" icon="info">
          This item is out of stock right now.
        </Alert>
      )}

      {open ? (
        <form className={s.form} onSubmit={submit}>
          {error ? <Alert tone="bad">{error}</Alert> : null}
          <label className={s.label} htmlFor="notify-phone">
            Type your mobile number
          </label>
          <div className={s.row}>
            <input
              id="notify-phone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
              inputMode="numeric"
              placeholder="Type your mobile number"
              required
              autoFocus
            />
            <Button type="submit" loading={busy}>
              Notify me
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" icon="alert" onClick={() => setOpen(true)}>
          Notify me when it is back
        </Button>
      )}
    </div>
  );
}

/**
 * The button that stands in for ADD on an out-of-stock card. Tapping it opens a
 * small box for the mobile number; sending it says "we will notify you soon".
 */
export function NotifyMeButton({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await notifyWhenBack(productId, phone.trim());
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={s.cardBtn} onClick={() => setOpen(true)}>
        {done ? 'We will notify' : 'Notify me'}
      </button>
      {open ? (
        <div className={s.overlay} role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
            {done ? (
              <>
                <p className={s.dialogTitle}>We will notify you soon</p>
                <Button full onClick={() => setOpen(false)}>
                  OK
                </Button>
              </>
            ) : (
              <form onSubmit={send}>
                <p className={s.dialogTitle}>Notify me when it is back</p>
                {error ? <Alert tone="bad">{error}</Alert> : null}
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                  inputMode="numeric"
                  placeholder="Type your mobile number"
                  required
                  autoFocus
                />
                <div style={{ height: 12 }} />
                <Button type="submit" full loading={busy}>
                  Send
                </Button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
