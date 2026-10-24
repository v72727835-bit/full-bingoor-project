import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from '../navigation';
import BulkUpload from '../components/BulkUpload';
import ProductVideoField from '../components/ProductVideoField';
import { bulkCreateProducts, uploadProductVideo, createProduct, deleteProduct, fetchCategories, fetchProducts, fetchAllShops, fetchSettings, fetchStandardCategories, updateProduct, uploadImages } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconPlus } from '../components/icons';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal, Pagination, Tabs, Thumb, money } from '../components/ui';
import { Category, PageMeta, Product, Shop, StandardCategory } from '../types';

type FormState = {
  name: string;
  brand: string;
  description: string;
  shop: string;
  category: string;
  price: string;
  mrp: string;
  unit: string;
  stock: string;
  foodType: '' | 'veg' | 'nonveg';
  hsn: string;
  gstRate: string;
  paymentMode: string;
  attributes: string;
  mainImage: string;
  video: string;
  galleryImages: string;
  ratingLabel: string;
  variantGroup: string;
  variantLabel: string;
  nameHi: string;
  points: string;
  sortCode: string;
  standardCategories: string[];
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  brand: '',
  description: '',
  shop: '',
  category: '',
  price: '',
  mrp: '',
  unit: '1 pc',
  stock: '0',
  foodType: '',
  hsn: '',
  gstRate: '',
  paymentMode: 'both',
  attributes: '',
  mainImage: '',
  video: '',
  galleryImages: '',
  ratingLabel: '',
  variantGroup: '',
  variantLabel: '',
  nameHi: '',
  points: '0',
  sortCode: '',
  standardCategories: [],
  isActive: true,
};

/** The aisle a child category sits under, so "Mangoes" under two aisles can be told apart in a sheet. */
const leafParentName = (c: Category, all: Category[]): string | undefined => {
  const parent = typeof c.parent === 'string' ? c.parent : (c.parent as { _id?: string } | null)?._id;
  return all.find((x) => x._id === parent)?.name;
};

export default function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'hidden'>('');
  const [category, setCategory] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(!!params.get('new'));
  const [showBulk, setShowBulk] = useState(false);

  const [shops, setShops] = useState<Shop[]>([]);
  const [leafCategories, setLeafCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const optionsRequest = useRef(false);

  const loadOptions = useCallback(async () => {
    if (optionsRequest.current) return;
    optionsRequest.current = true;
    setOptionsLoading(true);
    setOptionsError('');
    try {
      const [warehouseResult, categoryResult] = await Promise.allSettled([
        fetchAllShops(),
        fetchCategories(),
      ]);
      const errors: string[] = [];
      if (warehouseResult.status === 'fulfilled') setShops(warehouseResult.value);
      else errors.push('Warehouses: ' + getErrorMessage(warehouseResult.reason));
      if (categoryResult.status === 'fulfilled') {
        setAllCategories(categoryResult.value);
        setLeafCategories(categoryResult.value.filter((c) => c.level === 3));
      } else errors.push('Categories: ' + getErrorMessage(categoryResult.reason));
      setOptionsError(errors.join(' '));
    } finally {
      optionsRequest.current = false;
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions, showForm]);

  const closeForm = () => {
    setShowForm(false);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const load = () => {
    setLoading(true);
    setError('');
    fetchProducts({
      page,
      limit: 20,
      q: q || undefined,
      category: category || undefined,
      shop: shopFilter || undefined,
      isActive: status === '' ? undefined : status === 'active',
    })
      .then(({ items, meta }) => {
        setProducts(items);
        setMeta(meta);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, status, category, shopFilter]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(p._id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const categoryName = (c: Product['category']) => (typeof c === 'string' ? c : c.name);
  const shopName = (s: Product['shop']) => (typeof s === 'string' ? s : s.name);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <div className="page-subtitle">{meta ? `${meta.total} products` : ''}</div>
        </div>
        <div className="row-flex" style={{ gap: 8 }}>
          <Button variant="secondary" onClick={() => setShowBulk(true)}>
            Bulk upload
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <IconPlus size={15} /> Add product
          </Button>
        </div>
      </div>
      {showBulk ? (
        <BulkUpload
          mode="admin"
          categories={leafCategories.map((c) => ({ name: c.name, parent: leafParentName(c, allCategories) }))}
          shops={shops.map((s) => s.name)}
          send={bulkCreateProducts}
          onClose={() => setShowBulk(false)}
          onDone={load}
        />
      ) : null}

      <div className="toolbar">
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All' },
            { value: 'active', label: 'Live' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          style={{ width: 180 }}
        >
          <option value="">All categories</option>
          {leafCategories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={shopFilter}
          onChange={(e) => {
            setShopFilter(e.target.value);
            setPage(1);
          }}
          style={{ width: 170 }}
        >
          <option value="">All warehouses</option>
          {shops.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        <form className="toolbar" style={{ margin: 0, flex: 1 }} onSubmit={search}>
          <input className="search-input" placeholder="Search by name or brand…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <ErrorBanner message={error} />
      <ErrorBanner message={optionsError} />
      {optionsError && (
        <Button variant="secondary" disabled={optionsLoading} onClick={() => void loadOptions()}>
          {optionsLoading ? 'Loading…' : 'Retry warehouses and categories'}
        </Button>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: 40 }}>
            <CenterSpinner />
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">No products found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Warehouse</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th></th>
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
                    <td className="cell-muted">{categoryName(p.category)}</td>
                    <td className="cell-muted">{shopName(p.shop)}</td>
                    <td>
                      {money(p.price)}
                      {p.mrp > p.price && (
                        <span className="cell-muted" style={{ textDecoration: 'line-through', marginLeft: 6 }}>
                          {money(p.mrp)}
                        </span>
                      )}
                    </td>
                    <td>
                      {p.stock === 0 ? (
                        <Badge tone="danger">Out of stock</Badge>
                      ) : p.stock <= 5 ? (
                        <Badge tone="warn">{p.stock} left</Badge>
                      ) : (
                        p.stock
                      )}
                    </td>
                    <td>
                      <Badge tone={p.isActive ? 'success' : 'muted'}>{p.isActive ? 'Active' : 'Hidden'}</Badge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(p);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(p)}>
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

      {showForm && (
        <ProductForm
          product={editing}
          shops={shops}
          categories={leafCategories}
          optionsLoading={optionsLoading}
          optionsError={optionsError}
          onRetryOptions={loadOptions}
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

function ProductForm({
  product,
  shops,
  categories,
  optionsLoading,
  optionsError,
  onRetryOptions,
  onClose,
  onSaved,
}: {
  product: Product | null;
  shops: Shop[];
  categories: Category[];
  optionsLoading: boolean;
  optionsError: string;
  onRetryOptions: () => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    product
      ? {
          name: product.name,
          brand: product.brand ?? '',
          description: product.description ?? '',
          shop: typeof product.shop === 'string' ? product.shop : product.shop._id,
          category: typeof product.category === 'string' ? product.category : product.category._id,
          price: String(product.price),
          mrp: String(product.mrp),
          unit: product.unit,
          stock: String(product.stock),
          foodType: product.foodType,
          hsn: product.hsn ?? '',
          paymentMode: product.paymentMode ?? 'both',
          gstRate: product.gstRate === undefined || product.gstRate === null ? '' : String(product.gstRate),
          attributes: product.attributes.join(', '),
          mainImage: product.images[0] ?? '',
          video: product.video ?? '',
          galleryImages: product.images.slice(1).join(', '),
          ratingLabel: product.ratingLabel ?? '',
          variantGroup: product.variantGroup ?? '',
          variantLabel: product.variantLabel ?? '',
          nameHi: product.nameHi ?? '',
          points: String(product.points ?? 0),
          sortCode: product.sortCode && product.sortCode < 1_000_000 ? String(product.sortCode) : '',
          standardCategories: product.standardCategories ?? [],
          isActive: product.isActive,
        }
      : EMPTY_FORM,
  );
  const [stdRows, setStdRows] = useState<StandardCategory[]>([]);
  useEffect(() => {
    fetchStandardCategories().then(setStdRows).catch(() => undefined);
  }, []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  // Photos are capped so listings stay fast on a phone; the limit is set in Store settings.
  const [maxKb, setMaxKb] = useState(200);
  useEffect(() => {
    fetchSettings()
      .then((s) => setMaxKb(s.imageMaxKb || 200))
      .catch(() => undefined);
  }, []);

  /** Keeps files within the limit and explains how to shrink the rest. */
  const acceptFiles = (files: File[]): File[] => {
    const tooBig = files.filter((f) => f.size > maxKb * 1024);
    if (tooBig.length) {
      setError(
        `${tooBig.map((f) => f.name).join(', ')} is over ${maxKb} KB. Reduce the image first — ` +
          'you can use a free tool such as the pi7 image tool (pi7.org/image-compressor) or any image compressor on Google.',
      );
    }
    return files.filter((f) => f.size <= maxKb * 1024);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.shop || !form.category) {
      setError('Pick a warehouse and a category.');
      return;
    }
    setSaving(true);
    try {
      const pendingFiles = [...(mainFile ? [mainFile] : []), ...galleryFiles];
      const uploaded = pendingFiles.length ? await uploadImages(pendingFiles) : [];
      let uploadedIndex = 0;
      const mainImage = mainFile ? uploaded[uploadedIndex++] : form.mainImage.trim();
      const existingGallery = form.galleryImages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const images = [mainImage, ...existingGallery, ...uploaded.slice(uploadedIndex)].filter(Boolean);
      const body = {
        name: form.name,
        brand: form.brand || undefined,
        description: form.description || undefined,
        shop: form.shop,
        category: form.category,
        price: Number(form.price),
        mrp: Number(form.mrp) || Number(form.price),
        unit: form.unit,
        stock: Number(form.stock) || 0,
        foodType: form.foodType,
        hsn: form.hsn.trim(),
        gstRate: form.gstRate === '' ? null : Number(form.gstRate),
        paymentMode: form.paymentMode as 'both' | 'cod' | 'online',
        attributes: form.attributes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        images,
        video: form.video.trim(),
        ratingLabel: form.ratingLabel.trim() || undefined,
        variantGroup: form.variantGroup.trim() || undefined,
        variantLabel: form.variantLabel.trim() || undefined,
        nameHi: form.nameHi.trim() || undefined,
        points: Math.min(50, Math.max(0, Number(form.points) || 0)),
        // Blank = no sort code, so the item falls back to A-Z after the ones that have one.
        sortCode: form.sortCode.trim() === '' ? null : Number(form.sortCode),
        standardCategories: form.standardCategories,
        isActive: form.isActive,
      };
      if (product) await updateProduct(product._id, body);
      else await createProduct(body as never);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={product ? 'Edit product' : 'Add product'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <ErrorBanner message={error} />
        <ErrorBanner message={optionsError} />
        {optionsError && (
          <Button type="button" variant="secondary" disabled={optionsLoading} onClick={() => void onRetryOptions()}>
            {optionsLoading ? 'Loading…' : 'Retry warehouses and categories'}
          </Button>
        )}
        {!optionsLoading && !optionsError && shops.length === 0 && (
          <p>No warehouses found. Create a warehouse on the Warehouses page, then retry.</p>
        )}
        {!optionsLoading && !optionsError && shops.length === 0 && (
          <Button type="button" variant="secondary" onClick={() => void onRetryOptions()}>Refresh warehouses</Button>
        )}
        <div className="field-row">
          <Field label="Name">
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Brand">
            <input value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Warehouse">
            <select value={form.shop} onChange={(e) => set('shop', e.target.value)} required disabled={optionsLoading || shops.length === 0}>
              <option value="">{optionsLoading ? 'Loading warehouses…' : shops.length === 0 ? 'No warehouses available' : 'Select warehouse…'}</option>
              {shops.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category (leaf)">
            <select value={form.category} onChange={(e) => set('category', e.target.value)} required disabled={optionsLoading || categories.length === 0}>
              <option value="">{optionsLoading ? 'Loading categories…' : categories.length === 0 ? 'No categories available' : 'Select category…'}</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="field-row">
          <Field label="Price (₹)">
            <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} required />
          </Field>
          <Field label="MRP (₹)">
            <input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Unit">
            <input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="1 kg, 500 ml, 1 pc…" />
          </Field>
          <Field label="Stock">
            <input type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
          </Field>
        </div>

        <Field label="How can customers pay for this product?">
          <select value={form.paymentMode} onChange={(e) => set('paymentMode', e.target.value)}>
            <option value="both">Cash on delivery + online payment</option>
            <option value="cod">Cash on delivery only</option>
            <option value="online">Online payment only</option>
          </select>
        </Field>

        <div className="field-row">
          <Field label="HSN code (for the GST bill)">
            <input value={form.hsn} onChange={(e) => set('hsn', e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="e.g. 1101" inputMode="numeric" />
          </Field>
          <Field label="GST rate (already in the price)">
            <select value={form.gstRate} onChange={(e) => set('gstRate', e.target.value)}>
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
            <select value={form.foodType} onChange={(e) => set('foodType', e.target.value as FormState['foodType'])}>
              <option value="">Not food</option>
              <option value="veg">Veg</option>
              <option value="nonveg">Non-veg</option>
            </select>
          </Field>
          <Field label="Attributes (comma separated)">
            <input value={form.attributes} onChange={(e) => set('attributes', e.target.value)} placeholder="Spicy, 500g pack" />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Ratings shown on the card">
            <input value={form.ratingLabel} onChange={(e) => set('ratingLabel', e.target.value)} placeholder="12 · 20K · 5L+" />
          </Field>
          <Field label="Size group (same word on every size of this item)">
            <input value={form.variantGroup} onChange={(e) => set('variantGroup', e.target.value)} placeholder="amul-dark-chocolate" />
          </Field>
          <Field label="This size's label">
            <input value={form.variantLabel} onChange={(e) => set('variantLabel', e.target.value)} placeholder="200 g" />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Hindi name (shown when the customer picks Hindi)">
            <input value={form.nameHi} onChange={(e) => set('nameHi', e.target.value)} placeholder="चावल" />
          </Field>
          <Field label="Cart points for this size (0–50, hidden from customers)">
            <input type="number" min={0} max={50} value={form.points} onChange={(e) => set('points', e.target.value)} />
          </Field>
          <Field label="Sort code (blank = A to Z)">
            <input type="number" min={0} value={form.sortCode} onChange={(e) => set('sortCode', e.target.value)} placeholder="1" />
          </Field>
        </div>

        <Field label="Standard category (home screen row, optional)">
          {stdRows.length === 0 ? (
            <span className="cell-muted">None yet. Create one in the “Standard category” menu.</span>
          ) : (
            <div className="row-flex" style={{ flexWrap: 'wrap' }}>
              {stdRows.map((r) => (
                <label key={r._id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.standardCategories.includes(r._id)}
                    onChange={(e) =>
                      setForm((cur) => ({
                        ...cur,
                        standardCategories: e.target.checked ? [...cur.standardCategories, r._id] : cur.standardCategories.filter((x) => x !== r._id),
                      }))
                    }
                  />
                  <span>
                    {r.name} <span className="cell-muted">({r.position === 'top' ? 'top' : 'bottom'} of home)</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>

        <Field label="Main image">
          <label className="image-upload-zone">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const picked = acceptFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
                if (picked[0]) setMainFile(picked[0]);
              }}
            />
            <span className="image-upload-title">{mainFile || form.mainImage ? 'Change main image' : 'Choose main image'}</span>
            <span className="image-upload-hint">
              JPEG, PNG, WebP or GIF, up to {maxKb} KB{' '}
              <span
                className="help-dot"
                title={`Keep photos under ${maxKb} KB so listings load fast. You can shrink an image with any free compressor on Google, for example the pi7 image tool (pi7.org/image-compressor).`}
              >
                ?
              </span>
            </span>
          </label>
          {(mainFile || form.mainImage) && (
            <div className="image-preview-grid single">
              <ImagePreview
                file={mainFile}
                url={mainFile ? undefined : form.mainImage}
                label="Main image"
                onRemove={() => {
                  setMainFile(null);
                  set('mainImage', '');
                }}
              />
            </div>
          )}
        </Field>

        <ProductVideoField value={form.video} onChange={(url) => set('video', url)} upload={uploadProductVideo} maxMb={30} />

        <Field label="Gallery images">
          <label className="image-upload-zone compact">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => {
                const picked = acceptFiles(Array.from(e.target.files ?? []));
                setGalleryFiles((current) => [...current, ...picked].slice(0, 9));
                e.target.value = '';
              }}
            />
            <span className="image-upload-title">Add gallery images</span>
            <span className="image-upload-hint">Select multiple images, up to 9 total — each under {maxKb} KB</span>
          </label>
          {(form.galleryImages || galleryFiles.length > 0) && (
            <div className="image-preview-grid">
              {form.galleryImages
                .split(',')
                .map((url) => url.trim())
                .filter(Boolean)
                .map((url) => (
                  <ImagePreview
                    key={url}
                    url={url}
                    label="Gallery image"
                    onRemove={() =>
                      set(
                        'galleryImages',
                        form.galleryImages
                          .split(',')
                          .map((item) => item.trim())
                          .filter((item) => item && item !== url)
                          .join(', '),
                      )
                    }
                  />
                ))}
              {galleryFiles.map((file, index) => (
                <ImagePreview
                  key={file.name + '-' + file.lastModified + '-' + index}
                  file={file}
                  label={file.name}
                  onRemove={() => setGalleryFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                />
              ))}
            </div>
          )}
        </Field>

        <Field label="Description">
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <div className="checkbox-row">
          <input type="checkbox" id="active" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          <label htmlFor="active" style={{ marginBottom: 0 }}>
            Visible in the app
          </label>
        </div>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || optionsLoading || shops.length === 0 || categories.length === 0}>
            {saving ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function ImagePreview({
  file,
  url,
  label,
  onRemove,
}: {
  file?: File | null;
  url?: string;
  label: string;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState(url ?? '');

  useEffect(() => {
    if (!file) {
      setPreview(url ?? '');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, url]);

  return (
    <div className="image-preview">
      {preview ? <img src={preview} alt={label} /> : <div className="image-preview-placeholder">Preparing preview...</div>}
      <button type="button" className="image-remove" onClick={onRemove} aria-label={'Remove ' + label}>
        ×
      </button>
      <span>{label}</span>
    </div>
  );
}
