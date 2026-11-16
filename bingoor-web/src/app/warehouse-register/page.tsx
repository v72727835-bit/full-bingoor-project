'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { registerWarehouse } from '../../api/support';
import { INDIA_STATES } from '../../components/AddressForm';
import { BackButton } from '../../components/BackButton';
import { LocationPicker, PickedPlace } from '../../components/LocationPicker';
import { PasswordField } from '../../components/PasswordField';
import { Alert, Button, Field, Input, Textarea } from '../../components/ui';
import { getErrorMessage } from '../../lib/client';
import s from '../contact/contact.module.css';

/** A warehouse registers itself here; the Bingoor team approves it, then it signs in to its own panel. */
export default function WarehouseRegisterPage() {
  const [f, setF] = useState({
    name: '', phone: '', email: '', password: '', confirm: '',
    shopName: '', line1: '', city: '', state: 'Uttar Pradesh', pincode: '', gst: '', note: '',
  });
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((cur) => ({ ...cur, [k]: v }));

  const picked = (p: PickedPlace) => {
    setLocation({ lat: p.lat, lng: p.lng });
    setF((cur) => ({ ...cur, city: cur.city || p.city || '', pincode: cur.pincode || p.pincode || '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const phone = f.phone.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit mobile number (it starts with 6, 7, 8 or 9).');
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    if (f.password !== f.confirm) return setError('The two passwords do not match.');
    if (!location) return setError('Please mark your warehouse on the map (or tap "Use my location") so riders and customers can find it.');
    setBusy(true);
    try {
      setDone(
        await registerWarehouse({
          name: f.name.trim(),
          phone,
          email: f.email.trim() || undefined,
          password: f.password,
          shopName: f.shopName.trim(),
          line1: f.line1.trim(),
          city: f.city.trim(),
          state: f.state,
          pincode: f.pincode.trim(),
          location,
          gst: f.gst.trim() || undefined,
          note: f.note.trim() || undefined,
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
      <h1 className="h1" style={{ margin: '12px 0 4px' }}>Register your warehouse</h1>
      <p className="body-sm" style={{ marginBottom: 20 }}>
        Fill this once. The Bingoor team reviews it and, after approval, you can sign in to your own panel to add products and send orders to riders.
      </p>

      {done ? (
        <Alert tone="ok" icon="check-circle">
          {done} We will review it shortly. <Link href="/" style={{ fontWeight: 700 }}>Back to shopping</Link>
        </Alert>
      ) : (
        <form className="card card-pad" onSubmit={submit}>
          {error ? <Alert tone="bad">{error}</Alert> : null}
          <Field label="Your full name" required>
            <Input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" required minLength={2} />
          </Field>
          <div className="two-col">
            <Field label="Mobile number (your login)" required>
              <Input value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/[^\d+\s-]/g, ''))} inputMode="tel" autoComplete="tel" placeholder="9876543210" maxLength={14} required />
            </Field>
            <Field label="Email">
              <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
            </Field>
          </div>
          <div className="two-col">
            <Field label="Password" required>
              <PasswordField value={f.password} onChange={(v) => set('password', v)} onGenerate={(v) => set('confirm', v)} required />
            </Field>
            <Field label="Confirm password" required>
              <PasswordField id="confirm" value={f.confirm} onChange={(v) => set('confirm', v)} canGenerate={false} required />
            </Field>
          </div>
          <Field label="Warehouse / shop name" required>
            <Input value={f.shopName} onChange={(e) => set('shopName', e.target.value)} required minLength={2} />
          </Field>
          <Field label="Warehouse address" required>
            <Input value={f.line1} onChange={(e) => set('line1', e.target.value)} required minLength={5} placeholder="Building, street, area" />
          </Field>
          <div className="two-col">
            <Field label="City" required>
              <Input value={f.city} onChange={(e) => set('city', e.target.value)} required autoComplete="address-level2" />
            </Field>
            <Field label="PIN code" required>
              <Input value={f.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" required autoComplete="postal-code" />
            </Field>
          </div>
          <Field label="State" required>
            <select className="input" value={f.state} onChange={(e) => set('state', e.target.value)} required>
              {INDIA_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </Field>
          <Field label="Warehouse location on map" required>
            <LocationPicker value={location} onPick={picked} />
          </Field>
          <Field label="GST number (optional)">
            <Input value={f.gst} onChange={(e) => set('gst', e.target.value.toUpperCase())} maxLength={20} />
          </Field>
          <Field label="Anything else we should know (optional)">
            <Textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={3} maxLength={500} />
          </Field>
          <Button type="submit" size="lg" full loading={busy}>
            Submit for approval
          </Button>
        </form>
      )}
    </div>
  );
}
