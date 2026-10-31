import React from 'react';
import { Order } from '../types';
import { Badge } from './ui';

/** Who is delivering the order, or - while it waits - whether any rider can see it in the app. */
export default function RiderCell({ order, stacked = false }: { order: Order; stacked?: boolean }) {
  const rider = typeof order.rider === 'string' ? null : order.rider;
  if (rider) {
    if (!stacked) return <span>{rider.name}{rider.phone ? ` · ${rider.phone}` : ''}</span>;
    return (
      <>
        {rider.name}
        <div className="cell-muted">{rider.phone}</div>
      </>
    );
  }
  if (order.fulfillment === 'shiprocket') return <span className="cell-muted">Shiprocket</span>;
  const pool = order.riderPool;
  if (!pool) return <span className="cell-muted">—</span>;
  if (!pool.linked) return <Badge tone="danger">No rider linked to this warehouse</Badge>;
  if (!pool.canSee) {
    return <Badge tone="danger">{order.longDistance ? 'Long distance: no long-distance rider' : 'All riders paused or long-distance only'}</Badge>;
  }
  return (
    <span className="cell-muted">
      Not assigned · {pool.canSee} rider{pool.canSee === 1 ? '' : 's'} can see it, {pool.online} online
    </span>
  );
}
