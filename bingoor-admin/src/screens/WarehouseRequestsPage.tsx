import React, { useEffect, useState } from 'react';
import { approveWarehouse, fetchWarehouseApplications, rejectWarehouse } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Modal, formatDate } from '../components/ui';
import type { WarehouseApplication } from '../types';

const TABS = [
  ['pending', 'Waiting'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
] as const;

/** Warehouses that registered themselves on the website. Approving creates the warehouse and opens its panel login. */
export default function WarehouseRequestsPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<WarehouseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rejecting, setRejecting] = useState<WarehouseApplication | null>(null);
  const [reason, setReason] = useState('');

  const load = () => {
    setLoading(true);
    fetchWarehouseApplications({ status, page: 1, limit: 50 })
      .then((r) => setRows(r.items))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [status]);

  const approve = async (r: WarehouseApplication) => {
    if (!window.confirm(`Approve "${r.warehouseApplication?.shopName}"? It becomes a warehouse and can log in to its panel.`)) return;
    setBusyId(r._id);
    setError('');
    try {
      await approveWarehouse(r._id);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId('');
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting._id);
    setError('');
    try {
      await rejectWarehouse(rejecting._id, reason);
      setRejecting(null);
      setReason('');
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouse requests</h1>
          <div className="page-subtitle">Warehouses that registered on the website. Approve one and it can log in to its own panel, add products and assign riders.</div>
        </div>
      </div>
      <div className="row-flex" style={{ marginBottom: 14 }}>
        {TABS.map(([k, label]) => (
          <Button key={k} size="sm" variant={status === k ? 'primary' : 'secondary'} onClick={() => setStatus(k)}>
            {label}
          </Button>
        ))}
      </div>
      <ErrorBanner message={error} />
      {loading ? (
        <CenterSpinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">Nothing here.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Owner</th>
                  <th>Address</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = r.warehouseApplication;
                  return (
                    <tr key={r._id}>
                      <td className="cell-name">
                        {a?.shopName ?? '-'}
                        {a?.gst ? <div className="cell-muted">GST {a.gst}</div> : null}
                      </td>
                      <td className="cell-muted">
                        {r.name}
                        <div>{r.phone}</div>
                        {r.email ? <div>{r.email}</div> : null}
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        {a ? `${a.line1}, ${a.city}, ${a.state} - ${a.pincode}` : '-'}
                        {a ? (
                          <div>
                            <a href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">
                              View on map
                            </a>
                          </div>
                        ) : null}
                        {a?.note ? <div className="cell-muted">{a.note}</div> : null}
                      </td>
                      <td className="cell-muted">{formatDate(r.createdAt)}</td>
                      <td>
                        {r.sellerStatus === 'pending' ? (
                          <div className="row-flex">
                            <Button size="sm" disabled={busyId === r._id} onClick={() => approve(r)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRejecting(r)}>
                              Reject
                            </Button>
                          </div>
                        ) : r.sellerStatus === 'rejected' ? (
                          <div>
                            <Badge tone="danger">Rejected</Badge>
                            {r.sellerRejectReason ? <div className="cell-muted">{r.sellerRejectReason}</div> : null}
                            <Button size="sm" variant="ghost" onClick={() => approve(r)}>
                              Approve anyway
                            </Button>
                          </div>
                        ) : (
                          <Badge tone="success">Approved</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rejecting && (
        <Modal title={`Reject ${rejecting.warehouseApplication?.shopName ?? 'registration'}`} onClose={() => setRejecting(null)}>
          <Field label="Reason (shown to the warehouse when it tries to log in)">
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="row-flex" style={{ marginTop: 12 }}>
            <Button disabled={busyId === rejecting._id || reason.trim().length < 3} onClick={reject}>
              Reject
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
