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

function LocationPicker({ lat, lng, onClose, onPick }: {
  lat: number; lng: number; onClose: () => void; onPick: (point: { lat: number; lng: number }) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [point, setPoint] = useState({ lat, lng });
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== 'https://bingoor.com' || event.source !== frame.current?.contentWindow) return;
      const data = event.data;
      if (data?.type === 'pin' && Number.isFinite(data.lat) && Number.isFinite(data.lng)
        && Math.abs(data.lat) <= 90 && Math.abs(data.lng) <= 180) setPoint({ lat: data.lat, lng: data.lng });
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <Modal title="Pick warehouse location on Google Maps" onClose={onClose} wide>
    <iframe ref={frame} title="Google warehouse location picker" style={{ width: '100%', height: 460, border: 0 }}
      src={`https://bingoor.com/mobile-map.html?mode=pick&destination=${encodeURIComponent(JSON.stringify({ lat, lng }))}`} />
    <p>Move the pin, tap Confirm this pin, then save the warehouse location.</p>
    <p>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
    <Button onClick={() => onPick(point)}>Use this warehouse location</Button>
  </Modal>;
}

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
        <Field label={current ? 'New password (leave empty to keep the current one)' : 'Password (at least 8 characters)'}>
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
