'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { submitReview } from '../api/catalog';
import { fetchOrders } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Order } from '../lib/types';
import { Icon } from './Icon';
import { Button } from './ui';
import s from './RateOrderPrompt.module.css';

const KEY = 'autozo_rated_orders';

const seen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};
const markSeen = (id: string) => {
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen(), id].slice(-30)));
  } catch {
    /* private mode: it may ask again next visit, which is harmless */
  }
};

/**
 * After an order is delivered, the next time the customer opens the site or
 * app a small sheet asks them to rate what they bought - and, if the admin
 * has set a Google review link, to repeat it there.
 */
export function RateOrderPrompt() {
  const { user } = useAuth();
  const settings = useSettings();
  const [order, setOrder] = useState<Order | null>(null);
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchOrders(1, 5)
      .then(({ items }) => {
        const delivered = items.find((o) => o.status === 'delivered' && !seen().includes(o.id));
        if (delivered) setOrder(delivered);
      })
      .catch(() => undefined);
  }, [user]);

  if (!order) return null;

  const close = () => {
    markSeen(order.id);
    setOrder(null);
  };

  const send = async () => {
    if (!stars) return;
    setBusy(true);
    // The rating goes onto every product in the order.
    await Promise.all(order.items.slice(0, 8).map((i) => submitReview(i.productId, stars).catch(() => undefined)));
    setBusy(false);
    setDone(true);
    markSeen(order.id);
  };

  return (
    <div className={s.sheet} role="dialog" aria-label="Rate your order">
      <button className={s.x} onClick={close} aria-label="Close">
        <Icon name="x" size={16} />
      </button>
      {done ? (
        <>
          <h2 className={s.title}>Thank you!</h2>
          <p className={s.body}>Your rating helps other customers.</p>
          {settings?.googleReviewUrl ? (
            <a className="btn btn-md btn-primary" href={settings.googleReviewUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOrder(null)}>
              Also rate us on Google
            </a>
          ) : (
            <Button onClick={() => setOrder(null)}>Close</Button>
          )}
        </>
      ) : (
        <>
          <h2 className={s.title}>How was your order?</h2>
          <p className={s.body}>
            Order {order.orderNumber} was delivered. Tap a star to rate it.{' '}
            <Link href={`/orders/${order.id}`} onClick={close}>
              View order
            </Link>
          </p>
          <div className={s.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} data-on={n <= stars}>
                <Icon name={n <= stars ? 'star-fill' : 'star'} size={30} />
              </button>
            ))}
          </div>
          <Button full loading={busy} disabled={!stars} onClick={send}>
            Submit rating
          </Button>
        </>
      )}
    </div>
  );
}
