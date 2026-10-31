"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RichTextField from '../components/RichTextField';
import BulkUpload from '../components/BulkUpload';
import ProductVideoField from '../components/ProductVideoField';
import { sellerBulkProducts, sellerUploadVideo, sellerCategories, sellerCreateProduct, sellerDeleteProduct, sellerProducts, sellerUpdateProduct, sellerUploadImages } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconPlus } from '../components/icons';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal, Pagination, Tabs, Thumb, money } from '../components/ui';
import { PageMeta, Product } from '../types';
import type { Wh } from './SellerApp';

export type Cat = { _id: string; name: string; nameHi?: string; parent: string | null; level: 1 | 2 | 3 };

const FILTERS = [
  ['', 'All'],
  ['live', 'Live'],
  ['low', 'Low stock'],
  ['out', 'Out of stock'],
  ['off', 'Off shelf'],
] as const;

export default function Products({ warehouses }: { warehouses: Wh[] }) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [rows, setRows] = useState<Product[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    sellerProducts({ page, limit: 20, status: status || undefined, q: query || undefined })
      .then((r) => { setRows(r.items); setMeta(r.meta as PageMeta); })
      .catch((e) => setError(getErrorMessage(e)));
  }, [page, status, query]);
  useEffect(load, [load]);
  useEffect(() => {
    sellerCategories().then(setCats).catch((e) => setError(getErrorMessage(e)));
  }, []);

  const patch = async (p: Product, body: Record<string, unknown>) => {
    try {
      await sellerUpdateProduct(p._id, body);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <div className="page-subtitle">Everything stocked in your warehouse. Add new products, edit prices and photos, or take items off the shelf.</div>
        </div>
        <div className="row-flex" style={{ gap: 8 }}>
          <Button variant="secondary" onClick={() => setShowBulk(true)}>Bulk upload</Button>
          <Button onClick={() => setEditing('new')}><IconPlus size={15} /> Add product</Button>
        </div>
      </div>
      {showBulk && (
        <BulkUpload
          mode="seller"
          categories={cats.filter((c) => c.level === 3).map((c) => ({ name: c.name, parent: cats.find((x) => x._id === c.parent)?.name }))}
          shops={warehouses.map((w) => w.name)}
          send={sellerBulkProducts}
          onClose={() => setShowBulk(false)}
          onDone={load}
        />
      )}
      <div className="row-flex" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={FILTERS.map(([value, label]) => ({ value, label }))} />
        <form className="row-flex" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or brand" style={{ width: 220 }} />
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
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={5} className="empty-state">No products here yet.</td></tr>}
                {rows.map((p) => (
                  <tr key={p._id}>
                    <td className="cell-name">
                      <div className="row-flex">
                        <Thumb src={p.images?.[0]} />
                        <div>
                          {p.name}
                          <div className="cell-muted">
                            {p.unit}{p.brand ? ` · ${p.brand}` : ''} · {typeof p.category === 'object' ? p.category.name : ''}
                            {warehouses.length > 1 && typeof p.shop === 'object' ? ` · ${p.shop.name}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {money(p.price)}
                      {p.mrp > p.price && <div className="cell-muted"><s>{money(p.mrp)}</s></div>}
                    </td>
                    <td className="cell-muted">{p.stock}</td>
                    <td>
                      {!p.isActive ? <Badge tone="muted">Off shelf</Badge> : p.stock <= 0 ? <Badge tone="danger">Out of stock</Badge> : p.stock <= 5 ? <Badge tone="warn">Low stock</Badge> : <Badge tone="success">Live</Badge>}
                    </td>
                    <td>
                      <div className="row-flex">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => patch(p, { isActive: !p.isActive })}>{p.isActive ? 'Take off' : 'Put live'}</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.confirm(`Delete “${p.name}” for good?`) && sellerDeleteProduct(p._id).then(load).catch((e) => setError(getErrorMessage(e)))}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}
      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          cats={cats}
          warehouses={warehouses}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

const csv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);

/** The full product form: category path, names, prices, stock, photos, food type, tags and size group. */
function ProductForm({ product, cats, warehouses, onClose, onSaved }: { product: Product | null; cats: Cat[]; warehouses: Wh[]; onClose: () => void; onSaved: () => void }) {
  const byId = useMemo(() => new Map(cats.map((c) => [c._id, c])), [cats]);
  const initialChild = product ? (typeof product.category === 'object' ? product.category._id : product.category) : '';
  const initialSub = byId.get(initialChild)?.parent ?? '';
  const initialMain = byId.get(initialSub)?.parent ?? '';
  const [main, setMain] = useState(initialMain);
  const [sub, setSub] = useState(initialSub);
  const [child, setChild] = useState(initialChild);
  const [warehouse, setWarehouse] = useState('');
  const [f, setF] = useState({
    name: product?.name ?? '', nameHi: product?.nameHi ?? '', brand: product?.brand ?? '', description: product?.description ?? '',
    price: product ? String(product.price) : '', mrp: product ? String(product.mrp) : '', unit: product?.unit ?? '1 pc', stock: product ? String(product.stock) : '0',
    foodType: (product?.foodType ?? '') as '' | 'veg' | 'nonveg',
    paymentMode: product?.paymentMode ?? 'both', hsn: product?.hsn ?? '', gstRate: product?.gstRate === undefined || product?.gstRate === null ? '' : String(product.gstRate),
    attributes: (product?.attributes ?? []).join(', '), tags: (product?.tags ?? []).join(', '),
    variantGroup: product?.variantGroup ?? '', variantLabel: product?.variantLabel ?? '',
  });
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [video, setVideo] = useState(product?.video ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const mains = useMemo(() => cats.filter((c) => c.level === 1), [cats]);
  const subs = useMemo(() => cats.filter((c) => c.parent === main), [cats, main]);
  const children = useMemo(() => cats.filter((c) => c.parent === sub), [cats, sub]);
  const price = Number(f.price);
  const mrp = Number(f.mrp) || price;
  const off = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const set = (k: keyof typeof f, v: string) => setF((cur) => ({ ...cur, [k]: v }));

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    if (files.some((x) => x.size > 200 * 1024)) return setError('Each image must be 200 KB or smaller. Reduce it with a free tool (for example the “pi7 image tool” site) and upload again.');
    setUploading(true);
    setError('');
    try {
      const urls = await sellerUploadImages(files);
      setImages((cur) => [...cur, ...urls].slice(0, 6));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!child) return setError('Choose the main, sub and child category first.');
    if (!product && warehouses.length > 1 && !warehouse) return setError('Choose the warehouse this product is stocked in.');
    if (mrp < price) return setError('MRP cannot be lower than the selling price.');
    setBusy(true);
    setError('');
    const body = {
      category: child,
      name: f.name, nameHi: f.nameHi, brand: f.brand, description: f.description,
      price, mrp, unit: f.unit, stock: Number(f.stock) || 0, foodType: f.foodType,
      paymentMode: f.paymentMode, hsn: f.hsn.trim(), gstRate: f.gstRate === '' ? null : Number(f.gstRate),
      attributes: csv(f.attributes), tags: csv(f.tags), images, video: video.trim(),
      ...(f.variantGroup ? { variantGroup: f.variantGroup } : {}),
      ...(f.variantLabel ? { variantLabel: f.variantLabel } : {}),
    };
    try {
      if (product) await sellerUpdateProduct(product._id, body);
      else await sellerCreateProduct({ ...body, nameHi: f.nameHi || undefined, brand: f.brand || undefined, description: f.description || undefined, warehouse: warehouse || (warehouses.length === 1 ? warehouses[0]._id : undefined) });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={product ? `Edit · ${product.name}` : 'Add product'} onClose={onClose} wide>
      <form onSubmit={save}>
        <ErrorBanner message={error} />
        {!product && warehouses.length > 1 && (
          <Field label="Warehouse">
            <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} required>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </Field>
        )}
        <div className="field-row">
          <Field label="Main category">
            <select value={main} onChange={(e) => { setMain(e.target.value); setSub(''); setChild(''); }}>
              <option value="">Select…</option>
              {mains.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Sub category">
            <select value={sub} onChange={(e) => { setSub(e.target.value); setChild(''); }} disabled={!main}>
              <option value="">Select…</option>
              {subs.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Child category">
            <select value={child} onChange={(e) => setChild(e.target.value)} disabled={!sub}>
              <option value="">Select…</option>
              {children.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Product name"><input value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} /></Field>
          <Field label="Hindi name (optional)"><input value={f.nameHi} onChange={(e) => set('nameHi', e.target.value)} /></Field>
          <Field label="Brand"><input value={f.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
        </div>
        <Field label="Description"><RichTextField value={f.description} onChange={(html) => set('description', html)} minHeight={110} /></Field>
        <div className="field-row">
          <Field label="Selling price ₹"><input type="number" min={0} step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} required /></Field>
          <Field label={`MRP ₹${off ? ` (${off}% off)` : ''}`}><input type="number" min={0} step="0.01" value={f.mrp} onChange={(e) => set('mrp', e.target.value)} /></Field>
          <Field label="Unit (500 g, 1 kg…)"><input value={f.unit} onChange={(e) => set('unit', e.target.value)} required /></Field>
          <Field label="Stock"><input type="number" min={0} value={f.stock} onChange={(e) => set('stock', e.target.value)} /></Field>
        </div>
        <Field label="How can customers pay for this product?">
          <select value={f.paymentMode} onChange={(e) => set('paymentMode', e.target.value)}>
            <option value="both">Cash on delivery + online payment</option>
            <option value="cod">Cash on delivery only</option>
            <option value="online">Online payment only</option>
          </select>
        </Field>

        <div className="field-row">
          <Field label="HSN code (for the GST bill)"><input value={f.hsn} onChange={(e) => set('hsn', e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="e.g. 1101" inputMode="numeric" /></Field>
          <Field label="GST rate (already in the price)">
            <select value={f.gstRate} onChange={(e) => set('gstRate', e.target.value)}>
              <option value="">Default rate</option>
              <option value="0">0% (exempt / nil)</option>
              <option value="0.25">0.25%</option>
              <option value="3">3%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Food type">
            <select value={f.foodType} onChange={(e) => set('foodType', e.target.value)}>
              <option value="">Not a food item</option>
              <option value="veg">Vegetarian</option>
              <option value="nonveg">Non-vegetarian</option>
            </select>
          </Field>
          <Field label="Highlights (comma separated)"><input value={f.attributes} onChange={(e) => set('attributes', e.target.value)} placeholder="Cotton, Spicy, SPF 50" /></Field>
          <Field label="Search tags (comma separated)"><input value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="snack, namkeen" /></Field>
        </div>
        <div className="field-row">
          <Field label="Size group (same text on all sizes)"><input value={f.variantGroup} onChange={(e) => set('variantGroup', e.target.value)} placeholder="e.g. aashirvaad-atta" /></Field>
          <Field label="This size's label"><input value={f.variantLabel} onChange={(e) => set('variantLabel', e.target.value)} placeholder="e.g. 5 kg" /></Field>
        </div>
        <Field label="Photos (up to 6, each up to 200 KB)">
          <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={pick} disabled={uploading || images.length >= 6} />
          <div className="row-flex" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {images.map((src, i) => (
              <span key={src} style={{ position: 'relative' }}>
                <img src={src} alt="" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} />
                {i === 0 && <span className="badge badge-brand" style={{ position: 'absolute', bottom: 2, left: 2 }}>Main</span>}
                <button type="button" aria-label="Remove photo" onClick={() => setImages((cur) => cur.filter((x) => x !== src))} style={{ position: 'absolute', top: -6, right: -6 }}>×</button>
              </span>
            ))}
            {uploading && <span className="cell-muted">Uploading…</span>}
          </div>
          <div className="page-subtitle">The first photo is the main one. Bring a photo down to about 100 KB with any free image tool (for example the “pi7 image tool” site).</div>
        </Field>
        <ProductVideoField value={video} onChange={setVideo} upload={sellerUploadVideo} maxMb={15} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || uploading}>{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</Button>
        </div>
      </form>
    </Modal>
  );
}
