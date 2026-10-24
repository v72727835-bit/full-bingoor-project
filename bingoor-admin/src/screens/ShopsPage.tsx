import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from '../navigation';
import { createShop, deleteShop, fetchShops, fetchWarehouseLogins, setWarehouseLogin, updateShop, WarehouseLogin } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal, Pagination } from '../components/ui';
import { PageMeta, Shop } from '../types';
import WarehouseCoverageMap from '../components/WarehouseCoverageMap';

type FormState = {
  name: string;
  description: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  lat: string;
  lng: string;
  deliveryFee: string;
  gstin: string;
  minOrderAmount: string;
  deliveryRadiusKm: string;
  isOpen: boolean;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: '',
  description: '',
  phone: '',
  line1: '',
  city: '',
  state: '',
  pincode: '',
  lat: '24.70',
  lng: '83.07',
  deliveryFee: '30',
  gstin: '',
  minOrderAmount: '0',
  deliveryRadiusKm: '10',
  isOpen: true,
  isActive: true,
};

export default function ShopsPage() {
  const [params, setParams] = useSearchParams();
  const [shops, setShops] = useState<Shop[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Shop | null>(null);
  const [logins, setLogins] = useState<WarehouseLogin[]>([]);
  const [loginFor, setLoginFor] = useState<Shop | null>(null);
  const [showForm, setShowForm] = useState(!!params.get('new'));

  const closeForm = () => {
    setShowForm(false);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const load = () => {
    fetchWarehouseLogins().then(setLogins).catch(() => undefined);
    setLoading(true);
    fetchShops({ page, limit: 20 })
      .then(({ items, meta }) => {
        setShops(items);
        setMeta(meta);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page]);

  const remove = async (s: Shop) => {
    if (!confirm(`Delete "${s.name}"? It must have no products first.`)) return;
    try {
      await deleteShop(s._id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses</h1>
          <div className="page-subtitle">{meta ? `${meta.total} warehouses` : ''}</div>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + Add warehouse
        </Button>
      </div>

      <ErrorBanner message={error} />

      <div className="card">
        {loading ? (
          <div style={{ padding: 40 }}>
            <CenterSpinner />
          </div>
        ) : shops.length === 0 ? (
          <div className="empty-state">No warehouses yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>City</th>
                  <th>Delivery fee</th>
                  <th>Min order</th>
                  <th>Status</th>
                  <th>Panel login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className="cell-name">{s.name}</div>
                      {s.phone && <div className="cell-muted">{s.phone}</div>}
                    </td>
                    <td className="cell-muted">{s.address.city || '—'}</td>
                    <td>₹{s.deliveryFee}</td>
                    <td>₹{s.minOrderAmount}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <Badge tone={s.isActive ? 'success' : 'muted'}>{s.isActive ? 'Active' : 'Hidden'}</Badge>
                      {!s.isOpen && <Badge tone="warn">Closed</Badge>}
                    </td>
                    <td className="cell-muted">
                      {logins.find((l) => l.shop === s._id)?.phone ?? <Badge tone="warn">Not created</Badge>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="sm" variant="secondary" onClick={() => setLoginFor(s)}>
                          {logins.some((l) => l.shop === s._id) ? 'Change login' : 'Create login'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(s);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(s)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}

      {loginFor && (
        <LoginModal
          shop={loginFor}
          current={logins.find((l) => l.shop === loginFor._id)}
          onClose={() => setLoginFor(null)}
          onDone={() => {
            setLoginFor(null);
            load();
          }}
        />
      )}

      {showForm && (
        <ShopForm
          shop={editing}
          onClose={closeForm}
          onSaved={() => {
            closeForm();
            load();
          }}
        />
      )}
    </>
  );
}

function ShopForm({ shop, onClose, onSaved }: { shop: Shop | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(
    shop
      ? {
          name: shop.name,
          description: shop.description ?? '',
          phone: shop.phone ?? '',
          line1: shop.address.line1 ?? '',
          city: shop.address.city ?? '',
          state: shop.address.state ?? '',
          pincode: shop.address.pincode ?? '',
          lat: String(shop.location.coordinates[1]),
          lng: String(shop.location.coordinates[0]),
          deliveryFee: String(shop.deliveryFee),
          gstin: shop.gstin ?? '',
          minOrderAmount: String(shop.minOrderAmount),
          deliveryRadiusKm: String(shop.deliveryRadiusKm),
          isOpen: shop.isOpen,
          isActive: shop.isActive,
        }
      : EMPTY,
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        phone: form.phone || undefined,
        address: { line1: form.line1, city: form.city, state: form.state, pincode: form.pincode },
        location: { lat: Number(form.lat), lng: Number(form.lng) },
        deliveryFee: Number(form.deliveryFee) || 0,
        gstin: form.gstin.trim().toUpperCase(),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        deliveryRadiusKm: Number(form.deliveryRadiusKm),
        isOpen: form.isOpen,
        isActive: form.isActive,
      };
      if (shop) await updateShop(shop._id, body);
      else await createShop(body as never);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={shop ? 'Edit warehouse' : 'Add warehouse'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <ErrorBanner message={error} />
        <div className="field-row">
          <Field label="Warehouse name">
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Address line">
          <input value={form.line1} onChange={(e) => set('line1', e.target.value)} />
        </Field>
        <div className="field-row">
          <Field label="City">
            <input value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="State">
            <input value={form.state} onChange={(e) => set('state', e.target.value)} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Pincode">
            <input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
          </Field>
          <Field label="Delivery radius (km)">
            <input type="number" min={1} step="any" required value={form.deliveryRadiusKm} onChange={(e) => set('deliveryRadiusKm', e.target.value)} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Latitude">
            <input type="number" step="0.0001" value={form.lat} onChange={(e) => set('lat', e.target.value)} required />
          </Field>
          <Field label="Longitude">
            <input type="number" step="0.0001" value={form.lng} onChange={(e) => set('lng', e.target.value)} required />
          </Field>
        </div>
        <div className="location-picker-row">
          <Button type="button" variant="secondary" onClick={() => setShowLocationPicker(true)}>
            Pick on map
          </Button>
          <span>
            {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
          </span>
        </div>
        <WarehouseCoverageMap lat={form.lat.trim() ? Number(form.lat) : NaN} lng={form.lng.trim() ? Number(form.lng) : NaN} radiusKm={form.deliveryRadiusKm.trim() ? Number(form.deliveryRadiusKm) : NaN} />
        <div className="field-row">
          <Field label="Delivery fee (₹)">
            <input type="number" value={form.deliveryFee} onChange={(e) => set('deliveryFee', e.target.value)} />
          </Field>
          <Field label="GSTIN of this warehouse (printed on its bills)">
            <input value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} maxLength={15} placeholder="09ABCDE1234F1Z5" />
          </Field>
          <Field label="Minimum order (₹)">
            <input type="number" value={form.minOrderAmount} onChange={(e) => set('minOrderAmount', e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div className="checkbox-row">
            <input type="checkbox" id="open" checked={form.isOpen} onChange={(e) => set('isOpen', e.target.checked)} />
            <label htmlFor="open" style={{ marginBottom: 0 }}>
              Currently open
            </label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="shop-active" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            <label htmlFor="shop-active" style={{ marginBottom: 0 }}>
              Visible in app
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : shop ? 'Save changes' : 'Create warehouse'}
          </Button>
        </div>
      </form>
      {showLocationPicker && (
        <LocationPicker
          lat={Number(form.lat) || Number(EMPTY.lat)}
          lng={Number(form.lng) || Number(EMPTY.lng)}
          onClose={() => setShowLocationPicker(false)}
          onPick={({ lat, lng }) => {
            setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
            setShowLocationPicker(false);
          }}
        />
      )}
    </Modal>
  );
}

interface Place {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /** What the search service considers the extent of the place. */
  box?: { north: number; south: number; east: number; west: number };
}

/**
 * Place search, through OpenStreetMap's Nominatim - the same data behind the
 * map already embedded here, so a result always lines up with what is drawn.
 *
 * Searching runs only when the form is submitted, never on every keystroke:
 * Nominatim's terms ask for at most one request a second, and an admin typing
 * "Robertsganj" would otherwise fire a dozen.
 */
async function searchPlaces(query: string): Promise<Place[]> {
  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?format=jsonv2&limit=6&addressdetails=0&countrycodes=in&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);

  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) return [];

  // Parsed defensively: a bad row is dropped rather than put on the map as
  // NaN, which would send the pin off the edge of the frame.
  const places: Place[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const b = row.boundingbox;
    const nums = Array.isArray(b) ? b.map(Number) : [];
    const box =
      nums.length === 4 && nums.every(Number.isFinite)
        ? { south: nums[0], north: nums[1], west: nums[2], east: nums[3] }
        : undefined;

    places.push({
      id: String(row.place_id ?? `${lat},${lng}`),
      label: String(row.display_name ?? 'Unnamed place'),
      lat,
      lng,
      box,
    });
  }
  return places;
}

/**
 * The map window for a result. A town comes back with a usable box; a single
 * building comes back with almost none, so the span is held to a minimum that
 * still leaves room to nudge the pin onto the right side of the street.
 */
function frameAround(place: Place) {
  const MIN_SPAN = 0.012; // roughly 1.3 km
  const span = place.box
    ? Math.max(place.box.north - place.box.south, place.box.east - place.box.west, MIN_SPAN)
    : MIN_SPAN;
  const half = span / 2;
  return {
    north: place.lat + half,
    south: place.lat - half,
    east: place.lng + half,
    west: place.lng - half,
  };
}

function LocationPicker({
  lat,
  lng,
  onClose,
  onPick,
}: {
  lat: number;
  lng: number;
  onClose: () => void;
  onPick: (point: { lat: number; lng: number }) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [point, setPoint] = useState({ lat, lng });
  const [dragging, setDragging] = useState(false);
  // The window the map shows. It used to be fixed for the life of the picker;
  // searching has to move it, so it is state now.
  const [bounds, setBounds] = useState({ north: lat + 0.06, south: lat - 0.06, east: lng + 0.06, west: lng - 0.06 });
  const { north, south, east, west } = bounds;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    try {
      const found = await searchPlaces(q);
      setResults(found);
      if (!found.length) setSearchError('Nothing found. Try the town or a landmark nearby.');
    } catch {
      setSearchError('Could not reach the search service. Drop the pin by hand instead.');
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  /** Centre the map on a result and drop the pin on it. */
  const goTo = (place: Place) => {
    setPoint({ lat: place.lat, lng: place.lng });
    setBounds(frameAround(place));
    setResults(null);
    setQuery(place.label);
  };

  const placeFromPointer = (clientX: number, clientY: number) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setPoint({ lat: north - y * (north - south), lng: west + x * (east - west) });
  };

  /**
   * Zoom around the pin, not the frame's centre.
   *
   * The embed draws its own +/- buttons, but the iframe has pointer-events
   * switched off so that a click lands on the map and moves the pin - which
   * leaves those buttons visible and dead. These redraw the frame instead,
   * and keeping the pin at the centre means it can never be zoomed off the
   * edge while it is being placed.
   */
  const MIN_SPAN = 0.0015; // roughly 160 m across
  const MAX_SPAN = 6; // roughly 650 km across
  const zoom = (factor: number) => {
    setBounds((b) => {
      const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, (b.north - b.south) * factor));
      const half = span / 2;
      return {
        north: point.lat + half,
        south: point.lat - half,
        east: point.lng + half,
        west: point.lng - half,
      };
    });
  };
  const span = north - south;
  const atMax = span >= MAX_SPAN - 1e-9;
  const atMin = span <= MIN_SPAN + 1e-9;

  const left = ((point.lng - west) / (east - west)) * 100;
  const top = ((north - point.lat) / (north - south)) * 100;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik`;

  return (
    <Modal title="Pick warehouse location" onClose={onClose} wide>
      <form className="map-search" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchError('');
          }}
          placeholder="Search a town, area or landmark…"
          aria-label="Search for a place"
          autoFocus
        />
        <Button type="submit" variant="secondary" disabled={searching || !query.trim()}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {searchError ? <div className="map-search-note">{searchError}</div> : null}

      {results?.length ? (
        <ul className="map-results">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => goTo(r)}>
                <span className="map-result-name">{r.label}</span>
                <span className="map-result-coords">
                  {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={mapRef}
        className="map-picker"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          placeFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => dragging && placeFromPointer(e.clientX, e.clientY)}
        onPointerUp={() => setDragging(false)}
      >
        <iframe title="Warehouse map" src={mapUrl} loading="lazy" />
        <div className="map-pin" style={{ left: `${left}%`, top: `${top}%` }} />

        {/* Bottom-left, clear of the embed's own (dead) controls at the top
            right, so there is never a half-covered button. */}
        <div
          className="map-zoom"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => zoom(0.55)} disabled={atMin} aria-label="Zoom in" title="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoom(1 / 0.55)} disabled={atMax} aria-label="Zoom out" title="Zoom out">
            −
          </button>
        </div>
      </div>
      <div className="map-picker-meta">
        <span>Drag the pin or click the map</span>
        <b>
          {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
        </b>
      </div>
      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={() => onPick(point)}>
          Use location
        </Button>
      </div>
    </Modal>
  );
}

/** The warehouse's own panel login: it signs in at admin.bingoor.com with "Warehouse sign in". */
function LoginModal({ shop, current, onClose, onDone }: { shop: Shop; current?: WarehouseLogin; onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState(current?.phone ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const gen = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    setPassword([...bytes].map((b) => chars[b % chars.length]).join('') + '@7');
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await setWarehouseLogin(shop._id, { phone, password: password || undefined });
      window.alert(`Warehouse login saved.\n\nPanel: admin.bingoor.com → "Warehouse sign in"\nPhone: ${phone}${password ? `\nPassword: ${password}` : '\n(password unchanged)'}\n\nShare it with the warehouse now - the password cannot be shown again.`);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Panel login · ${shop.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner message={error} />
        <Field label="Login phone number (10 digits)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" required />
        </Field>
        <Field label={current ? 'New password (leave empty to keep the current one)' : 'Password (at least 6 characters)'}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={password} onChange={(e) => setPassword(e.target.value)} required={!current} style={{ flex: 1 }} />
            <Button type="button" variant="secondary" onClick={gen}>
              Generate
            </Button>
          </div>
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save login'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
