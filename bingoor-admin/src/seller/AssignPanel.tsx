"use client";

import React, { useEffect, useState } from 'react';
import { NavLink } from '../navigation';
import { OrderRiders, sellerAssignRider, sellerAssignShiprocket, sellerOrderRiders } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, ErrorBanner } from '../components/ui';
import type { Tone } from '../components/ui';

const STATE: Record<string, { label: string; tone: Tone }> = {
  free: { label: 'Free', tone: 'success' },
  busy: { label: 'On a delivery', tone: 'brand' },
  offline: { label: 'Offline', tone: 'muted' },
  paused: { label: 'Paused', tone: 'danger' },
  long_distance_only: { label: 'Long-distance rider only', tone: 'muted' },
  not_long_distance: { label: 'Not a long-distance rider', tone: 'muted' },
};

/**
 * The riders of the warehouse that serves this order, with who is free. Free riders can be
 * assigned in one tap; the others show why they cannot take the order right now.
 */
export default function AssignPanel({ orderId, onAssigned }: { orderId: string; onAssigned: () => void }) {
  const [data, setData] = useState<OrderRiders | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refresh = () => sellerOrderRiders(orderId).then(setData).catch((e) => setError(getErrorMessage(e)));
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const pick = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      await sellerAssignRider(orderId, id);
      onAssigned();
    } catch (e) {
      setError(getErrorMessage(e));
      refresh();
    } finally {
      setBusy('');
    }
  };

  const sendShiprocket = async () => {
    setBusy('shiprocket');
    setError('');
    try {
      await sellerAssignShiprocket(orderId);
      onAssigned();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={{ margin: '12px 0', padding: 12, border: '1px solid var(--border)', borderRadius: 12 }}>
      <div className="stat-label" style={{ marginBottom: 6 }}>How should this order be delivered?</div>
      <div className="row-flex" style={{ justifyContent: 'space-between', padding: '8px 10px', marginBottom: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(124,108,255,.06)' }}>
        <span>📦 <b>Shiprocket courier</b> <span className="cell-muted">sync this order for pickup</span></span>
        <Button size="sm" variant="secondary" disabled={!!busy} onClick={sendShiprocket}>
          {busy === 'shiprocket' ? 'Sending…' : 'Send to Shiprocket'}
        </Button>
      </div>
      <div className="stat-label" style={{ marginBottom: 4 }}>Or give it to a rider</div>
      {data && (
        <div className="cell-muted" style={{ marginBottom: 8 }}>
          {data.warehouse}
          {data.radiusKm ? ` · delivers within ${data.radiusKm} km` : ''}
          {data.distanceKm !== null ? ` · this order is ${data.distanceKm} km away` : ''}
          {data.longDistance ? ' · long-distance order' : ''}
        </div>
      )}
      <ErrorBanner message={error} />
      {!data ? (
        <span className="cell-muted">Loading riders…</span>
      ) : data.riders.length === 0 ? (
        <div className="cell-muted">
          This warehouse has no riders yet. <NavLink to="/riders" className="btn btn-sm btn-secondary">Add a rider</NavLink>
        </div>
      ) : (
        <>
          {data.riders.map((r) => {
            const st = STATE[r.state] ?? { label: r.state, tone: 'muted' as Tone };
            return (
              <div key={r._id} className="row-flex" style={{ justifyContent: 'space-between', padding: '6px 0', opacity: r.free ? 1 : 0.7 }}>
                <span>
                  <span className={`dot${r.state === 'free' || r.state === 'busy' ? ' dot-on' : ''}`} /> <b>{r.name}</b> <span className="cell-muted">{r.phone}</span>
                </span>
                <span className="row-flex">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {r.free && (
                    <Button size="sm" disabled={!!busy} onClick={() => pick(r._id)}>
                      {busy === r._id ? 'Assigning…' : 'Assign'}
                    </Button>
                  )}
                </span>
              </div>
            );
          })}
          {!data.riders.some((r) => r.free) && <div className="cell-muted">No rider is free right now. This list refreshes every 15 seconds.</div>}
        </>
      )}
    </div>
  );
}
