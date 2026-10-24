import React, { useEffect, useState } from 'react';
import { fetchProducts, fetchShops, updateProduct } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconAlert, IconBox, IconCheck } from '../components/icons';
import {
  Badge,
  Button,
  CenterSpinner,
  ErrorBanner,
  Pagination,
  StatCard,
  Tabs,
  Thumb,
  money,
} from '../components/ui';
import { PageMeta, Product, Shop } from '../types';

type View = 'critical' | 'low' | 'out' | 'all';

const LOW_AT = 5;
const CRITICAL_AT = 2;

/** Stock desk: see what is running out and top it up without opening each product. */
export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>('critical');
  const [shop, setShop] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchShops({ page: 1, limit: 100 })
      .then(({ items }) => setShops(items))
      .catch(() => undefined);
  }, []);

  const load = () => {
    setLoading(true);
    // the list endpoint has no stock filter, so pull a wide page and slice here
    fetchProducts({ page, limit: view === 'all' ? 20 : 50, q: q || undefined, shop: shop || undefined })
      .then(({ items, meta }) => {
        const filtered =
          view === 'all'
            ? items
            : items
                .filter((p) =>
                  view === 'out' ? p.stock === 0 : view === 'critical' ? p.stock <= CRITICAL_AT : p.stock <= LOW_AT,
                )
                .sort((a, b) => a.stock - b.stock);
        setProducts(filtered);
        setMeta(meta);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, view, shop]);

  const save = async (p: Product) => {
    const next = Number(draft[p._id]);
    if (Number.isNaN(next) || next < 0 || next === p.stock) return;
    setSavingId(p._id);
    setError('');
    try {
      await updateProduct(p._id, { stock: next });
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, stock: next } : x)));
      setDraft((d) => ({ ...d, [p._id]: '' }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const bump = async (p: Product, by: number) => {
    const next = Math.max(0, p.stock + by);
    setSavingId(p._id);
    try {
      await updateProduct(p._id, { stock: next });
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, stock: next } : x)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const outCount = products.filter((p) => p.stock === 0).length;
  const critCount = products.filter((p) => p.stock > 0 && p.stock <= CRITICAL_AT).length;
  const lowCount = products.filter((p) => p.stock > CRITICAL_AT && p.stock <= LOW_AT).length;
  const stockValue = products.reduce((s, p) => s + p.stock * p.price, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <div className="page-subtitle">Review low and out-of-stock items, and update stock levels directly from this list.</div>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard label="Out of stock" value={String(outCount)} icon={<IconAlert size={19} />} tone="var(--danger)" toneSoft="var(--danger-soft)" hint="Not sellable right now" />
        <StatCard label="Critical (≤2)" value={String(critCount)} icon={<IconAlert size={19} />} tone="var(--brand)" toneSoft="var(--brand-soft)" hint="Restock today" />
        <StatCard label="Low (≤5)" value={String(lowCount)} icon={<IconBox size={19} />} tone="var(--warn)" toneSoft="var(--warn-soft)" hint="Keep an eye on these" />
        <StatCard label="Stock value shown" value={money(stockValue)} icon={<IconCheck size={19} />} tone="var(--ok)" toneSoft="var(--ok-soft)" hint="Selling price × units" />
      </div>

      <div className="toolbar">
        <Tabs
          value={view}
          onChange={(v) => {
            setView(v);
            setPage(1);
          }}
          options={[
            { value: 'critical', label: 'Critical' },
            { value: 'low', label: 'Low stock' },
            { value: 'out', label: 'Out of stock' },
            { value: 'all', label: 'All products' },
          ]}
        />
        <select value={shop} onChange={(e) => setShop(e.target.value)} style={{ width: 190 }}>
          <option value="">All shops</option>
          {shops.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        <form
          className="toolbar"
          style={{ margin: 0, flex: 1 }}
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
        >
          <input className="search-input" placeholder="Search product…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <ErrorBanner message={error} />

      <div className="card">
        {loading ? (
          <div style={{ padding: 40 }}>
            <CenterSpinner />
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">No items in this group. Stock levels are healthy.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Shop</th>
                  <th>Price</th>
                  <th>In stock</th>
                  <th>Status</th>
                  <th style={{ width: 250 }}>Restock</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div className="row-flex">
                        <Thumb src={p.images?.[0]} />
                        <div>
                          <div className="cell-name">{p.name}</div>
                          <div className="cell-muted">
                            {p.brand ? `${p.brand} · ` : ''}
                            {p.unit}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="cell-muted">{typeof p.shop === 'string' ? '—' : p.shop.name}</td>
                    <td>{money(p.price)}</td>
                    <td className="cell-name">{p.stock}</td>
                    <td>
                      <Badge tone={p.stock === 0 ? 'danger' : p.stock <= CRITICAL_AT ? 'danger' : p.stock <= LOW_AT ? 'warn' : 'success'}>
                        {p.stock === 0 ? 'Out' : p.stock <= CRITICAL_AT ? 'Critical' : p.stock <= LOW_AT ? 'Low' : 'Healthy'}
                      </Badge>
                    </td>
                    <td>
                      <div className="row-flex">
                        <Button size="sm" variant="secondary" disabled={savingId === p._id} onClick={() => bump(p, 10)}>
                          +10
                        </Button>
                        <Button size="sm" variant="secondary" disabled={savingId === p._id} onClick={() => bump(p, 50)}>
                          +50
                        </Button>
                        <input
                          style={{ width: 78, height: 31, fontSize: 12.5 }}
                          type="number"
                          min={0}
                          placeholder="set"
                          value={draft[p._id] ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, [p._id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && save(p)}
                        />
                        <Button size="sm" disabled={savingId === p._id || !draft[p._id]} onClick={() => save(p)}>
                          Save
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

      {meta && view === 'all' && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}
    </>
  );
}
