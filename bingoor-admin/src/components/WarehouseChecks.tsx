import React from 'react';

/** Tick one or more warehouses; used when a rider can serve several of them. */
export default function WarehouseChecks({
  options,
  value,
  onChange,
}: {
  options: { _id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: 8 }}>
      {options.length === 0 && <span className="cell-muted">No warehouses yet.</span>}
      {options.map((w) => (
        <label key={w._id} className="checkbox-row">
          <input type="checkbox" checked={value.includes(w._id)} onChange={() => toggle(w._id)} />
          <span>{w.name}</span>
        </label>
      ))}
      <span className="cell-muted">{value.length} selected</span>
    </div>
  );
}
