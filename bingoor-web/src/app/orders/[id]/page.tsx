'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { cancelOrder, fetchInvoiceLinks, fetchOrder, reorder } from '../../../api/orders';
import { getErrorMessage } from '../../../lib/client';
import { FLOW, STATUS_BLURB, STATUS_LABEL, STATUS_TONE, isFinal } from '../../../lib/orderStatus';
import { fitClass } from '../../../lib/art';
import { Order } from '../../../lib/types';
import { useCart } from '../../../context/CartContext';
import { useToast } from '../../../context/ToastContext';
import { Crumbs } from '../../../components/Crumbs';
import { Icon } from '../../../components/Icon';
import { GoogleDeliveryMap } from '../../../components/GoogleDeliveryMap';
import { LiveTrackMap } from '../../../components/LiveTrackMap';
import { RequireAuth } from '../../../components/RequireAuth';
import { Alert, Badge, Button, PageLoader } from '../../../components/ui';
import s from '../orders.module.css';

function OrderInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const placed = useSearchParams().get('placed') === '1';
  const { refresh } = useCart();
  const { show } = useToast();

  const [o, setO] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setO(await fetchOrder(id));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the order is still moving — the shop and rider update it.
  useEffect(() => {
    if (!o || isFinal(o.status)) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [o, load]);

  if (error)
    return (
      <div className="page" style={{ paddingTop: 24, maxWidth: 560 }}>
        <Alert tone="bad">{error}</Alert>
        <Link href="/orders" className="btn btn-md btn-outline">
          All orders
        </Link>
      </div>
    );

  if (!o) return <PageLoader label="Loading your order…" />;

  const step = FLOW.indexOf(o.status);
  const loc = o.address.location;
  const canCancel = o.status === 'placed' || o.status === 'accepted';

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      show(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page rise">
      <Crumbs trail={[{ label: 'My orders', href: '/orders' }, { label: `#${o.orderNumber}` }]} />

      {placed ? (
        <div className={s.won}>
          <span className={s.wonIcon}>
            <Icon name="check" size={26} strokeWidth={2.6} />
          </span>
          <div>
            <h1 className="h2">Order placed</h1>
            <p className="body-sm">The shop has been notified and will have it on the way shortly.</p>
          </div>
        </div>
      ) : null}

      <div className="page-head">
        <div>
          <h1 className="h1 num">#{o.orderNumber}</h1>
          <p className="body-sm">
            {new Date(o.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'long',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
      </div>

      <div className="side-grid">
        <div className="stack" style={{ gap: 16 }}>
          {step >= 0 ? (
            <section className="card card-pad">
              <h2 className="h3" style={{ marginBottom: 18 }}>
                Order progress
              </h2>
              <ol className={s.track}>
                {FLOW.map((st, i) => {
                  const done = i < step;
                  const now = i === step;
                  return (
                    <li key={st} data-done={done} data-now={now}>
                      <span className={s.node}>
                        {done ? (
                          <Icon name="check" size={13} strokeWidth={3} />
                        ) : now ? (
                          <span className={s.nowDot} />
                        ) : null}
                      </span>
                      <span className={s.text}>
                        <span className={s.tLabel}>{STATUS_LABEL[st]}</span>
                        {now ? <span className={s.tBlurb}>{STATUS_BLURB[st]}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {!isFinal(o.status) ? (
                <p className={`body-sm ${s.auto}`}>
                  <span className={s.pulse} />
                  This updates automatically
                </p>
              ) : null}
            </section>
          ) : (
            <section className="card card-pad">
              <Alert tone="bad" icon="info">
                Ye order {STATUS_LABEL[o.status].toLowerCase()}.
              </Alert>
            </section>
          )}

          {o.deliveryOtp && !isFinal(o.status) ? (
            <section className={`card ${s.otp}`}>
              <div>
                <span className="eyebrow">Delivery OTP</span>
                <p className={s.otpBody}>Share this with your rider only after you receive your order</p>
              </div>
              <span className={`num ${s.code}`}>{o.deliveryOtp}</span>
            </section>
          ) : null}

          {['accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o.status) && o.address.location ? (
            <LiveTrackMap order={o} />
          ) : o.status === 'out_for_delivery' ? (
            <RiderTracking order={o} />
          ) : null}

          <section className="card">
            <h2 className={`h3 ${s.secTitle}`}>
              {o.items.length} item{o.items.length > 1 ? 's' : ''}
            </h2>
            {o.items.map((it) => (
              <div key={it.productId} className={s.line}>
                <span className={s.lineArt}>
                  <Image src={it.image || it.art} alt="" width={60} height={60} className={fitClass(it.image, s.lineArtImg)} unoptimized />
                </span>
                <span className={s.lineBody}>
                  <span className={`${s.lineName} clamp-1`}>{it.name}</span>
                  <span className={s.lineMeta}>
                    {it.unit ? `${it.unit} · ` : ''}₹{it.price} × {it.quantity}
                  </span>
                </span>
                <span className={`num ${s.lineTotal}`}>₹{it.lineTotal}</span>
              </div>
            ))}
            <div className={s.bill}>
              <BillRow label="Item total" value={`₹${o.subtotal}`} />
              <BillRow
                label="Delivery"
                value={o.deliveryFee === 0 ? 'FREE' : `₹${o.deliveryFee}`}
                good={o.deliveryFee === 0}
              />
              <hr className="divider" style={{ margin: '10px 0' }} />
              <BillRow label="Total" value={`₹${o.total}`} big />
              <p className="body-sm" style={{ marginTop: 6 }}>
                {o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'}
              </p>
            </div>
          </section>
        </div>

        <aside className="stack" style={{ gap: 16 }}>
          <section className="card card-pad">
            <h2 className="h3" style={{ marginBottom: 12 }}>
              Delivery address
            </h2>
            <p className={s.who}>
              {o.address.name} · {o.address.phone}
            </p>
            <p className={s.addr}>
              {[
                o.address.line1,
                o.address.line2,
                o.address.landmark,
                o.address.city,
                o.address.state,
                o.address.pincode,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
            {loc ? (
              <GoogleDeliveryMap destination={loc} />
            ) : null}
            {o.note ? (
              <p className={s.note}>
                <Icon name="info" size={14} />
                {o.note}
              </p>
            ) : null}
          </section>

          <div className="stack" style={{ gap: 10 }}>
            {canCancel ? (
              <Button
                variant="danger"
                full
                loading={busy}
                onClick={() =>
                  act(async () => {
                    setO(await cancelOrder(o.id));
                    show('Your order has been cancelled', 'success');
                  })
                }
              >
                Cancel order
              </Button>
            ) : null}
            {isFinal(o.status) ? (
              <Button
                variant="outline"
                full
                icon="repeat"
                loading={busy}
                onClick={() =>
                  act(async () => {
                    await reorder(o.id);
                    await refresh();
                    router.push('/cart');
                  })
                }
              >
                Order again
              </Button>
            ) : null}
            <Button
              variant="outline"
              full
              icon="download"
              loading={busy}
              onClick={() => {
                // Open the tab first so the pop-up blocker lets it through, then point it at the bill.
                const tab = window.open('', '_blank');
                act(async () => {
                  try {
                    const links = await fetchInvoiceLinks(o.id);
                    if (tab) tab.location.href = links.a4;
                    else window.location.href = links.a4;
                  } catch (e) {
                    tab?.close();
                    throw e;
                  }
                });
              }}
            >
              Download invoice
            </Button>
            <Link href="/orders" className="btn btn-md btn-ghost btn-full">
              All orders
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function BillRow({ label, value, big, good }: { label: string; value: string; big?: boolean; good?: boolean }) {
  return (
    <div className={s.billRow} data-big={big ? 'true' : 'false'}>
      <span>{label}</span>
      <span className={`num ${good ? s.good : ''}`}>{value}</span>
    </div>
  );
}

export default function OrderPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<PageLoader />}>
        <OrderInner />
      </Suspense>
    </RequireAuth>
  );
}

/** Straight-line distance in km between two points. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Where the rider is right now. The rider app reports its position every few
 * seconds and this page polls, so the pin moves as the parcel comes closer.
 * The shared Google map displays the latest rider position.
 */
function RiderTracking({ order }: { order: Order }) {
  const at = order.riderLocation;
  const home = order.address.location;
  if (!at) {
    return (
      <section className={`card ${s.track}`}>
        <span className="eyebrow">On the way</span>
        <p className={s.trackText}>
          {order.rider ? `${order.rider.name} has picked up your order.` : 'Your rider has picked up your order.'} Live location appears
          here as soon as their phone shares it.
        </p>
      </section>
    );
  }
  const away = home ? km(at, home) : null;
  return (
    <section className={`card ${s.track}`}>
      <div className={s.trackHead}>
        <div>
          <span className="eyebrow">Live tracking</span>
          <p className={s.trackText}>
            {order.rider?.name ?? 'Your rider'} is {away === null ? 'on the way' : away < 0.15 ? 'at your door' : `${away.toFixed(1)} km away`}
          </p>
        </div>
        {order.rider?.phone ? (
          <a className="btn btn-outline btn-sm" href={`tel:${order.rider.phone}`}>
            Call rider
          </a>
        ) : null}
      </div>
      <GoogleDeliveryMap destination={home ?? at} rider={at} />
      <a className={s.trackLink} href={`https://www.google.com/maps?q=${at.lat},${at.lng}`} target="_blank" rel="noreferrer">
        Open in Google Maps
      </a>
    </section>
  );
}
