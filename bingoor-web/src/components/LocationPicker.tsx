'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { accuratePosition, reverseGeocode, searchPlaces } from '../lib/geo';
import { addBaseLayer } from '../lib/mapBase';
import { useSettings } from '../context/SettingsContext';
import { getDeliveryPoint } from '../lib/deliveryPoint';
import { Icon } from './Icon';
import { Button } from './ui';
import s from './LocationPicker.module.css';

export interface PickedPlace {
  lat: number;
  lng: number;
  /** Filled from the map's address lookup when it succeeds. */
  city?: string;
  state?: string;
  pincode?: string;
  line?: string;
  /** House number and road, for the first address line. */
  line1?: string;
  /** Neighbourhood / locality, for the second address line. */
  area?: string;
}

interface Hit {
  display_name: string;
  lat: string;
  lon: string;
}

const START = { lat: 24.7, lng: 83.07 }; // Robertsganj, until the customer moves the pin

/** City, state and PIN for a pin (Google Geocoding). Failure just leaves the form as it was. */
export async function reverse(lat: number, lng: number): Promise<Partial<PickedPlace>> {
  return reverseGeocode(lat, lng);
}

/**
 * Half-screen map to place the delivery pin: search a PIN code, landmark or
 * street, move the map under the fixed pin to the exact doorstep, or jump to the
 * phone's own position with "Use my current location".
 */
export function LocationPicker({ value, onPick }: { value?: { lat: number; lng: number }; onPick: (p: PickedPlace) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const movingPinRef = useRef(false);
  const settings = useSettings();
  const mapsCfgRef = useRef(settings?.maps);
  mapsCfgRef.current = settings?.maps;
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  const [movingPin, setMovingPin] = useState(false);

  // Last point handed to onPick, so the map's own moveend after a jump
  // (search, GPS) does not look the same address up twice.
  const lastRef = useRef<{ lat: number; lng: number } | null>(null);

  const place = useCallback(
    async (lat: number, lng: number, move = true) => {
      lastRef.current = { lat, lng };
      if (move) mapRef.current?.setView([lat, lng], Math.max(mapRef.current.getZoom(), 16));
      onPick({ lat, lng });
      onPick({ lat, lng, ...(await reverse(lat, lng)) });
    },
    [onPick],
  );

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (dead || !box.current || mapRef.current) return;
      leaflet.current = L;
      // Start where the customer is (the delivery point) when the address has no pin yet.
      const here = getDeliveryPoint();
      const start = value ?? (here ? { lat: here.lat, lng: here.lng } : START);
      // Keep one-finger vertical swipes available for page scrolling. Customers
      // explicitly enable map movement while positioning the pin.
      const map = L.map(box.current, { zoomControl: true, attributionControl: true, dragging: false }).setView([start.lat, start.lng], value || here ? 17 : 13);
      await addBaseLayer(L, map, mapsCfgRef.current);
      // The pin stays fixed in the middle of the map and the map moves under it
      // (Blinkit / Zepto style). Dragging a small marker with a finger was
      // unreliable on phones, so the spot under the pin is what gets saved.
      map.on('moveend', () => {
        const c = map.getCenter();
        const last = lastRef.current;
        if (last && Math.abs(last.lat - c.lat) < 1e-6 && Math.abs(last.lng - c.lng) < 1e-6) return;
        place(c.lat, c.lng, false);
      });
      // A tap moves that spot under the pin.
      map.on('click', (e) => map.panTo(e.latlng));
      mapRef.current = map;
      if (movingPinRef.current) map.dragging.enable();
      // The map opened on the customer's own spot: that is already a valid
      // pin, so save it without making them nudge the map first.
      if (!value && here) place(start.lat, start.lng, false);
    })();
    return () => {
      dead = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is built once; later pins move through `place`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    movingPinRef.current = movingPin;
    const dragging = mapRef.current?.dragging;
    if (!dragging) return;
    if (movingPin) dragging.enable();
    else dragging.disable();
  }, [movingPin]);

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true);
    setNote('');
    try {
      const list: Hit[] = await searchPlaces(q);
      setHits(list);
      if (!list.length) setNote('No place found. Try a PIN code, or a nearby landmark.');
      else if (list.length === 1) pick(list[0]);
    } catch {
      setNote('Search is not reachable right now. You can still move the pin on the map.');
    } finally {
      setSearching(false);
    }
  };

  const pick = (h: Hit) => {
    setHits([]);
    place(Number(h.lat), Number(h.lon));
  };

  const locate = () => {
    if (!navigator.geolocation) return setNote('This browser does not support location access.');
    setNote('Finding your exact location…');
    accuratePosition()
      .then((fix) => {
        setNote(fix.accuracy > 100 ? `Pin placed (about ${Math.round(fix.accuracy)} m accurate). Drag it to your door if needed.` : '');
        place(fix.lat, fix.lng);
      })
      .catch(() => setNote('Location is off. Allow it in your browser (or switch it on in settings), then tap Enable again.'));
  };

  return (
    <div className={s.wrap}>
      {/* A div, not a form: this picker sits inside other forms (address, warehouse), and a nested form made Search submit the page. */}
      <div className={s.search} role="search">
        <Icon name="search" size={17} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Search your pin code and landmark, street name etc."
          aria-label="Search your pin code and landmark, street name etc."
        />
        <Button type="button" size="sm" loading={searching} onClick={search}>
          Search
        </Button>
      </div>
      {hits.length > 1 ? (
        <ul className={s.hits}>
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button type="button" onClick={() => pick(h)}>
                <Icon name="pin" size={14} />
                {h.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={s.mapBox}>
        <div ref={box} className={s.map} />
        <div className={s.centerPin} aria-hidden>
          <div className={s.pinBox}>
            <div className={s.tip}>
              <b>Order will be delivered here</b>
              <span>Move the map to your exact location</span>
            </div>
            <span className={s.head} />
            <span className={s.stick} />
            <span className={s.base} />
          </div>
        </div>
        <button type="button" className={s.locateBtn} onClick={locate} aria-label="Go to my current location" title="My current location">
          <Icon name="pin" size={18} />
        </button>
      </div>
      <div className={s.foot}>
        <span className="body-sm">{movingPin ? 'Move the map so the pin sits on your doorstep.' : 'Page scrolling stays available. Turn on map movement to place the pin.'}</span>
        <Button type="button" size="sm" variant={movingPin ? 'soft' : 'primary'} icon={movingPin ? 'check' : 'pin'} onClick={() => setMovingPin((v) => !v)}>
          {movingPin ? 'Done moving pin' : 'Move map to set pin'}
        </Button>
        <Button type="button" variant="outline" size="sm" icon="pin" onClick={locate}>
          Use my current location
        </Button>
      </div>
      {note ? <p className={`body-sm ${s.note}`}>{note}</p> : null}
    </div>
  );
}
