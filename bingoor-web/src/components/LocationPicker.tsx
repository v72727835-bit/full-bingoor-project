'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { accuratePosition, reverseGeocode, searchPlaces } from '../lib/geo';
import { addBaseLayer } from '../lib/mapBase';
import { useSettings } from '../context/SettingsContext';
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

/** City, state and PIN for a pin (Google when a Maps key is set, else OpenStreetMap). Failure just leaves the form as it was. */
export async function reverse(lat: number, lng: number): Promise<Partial<PickedPlace>> {
  return reverseGeocode(lat, lng);
}

/**
 * Half-screen map to place the delivery pin: search a PIN code, landmark or
 * street, tap the map or drag the pin to the exact doorstep, or jump to the
 * phone's own position with "Use my current location".
 */
export function LocationPicker({ value, onPick }: { value?: { lat: number; lng: number }; onPick: (p: PickedPlace) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const pinRef = useRef<import('leaflet').Marker | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const settings = useSettings();
  const mapsCfgRef = useRef(settings?.maps);
  mapsCfgRef.current = settings?.maps;
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');

  const place = useCallback(
    async (lat: number, lng: number, move = true) => {
      pinRef.current?.setLatLng([lat, lng]);
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
      const start = value ?? START;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value ? 16 : 13);
      await addBaseLayer(L, map, mapsCfgRef.current);
      const icon = L.divIcon({ className: s.pinWrap, html: `<span class="${s.pin}"></span>`, iconSize: [30, 40], iconAnchor: [15, 38] });
      const pin = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(map);
      pin.on('dragend', () => {
        const p = pin.getLatLng();
        place(p.lat, p.lng, false);
      });
      map.on('click', (e) => place(e.latlng.lat, e.latlng.lng, false));
      mapRef.current = map;
      pinRef.current = pin;
    })();
    return () => {
      dead = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is built once; later pins move through `place`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      </div>
      <div className={s.foot}>
        <span className="body-sm">Drag the pin, or tap the map, to your doorstep.</span>
        <Button type="button" variant="outline" size="sm" icon="pin" onClick={locate}>
          Use my current location
        </Button>
      </div>
      {note ? <p className={`body-sm ${s.note}`}>{note}</p> : null}
    </div>
  );
}
