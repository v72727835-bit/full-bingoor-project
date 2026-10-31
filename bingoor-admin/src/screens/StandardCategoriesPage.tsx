import React, { useEffect, useState } from 'react';
import { createStandardCategory, deleteStandardCategory, fetchStandardCategories, updateStandardCategory } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal } from '../components/ui';
import { StandardCategory } from '../types';

/**
 * Standard categories are named rows of products ("Morning Breakfast") pinned to
 * the very top or the very bottom of the customer home screen. The aisles stay in
 * between. A product joins a row by picking the row's name in its listing.
 */
export default function StandardCategoriesPage() {
  const [rows, setRows] = useState<StandardCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<StandardCategory | 'new' | null>(null);

  const load = () => {
    fetchStandardCategories()
      .then(setRows)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (r: StandardCategory) => {
    if (!window.confirm(`Delete “${r.name}”? Its products stay, they just leave this row.`)) return;
    try {
      await deleteStandardCategory(r._id);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const group = (pos: 'top' | 'bottom') => rows.filter((r) => r.position === pos);

  const table = (title: string, items: StandardCategory[]) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-pad">
        <h2 className="card-title" style={{ margin: 0 }}>{title}</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Order</th>
              <th>Products</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">None yet.</td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r._id}>
                <td className="cell-name">
                  {r.name}
                  {r.nameHi ? <div className="cell-muted">{r.nameHi}</div> : null}
                </td>
                <td className="cell-muted">{r.sortOrder}</td>
                <td className="cell-muted">{r.products ?? 0}</td>
                <td>{r.isActive ? <Badge tone="success">Showing</Badge> : <Badge tone="muted">Hidden</Badge>}</td>
                <td>
                  <div className="row-flex">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Standard category</h1>
          <div className="page-subtitle">
            Name a row (like “Morning Breakfast”) and pin it to the top or the bottom of the home screen. The aisles stay in the middle. Add products to a row from the product listing.
          </div>
        </div>
        <Button onClick={() => setEditing('new')}>+ New standard category</Button>
      </div>
      <ErrorBanner message={error} />
      {loading ? (
        <CenterSpinner />
      ) : (
        <>
          {table('On top of the home screen', group('top'))}
          {table('At the bottom of the home screen', group('bottom'))}
        </>
      )}
      {editing && (
        <RowForm
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function RowForm({ row, onClose, onDone }: { row: StandardCategory | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: row?.name ?? '',
    nameHi: row?.nameHi ?? '',
    position: (row?.position ?? 'top') as 'top' | 'bottom',
    sortOrder: String(row?.sortOrder ?? 0),
    isActive: row?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { name: f.name, nameHi: f.nameHi || undefined, position: f.position, sortOrder: Number(f.sortOrder) || 0, isActive: f.isActive };
      if (row) await updateStandardCategory(row._id, body);
      else await createStandardCategory(body);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={row ? 'Edit standard category' : 'New standard category'} onClose={onClose}>
      <form onSubmit={save}>
        <ErrorBanner message={error} />
        <Field label="Name shown to customers (e.g. Morning Breakfast)">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </Field>
        <Field label="Hindi name (optional)">
          <input value={f.nameHi} onChange={(e) => setF({ ...f, nameHi: e.target.value })} />
        </Field>
        <div className="field-row">
          <Field label="Where on the home screen">
            <select value={f.position} onChange={(e) => setF({ ...f, position: e.target.value as 'top' | 'bottom' })}>
              <option value="top">On top</option>
              <option value="bottom">At the bottom</option>
            </select>
          </Field>
          <Field label="Order (0 comes first)">
            <input type="number" min={0} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} />
          </Field>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
          <span>Show on the home screen</span>
        </label>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}
