import React, { useEffect, useState } from 'react';
import { fetchProducts, fetchSettings, saveSettings } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Button, CenterSpinner, ErrorBanner, Field } from '../components/ui';
import { Product, Settings } from '../types';

type Save = (patch: Record<string, unknown>) => Promise<void>;
const num = (v: string) => (v === '' ? 0 : Number(v));

/**
 * Everything that changes what a customer pays or sees at checkout: the three
 * delivery times, the distance-based charges, the hidden cart-points rule,
 * the listing filters and the customer-care number.
 */
export default function DeliveryPricingPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    fetchSettings().then(setSettings).catch((e) => setError(getErrorMessage(e)));
  }, []);

  const save: Save = async (patch) => {
    setError('');
    try {
      setSettings(await saveSettings(patch as Partial<Settings>));
      setSaved('Saved');
      setTimeout(() => setSaved(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (!settings) return error ? <ErrorBanner message={error} /> : <CenterSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery &amp; pricing</h1>
          <div className="page-subtitle">
            Delivery times, distance-based charges, the cart-points rule, listing filters and the customer-care number.
          </div>
        </div>
        {saved && <span className="badge badge-success">{saved}</span>}
      </div>
      <ErrorBanner message={error} />
      <SlotsCard settings={settings} onSave={save} />
      <PricingCard settings={settings} onSave={save} />
      <PointsCard settings={settings} onSave={save} />
      <PaymentOptionsCard settings={settings} onSave={save} />
      <FiltersCard settings={settings} onSave={save} />
    </>
  );
}

/* ------------------------------ delivery times ----------------------------- */

function SlotsCard({ settings, onSave }: { settings: Settings; onSave: Save }) {
  const [slots, setSlots] = useState(settings.deliverySlots);
  const [twoHour, setTwoHour] = useState(settings.twoHourCharge);
  const [phone, setPhone] = useState(settings.supportPhone ?? '');
  const [google, setGoogle] = useState(settings.googleReviewUrl ?? '');
  const [busy, setBusy] = useState(false);
  const enabledCount = slots.filter((s) => s.enabled).length;

  const submit = async () => {
    setBusy(true);
    await onSave({ deliverySlots: slots, twoHourCharge: twoHour, supportPhone: phone.trim(), googleReviewUrl: google.trim() });
    setBusy(false);
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 18 }}>
      <h2 className="card-title">Delivery times</h2>
      <div className="page-subtitle" style={{ marginBottom: 14 }}>
        Rename any of the three times, or switch one off. A switched-off time disappears everywhere and the others spread out to fill the row.
      </div>
      {slots.map((s, i) => (
        <div key={s.key} className="row-flex" style={{ marginBottom: 8 }}>
          <span className="stat-label" style={{ width: 40 }}>
            {i + 1}
            {['st', 'nd', 'rd'][i]}
          </span>
          <input
            value={s.label}
            maxLength={30}
            onChange={(e) => setSlots((cur) => cur.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)))}
            style={{ flex: 1 }}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={s.enabled}
              disabled={s.enabled && enabledCount === 1}
              onChange={(e) => setSlots((cur) => cur.map((x, j) => (i === j ? { ...x, enabled: e.target.checked } : x)))}
            />
            <span>Show</span>
          </label>
        </div>
      ))}

      <div className="field-row" style={{ marginTop: 14 }}>
        <Field label="Charge for the 2 hour delivery">
          <div className="checkbox-row" style={{ height: 38 }}>
            <input
              id="two-on"
              type="checkbox"
              checked={twoHour.enabled}
              onChange={(e) => setTwoHour({ ...twoHour, enabled: e.target.checked })}
            />
            <label htmlFor="two-on" style={{ marginBottom: 0 }}>
              Charge extra for 2 hour delivery
            </label>
          </div>
        </Field>
        <Field label="Extra amount (₹)">
          <input type="number" min={0} value={twoHour.amount} disabled={!twoHour.enabled} onChange={(e) => setTwoHour({ ...twoHour, amount: num(e.target.value) })} />
        </Field>
      </div>

      <Field label="Customer care number (shown in the cart header)">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" maxLength={20} />
      </Field>

      <Field label="Google review link (customers are asked to rate us here after delivery)">
        <input value={google} onChange={(e) => setGoogle(e.target.value)} placeholder="https://g.page/r/…/review" maxLength={500} />
      </Field>

      <div className="modal-actions">
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save delivery times'}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------- distance-based pricing ------------------------ */

function PricingCard({ settings, onSave }: { settings: Settings; onSave: Save }) {
  const [p, setP] = useState(settings.pricing);
  const [busy, setBusy] = useState(false);
  const setBand = (i: number, patch: Partial<Settings['pricing']['bands'][number]>) =>
    setP((cur) => ({ ...cur, bands: cur.bands.map((b, j) => (i === j ? { ...b, ...patch } : b)) }));

  const submit = async () => {
    setBusy(true);
    await onSave({ pricing: p });
    setBusy(false);
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 18 }}>
      <h2 className="card-title">Distance-based delivery pricing</h2>
      <div className="page-subtitle" style={{ marginBottom: 14 }}>
        Each row is a distance from the warehouse. The customer must shop at least the <b>minimum</b>; delivery is free from the <b>free-above</b> amount,
        otherwise the <b>fee</b> is charged (shown struck-through when waived). A <b>handling fee</b> is always added. <b>Red order</b> sends the order to
        the rider highlighted in red; <b>next day</b> promises next-day delivery. Customers further than the last row get the long-distance rules below and
        their orders go only to riders marked “long distance”.
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Up to (km)</th>
              <th>Minimum shopping ₹</th>
              <th>Free delivery above ₹</th>
              <th>Delivery fee ₹</th>
              <th>Next day</th>
              <th>Red order</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {p.bands.map((b, i) => (
              <tr key={i}>
                <td><input type="number" min={1} value={b.upToKm} onChange={(e) => setBand(i, { upToKm: num(e.target.value) })} style={{ width: 80 }} /></td>
                <td><input type="number" min={0} value={b.minOrder} onChange={(e) => setBand(i, { minOrder: num(e.target.value) })} style={{ width: 100 }} /></td>
                <td><input type="number" min={0} value={b.freeAbove} onChange={(e) => setBand(i, { freeAbove: num(e.target.value) })} style={{ width: 100 }} /></td>
                <td><input type="number" min={0} value={b.fee} onChange={(e) => setBand(i, { fee: num(e.target.value) })} style={{ width: 80 }} /></td>
                <td><input type="checkbox" checked={b.nextDay} onChange={(e) => setBand(i, { nextDay: e.target.checked })} /></td>
                <td><input type="checkbox" checked={b.redOrder} onChange={(e) => setBand(i, { redOrder: e.target.checked })} /></td>
                <td>
                  <Button variant="ghost" size="sm" onClick={() => setP((cur) => ({ ...cur, bands: cur.bands.filter((_, j) => j !== i) }))} disabled={p.bands.length <= 1}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8 }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setP((cur) => {
              const last = cur.bands[cur.bands.length - 1];
              return { ...cur, bands: [...cur.bands, { ...last, upToKm: last.upToKm + 5 }] };
            })
          }
        >
          + Add distance row
        </Button>
      </div>

      <div className="field-row" style={{ marginTop: 14 }}>
        <Field label="Handling fee, always charged (₹)">
          <input type="number" min={0} value={p.handlingFee} onChange={(e) => setP({ ...p, handlingFee: num(e.target.value) })} />
        </Field>
        <Field label="Long distance: delivery in (days)">
          <input type="number" min={1} value={p.beyondDays} onChange={(e) => setP({ ...p, beyondDays: num(e.target.value) })} />
        </Field>
        <Field label="Long distance: minimum shopping (₹)">
          <input type="number" min={0} value={p.beyondMinOrder} onChange={(e) => setP({ ...p, beyondMinOrder: num(e.target.value) })} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Long distance: cash on delivery">
          <div className="checkbox-row" style={{ height: 38 }}>
            <input
              id="beyond-cod"
              type="checkbox"
              checked={p.beyondCodDisabled}
              onChange={(e) => setP({ ...p, beyondCodDisabled: e.target.checked })}
            />
            <label htmlFor="beyond-cod" style={{ marginBottom: 0 }}>
              Refuse COD past the last distance row
            </label>
          </div>
        </Field>
        <Field label="Message shown when COD is refused">
          <input
            value={p.beyondCodMessage}
            onChange={(e) => setP({ ...p, beyondCodMessage: e.target.value })}
            maxLength={200}
            placeholder='For long distance "COD" option is not available'
          />
        </Field>
      </div>
      <div className="page-subtitle">Beyond the last row, long-distance delivery time and minimum shopping apply. Payment options follow each product&apos;s COD / online setting.</div>
      <div className="modal-actions">
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save pricing'}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- cart points ------------------------------ */

function PointsCard({ settings, onSave }: { settings: Settings; onSave: Save }) {
  const [on, setOn] = useState(settings.cartPoints.enabled);
  const [target, setTarget] = useState(settings.cartPoints.target);
  const saved = settings.cartPoints.suggestions.map((x) => (typeof x === 'string' ? { _id: x, name: x.slice(-6), unit: '' } : x));
  const [ids, setIds] = useState<string[]>(saved.map((x) => x._id));
  const [names, setNames] = useState<Record<string, string>>(
    Object.fromEntries(saved.map((x) => [x._id, x.unit ? `${x.name} (${x.unit})` : x.name])),
  );
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.trim()) return setFound([]);
    const t = setTimeout(() => fetchProducts({ q, limit: 8 }).then((r) => setFound(r.items)).catch(() => undefined), 250);
    return () => clearTimeout(t);
  }, [q]);

  const submit = async () => {
    setBusy(true);
    await onSave({ cartPoints: { enabled: on, target, suggestions: ids } });
    setBusy(false);
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 18 }}>
      <h2 className="card-title">Cart points</h2>
      <div className="page-subtitle" style={{ marginBottom: 14 }}>
        Each product size has a hidden point value (set it on the product, 0–50). Customers never see points. Checkout opens once the basket reaches the target.
        If it falls short, the products below are shown above “Proceed to payment” and one that closes the gap is added for the customer.
        Leave this off until points are set on your products, otherwise no one could check out.
      </div>
      <div className="field-row">
        <Field label="Rule">
          <div className="checkbox-row" style={{ height: 38 }}>
            <input id="pts-on" type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
            <label htmlFor="pts-on" style={{ marginBottom: 0 }}>
              Require the target before checkout
            </label>
          </div>
        </Field>
        <Field label="Target points">
          <input type="number" min={1} value={target} onChange={(e) => setTarget(num(e.target.value))} />
        </Field>
      </div>

      <div className="stat-label" style={{ margin: '10px 0 6px' }}>
        Top-up products ({ids.length})
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a product to add" style={{ width: '100%' }} />
      {found.length > 0 && (
        <div className="card" style={{ marginTop: 6 }}>
          {found.map((p) => (
            <div key={p._id} className="row-flex" style={{ padding: '6px 10px' }}>
              <span style={{ flex: 1 }}>
                {p.name} <span className="cell-muted">{p.unit} · {p.points ?? 0} pts</span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={ids.includes(p._id)}
                onClick={() => {
                  setIds((cur) => [...cur, p._id]);
                  setNames((n) => ({ ...n, [p._id]: `${p.name} (${p.unit})` }));
                }}
              >
                {ids.includes(p._id) ? 'Added' : 'Add'}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        {ids.map((id) => (
          <span key={id} className="badge badge-muted" style={{ marginRight: 6, marginBottom: 6, display: 'inline-flex', gap: 6 }}>
            {names[id] ?? id.slice(-6)}
            <button type="button" onClick={() => setIds((cur) => cur.filter((x) => x !== id))} aria-label="Remove" style={{ border: 0, background: 'none', cursor: 'pointer' }}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="modal-actions">
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save cart points'}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------- filters -------------------------------- */

const KIND_LABEL: Record<string, string> = {
  brand: 'Brand list',
  price: 'Price range',
  discount: 'Discount',
  rating: 'Customer rating',
  diet: 'Veg / Non-veg',
  stock: 'In stock only',
};

function FiltersCard({ settings, onSave }: { settings: Settings; onSave: Save }) {
  const [filters, setFilters] = useState(settings.filters);
  const [sortOn, setSortOn] = useState(settings.priceSortEnabled);
  const [busy, setBusy] = useState(false);

  const move = (i: number, d: -1 | 1) =>
    setFilters((cur) => {
      const next = [...cur];
      const j = i + d;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async () => {
    setBusy(true);
    await onSave({ filters, priceSortEnabled: sortOn });
    setBusy(false);
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 18 }}>
      <h2 className="card-title">Listing filters</h2>
      <div className="page-subtitle" style={{ marginBottom: 14 }}>
        The filters on category and search pages (across the top and down the left). Rename them, change their order, hide any, or add another of a kind.
        The “Low to high / High to low” price section sits apart with its on/off switch.
      </div>
      {filters.map((f, i) => (
        <div key={i} className="row-flex" style={{ marginBottom: 8 }}>
          <input
            value={f.label}
            maxLength={30}
            onChange={(e) => setFilters((cur) => cur.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)))}
            style={{ flex: 1 }}
          />
          <span className="cell-muted" style={{ width: 130 }}>{KIND_LABEL[f.kind]}</span>
          <label className="checkbox-row">
            <input type="checkbox" checked={f.enabled} onChange={(e) => setFilters((cur) => cur.map((x, j) => (i === j ? { ...x, enabled: e.target.checked } : x)))} />
            <span>Show</span>
          </label>
          <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
          <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === filters.length - 1}>↓</Button>
          <Button variant="ghost" size="sm" onClick={() => setFilters((cur) => cur.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <div className="row-flex" style={{ marginTop: 6 }}>
        {(['brand', 'price', 'discount', 'rating', 'diet', 'stock'] as const).map((kind) => (
          <Button
            key={kind}
            variant="secondary"
            size="sm"
            onClick={() => setFilters((cur) => [...cur, { key: `${kind}-${cur.length + 1}`, label: KIND_LABEL[kind], kind, enabled: true }])}
          >
            + {KIND_LABEL[kind]}
          </Button>
        ))}
      </div>
      <div className="checkbox-row" style={{ marginTop: 14 }}>
        <input id="sort-on" type="checkbox" checked={sortOn} onChange={(e) => setSortOn(e.target.checked)} />
        <label htmlFor="sort-on" style={{ marginBottom: 0 }}>
          Show the “Low to high / High to low” price section
        </label>
      </div>
      <div className="modal-actions">
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save filters'}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ ways to pay (#36) ----------------------------- */

const PAY_DEFAULTS: NonNullable<Settings['paymentOptions']> = [
  { key: 'upi', label: 'UPI ID / UPI scanner', note: 'PhonePe, Google Pay, Paytm, BHIM, CRED UPI or any UPI app / scanner - free', enabled: true, pct: 0 },
  { key: 'cod', label: 'Cash on delivery', note: 'Free', enabled: true, pct: 0 },
  { key: 'debit', label: 'Debit card', enabled: true, pct: 0.4, highPct: 0.9, highFrom: 2000 },
  { key: 'netbanking', label: 'Net banking', enabled: true, pct: 1.8 },
  { key: 'credit', label: 'Credit card', enabled: true, pct: 2 },
  { key: 'rupay', label: 'RuPay debit card', note: 'Free', enabled: true, pct: 0 },
];

function PaymentOptionsCard({ settings, onSave }: { settings: Settings; onSave: Save }) {
  const [rows, setRows] = useState(() => PAY_DEFAULTS.map((d) => ({ ...d, ...(settings.paymentOptions?.find((s) => s.key === d.key) ?? {}) })));
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((cur) => cur.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  const num = (v: string) => (v === '' ? undefined : Number(v));

  const submit = async () => {
    setBusy(true);
    await onSave({
      paymentOptions: rows.map((r) => ({
        ...r,
        note: r.note || undefined,
        highPct: r.highPct === undefined || Number.isNaN(r.highPct) ? undefined : r.highPct,
        highFrom: r.highFrom === undefined || Number.isNaN(r.highFrom) ? undefined : r.highFrom,
      })),
    });
    setBusy(false);
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 18 }}>
      <h2 className="card-title">Ways to pay &amp; their charges</h2>
      <div className="page-subtitle" style={{ marginBottom: 14 }}>
        The six choices at checkout. The charge is a percent of the customer’s whole bill and is added to it as its own line (for example “Debit card
        charges ₹4”). “Higher %” replaces the normal percent once the bill reaches “from ₹” (debit card: 0.40% up to ₹1999, 0.90% from ₹2000).
        Online choices need Razorpay switched on under Login &amp; Payments.
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Show</th>
              <th>Name</th>
              <th>Message when picked</th>
              <th>Charge %</th>
              <th>Higher %</th>
              <th>From ₹</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td>
                  <input type="checkbox" checked={r.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} />
                </td>
                <td>
                  <input value={r.label} maxLength={40} onChange={(e) => set(i, { label: e.target.value })} />
                </td>
                <td>
                  <input value={r.note ?? ''} maxLength={200} placeholder="Free" onChange={(e) => set(i, { note: e.target.value })} />
                </td>
                <td>
                  <input type="number" step="0.01" min={0} max={10} value={r.pct} onChange={(e) => set(i, { pct: Number(e.target.value) || 0 })} style={{ width: 80 }} />
                </td>
                <td>
                  <input type="number" step="0.01" min={0} max={10} value={r.highPct ?? ''} onChange={(e) => set(i, { highPct: num(e.target.value) })} style={{ width: 80 }} />
                </td>
                <td>
                  <input type="number" min={0} value={r.highFrom ?? ''} onChange={(e) => set(i, { highFrom: num(e.target.value) })} style={{ width: 100 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="modal-actions">
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save ways to pay'}
        </Button>
      </div>
    </div>
  );
}
