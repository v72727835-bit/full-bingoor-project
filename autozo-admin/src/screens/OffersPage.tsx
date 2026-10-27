import React, { useEffect, useState } from 'react';
import { useSearchParams } from '../navigation';
import { createCoupon, deleteCoupon, fetchCoupons, fetchAllShops, updateCoupon } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconPlus, IconTag } from '../components/icons';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal, Pagination, Tone, money } from '../components/ui';
import { Coupon, PageMeta, Shop } from '../types';

const dateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

function couponState(c: Coupon): { label: string; tone: Tone } {
  if (!c.isActive) return { label: 'Paused', tone: 'muted' };
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { label: 'Expired', tone: 'danger' };
  if (c.startsAt && new Date(c.startsAt) > new Date()) return { label: 'Scheduled', tone: 'info' };
  if (c.usageLimit > 0 && c.usedCount >= c.usageLimit) return { label: 'Used up', tone: 'warn' };
  return { label: 'Running', tone: 'success' };
}

export default function OffersPage() {
  const [params, setParams] = useSearchParams();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [showForm, setShowForm] = useState(!!params.get('new'));
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    fetchAllShops()
      .then((items) => setShops(items))
      .catch(() => undefined);
  }, []);

  const load = () => {
    setLoading(true);
    fetchCoupons({ page, limit: 20, q: q || undefined })
      .then(({ items, meta }) => {
        setCoupons(items);
        setMeta(meta);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page]);

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await deleteCoupon(c._id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const toggle = async (c: Coupon) => {
    try {
      const updated = await updateCoupon(c._id, { isActive: !c.isActive });
      setCoupons((list) => list.map((x) => (x._id === c._id ? { ...x, ...updated } : x)));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const close = () => {
    setShowForm(false);
    if (params.get('new')) setParams({}, { replace: true });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Offers & coupons</h1>
          <div className="page-subtitle">Discount codes customers can apply at checkout.</div>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <IconPlus size={15} /> New coupon
        </Button>
      </div>

      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
      >
        <input className="search-input" placeholder="Search by code…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <ErrorBanner message={error} />

      <div className="card">
        {loading ? (
          <div style={{ padding: 40 }}>
            <CenterSpinner />
          </div>
        ) : coupons.length === 0 ? (
          <div className="empty-state">No coupons yet. Create your first offer to get started.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Conditions</th>
                  <th>Used</th>
                  <th>Window</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const st = couponState(c);
                  return (
                    <tr key={c._id}>
                      <td>
                        <div className="row-flex">
                          <span className="qa-icon" style={{ width: 30, height: 30 }}>
                            <IconTag size={15} />
                          </span>
                          <div>
                            <div className="cell-name">{c.code}</div>
                            {c.description && <div className="cell-muted">{c.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="cell-name">
                        {c.discountType === 'percent' ? `${c.value}% off` : `${money(c.value)} off`}
                        {c.discountType === 'percent' && c.maxDiscount > 0 && (
                          <div className="cell-muted">max {money(c.maxDiscount)}</div>
                        )}
                      </td>
                      <td className="cell-muted">
                        {c.minOrderAmount > 0 ? `Min order ${money(c.minOrderAmount)}` : 'No minimum'}
                        <div>{c.perUserLimit > 0 ? `${c.perUserLimit}× per customer` : 'Unlimited per customer'}</div>
                      </td>
                      <td>
                        {c.usedCount}
                        {c.usageLimit > 0 && <span className="cell-muted"> / {c.usageLimit}</span>}
                      </td>
                      <td className="cell-muted">
                        {c.startsAt ? new Date(c.startsAt).toLocaleDateString('en-IN') : 'now'} →{' '}
                        {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN') : 'no end'}
                      </td>
                      <td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td>
                        <div className="row-flex">
                          <Button size="sm" variant="secondary" onClick={() => toggle(c)}>
                            {c.isActive ? 'Pause' : 'Resume'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(c);
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => remove(c)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}

      {showForm && (
        <CouponForm
          coupon={editing}
          shops={shops}
          onClose={close}
          onSaved={() => {
            close();
            load();
          }}
        />
      )}
    </>
  );
}

function CouponForm({
  coupon,
  shops,
  onClose,
  onSaved,
}: {
  coupon: Coupon | null;
  shops: Shop[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    discountType: coupon?.discountType ?? ('percent' as 'percent' | 'flat'),
    value: String(coupon?.value ?? 10),
    maxDiscount: String(coupon?.maxDiscount ?? 0),
    minOrderAmount: String(coupon?.minOrderAmount ?? 0),
    startsAt: dateInput(coupon?.startsAt),
    expiresAt: dateInput(coupon?.expiresAt),
    usageLimit: String(coupon?.usageLimit ?? 0),
    perUserLimit: String(coupon?.perUserLimit ?? 1),
    shop: coupon?.shops?.length ? (typeof coupon.shops[0] === 'string' ? coupon.shops[0] : coupon.shops[0]._id) : '',
    isActive: coupon?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        description: form.description || undefined,
        discountType: form.discountType,
        value: Number(form.value) || 0,
        maxDiscount: Number(form.maxDiscount) || 0,
        minOrderAmount: Number(form.minOrderAmount) || 0,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
        usageLimit: Number(form.usageLimit) || 0,
        perUserLimit: Number(form.perUserLimit) || 0,
        shops: form.shop ? [form.shop] : [],
        isActive: form.isActive,
      };
      if (coupon) await updateCoupon(coupon._id, body as Partial<Coupon>);
      else await createCoupon(body as Partial<Coupon>);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={coupon ? `Edit ${coupon.code}` : 'New coupon'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <ErrorBanner message={error} />
        <div className="field-row">
          <Field label="Code">
            <input
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="BINGOOR50"
              required
              autoFocus
            />
          </Field>
          <Field label="Type">
            <select value={form.discountType} onChange={(e) => set('discountType', e.target.value as 'percent' | 'flat')}>
              <option value="percent">Percent off</option>
              <option value="flat">Flat ₹ off</option>
            </select>
          </Field>
        </div>

        <Field label="Description (shown to the customer)">
          <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="₹50 off your first order" />
        </Field>

        <div className="field-row">
          <Field label={form.discountType === 'percent' ? 'Percent (%)' : 'Amount (₹)'}>
            <input type="number" min="0" value={form.value} onChange={(e) => set('value', e.target.value)} required />
          </Field>
          <Field label="Max discount (₹, 0 = no cap)">
            <input type="number" min="0" value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Minimum order (₹)">
            <input type="number" min="0" value={form.minOrderAmount} onChange={(e) => set('minOrderAmount', e.target.value)} />
          </Field>
          <Field label="Shop (blank = all shops)">
            <select value={form.shop} onChange={(e) => set('shop', e.target.value)}>
              <option value="">All shops</option>
              {shops.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="field-row">
          <Field label="Starts on">
            <input type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </Field>
          <Field label="Expires on">
            <input type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Total uses (0 = unlimited)">
            <input type="number" min="0" value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} />
          </Field>
          <Field label="Uses per customer (0 = unlimited)">
            <input type="number" min="0" value={form.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} />
          </Field>
        </div>

        <div className="checkbox-row">
          <input type="checkbox" id="coupon-active" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          <label htmlFor="coupon-active">Live right now</label>
        </div>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
