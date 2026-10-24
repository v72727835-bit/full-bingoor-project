'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { fetchOrders } from '../../api/orders';
import { getErrorMessage } from '../../lib/client';
import { STATUS_LABEL, STATUS_TONE, isFinal } from '../../lib/orderStatus';
import { fitClass } from '../../lib/art';
import { Order } from '../../lib/types';
import { Crumbs } from '../../components/Crumbs';
import { Icon } from '../../components/Icon';
import { RequireAuth } from '../../components/RequireAuth';
import { Alert, Badge, EmptyState } from '../../components/ui';
import s from './orders.module.css';

function OrdersInner() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrders()
      .then((r) => setOrders(r.items))
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <div className="page">
      <Crumbs trail={[{ label: 'My orders' }]} />
      <h1 className="h1" style={{ marginBottom: 20 }}>
        Your orders
      </h1>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      {!orders ? (
        <div className="stack" style={{ gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="sk" style={{ height: 118, borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="package"
          title="No orders yet"
          body="Place your first order and we will deliver it in minutes."
          action={
            <Link href="/" className="btn btn-md btn-primary">
              Start shopping
            </Link>
          }
        />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className={`card card-hover ${s.row}`}>
              <div className={s.top}>
                <span className={`num ${s.on}`}>#{o.orderNumber}</span>
                <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                {!isFinal(o.status) ? (
                  <span className={s.live}>
                    <span className={s.pulse} />
                    Live
                  </span>
                ) : null}
              </div>

              <div className={s.arts}>
                {o.items.slice(0, 5).map((it) => (
                  <span key={it.productId} className={s.art}>
                    <Image src={it.image || it.art} alt="" width={52} height={52} className={fitClass(it.image, s.artImg)} unoptimized />
                  </span>
                ))}
                {o.items.length > 5 ? <span className={`num ${s.more}`}>+{o.items.length - 5}</span> : null}
              </div>

              <div className={s.foot}>
                <span className="body-sm">
                  {new Date(o.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · {o.items.length} item{o.items.length > 1 ? 's' : ''}
                </span>
                <span className={`num ${s.total}`}>₹{o.total}</span>
                <Icon name="chevron-right" size={17} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersInner />
    </RequireAuth>
  );
}
