"use client";

import React, { useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { downloadCsv, parseCsv, rowsToObjects } from '../lib/csv';
import { Badge, Button, ErrorBanner, Modal } from './ui';

export interface BulkRowResult {
  row: number;
  name: string;
  ok: boolean;
  error?: string;
  id?: string;
}
export interface BulkResponse {
  results: BulkRowResult[];
  created: number;
  failed: number;
}

/** Same page size the server accepts per request. */
const CHUNK = 300;

const COLUMNS_ADMIN = ['name', 'category', 'price', 'mrp', 'unit', 'stock', 'warehouse', 'brand', 'description', 'images', 'video', 'foodType', 'tags', 'attributes', 'variantGroup', 'variantLabel', 'nameHi', 'points', 'sortCode', 'hsn', 'gstRate', 'payment'];
const COLUMNS_SELLER = COLUMNS_ADMIN.filter((c) => c !== 'points' && c !== 'sortCode');
const REQUIRED = ['name', 'category', 'price'];

/**
 * Add many products at once from a spreadsheet saved as CSV. Each row is
 * checked on its own on the server, so a few bad rows never stop the rest, and
 * the rows that failed can be downloaded, fixed and uploaded again.
 */
export default function BulkUpload({
  mode,
  categories,
  shops,
  send,
  onClose,
  onDone,
}: {
  mode: 'admin' | 'seller';
  /** Child (level 3) categories: the name, and the parent's name to tell twins apart. */
  categories: { name: string; parent?: string }[];
  /** Warehouse / shop names the person may use. */
  shops: string[];
  send: (rows: Record<string, string>[], dryRun: boolean) => Promise<BulkResponse>;
  onClose: () => void;
  onDone: () => void;
}) {
  const columns = mode === 'admin' ? COLUMNS_ADMIN : COLUMNS_SELLER;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'check' | 'upload'>('');
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<{ dryRun: boolean; created: number; failed: number; results: BulkRowResult[] } | null>(null);

  // Twin names ("Mangoes" under two aisles) must be written as "Parent > Name".
  const catLabels = useMemo(() => {
    const count = new Map<string, number>();
    categories.forEach((c) => count.set(c.name.toLowerCase(), (count.get(c.name.toLowerCase()) ?? 0) + 1));
    return categories.map((c) => (c.parent && (count.get(c.name.toLowerCase()) ?? 0) > 1 ? `${c.parent} > ${c.name}` : c.name));
  }, [categories]);

  const downloadTemplate = () => {
    const cat = catLabels[0] ?? 'Apples';
    const shop = shops[0] ?? 'My Warehouse';
    const sample = (o: Record<string, string>) => columns.map((c) => o[c] ?? '');
    downloadCsv('bingoor-products-template.csv', [
      columns,
      sample({ name: 'Shimla Apple', category: cat, price: '120', mrp: '140', unit: '1 kg', stock: '30', warehouse: shop, brand: 'Fresh', description: 'Crisp and sweet', images: 'https://example.com/apple1.jpg|https://example.com/apple2.jpg', video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', foodType: 'veg', tags: 'fruit|fresh', attributes: 'Premium', points: '2', sortCode: '1', hsn: '0808', gstRate: '0', payment: 'both' }),
      sample({ name: 'Amul Taaza Milk', category: cat, price: '29', mrp: '32', unit: '500 ml', stock: '100', warehouse: shop, brand: 'Amul', foodType: 'veg', hsn: '0401', gstRate: '0', payment: 'cod' }),
    ]);
  };

  const downloadCategories = () =>
    downloadCsv('bingoor-category-names.csv', [['Use this in the "category" column'], ...catLabels.map((l) => [l])]);

  const onFile = async (file: File | undefined) => {
    setReport(null);
    setError('');
    setRows([]);
    if (!file) return;
    setFileName(file.name);
    try {
      const table = parseCsv(await file.text());
      const objs = rowsToObjects(table);
      if (!objs.length) return setError('The file has no product rows. Fill the template and save it as CSV.');
      const headers = Object.keys(objs[0]);
      const missing = REQUIRED.filter((c) => !headers.includes(c));
      if (missing.length) return setError(`The first row must have these column names: ${missing.join(', ')}. Download the template to see the exact layout.`);
      setRows(objs);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? 'check' : 'upload');
    setError('');
    setReport(null);
    const all: BulkRowResult[] = [];
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        setProgress(`${Math.min(i + CHUNK, rows.length)} of ${rows.length} rows`);
        const res = await send(rows.slice(i, i + CHUNK), dryRun);
        // The server numbers rows from the top of each request; shift them to the sheet's own row numbers.
        res.results.forEach((r) => all.push({ ...r, row: r.row + i }));
      }
      const created = all.filter((r) => r.ok).length;
      setReport({ dryRun, created, failed: all.length - created, results: all });
      if (!dryRun && created) onDone();
    } catch (e) {
      setError(getErrorMessage(e));
      if (all.length) {
        const created = all.filter((r) => r.ok).length;
        setReport({ dryRun, created, failed: all.length - created, results: all });
      }
    } finally {
      setBusy('');
      setProgress('');
    }
  };

  const failed = report?.results.filter((r) => !r.ok) ?? [];
  const downloadFailed = () => {
    const byRow = new Map(failed.map((f) => [f.row, f.error ?? '']));
    const headers = Object.keys(rows[0] ?? {});
    downloadCsv('bingoor-products-to-fix.csv', [
      [...headers, 'problem'],
      ...rows.flatMap((r, i) => (byRow.has(i + 2) ? [[...headers.map((h) => r[h] ?? ''), byRow.get(i + 2)]] : [])),
    ]);
  };

  return (
    <Modal title="Add many products at once" onClose={onClose} wide>
      <ol style={{ margin: '0 0 14px', paddingLeft: 18, lineHeight: 1.7, color: 'var(--ink-soft)', fontSize: 13.5 }}>
        <li>Download the template and fill one product per row (open it in Excel or Google Sheets).</li>
        <li>
          Save it as <b>CSV</b>, choose the file below and press <b>Check file</b>. Nothing is saved until you press <b>Upload</b>.
        </li>
        <li>Rows with a problem are listed with the reason. Download them, fix them and upload again.</li>
      </ol>

      <div className="row-flex" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Button variant="secondary" onClick={downloadTemplate}>Download template</Button>
        <Button variant="secondary" onClick={downloadCategories} disabled={!categories.length}>Download category names</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>{fileName ? 'Choose another file' : 'Choose CSV file'}</Button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <details style={{ marginBottom: 12, fontSize: 13, color: 'var(--ink-soft)' }}>
        <summary style={{ cursor: 'pointer' }}>What goes in each column?</summary>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>name, category, price</b> are required. <b>category</b> is the exact name of a child category (use <i>Parent &gt; Name</i> if two aisles share a name).</li>
          <li><b>mrp</b> defaults to the price, <b>unit</b> to "1 pc", <b>stock</b> to 0.</li>
          <li><b>warehouse</b>: the {mode === 'admin' ? 'shop' : 'warehouse'} name{mode === 'seller' ? ' (leave empty if you have only one)' : ''}.</li>
          <li><b>images, tags, attributes</b>: separate several values with <b>|</b>. Images must be full links.</li>
          <li><b>video</b>: one YouTube link or a direct .mp4 link (optional).</li>
          <li><b>foodType</b>: veg or nonveg (leave empty for other products).</li>
          <li><b>hsn</b> (HSN code) and <b>gstRate</b> (0, 5, 12, 18 or 28; the GST already inside the price). Leave gstRate empty to use the default rate.</li>
          <li><b>payment</b>: <code>both</code> (default), <code>cod</code> (cash on delivery only) or <code>online</code> (online payment only).</li>
          {mode === 'admin' ? <li><b>points</b> (0-50) and <b>sortCode</b> are admin-only.</li> : null}
        </ul>
      </details>

      <ErrorBanner message={error} />

      {rows.length ? (
        <div className="row-flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '4px 0 12px' }}>
          <span style={{ fontSize: 13.5 }}>
            <b>{fileName}</b>: {rows.length} product{rows.length === 1 ? '' : 's'} found
          </span>
          <Button variant="secondary" disabled={!!busy} onClick={() => void run(true)}>{busy === 'check' ? 'Checking…' : 'Check file'}</Button>
          <Button disabled={!!busy} onClick={() => void run(false)}>{busy === 'upload' ? 'Uploading…' : `Upload ${rows.length} product${rows.length === 1 ? '' : 's'}`}</Button>
          {progress ? <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>{progress}</span> : null}
        </div>
      ) : null}

      {report ? (
        <div>
          <div className="row-flex" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tone="success">{report.created} {report.dryRun ? 'ready to upload' : 'added'}</Badge>
            {report.failed ? <Badge tone="danger">{report.failed} with a problem</Badge> : null}
            {report.dryRun && !report.failed ? <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>All good. Press Upload to add them.</span> : null}
            {!report.dryRun && report.created && !report.failed ? <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Done. All products were added.</span> : null}
            {failed.length ? <Button size="sm" variant="secondary" onClick={downloadFailed}>Download rows to fix</Button> : null}
          </div>
          {failed.length ? (
            <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Row</th><th>Product</th><th>Problem</th></tr>
                </thead>
                <tbody>
                  {failed.map((f) => (
                    <tr key={f.row}>
                      <td>{f.row}</td>
                      <td>{f.name || '-'}</td>
                      <td style={{ color: 'var(--danger)' }}>{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
