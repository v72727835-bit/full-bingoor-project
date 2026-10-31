'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOrders } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import { isFinal } from '../lib/orderStatus';
import { Order } from '../lib/types';
import { Icon } from './Icon';
import s from './OrderProgressToast.module.css';

const DISMISSED_KEY = 'bingoor_order_toast_hidden';
/** The reminder comes back every five minutes until the order arrives. */
const REMIND_AFTER_MS = 5 * 60_000;

function hiddenUntil(orderId: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}') as Record<string, number>;
    return raw[orderId] ?? 0;
  } catch {
    return 0;
  }
}

function hideFor(orderId: string, ms: number) {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}') as Record<string, number>;
    localStorage.setItem(DISMISSED_KEY, JSON.stringify({ ...raw, [orderId]: Date.now() + ms }));
  } catch {
    /* private mode - the reminder just reappears on the next check */
  }
}

/**
 * "Your order is in process" — a standing reminder while an order is on its
 * way. The customer can close it with the ×; it returns five minutes later,
 * and stops for good once the order is delivered or cancelled.
 */
export function OrderProgressToast() {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) {
      setOrder(null);
      return;
    }
    let alive = true;
    const check = () => {
      fetchOrders(1, 5)
        .then(({ items }) => {
          if (!alive) return;
          const live = items.find((o) => !isFinal(o.status)) ?? null;
          setOrder(live);
          setVisible(live ? hiddenUntil(live.id) < Date.now() : false);
        })
        .catch(() => undefined);
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user]);

  if (!order || !visible) return null;

  const eta =
    order.deliveryDays && order.deliveryDays > 1
      ? `in about ${order.deliveryDays} days`
      : 'soon';

  return (
    <div className={s.toast} role="status">
      <span className={s.icon}>
        <Icon name="truck" size={18} />
      </span>
      <div className={s.body}>
        <strong className={s.title}>Your order is in process</strong>
        <p className={s.text}>
          You will get it {eta}.{' '}
          <Link href={`/orders/${order.id}`} className={s.link}>
            Track order {order.orderNumber}
          </Link>
        </p>
      </div>
      <button
        className={s.close}
        aria-label="Hide this reminder"
        onClick={() => {
          hideFor(order.id, REMIND_AFTER_MS);
          setVisible(false);
        }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
