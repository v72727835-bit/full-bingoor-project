"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sellerCategories, sellerCreateRider, sellerCustomers, sellerRiders, WarehouseCustomer, WarehouseRider } from '../api/admin';
import { getErrorMessage } from '../api/client';
import WarehouseChecks from '../components/WarehouseChecks';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal, Pagination, formatDate, money } from '../components/ui';
import { PageMeta } from '../types';
import type { Cat } from './Products';
import type { Wh } from './SellerApp';

/* ---------------------------------- riders --------------------------------- */

export function RidersView({ warehouses }: { warehouses: Wh[] }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Riders</h1>
          <div className="page-subtitle">Your delivery partners. They sign in to the rider app with the phone and password you create here.</div>
        </div>
      </div>
      <RidersInner warehouses={warehouses} />
    </>
  );
}

function RidersInner({ warehouses }: { warehouses: Wh[] }) {
  const [rows, setRows] = useState<WarehouseRider[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({ name: '', phone: '', password: '', warehouses: [] as string[] });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    sellerRiders().then(setRows).catch((e) => setError(getErrorMessage(e)));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const gen = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    setF((cur) => ({ ...cur, password: [...bytes].map((b) => chars[b % chars.length]).join('') + '@7' }));
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (warehouses.length > 1 && f.warehouses.length === 0) {
      setError('Choose at least one warehouse.');
      return;
    }
    setBusy(true);
    try {
      await sellerCreateRider({ ...f, warehouses: f.warehouses.length ? f.warehouses : undefined });
      window.alert(`Rider created.\n\nRider app login (phone): ${f.phone}\nPassword: ${f.password}\n\nShare it with the rider now - the password cannot be shown again.`);
      setAdding(false);
      setF({ name: '', phone: '', password: '', warehouses: [] });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="row-flex" style={{ padding: 14, justifyContent: 'space-between' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Your riders</h2>
        <Button size="sm" onClick={() => setAdding(true)}>+ New rider</Button>
      </div>
      <ErrorBanner message={error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rider</th>
              <th>Status</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} className="empty-state">No riders yet. Add one - they sign in to the rider app with this phone and password.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="cell-name">
                  <span className={`dot${r.online ? ' dot-on' : ''}`} /> {r.name}
                  <div className="cell-muted">{r.phone}</div>
                </td>
                <td>
                  {r.paused ? <Badge tone="danger">Paused</Badge> : r.busy ? <Badge tone="brand">On a delivery</Badge> : r.online ? <Badge tone="success">Free</Badge> : <Badge tone="muted">Offline</Badge>}
                </td>
                <td className="cell-muted">{r.lastSeenAt ? formatDate(r.lastSeenAt) : 'Logged out'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && (
        <Modal title="New rider" onClose={() => setAdding(false)}>
          <form onSubmit={save}>
            <Field label="Rider name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
            <Field label="Phone number (rider app login)"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="numeric" required /></Field>
            <Field label="Password (at least 8 characters)">
              <div className="row-flex">
                <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required style={{ flex: 1 }} />
                <Button type="button" variant="secondary" onClick={gen}>Generate</Button>
              </div>
            </Field>
            {warehouses.length > 1 && (
              <Field label="Warehouses (tick one or more)">
                <WarehouseChecks options={warehouses} value={f.warehouses} onChange={(w) => setF({ ...f, warehouses: w })} />
              </Field>
            )}
            <ErrorBanner message={error} />
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create rider'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}


/* -------------------------------- categories -------------------------------- */

export function CategoriesView() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    sellerCategories().then(setCats).catch((e) => setError(getErrorMessage(e)));
  }, []);
  const kids = useMemo(() => {
    const m = new Map<string, Cat[]>();
    (cats ?? []).forEach((c) => m.set(c.parent ?? '', [...(m.get(c.parent ?? '') ?? []), c]));
    return m;
  }, [cats]);
  if (!cats) return error ? <ErrorBanner message={error} /> : <CenterSpinner />;

  const node = (c: Cat, depth: number): React.ReactNode => {
    const children = kids.get(c._id) ?? [];
    return (
      <div key={c._id} style={{ marginLeft: depth * 20 }}>
        <div className="row-flex" style={{ padding: '6px 0' }}>
          {children.length > 0 ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen({ ...open, [c._id]: !open[c._id] })}>{open[c._id] ? '▾' : '▸'}</button>
          ) : (
            <span style={{ width: 34 }} />
          )}
          <b>{c.name}</b>
          {c.nameHi && <span className="cell-muted">{c.nameHi}</span>}
          <Badge tone="muted">{c.level === 1 ? 'Main' : c.level === 2 ? 'Sub' : 'Child'}</Badge>
        </div>
        {open[c._id] && children.map((k) => node(k, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <div className="page-subtitle">The category tree you list products under: main, then sub, then child. Need a new category? Ask Bingoor support to add it.</div>
        </div>
      </div>
      <div className="card card-pad">{(kids.get('') ?? []).map((c) => node(c, 0))}</div>
    </>
  );
}

/* --------------------------------- customers -------------------------------- */

export function CustomersView() {
  const [rows, setRows] = useState<WarehouseCustomer[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    sellerCustomers({ page, limit: 20, q: query || undefined })
      .then((r) => { setRows(r.items); setMeta(r.meta as PageMeta); })
      .catch((e) => setError(getErrorMessage(e)));
  }, [page, query]);
  useEffect(load, [load]);
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <div className="page-subtitle">People who have ordered from your warehouse.</div>
        </div>
        <form className="row-flex" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" style={{ width: 200 }} />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>
      <ErrorBanner message={error} />
      {!rows ? (
        <CenterSpinner />
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Orders</th><th>Spent</th><th>Last order</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={4} className="empty-state">No customers yet.</td></tr>}
                {rows.map((c) => (
                  <tr key={c._id}>
                    <td className="cell-name">{c.name}<div className="cell-muted">{c.phone}</div></td>
                    <td>{c.orders}</td>
                    <td>{money(c.spent)}</td>
                    <td className="cell-muted">{formatDate(c.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}
    </>
  );
}
