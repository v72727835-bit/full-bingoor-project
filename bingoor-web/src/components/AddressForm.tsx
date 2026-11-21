'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AddressInput } from '../api/account';
import { Address } from '../lib/types';
import { getErrorMessage } from '../lib/client';
import { INDIA_STATES, matchState } from '../lib/india';
import { Icon, IconName } from './Icon';
import { useAuth } from '../context/AuthContext';
import { getDeliveryPoint, setDeliveryPoint } from '../lib/deliveryPoint';
import { PlaceParts, detectHere, shortPlace } from '../lib/geo';
import { LocationPicker, PickedPlace } from './LocationPicker';
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
  openMap,
}: {
  initial?: Address;
  onSubmit: (body: AddressInput) => Promise<void>;
  onCancel?: () => void;
  /** Open with the map showing (the "Open map and set your home address" buttons). */
  openMap?: boolean;
}) {
  // Name and phone come from the account the customer signed up with; they only
  // have to be typed when the account has none (e.g. signed in with Google).
  const { user } = useAuth();
  const accountPhone = user?.phone && /^[6-9]\d{9}$/.test(user.phone) ? user.phone : '';
  const [f, setF] = useState<AddressInput>({
    label: initial?.label ?? 'home',
    name: initial?.name ?? user?.name ?? '',
    phone: initial?.phone ?? accountPhone,
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    landmark: initial?.landmark ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
    location: initial?.location,
    isDefault: initial?.isDefault ?? true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [manual, setManual] = useState(!!openMap);
  const [editContact, setEditContact] = useState(!initial && !(user?.name && accountPhone));
  // The address the GPS found, shown as a card above the form (Blinkit-style).
  const [here, setHere] = useState<{ text: string; accuracy?: number } | null>(null);
  const flatRef = useRef<HTMLInputElement>(null);

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
      // The street and area found at the pin go to "Street / area"; "Flat / house"
      // stays for the customer, who knows it better than any map.
      line2:
        [p.line1, p.area].filter(Boolean).join(', ') ||
        // No street name at this spot: the first parts of the full address (village / locality).
        (p.line ? p.line.split(',').map((x) => x.trim()).filter((x) => x && x !== p.city && x !== p.state && !/^\d{6}$/.test(x) && x !== 'India').slice(0, 2).join(', ') : '') ||
        cur.line2,
    }));

  // What happened on the last tap of "Use my current location", shown right beside the buttons.
  const [geoMsg, setGeoMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  /** Fills the form from a place the GPS found and remembers it as the delivery point. */
  const fillFrom = (lat: number, lng: number, place: PlaceParts, accuracy?: number) => {
    picked({ lat, lng, ...place });
    setHere({ text: place.line || shortPlace(place) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, accuracy });
  };

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
    setGeoMsg({ tone: 'ok', text: 'Finding your exact location… if your browser asks, tap Allow.' });
    detectHere((fix) => set('location', { lat: fix.lat, lng: fix.lng })).then(
      ({ lat, lng, accuracy, place }) => {
        fillFrom(lat, lng, place, accuracy);
        // The catalogue, the cart's delivery time and the order all follow this spot now.
        setDeliveryPoint({ lat, lng, label: shortPlace(place) || place.city, address: place, accuracy: Math.round(accuracy), at: Date.now() });
        setGeoMsg(
          place.city || place.pincode
            ? null
            : { tone: 'bad', text: 'Your pin is saved, but we could not read the address there. Please type the city, state and PIN code.' },
        );
        setLocating(false);
        if (!f.line1) flatRef.current?.focus();
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

  // "Open map and set your home address": bring the map into view straight away.
  useEffect(() => {
    if (!openMap) return;
    const t = setTimeout(() => document.getElementById('address-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    return () => clearTimeout(t);
  }, [openMap]);

  // A new address starts from where the customer is right now: what the
  // location step already found is filled in at once, then a fresh GPS reading
  // makes it exact.
  useEffect(() => {
    if (initial) return;
    const point = getDeliveryPoint();
    if (point?.address && point.at && Date.now() - point.at < 30 * 60_000) fillFrom(point.lat, point.lng, point.address, point.accuracy);
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(f.pincode)) {
      setError('Please enter a valid 6-digit PIN code.');
      return;
    }
    if (f.name.trim().length < 2) {
      setError('Please enter your full name.');
      setEditContact(true);
      return;
    }
    if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, '').slice(-10))) {
      setError('Please enter a valid 10-digit mobile number.');
      setEditContact(true);
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
      // The server's own reason, with its field names in the words used on this form.
      const labels: Record<string, string> = { line1: 'Flat / house no.', line2: 'Street / area', name: 'Full name', phone: 'Phone', city: 'City', state: 'State', pincode: 'Pincode', landmark: 'Landmark', location: 'Map pin' };
      const msg = getErrorMessage(err).replace(/\b(line1|line2|name|phone|city|state|pincode|landmark|location)\b(?=:)/g, (k) => labels[k] ?? k);
      setError(msg || 'Could not save the address. Please check the details and try again.');
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

      {here ? (
        <div className={s.here}>
          <Icon name="pin" size={18} />
          <span className={s.hereText}>
            <b>{locating ? 'Updating your exact location…' : 'Delivering to your current location'}</b>
            {here.text}
            {here.accuracy ? <span className={s.hereAcc}>Accurate to about {Math.round(here.accuracy)} m</span> : null}
          </span>
          <button type="button" className={s.hereBtn} onClick={() => setManual(true)}>
            Change
          </button>
        </div>
      ) : null}

      {!editContact ? (
        <div className={s.contact}>
          <Icon name="user" size={16} />
          <span>
            <b>{f.name}</b> · {f.phone}
          </span>
          <button type="button" className={s.hereBtn} onClick={() => setEditContact(true)}>
            Edit
          </button>
        </div>
      ) : (
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
      )}

      <Field label="Flat / house no. / building" required>
        <Input
          ref={flatRef}
          value={f.line1}
          onChange={(e) => set('line1', e.target.value)}
          required
          autoComplete="address-line1"
          placeholder="e.g. B-12, 2nd floor, Shiv Apartment"
        />
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
        <div id="address-map" />
      ) : null}
      {manual ? (
        <LocationPicker
          showNearest
          value={f.location}
          onPick={(p) => {
            picked(p);
            if (p.line) setHere({ text: p.line });
          }}
        />
      ) : null}

      <div className={s.geo}>
        <Button variant="outline" size="sm" icon="pin" onClick={() => setManual((v) => !v)}>
          {manual ? 'Hide map' : 'Open map and set your home address'}
        </Button>
        {/* The open map has its own "Use my current location". */}
        {manual ? null : (
          <Button variant="ghost" size="sm" icon="bolt" onClick={locate} loading={locating}>
            Use my current location
          </Button>
        )}
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
