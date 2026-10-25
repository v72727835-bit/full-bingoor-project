import React, { useEffect, useState } from 'react';
import { BlogPost, createBlogPost, deleteBlogPost, fetchBlogPosts, updateBlogPost, uploadImages } from '../api/admin';
import { getErrorMessage } from '../api/client';
import RichTextField from '../components/RichTextField';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal, Pagination, formatDate } from '../components/ui';

/**
 * #38: blog posts shown at bingoor.com/blog. Any admin (or Team & access
 * account) writes them here; a post shows on the website only once Published
 * is ticked.
 */
export default function BlogPage() {
  const [rows, setRows] = useState<BlogPost[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Partial<BlogPost> | null>(null);

  const load = () => {
    setLoading(true);
    fetchBlogPosts({ page, limit: 25 })
      .then((r) => {
        setRows(r.items);
        setPages(r.meta?.totalPages ?? 1);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [page]);

  const remove = async (post: BlogPost) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    try {
      await deleteBlogPost(post._id);
      setRows((cur) => cur.filter((r) => r._id !== post._id));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Blog</h1>
          <div className="page-subtitle">Posts shown on the website at /blog. Only published posts are visible to customers.</div>
        </div>
        <Button onClick={() => setEditing({ published: true, body: '' })}>+ New post</Button>
      </div>

      <ErrorBanner message={error} />
      {loading ? (
        <CenterSpinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">No blog posts yet. Press “New post” to write the first one.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Author</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div style={{ fontWeight: 650 }}>{r.title}</div>
                      <div className="cell-muted">/blog/{r.slug}</div>
                    </td>
                    <td>{r.author || '—'}</td>
                    <td>{formatDate(r.publishedAt ?? r.createdAt)}</td>
                    <td>
                      <Badge tone={r.published ? 'success' : 'muted'}>{r.published ? 'Published' : 'Draft'}</Badge>
                    </td>
                    <td>
                      <div className="row-flex" style={{ justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(r)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={pages} onChange={setPage} />
        </div>
      )}

      {editing ? (
        <PostModal
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </>
  );
}

function PostModal({ post, onClose, onSaved }: { post: Partial<BlogPost>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: post.title ?? '',
    excerpt: post.excerpt ?? '',
    body: post.body ?? '',
    cover: post.cover ?? '',
    author: post.author ?? '',
    published: post.published ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const [url] = await uploadImages([file]);
      setF((cur) => ({ ...cur, cover: url }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const body = { ...f, excerpt: f.excerpt.trim() || undefined, cover: f.cover.trim() || undefined, author: f.author.trim() || undefined };
      if (post._id) await updateBlogPost(post._id, body);
      else await createBlogPost(body);
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={post._id ? 'Edit post' : 'New post'} onClose={onClose} wide>
      <ErrorBanner message={error} />
      <Field label="Title">
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} />
      </Field>
      <Field label="Short summary (shown on the blog list)">
        <textarea value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} rows={2} maxLength={300} />
      </Field>
      <Field label="Cover photo">
        <div className="row-flex">
          {f.cover ? <img src={f.cover} alt="" style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 8 }} /> : null}
          <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
          {f.cover ? (
            <Button size="sm" variant="secondary" type="button" onClick={() => setF({ ...f, cover: '' })}>
              Remove
            </Button>
          ) : null}
        </div>
      </Field>
      <Field label="Post">
        <RichTextField value={f.body} onChange={(body) => setF((cur) => ({ ...cur, body }))} minHeight={260} />
      </Field>
      <Field label="Author (optional)">
        <input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} maxLength={80} />
      </Field>
      <label className="checkbox-row">
        <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} />
        Published (show on the website)
      </label>
      <div className="row-flex" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || uploading || f.title.trim().length < 3 || !f.body.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
