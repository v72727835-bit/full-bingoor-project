'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { fetchAddresses } from '../api/account';
import { fetchCoverage } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import { DeliveryPoint, POINT_EVENT, getDeliveryPoint, setDeliveryPoint } from '../lib/deliveryPoint';
import { Address } from '../lib/types';
import { PlaceParts, detectHere, searchPlaces, shortPlace } from '../lib/geo';
import { Alert, Button, Input } from './ui';
import s from './LocationGate.module.css';

/** The header's location chip fires this to let the customer pick another area. */
export const OPEN_LOCATION_EVENT = 'bingoor:open-location';

/** Pages that work without a delivery area (sign-in, sign-up, partner forms, help). */
const SKIP = ['/login', '/signup', '/forgot-password', '/warehouse-register', '/seller-partner', '/delivery-partner', '/pay', '/help', '/contact', '/blog'];

interface Hit {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * The first thing a visitor sees: where should we deliver? Products are only shown from
 * warehouses that deliver to the answer, so the visitor either shares their current
 * location, picks one of their saved addresses, or searches a PIN code / area.
 */
export function LocationGate() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [point, setPoint] = useState<DeliveryPoint | null | undefined>(undefined);
  const [forced, setForced] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    const sync = () => setPoint(getDeliveryPoint());
    sync();
    const open = () => setForced(true);
    window.addEventListener(POINT_EVENT, sync);
    window.addEventListener(OPEN_LOCATION_EVENT, open);
    return () => {
      window.removeEventListener(POINT_EVENT, sync);
      window.removeEventListener(OPEN_LOCATION_EVENT, open);
    };
  }, []);

  const skipped = SKIP.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const open = point !== undefined && ((point === null && !skipped) || forced);

  // Saved addresses, for a signed-in customer.
  useEffect(() => {
    if (!open || !user) return;
    fetchAddresses(false).then(setAddresses).catch(() => setAddresses([]));
  }, [open, user]);

  /** Checks a warehouse delivers here, then remembers the place; otherwise says so and stays open. */
  const choose = useCallback(async (lat: number, lng: number, label?: string, here?: { place: PlaceParts; accuracy: number }) => {
    // Anything the customer picks by hand wins over a GPS reading still on its way.
    if (!here) gpsTurn.current++;
    setBusy('check');
    setMsg(null);
    try {
      const cover = await fetchCoverage(lat, lng);
      if (!cover.serviceable) {
        setMsg({ tone: 'bad', text: `Sorry, no Bingoor warehouse delivers to ${label || 'this place'} yet. Please choose another address or area.` });
        return;
      }
      // A GPS fix keeps the full address it found, so the address form can fill itself (Blinkit-style).
      setDeliveryPoint(here ? { lat, lng, label, address: here.place, accuracy: Math.round(here.accuracy), at: Date.now() } : { lat, lng, label, at: Date.now() });
      setForced(false);
      setHits([]);
      setQ('');
    } catch {
      setMsg({ tone: 'bad', text: 'Could not check delivery for this place. Please check your internet and try again.' });
    } finally {
      setBusy('');
    }
  }, []);

  // Bumped whenever a new search for "where am I" starts or the customer picks
  // something else, so a late GPS answer never overrides their choice.
  const gpsTurn = useRef(0);
  const [found, setFound] = useState('');
  const locate = () => {
    setMsg(null);
    setFound('');
    if (!window.isSecureContext || !navigator.geolocation) {
      setMsg({ tone: 'bad', text: 'This browser cannot share your location here. Please search your PIN code or area below.' });
      return;
    }
    const turn = ++gpsTurn.current;
    setBusy('geo');
    detectHere().then(
      async ({ lat, lng, accuracy, place }) => {
        if (turn !== gpsTurn.current) return;
        setBusy('');
        setFound(place.line || shortPlace(place));
        await choose(lat, lng, shortPlace(place) || place.city, { place, accuracy });
      },
      (err: GeolocationPositionError) => {
        if (turn !== gpsTurn.current) return;
        setBusy('');
        setMsg({
          tone: 'bad',
          text:
            err.code === 1
              ? 'Location is blocked for this site. Allow it in your browser settings, or search your PIN code / area below.'
              : 'We could not find your location. Turn on GPS, or search your PIN code / area below.',
        });
      },
    );
  };

  // Point 16: the moment this opens - on a first visit or from the header's
  // location button - the current location is looked up straight away (the
  // customer only has to tap "Allow"); saved addresses and search stay below.
  useEffect(() => {
    if (!open) {
      gpsTurn.current++;
      return;
    }
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy('search');
    setMsg(null);
    try {
      const list: Hit[] = await searchPlaces(q.trim());
      setHits(list);
      if (!list.length) setMsg({ tone: 'bad', text: 'No place found. Try your PIN code or a nearby landmark.' });
    } catch {
      setMsg({ tone: 'bad', text: 'Search is not reachable right now. Try “Use my current location”.' });
    } finally {
      setBusy('');
    }
  };

  if (!open) return null;

  return (
    <div className={s.back} role="dialog" aria-modal="true" aria-label="Choose delivery location">
      <div className={s.box}>
        {point ? (
          <button className={s.close} onClick={() => setForced(false)} aria-label="Close">
            ×
          </button>
        ) : null}
        <h2 className={s.title}>Where should we deliver?</h2>
        <p className={s.sub}>We show products from the warehouses that deliver to your place.</p>

        <div className={s.stack}>
          <Button full icon="pin" onClick={locate} loading={busy === 'geo'} disabled={!!busy && busy !== 'geo'}>
            {busy === 'geo' ? 'Finding your exact location…' : 'Use my current location'}
          </Button>
          {found ? (
            <div className={s.found}>
              <b>Your current location</b>
              {found}
            </div>
          ) : null}
        </div>

        {addresses.length > 0 ? (
          <>
            <div className={s.or}>Or choose a saved address</div>
            <div className={s.stack}>
              {addresses.map((a) => (
                <button
                  key={a.id}
                  className={s.addr}
                  disabled={!!busy || !a.location}
                  onClick={() => a.location && choose(a.location.lat, a.location.lng, a.city)}
                >
                  <span className={s.addrTitle}>
                    {a.label.charAt(0).toUpperCase() + a.label.slice(1)} · {a.name}
                  </span>
                  <span className={s.addrBody}>
                    {[a.line1, a.city, a.pincode].filter(Boolean).join(', ')}
                    {a.location ? '' : ' (no map pin - edit it in My addresses)'}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className={s.or}>Or search your area</div>
        <form className={s.search} onSubmit={search}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="PIN code, area or landmark" aria-label="Search area" />
          <Button type="submit" variant="outline" loading={busy === 'search'} disabled={!!busy && busy !== 'search'}>
            Search
          </Button>
        </form>
        {hits.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            {hits.map((h, i) => (
              <button
                key={`${h.lat}${h.lon}${i}`}
                className={s.hit}
                disabled={!!busy}
                onClick={() => choose(Number(h.lat), Number(h.lon), h.display_name.split(',').slice(0, 2).join(',').trim())}
              >
                {h.display_name}
              </button>
            ))}
          </div>
        ) : null}

        {busy === 'check' ? <div className={s.sub} style={{ marginTop: 12 }}>Checking delivery…</div> : null}
        {msg ? (
          <div style={{ marginTop: 14 }} role="status">
            <Alert tone={msg.tone === 'ok' ? 'brand' : 'bad'}>{msg.text}</Alert>
          </div>
        ) : null}
      </div>
    </div>
  );
}
