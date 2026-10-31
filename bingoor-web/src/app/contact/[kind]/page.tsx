'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useState } from 'react';
import { sendEnquiry } from '../../../api/support';
import { getErrorMessage } from '../../../lib/client';
import { FORMS } from '../../../lib/pages';
import { BackButton } from '../../../components/BackButton';
import { Alert, Button, Field, Input, Textarea } from '../../../components/ui';
import s from '../contact.module.css';

export default function ContactPage() {
  const { kind: slug } = useParams<{ kind: string }>();
  const form = FORMS.find((f) => f.slug === slug);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otherPhone, setOtherPhone] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  if (!form)
    return (
      <div className="page" style={{ paddingTop: 28 }}>
        <Alert tone="bad">This form does not exist.</Alert>
      </div>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      setDone(
        await sendEnquiry({
          kind: form.kind,
          fullName: fullName.trim(),
          email: email.trim(),
          mobile: mobile.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''),
          otherPhone: otherPhone.trim() || undefined,
          reason: reason.trim(),
        }),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`page rise ${s.wrap}`}>
      <BackButton />
      <h1 className="h1" style={{ margin: '12px 0 4px' }}>
        {form.title}
      </h1>
      <p className="body-sm" style={{ marginBottom: 20 }}>
        {form.lead}
      </p>

      {done ? (
        <Alert tone="ok" icon="check-circle">
          {done}{' '}
          <Link href="/" style={{ fontWeight: 700 }}>
            Back to shopping
          </Link>
        </Alert>
      ) : (
        <form className="card card-pad" onSubmit={submit}>
          {error ? <Alert tone="bad">{error}</Alert> : null}
          <Field label="Full name" required>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <div className="two-col">
            <Field label="Mobile number" required>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="9876543210" required />
            </Field>
            <Field label="Telephone / other mobile number">
              <Input value={otherPhone} onChange={(e) => setOtherPhone(e.target.value)} inputMode="tel" />
            </Field>
          </div>
          <Field label={form.reasonLabel} required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} required />
          </Field>
          <Button type="submit" size="lg" full loading={busy}>
            Submit
          </Button>
        </form>
      )}
    </div>
  );
}
