'use client';

import React, { useState } from 'react';
import { AddressInput } from '../api/account';
import { Address } from '../lib/types';
import { INDIA_STATES, matchState } from '../lib/india';
import { Icon, IconName } from './Icon';
import { accuratePosition } from '../lib/geo';
import { LocationPicker, PickedPlace, reverse } from './LocationPicker';
import { Alert, Button, Field, Input } from './ui';
import s from './AddressForm.module.css';

export { INDIA_STATES };

const LABELS: { value: Address['label']; text: string; icon: IconName }[] = [
  { value: 'home', text: 'Home', icon: 'home' },
  { value: 'work', text: 'Work', icon: 'store' },
  { value: 'other', text: 'Other', icon: 'pin' },
];

export function AddressForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Address;
  onSubmit: (body: AddressInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [f, setF] = useState<AddressInput>({
    label: initial?.label ?? 'home',
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    landmark: initial?.landmark ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
    location: initial?.location,
    isDefault: initial?.isDefault ?? false,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [manual, setManual] = useState(false);

  const set = <K extends keyof AddressInput>(k: K, v: AddressInput[K]) => setF((p) => ({ ...p, [k]: v }));

  /** The pin moved: keep it, and fill what the map could tell us if the customer has not typed it. */
  const picked = (p: PickedPlace) =>
    setF((cur) => ({
      ...cur,
      location: { lat: p.lat, lng: p.lng },
      // City, state and PIN come from the pin, so they follow it; the house and street are only filled when empty.
      city: p.city || cur.city,
      state: matchState(p.state) || cur.state,
      pincode: p.pincode || cur.pincode,
      line1: cur.line1 || p.line1 || '',
      line2: cur.line2 || p.area || '',
    }));

  // What happened on the last tap of "Use my current location", shown right beside the buttons.
  const [geoMsg, setGeoMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const locate = () => {
    setGeoMsg(null);
    setError('');
    if (!window.isSecureContext) {
      setGeoMsg({ tone: 'bad', text: 'Location works only on a secure (https) page. Please open the site with https://.' });
      return;
    }
    if (!navigator.geolocation) {
      setGeoMsg({ tone: 'bad', text: 'This browser cannot share your location. Try Chrome, or use “Add new address manually” and drop the pin on the map.' });
      return;
    }
    setLocating(true);
    setGeoMsg({ tone: 'ok', text: 'Finding your location… if your browser asks, tap Allow.' });
    accuratePosition().then(
      async (pos) => {
        const { lat, lng } = pos;
        set('location', { lat, lng });
        setGeoMsg({ tone: 'ok', text: 'Location saved. Filling in your address…' });
        const place = await reverse(lat, lng);
        picked({ lat, lng, ...place });
        const filled = place.city || place.pincode || place.state;
        setGeoMsg({
          tone: 'ok',
          text: filled
            ? `Address filled from your location (accurate to about ${Math.round(pos.accuracy)} m). Please check it, add your flat / house number and save.`
            : 'Your pin is saved, but we could not read the address. Please type the city, state and PIN code.',
        });
        setLocating(false);
      },
      (err: GeolocationPositionError) => {
        const text =
          err.code === 1
            ? 'Location is blocked for this site. Tap the lock icon next to the web address → Site settings → Location → Allow, then press the button again.'
            : err.code === 2
              ? 'Your device could not find its position. Turn on the phone’s location / GPS and try again.'
              : 'Finding your location took too long. Turn on GPS, go near a window and try again.';
        setGeoMsg({ tone: 'bad', text });
        setLocating(false);
      },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(f.pincode)) {
      setError('Please enter a valid 6-digit PIN code.');
      return;
    }
    // A map pin helps the rider and gives an exact delivery distance, but it is
    // not required: a typed address with a valid PIN is enough to order. (Many
    // customers deny location access or are on a desktop with no GPS, and
    // blocking them here stopped the order from ever being placed.)
    setSaving(true);
    try {
      const body: AddressInput = { ...f };
      if (!body.line2) delete body.line2;
      if (!body.landmark) delete body.landmark;
      if (!body.location) delete body.location;
      await onSubmit(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the address');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {error ? <Alert tone="bad">{error}</Alert> : null}

      <div className={s.tabs} role="radiogroup" aria-label="Address type">
        {LABELS.map((l) => (
          <button
            key={l.value}
            type="button"
            className="chip"
            data-active={f.label === l.value}
            onClick={() => set('label', l.value)}
            role="radio"
            aria-checked={f.label === l.value}
          >
            <Icon name={l.icon} size={15} />
            {l.text}
          </button>
        ))}
      </div>

      <div className={s.two}>
        <Field label="Full name" required>
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} required autoComplete="name" />
        </Field>
        <Field label="Phone" required>
          <Input
            value={f.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>
      </div>

      <Field label="Flat / house / building" required>
        <Input value={f.line1} onChange={(e) => set('line1', e.target.value)} required autoComplete="address-line1" />
      </Field>

      <div className={s.two}>
        <Field label="Street / area" hint="optional">
          <Input value={f.line2} onChange={(e) => set('line2', e.target.value)} autoComplete="address-line2" />
        </Field>
        <Field label="Landmark" hint="optional">
          <Input value={f.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder="Near the temple" />
        </Field>
      </div>

      <div className={s.three}>
        <Field label="City" required>
          <Input value={f.city} onChange={(e) => set('city', e.target.value)} required autoComplete="address-level2" />
        </Field>
        <Field label="State" required>
          <select className="input" value={f.state} onChange={(e) => set('state', e.target.value)} required autoComplete="address-level1">
            <option value="">Select state</option>
            {!INDIA_STATES.includes(f.state) && f.state ? <option value={f.state}>{f.state}</option> : null}
            {INDIA_STATES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pincode" required>
          <Input
            value={f.pincode}
            onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            inputMode="numeric"
            autoComplete="postal-code"
          />
        </Field>
      </div>

      {manual ? (
        <LocationPicker value={f.location} onPick={picked} />
      ) : null}

      <div className={s.geo}>
        <Button variant="outline" size="sm" icon="pin" onClick={locate} loading={locating}>
          Use my current location
        </Button>
        <Button variant="ghost" size="sm" icon="plus" onClick={() => setManual((v) => !v)}>
          {manual ? 'Hide map' : 'Add new address manually'}
        </Button>
        {f.location ? (
          <span className={s.geoOk}>
            <Icon name="check-circle" size={14} />
            Your rider will see this on the map
          </span>
        ) : (
          <span className="body-sm">This helps your rider find you faster</span>
        )}
      </div>
      {geoMsg ? (
        <div style={{ margin: '10px 0' }} role="status">
          <Alert tone={geoMsg.tone === 'ok' ? 'brand' : 'bad'}>{geoMsg.text}</Alert>
        </div>
      ) : null}

      <label className={s.def}>
        <input type="checkbox" checked={!!f.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
        Set as my default address
      </label>

      <div className={s.acts}>
        <Button type="submit" loading={saving}>
          Save address
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
