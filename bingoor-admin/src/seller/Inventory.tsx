"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { sellerProducts, sellerUpdateProduct } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Pagination, Tabs, Thumb } from '../components/ui';
import { PageMeta, Product } from '../types';

/** Quick stock keeping: change a number and press Save, or mark an item out of stock. */
export default function Inventory() {
  const [rows, setRows] = useState<Product[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [status, setStatus] = useState('low');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    sellerProducts({ page, limit: 20, status: status || undefined })
      .then((r) => { setRows(r.items); setMeta(r.meta as PageMeta); setDraft({}); })
      .catch((e) => setError(getErrorMessage(e)));
  }, [page, status]);
  useEffect(load, [load]);

  const save = async (p: Product, stock: number) => {
    setBusy(p._id);
    setError('');
    try {
      await sellerUpdateProduct(p._id, { stock });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <div className="page-subtitle">Keep stock numbers right so customers never order what you do not have. Five or fewer counts as low.</div>
        </div>
      </div>
      <Tabs
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
        options={[{ value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }, { value: 'live', label: 'In stock' }, { value: '', label: 'All' }]}
      />
      <ErrorBanner message={error} />
      {!rows ? (
        <CenterSpinner />
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Product</th><th>Stock</th><th /></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={3} className="empty-state">Nothing here.</td></tr>}
                {rows.map((p) => {
                  const value = draft[p._id] ?? String(p.stock);
                  const changed = value !== String(p.stock);
                  return (
                    <tr key={p._id}>
                      <td className="cell-name">
                        <div className="row-flex">
                          <Thumb src={p.images?.[0]} />
                          <div>{p.name}<div className="cell-muted">{p.unit}</div></div>
                        </div>
                      </td>
                      <td>
                        <div className="row-flex">
                          <input type="number" min={0} value={value} onChange={(e) => setDraft({ ...draft, [p._id]: e.target.value })} style={{ width: 90 }} />
                          {p.stock <= 0 ? <Badge tone="danger">Out</Badge> : p.stock <= 5 ? <Badge tone="warn">Low</Badge> : null}
                        </div>
                      </td>
                      <td>
                        <div className="row-flex">
                          <Button size="sm" disabled={!changed || busy === p._id} onClick={() => save(p, Math.max(0, Math.floor(Number(value) || 0)))}>Save</Button>
                          {p.stock > 0 && <Button size="sm" variant="ghost" disabled={busy === p._id} onClick={() => save(p, 0)}>Mark out of stock</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}
    </>
  );
}
