import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createBanner, deleteBanner, fetchBanners, fetchCategories, updateBanner, uploadImages } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconArrowDown, IconArrowUp, IconImage, IconPlus } from '../components/icons';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal } from '../components/ui';
import { Banner, Category } from '../types';

const categoryId = (b: Banner) => (b.category && typeof b.category === 'object' ? b.category._id : b.category ?? null);
const categoryName = (b: Banner) => (b.category && typeof b.category === 'object' ? b.category.name : '');

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [form, setForm] = useState<{ banner?: Banner } | null>(null);

  const load = () => {
    setLoading(true);
    fetchBanners()
      .then(setBanners)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  const remove = async (b: Banner) => {
    if (!confirm('Delete this banner?')) return;
    try {
      await deleteBanner(b._id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  /** Swap sortOrder with the neighbour, same as the categories tree. */
  const reorder = async (b: Banner, dir: -1 | 1) => {
    const idx = banners.findIndex((x) => x._id === b._id);
    const other = banners[idx + dir];
    if (!other) return;
    setMoving(b._id);
    try {
      // Equal sort orders would swap to the same value, so fall back to the list position.
      const [a, c] = b.sortOrder === other.sortOrder ? [idx, idx + dir] : [b.sortOrder, other.sortOrder];
      await Promise.all([updateBanner(b._id, { sortOrder: c }), updateBanner(other._id, { sortOrder: a })]);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setMoving(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Home Banners</h1>
          <div className="page-subtitle">
            Promo slides at the top of the customer home page. The image fills the whole slide; title and button text are optional. Until you add one, the
            built-in banners are shown.
          </div>
        </div>
        <Button onClick={() => setForm({})}>
          <IconPlus size={16} /> Add banner
        </Button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <CenterSpinner />
      ) : banners.length === 0 ? (
        <div className="card">
          <div className="empty-state">No banners yet. Upload your first banner to replace the built-in ones.</div>
        </div>
      ) : (
        <div className="banner-grid">
          {banners.map((b, i) => (
            <div key={b._id} className="card banner-card">
              <div className="banner-preview">
                <img src={b.image} alt="" />
                {b.title && (
                  <div className="banner-preview-copy">
                    <strong>{b.title}</strong>
                    {b.subtitle && <span>{b.subtitle}</span>}
                  </div>
                )}
              </div>
              <div className="banner-meta">
                <div className="row-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {b.isActive ? <Badge tone="success">Live</Badge> : <Badge tone="muted">Hidden</Badge>}
                  <span className="cell-muted" style={{ fontSize: 12 }}>
                    {categoryName(b) ? `Opens ${categoryName(b)}` : 'Opens all categories'}
                  </span>
                </div>
                <div className="banner-actions">
                  <button className="btn btn-ghost btn-sm" disabled={moving === b._id || i === 0} onClick={() => reorder(b, -1)} aria-label="Move up">
                    <IconArrowUp size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={moving === b._id || i === banners.length - 1}
                    onClick={() => reorder(b, 1)}
                    aria-label="Move down"
                  >
                    <IconArrowDown size={14} />
                  </button>
                  <span className="banner-actions-end">
                    <button className="btn btn-secondary btn-sm" onClick={() => setForm({ banner: b })}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(b)}>
                      Delete
                    </button>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <BannerForm
          banner={form.banner}
          nextSortOrder={banners.length ? Math.max(...banners.map((b) => b.sortOrder)) + 1 : 0}
          categories={categories}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </>
  );
}

function BannerForm({
  banner,
  nextSortOrder,
  categories,
  onClose,
  onSaved,
}: {
  banner?: Banner;
  nextSortOrder: number;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [image, setImage] = useState(banner?.image ?? '');
  const [title, setTitle] = useState(banner?.title ?? '');
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? '');
  const [cta, setCta] = useState(banner?.cta ?? '');
  const [category, setCategory] = useState<string | null>(banner ? categoryId(banner) : null);
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Banners link to the tiles customers tap (level 2), grouped under their heading.
  const options = useMemo(() => {
    const byOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    return categories
      .filter((c) => c.level === 1)
      .sort(byOrder)
      .map((g) => ({ group: g, items: categories.filter((c) => c.parent === g._id).sort(byOrder) }))
      .filter((g) => g.items.length);
  }, [categories]);

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const [url] = await uploadImages([file]);
      setImage(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError('Upload a banner image first.');
      return;
    }
    setSaving(true);
    setError('');
    const body = { image, title, subtitle, cta, category, isActive, sortOrder: banner?.sortOrder ?? nextSortOrder };
    try {
      if (banner) await updateBanner(banner._id, body);
      else await createBanner(body);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={banner ? 'Edit banner' : 'Add banner'} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner message={error} />

        <Field label="Banner image (recommended 1560 × 300 px, wide and short like Blinkit)">
          <div className="banner-preview banner-preview-lg" onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
            {image ? (
              <img src={image} alt="" />
            ) : (
              <div className="banner-preview-empty">
                <IconImage size={26} />
                <span>{uploading ? 'Uploading…' : 'Click to upload'}</span>
              </div>
            )}
          </div>
          <div className="row-flex" style={{ marginTop: 8 }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : image ? 'Replace image' : 'Upload image'}
            </Button>
            <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="Or paste an image URL" style={{ fontSize: 12.5, flex: 1 }} />
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={onFileChosen} />
        </Field>

        <Field label="Title (optional — leave empty if the text is already in the image)">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Fresh from the mandi" />
        </Field>
        <Field label="Subtitle (optional)">
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={140} placeholder="Sabzi and fruits, packed this morning" />
        </Field>
        <div className="field-row">
          <Field label="Button text (optional)">
            <input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={30} placeholder="Shop now" />
          </Field>
          <Field label="Opens category">
            <select value={category ?? ''} onChange={(e) => setCategory(e.target.value || null)}>
              <option value="">All categories</option>
              {options.map(({ group, items }) => (
                <optgroup key={group._id} label={group.name}>
                  {items.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Visible">
          <div className="checkbox-row">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="banner-active" />
            <label htmlFor="banner-active" style={{ marginBottom: 0 }}>
              Show on the home page
            </label>
          </div>
        </Field>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || uploading}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
