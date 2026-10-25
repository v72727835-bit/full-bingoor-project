import React, { useEffect, useState } from 'react';
import { createSeller, fetchSellers, fetchShops, setSellerActive } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal, Pagination, formatDate } from '../components/ui';
import { SellerRow, Shop } from '../types';

/**
 * #45: product sellers. The admin makes each seller a login (phone or email +
 * password, every one unique) and sends it to them. A product seller lists
 * products into the chosen warehouses and sees only their own sales: product
 * name, quantity and payment - never the customer's name, phone or address.
 * They log in at the same panel as warehouses.
 */
export default function ProductSellersPage() {
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [made, setMade] = useState<{ name: string; login: string; password: string; sellerId?: string } | null>(null);

  const load = () => {
    setLoading(true);
    fetchSellers({ page, limit: 25, q: q.trim() || undefined, kind: 'product' })
      .then((r) => {
        setRows(r.items);
        setPages(r.meta?.totalPages ?? 1);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [page]);

  const toggle = async (row: SellerRow) => {
    try {
      await setSellerActive(row._id, !row.isActive);
      setRows((cur) => cur.map((r) => (r._id === row._id ? { ...r, isActive: !r.isActive } : r)));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Product sellers</h1>
          <div className="page-subtitle">Make a login for each seller. They list products and see only product name, quantity and payment of their sales.</div>
        </div>
        <Button onClick={() => setAdding(true)}>+ New seller login</Button>
      </div>

      <form
        className="row-flex"
        style={{ marginBottom: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
      >
        <input placeholder="Search name, phone or seller id" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <Button variant="secondary" type="submit">
          Search
        </Button>
      </form>

      <ErrorBanner message={error} />
      {loading ? (
        <CenterSpinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">No product sellers yet. Press “New seller login” to make the first one.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Login</th>
                  <th>Warehouses</th>
                  <th>Listings</th>
                  <th>Since</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div style={{ fontWeight: 650 }}>{r.name}</div>
                      <div className="cell-muted">{r.sellerId ?? ''}</div>
                    </td>
                    <td>
                      <div>{r.phone}</div>
                      {r.email ? <div className="cell-muted">{r.email}</div> : null}
                    </td>
                    <td>{(r.sellerWarehouses ?? []).map((w) => w.name).join(', ') || '—'}</td>
                    <td>{r.listings ?? 0}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      <Badge tone={r.isActive ? 'success' : 'danger'}>{r.isActive ? 'Active' : 'Blocked'}</Badge>
                    </td>
                    <td>
                      <Button size="sm" variant={r.isActive ? 'secondary' : 'primary'} onClick={() => toggle(r)}>
                        {r.isActive ? 'Block' : 'Unblock'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={pages} onChange={setPage} />
        </div>
      )}

      {adding ? (
        <NewSellerModal
          onClose={() => setAdding(false)}
          onMade={(m) => {
            setAdding(false);
            setMade(m);
            setPage(1);
            load();
          }}
        />
      ) : null}

      {made ? (
        <Modal title="Seller login created" onClose={() => setMade(null)}>
          <p style={{ marginTop: 0 }}>Send these details to {made.name}. The password is not shown again.</p>
          <div className="card" style={{ padding: 14, fontFamily: 'monospace', lineHeight: 1.8 }}>
            Login: {made.login}
            <br />
            Password: {made.password}
            {made.sellerId ? (
              <>
                <br />
                Seller id: {made.sellerId}
              </>
            ) : null}
            <br />
            Panel: {window.location.origin}
          </div>
          <div className="row-flex" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(`Bingoor seller login\nLogin: ${made.login}\nPassword: ${made.password}\nPanel: ${window.location.origin}`)
                  .catch(() => undefined)
              }
            >
              Copy
            </Button>
            <Button onClick={() => setMade(null)}>Done</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function NewSellerModal({ onClose, onMade }: { onClose: () => void; onMade: (m: { name: string; login: string; password: string; sellerId?: string }) => void }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [f, setF] = useState({ name: '', phone: '', email: '', password: makePassword() });
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchShops({ page: 1, limit: 200 })
      .then((r) => {
        setShops(r.items);
        if (r.items.length === 1) setWarehouses([r.items[0]._id]);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const save = async () => {
    setError('');
    if (!warehouses.length) return setError('Choose at least one warehouse where this seller’s products are kept.');
    setBusy(true);
    try {
      const res = (await createSeller({ ...f, email: f.email || undefined, warehouses, kind: 'product' })) as { sellerId?: string };
      onMade({ name: f.name, login: f.phone, password: f.password, sellerId: res?.sellerId });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  return (
    <Modal title="New product seller login" onClose={onClose}>
      <ErrorBanner message={error} />
      <Field label="Seller / firm name">
        <input value={f.name} onChange={set('name')} />
      </Field>
      <Field label="Mobile number (this is the login)">
        <input value={f.phone} onChange={set('phone')} inputMode="numeric" maxLength={13} />
      </Field>
      <Field label="Email (optional, can also be used to log in)">
        <input value={f.email} onChange={set('email')} type="email" />
      </Field>
      <Field label="Password">
        <div className="row-flex">
          <input value={f.password} onChange={set('password')} />
          <Button variant="secondary" type="button" onClick={() => setF((cur) => ({ ...cur, password: makePassword() }))}>
            New
          </Button>
        </div>
      </Field>
      <Field label="Warehouses where their products are kept">
        <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflow: 'auto' }}>
          {shops.map((s) => (
            <label key={s._id} className="checkbox-row" style={{ marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={warehouses.includes(s._id)}
                onChange={(e) => setWarehouses((cur) => (e.target.checked ? [...cur, s._id] : cur.filter((x) => x !== s._id)))}
              />
              {s.name}
            </label>
          ))}
        </div>
      </Field>
      <div className="row-flex" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || f.name.trim().length < 2 || !f.phone.trim() || f.password.length < 8}>
          {busy ? 'Creating…' : 'Create login'}
        </Button>
      </div>
    </Modal>
  );
}

/** A readable 10-character password (no look-alike letters). */
function makePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
