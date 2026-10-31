import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createCategory, deleteCategory, fetchCategories, updateCategory, uploadImages } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconArrowDown, IconArrowUp, IconBox } from '../components/icons';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal } from '../components/ui';
import { Category } from '../types';

const LEVEL_LABEL: Record<number, string> = { 1: 'Group', 2: 'Category', 3: 'Child' };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [formState, setFormState] = useState<{ mode: 'create' | 'edit'; level: 1 | 2 | 3; parent: string | null; category?: Category } | null>(
    null,
  );

  const load = () => {
    setLoading(true);
    fetchCategories()
      .then((cats) => {
        setCategories(cats);
        setExpandedGroups(new Set(cats.filter((c) => c.level === 1).map((c) => c._id)));
        setExpandedCategories(new Set(cats.filter((c) => c.level === 2).map((c) => c._id)));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (c: Category) => {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try {
      await deleteCategory(c._id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const groups = categories.filter((c) => c.level === 1);
  const childrenOf = (id: string) =>
    categories.filter((c) => c.parent === id).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const toggleSet = (id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Swap sortOrder with the sibling directly above/below, so the arrows double as a lightweight reorder tool. */
  const reorder = async (siblings: Category[], c: Category, dir: -1 | 1) => {
    const idx = siblings.findIndex((s) => s._id === c._id);
    const swapWith = siblings[idx + dir];
    if (!swapWith) return;
    setMoving(c._id);
    try {
      await Promise.all([
        updateCategory(c._id, { sortOrder: swapWith.sortOrder }),
        updateCategory(swapWith._id, { sortOrder: c.sortOrder }),
      ]);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setMoving(null);
    }
  };

  /** Type a sort code right on the row: the lower the number, the earlier it shows on the website and in the app. */
  const setCode = async (c: Category, value: number) => {
    if (value === c.sortOrder) return;
    setMoving(c._id);
    try {
      await updateCategory(c._id, { sortOrder: value });
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
          <h1 className="page-title">Categories</h1>
          <div className="page-subtitle">Group › Category › Child — the same structure customers see in the app. Set the image, colour, display order and parent for each entry.</div>
        </div>
        <Button onClick={() => setFormState({ mode: 'create', level: 1, parent: null })}>+ Add group</Button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <CenterSpinner />
      ) : (
        <div className="card category-card">
          {groups.length === 0 && <div className="empty-state">No categories yet. Create your first group to get started.</div>}
          {groups
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((g) => {
              const groupChildren = childrenOf(g._id);
              const groupOpen = expandedGroups.has(g._id);
              return (
                <div key={g._id} className="tree-block">
                  <CategoryRow
                    c={g}
                    siblings={groups}
                    childCount={groupChildren.length}
                    expanded={groupOpen}
                    moving={moving === g._id}
                    onToggle={() => toggleSet(g._id, setExpandedGroups)}
                    onEdit={() => setFormState({ mode: 'edit', level: 1, parent: null, category: g })}
                    onDelete={() => remove(g)}
                    onMove={(dir) => reorder(groups, g, dir)}
                    onSortCode={(n) => setCode(g, n)}
                  />
                  {groupOpen && (
                    <div className="tree-branch">
                      {groupChildren.map((cat) => {
                        const childCategories = childrenOf(cat._id);
                        const catOpen = expandedCategories.has(cat._id);
                        return (
                          <div key={cat._id} className="tree-block">
                            <CategoryRow
                              c={cat}
                              siblings={groupChildren}
                              childCount={childCategories.length}
                              expanded={catOpen}
                              moving={moving === cat._id}
                              onToggle={() => toggleSet(cat._id, setExpandedCategories)}
                              onEdit={() => setFormState({ mode: 'edit', level: 2, parent: g._id, category: cat })}
                              onDelete={() => remove(cat)}
                              onMove={(dir) => reorder(groupChildren, cat, dir)}
                    onSortCode={(n) => setCode(cat, n)}
                            />
                            {catOpen && (
                              <div className="tree-branch">
                                {childCategories.map((child) => (
                                  <CategoryRow
                                    key={child._id}
                                    c={child}
                                    siblings={childCategories}
                                    moving={moving === child._id}
                                    onEdit={() => setFormState({ mode: 'edit', level: 3, parent: cat._id, category: child })}
                                    onDelete={() => remove(child)}
                                    onMove={(dir) => reorder(childCategories, child, dir)}
                    onSortCode={(n) => setCode(child, n)}
                                  />
                                ))}
                                <button
                                  className="btn btn-ghost btn-sm tree-add"
                                  onClick={() => setFormState({ mode: 'create', level: 3, parent: cat._id })}
                                >
                                  + Add child
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button className="btn btn-ghost btn-sm tree-add" onClick={() => setFormState({ mode: 'create', level: 2, parent: g._id })}>
                        + Add category
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {formState && (
        <CategoryForm
          state={formState}
          categories={categories}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            load();
          }}
        />
      )}
    </>
  );
}

function CategoryRow({
  c,
  siblings,
  childCount = 0,
  expanded,
  moving,
  onToggle,
  onEdit,
  onDelete,
  onMove,
  onSortCode,
}: {
  c: Category;
  siblings: Category[];
  childCount?: number;
  expanded?: boolean;
  moving: boolean;
  onToggle?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onSortCode: (n: number) => void;
}) {
  const canExpand = !!onToggle;
  const sorted = siblings.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const idx = sorted.findIndex((s) => s._id === c._id);

  return (
    <div className="tree-row">
      {canExpand ? (
        <button className={`tree-toggle${expanded ? ' expanded' : ''}`} onClick={onToggle} aria-label={expanded ? 'Collapse' : 'Expand'}>
          <span />
        </button>
      ) : (
        <span className="tree-toggle-spacer" />
      )}
      {c.image ? (
        <img src={c.image} alt="" className="thumb" style={{ width: 26, height: 26, borderRadius: 8 }} />
      ) : (
        <div className="tree-swatch" style={{ background: c.tint || '#eee' }} />
      )}
      <span style={{ fontWeight: 600 }}>{c.name}</span>
      <span className="cell-muted" style={{ fontSize: 12 }}>
        {LEVEL_LABEL[c.level]}
      </span>
      {canExpand && <Badge tone="muted">{childCount}</Badge>}
      {!c.isActive && <Badge tone="muted">Hidden</Badge>}
      <label className="cell-muted" style={{ marginLeft: 'auto', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        Sort code
        <input
          key={`${c._id}-${c.sortOrder}`}
          type="number"
          min={0}
          defaultValue={c.sortOrder}
          disabled={moving}
          onBlur={(e) => onSortCode(Number(e.target.value) || 0)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          style={{ width: 70, padding: '4px 6px' }}
          aria-label={`Sort code for ${c.name}`}
        />
      </label>
      <div className="tree-actions">
        <button className="btn btn-ghost btn-sm" disabled={moving || idx <= 0} onClick={() => onMove(-1)} title="Move up" aria-label="Move up">
          <IconArrowUp size={14} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={moving || idx === -1 || idx >= sorted.length - 1}
          onClick={() => onMove(1)}
          title="Move down"
          aria-label="Move down"
        >
          <IconArrowDown size={14} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function CategoryForm({
  state,
  categories,
  onClose,
  onSaved,
}: {
  state: { mode: 'create' | 'edit'; level: 1 | 2 | 3; parent: string | null; category?: Category };
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = state.category;
  const [name, setName] = useState(c?.name ?? '');
  const [nameHi, setNameHi] = useState(c?.nameHi ?? '');
  const [icon, setIcon] = useState(c?.icon ?? '');
  const [tint, setTint] = useState(c?.tint ?? '#FCE8F3');
  const [image, setImage] = useState(c?.image ?? '');
  const [parent, setParent] = useState<string | null>(state.mode === 'edit' ? c?.parent ?? null : state.parent);
  const [sortOrder, setSortOrder] = useState(String(c?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(c?.isActive ?? true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Which categories this one may move under: same-level parents only, never itself or its own branch.
  const parentChoices = useMemo(() => {
    if (state.level === 1) return [];
    const parentLevel = state.level - 1;
    return categories
      .filter((cat) => cat.level === parentLevel)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [categories, state.level]);

  const pickFile = () => fileRef.current?.click();

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
    setSaving(true);
    setError('');
    try {
      if (state.mode === 'create') {
        await createCategory({
          name,
          nameHi: nameHi.trim() || undefined,
          level: state.level,
          parent,
          icon: icon || undefined,
          image: image || undefined,
          tint: tint || undefined,
          sortOrder: Number(sortOrder) || 0,
          isActive,
        });
      } else if (c) {
        await updateCategory(c._id, {
          name,
          nameHi: nameHi.trim(),
          parent: state.level === 1 ? null : parent,
          icon: icon || undefined,
          image: image || '',
          tint: tint || undefined,
          sortOrder: Number(sortOrder) || 0,
          isActive,
        });
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`${state.mode === 'create' ? 'Add' : 'Edit'} ${LEVEL_LABEL[state.level].toLowerCase()}`} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner message={error} />

        <Field label="Image">
          <div className="row-flex" style={{ alignItems: 'flex-start' }}>
            {image ? (
              <img src={image} alt="" className="thumb" style={{ width: 56, height: 56, borderRadius: 12 }} />
            ) : (
              <div className="thumb thumb-fallback" style={{ width: 56, height: 56, borderRadius: 12 }}>
                <IconBox size={20} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div className="row-flex">
                <Button type="button" variant="secondary" size="sm" onClick={pickFile} disabled={uploading}>
                  {uploading ? 'Uploading…' : image ? 'Replace image' : 'Upload image'}
                </Button>
                {image && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImage('')}>
                    Remove
                  </Button>
                )}
              </div>
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="Or paste an image URL"
                style={{ fontSize: 12.5 }}
              />
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={onFileChosen} />
            </div>
          </div>
        </Field>

        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Hindi name (optional)">
          <input value={nameHi} onChange={(e) => setNameHi(e.target.value)} placeholder="चावल" />
        </Field>

        {state.level > 1 && (
          <Field label={state.level === 2 ? 'Group' : 'Category'}>
            <select value={parent ?? ''} onChange={(e) => setParent(e.target.value || null)} required>
              <option value="" disabled>
                Choose where this lives…
              </option>
              {parentChoices.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="field-row">
          <Field label="Icon key (Fluent Emoji, optional)">
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="carrot" />
          </Field>
          <Field label="Tint color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(tint) ? tint : '#fce8f3'} onChange={(e) => setTint(e.target.value)} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Sort order">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Field>
          <Field label="Visible">
            <div className="checkbox-row" style={{ height: 38 }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="cat-active" />
              <label htmlFor="cat-active" style={{ marginBottom: 0 }}>
                Shown in the app
              </label>
            </div>
          </Field>
        </div>
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
