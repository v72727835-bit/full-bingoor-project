import React, { useEffect, useState } from 'react';
import { deleteEnquiry, fetchEnquiries } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, formatDate } from '../components/ui';
import { ENQUIRY_LABELS, Enquiry } from '../types';

/** Everything customers, partners and complainers submit through the six website forms. */
export default function EnquiriesPage() {
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetchEnquiries({ page: 1, limit: 50, kind: kind || undefined })
      .then((r) => setRows(r.items))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [kind]);

  const remove = async (id: string) => {
    if (!window.confirm('Delete this enquiry?')) return;
    await deleteEnquiry(id).catch((e) => setError(getErrorMessage(e)));
    setRows((cur) => cur.filter((r) => r._id !== id));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Enquiries</h1>
          <div className="page-subtitle">Submissions from the six website forms: city manager, investors, delivery partners, sellers, advertisers and complaints.</div>
        </div>
      </div>
      <div className="row-flex" style={{ marginBottom: 14 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All forms</option>
          {Object.entries(ENQUIRY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <ErrorBanner message={error} />
      {loading ? (
        <CenterSpinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">No enquiries yet.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Who</th>
                  <th>Contact</th>
                  <th>Reason</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <Badge tone={r.kind === 'complaint' ? 'danger' : 'info'}>{ENQUIRY_LABELS[r.kind] ?? r.kind}</Badge>
                    </td>
                    <td className="cell-name">{r.fullName}</td>
                    <td className="cell-muted">
                      {r.mobile}
                      {r.otherPhone ? ` / ${r.otherPhone}` : ''}
                      <div>{r.email}</div>
                    </td>
                    <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{r.reason}</td>
                    <td className="cell-muted">{formatDate(r.createdAt)}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => remove(r._id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
