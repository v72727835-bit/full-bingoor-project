import React, { useEffect, useRef, useState } from 'react';
import { createMedia, deleteMedia, fetchMedia, updateMedia, uploadImages } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconArrowDown, IconArrowUp, IconImage, IconPlus, IconVideo } from '../components/icons';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal } from '../components/ui';
import { MediaItem } from '../types';

type Kind = 'photo' | 'video';

const COPY: Record<Kind, { title: string; subtitle: string; add: string; empty: string; page: string }> = {
  photo: {
    title: 'Gallery',
    subtitle: 'Photos shown on the Gallery page of the website (linked from the footer). Add shop photos, deliveries, events and offers.',
    add: 'Add photo',
    empty: 'No photos yet. Add your first photo and it will appear on the Gallery page.',
    page: '/gallery',
  },
  video: {
    title: 'Videos',
    subtitle: 'Videos shown on the Videos page of the website (linked from the footer). Paste a YouTube or Vimeo link, or a direct .mp4 link.',
    add: 'Add video',
    empty: 'No videos yet. Paste a YouTube link to add your first video.',
    page: '/videos',
  },
};

/** One screen for both the photo gallery and the video list; they only differ in the form. */
export default function MediaPage({ kind }: { kind: Kind }) {
  const copy = COPY[kind];
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [form, setForm] = useState<{ item?: MediaItem } | null>(null);

  const load = () => {
    setLoading(true);
    fetchMedia(kind)
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [kind]);

  const remove = async (m: MediaItem) => {
    if (!confirm(`Delete "${m.title}"?`)) return;
    try {
      await deleteMedia(m._id);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const toggle = async (m: MediaItem) => {
    try {
      await updateMedia(m._id, { isActive: !m.isActive });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const reorder = async (m: MediaItem, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x._id === m._id);
    const other = items[idx + dir];
    if (!other) return;
    setMoving(m._id);
    try {
      // Give both a fresh position from the list order, so equal numbers still swap.
      await Promise.all([updateMedia(m._id, { sortOrder: idx + dir }), updateMedia(other._id, { sortOrder: idx })]);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setMoving(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{copy.title}</h1>
          <div className="page-subtitle">{copy.subtitle}</div>
        </div>
        <Button onClick={() => setForm({})}>
          <IconPlus size={16} /> {copy.add}
        </Button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <CenterSpinner />
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty-state">{copy.empty}</div>
        </div>
      ) : (
        <div className="banner-grid">
          {items.map((m, i) => {
            const cover = kind === 'photo' ? m.url : m.thumbnail;
            return (
              <div key={m._id} className="card banner-card">
                <div className="banner-preview" style={{ aspectRatio: '16 / 10' }}>
                  {cover ? <img src={cover} alt="" /> : <div className="banner-preview-empty"><IconVideo size={28} /></div>}
                  {kind === 'video' ? (
                    <div className="banner-preview-copy" style={{ alignItems: 'center', background: 'rgba(0,0,0,0.25)' }}>
                      <IconVideo size={34} />
                    </div>
                  ) : null}
                </div>
                <div className="banner-meta">
                  <div>
                    <strong style={{ fontSize: 14 }}>{m.title}</strong>
                    {m.caption ? <div className="cell-muted" style={{ fontSize: 12 }}>{m.caption}</div> : null}
                  </div>
                  <div className="row-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {m.isActive ? <Badge tone="success">Live</Badge> : <Badge tone="muted">Hidden</Badge>}
                    {kind === 'video' && m.videoType ? <Badge tone="info">{m.videoType === 'file' ? 'Video file' : m.videoType === 'youtube' ? 'YouTube' : 'Vimeo'}</Badge> : null}
                  </div>
                  <div className="banner-actions">
                    <button className="btn btn-ghost btn-sm" disabled={moving === m._id || i === 0} onClick={() => reorder(m, -1)} aria-label="Move up">
                      <IconArrowUp size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={moving === m._id || i === items.length - 1} onClick={() => reorder(m, 1)} aria-label="Move down">
                      <IconArrowDown size={14} />
                    </button>
                    <span className="banner-actions-end">
                      <button className="btn btn-secondary btn-sm" onClick={() => toggle(m)}>{m.isActive ? 'Hide' : 'Show'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setForm({ item: m })}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>Delete</button>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <MediaForm
          kind={kind}
          item={form.item}
          nextSortOrder={items.length ? Math.max(...items.map((x) => x.sortOrder)) + 1 : 0}
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

function MediaForm({ kind, item, nextSortOrder, onClose, onSaved }: { kind: Kind; item?: MediaItem; nextSortOrder: number; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState(item?.url ?? '');
  const [thumbnail, setThumbnail] = useState(item?.thumbnail ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [caption, setCaption] = useState(item?.caption ?? '');
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [uploading, setUploading] = useState<'' | 'main' | 'cover'>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined, target: 'main' | 'cover') => {
    if (!file) return;
    setUploading(target);
    setError('');
    try {
      const [link] = await uploadImages([file]);
      if (target === 'main') setUrl(link);
      else setThumbnail(link);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading('');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return setError(kind === 'photo' ? 'Upload a photo first.' : 'Paste the video link first.');
    if (!title.trim()) return setError('Add a title.');
    setSaving(true);
    setError('');
    const body = { kind, title: title.trim(), caption: caption.trim() || undefined, url: url.trim(), thumbnail: thumbnail.trim() || undefined, isActive, sortOrder: item?.sortOrder ?? nextSortOrder };
    try {
      if (item) await updateMedia(item._id, body);
      else await createMedia(body);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? `Edit ${kind}` : kind === 'photo' ? 'Add photo' : 'Add video'} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner message={error} />

        {kind === 'photo' ? (
          <Field label="Photo">
            <div className="banner-preview banner-preview-lg" style={{ aspectRatio: '16 / 10' }} onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
              {url ? <img src={url} alt="" /> : <div className="banner-preview-empty"><IconImage size={26} /><span>{uploading === 'main' ? 'Uploading…' : 'Click to upload'}</span></div>}
            </div>
            <div className="row-flex" style={{ marginTop: 8 }}>
              <Button type="button" variant="secondary" size="sm" disabled={!!uploading} onClick={() => fileRef.current?.click()}>
                {uploading === 'main' ? 'Uploading…' : url ? 'Replace photo' : 'Upload photo'}
              </Button>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Or paste an image link" style={{ fontSize: 12.5, flex: 1 }} />
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { void upload(e.target.files?.[0], 'main'); e.target.value = ''; }} />
          </Field>
        ) : (
          <>
            <Field label="Video link">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
              <div className="page-subtitle">YouTube (watch, share, Shorts), Vimeo, or a direct .mp4 / .webm file link.</div>
            </Field>
            <Field label="Cover image (optional, YouTube covers are added automatically)">
              <div className="row-flex">
                <Button type="button" variant="secondary" size="sm" disabled={!!uploading} onClick={() => coverRef.current?.click()}>
                  {uploading === 'cover' ? 'Uploading…' : thumbnail ? 'Replace cover' : 'Upload cover'}
                </Button>
                <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="Or paste an image link" style={{ fontSize: 12.5, flex: 1 }} />
              </div>
              <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void upload(e.target.files?.[0], 'cover'); e.target.value = ''; }} />
            </Field>
          </>
        )}

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder={kind === 'photo' ? 'Our Robertsganj warehouse' : 'How Bingoor delivers in minutes'} />
        </Field>
        <Field label="Short description (optional)">
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} />
        </Field>
        <label className="row-flex" style={{ gap: 8, margin: '6px 0 12px' }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={{ width: 'auto' }} />
          Show on the website
        </label>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !!uploading}>{saving ? 'Saving…' : item ? 'Save changes' : kind === 'photo' ? 'Add photo' : 'Add video'}</Button>
        </div>
      </form>
    </Modal>
  );
}
