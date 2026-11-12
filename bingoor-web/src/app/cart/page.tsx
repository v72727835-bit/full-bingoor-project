'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useCatalog } from '../../context/CatalogContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import { useSlot } from '../../context/SlotContext';
import { useToast } from '../../context/ToastContext';
import { getTip, setTip } from '../../lib/tip';
import { useQuote } from '../../lib/useQuote';
import { DeliverySlots } from '../../components/DeliverySlots';
import { fitClass } from '../../lib/art';
import { getErrorMessage } from '../../lib/client';
import { shortDelivery } from '../../lib/deliveryText';
import { Icon } from '../../components/Icon';
import { QuantityStepper } from '../../components/QuantityStepper';
import { TopUpSheet } from '../../components/TopUpSheet';
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard';
import { fetchPointsProducts } from '../../api/catalog';
import { Product } from '../../lib/types';
import { Alert, Badge, Button, EmptyState, PageLoader } from '../../components/ui';
import s from './cart.module.css';

/** Point 15: how long a customer has to pick a top-up product after removing the one added for them. */
const AUTO_ADD_SECONDS = 30;

function CartInner() {
  const { cart, loading, guest, updateItem, removeItem, clear, addItem } = useCart();
  const { home } = useCatalog();
  const { show } = useToast();
  const { t, name } = useLanguage();
  const settings = useSettings();
  const { slot, slots, label } = useSlot();
  const accountQuote = useQuote(slot, cart?.total);
  // A visitor's basket carries its own quote (priced for their chosen location).
  const quote = guest ? (cart?.quote ?? null) : accountQuote;
  const [askLogin, setAskLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  // #35: the "See all products" half-page sheet over the cart.
  const [showAll, setShowAll] = useState(false);

  // Point 15: the shopping minimum for this customer's distance (₹199, ₹1199…)
  // comes first. Without a priced quote the shops' own minimums stand in.
  // The basket as a whole is what counts here (a top-up from another warehouse must not flip it).
  const minMet = quote ? quote.subtotal >= quote.minOrder : (cart?.groups ?? []).every((g) => g.meetsMinOrder);

  // The hidden points rule: the moment the minimum is met and the basket is
  // still short of points, one top-up (50-point) product is added for the
  // customer. If they take it out they are told it is mandatory, and unless
  // they pick one from the row within 30 seconds one is added again.
  const autoTried = useRef(false);
  // The product added for the customer, and the ones they took out again: a
  // removed product is never put back, and each time a different one is used.
  const autoAdded = useRef<string | null>(null);
  const removedIds = useRef<Set<string>>(new Set());
  const pickTopUp = useCallback(
    (preferred?: string | null) => {
      const pool = (cart?.points.suggestions ?? []).map((x) => String(x.productId)).filter((id) => !removedIds.current.has(id));
      if (preferred && pool.includes(String(preferred))) return String(preferred);
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    },
    [cart?.points.suggestions],
  );
  const [removedAuto, setRemovedAuto] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => {
    const pts = cart?.points;
    if (!pts?.enabled) return;
    if (pts.met) {
      // Keep `autoTried`: if the added product is taken out, the customer is
      // warned instead of it silently coming straight back.
      setRemovedAuto(false);
      return;
    }
    if (!minMet) {
      // Back under the minimum: start over once it is reached again.
      autoTried.current = false;
      setRemovedAuto(false);
      return;
    }
    if (!autoTried.current && pts.autoAddId) {
      autoTried.current = true;
      const id = pickTopUp(pts.autoAddId);
      if (id) {
        autoAdded.current = id;
        addItem(id).catch(() => undefined);
      }
    } else if (autoTried.current) {
      if (autoAdded.current) removedIds.current.add(autoAdded.current);
      setRemovedAuto(true);
    }
  }, [cart?.points, minMet, addItem, pickTopUp]);

  useEffect(() => {
    if (!removedAuto) {
      setCountdown(null);
      return;
    }
    setCountdown(AUTO_ADD_SECONDS);
    // Bring the warning into view - the customer is usually looking at the item they just removed.
    requestAnimationFrame(() => document.getElementById('topup-warn')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    const t = setInterval(() => setCountdown((c) => (c === null ? null : Math.max(0, c - 1))), 1000);
    return () => clearInterval(t);
  }, [removedAuto]);
  useEffect(() => {
    if (countdown !== 0) return;
    const id = pickTopUp();
    setRemovedAuto(false);
    if (id) {
      autoAdded.current = id;
      addItem(id).catch(() => undefined);
    }
  }, [countdown, addItem, pickTopUp]);

  // Full product cards for the top-up rows (the cart itself only carries a summary of each).
  // 6-day aisles: only when EVERY item is from one does the cart take the slow promise.
  const allCartItems = cart ? cart.groups.flatMap((g) => g.items) : [];
  const sixDayOnly =
    allCartItems.length > 0 && allCartItems.every((i) => (i.deliveryDays ?? 0) > 1)
      ? allCartItems.reduce((m, i) => Math.max(m, i.deliveryDays ?? 0), 0)
      : 0;
  const topUpOpen = !!cart?.points.enabled && !cart.points.met && minMet;
  const [topProducts, setTopProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    if (!topUpOpen || topProducts) return;
    fetchPointsProducts()
      .then(setTopProducts)
      .catch(() => setTopProducts([]));
  }, [topUpOpen, topProducts]);
  const suggestionIds = new Set((cart?.points.suggestions ?? []).map((x) => String(x.productId)));

  const [tip, setTipState] = useState(0);
  useEffect(() => setTipState(getTip()), []);
  const chooseTip = (n: number) => {
    const next = tip === n ? 0 : n;
    setTipState(next);
    setTip(next);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      show(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !cart) return <PageLoader label="Loading your cart…" />;

  if (!cart || cart.itemCount === 0)
    return (
      <div className="page">
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          body="Add what you need and we will deliver it in minutes."
          action={
            <Link href="/" className="btn btn-md btn-primary">
              Start shopping
              <Icon name="arrow-right" size={16} />
            </Link>
          }
        />
      </div>
    );

  const left = Math.max(0, cart.freeDeliveryAbove - cart.subtotal);
  // Only while a delivery charge is actually being paid.
  const freeGap = quote ? (quote.deliveryFee > 0 ? Math.ceil(quote.addForFree) : 0) : cart.deliveryFee > 0 ? Math.ceil(left) : 0;

  return (
    <div className="page rise" style={{ paddingTop: 22 }}>
      {/* The delivery promise is the headline of this page, so it sits centred
          and large rather than tucked under the title. */}
      <div className={s.eta}>
        <Icon name="bolt" size={20} />
        <span className={s.etaTime}>
          {/* The real promise comes from the distance: far addresses are next day or a few working days. */}
          {sixDayOnly > 1
            ? `${t('delivery')}: ${sixDayOnly} days`
            : quote && quote.days > 0
            ? `${t('delivery')}: ${quote.days === 1 ? 'Next day delivery' : `${quote.days} working days`}`
            : slot === 'instant' && home
              ? `${t('delivery')}: ${shortDelivery(home)}`
              : `${t('delivery')}: ${label}`}
        </span>
      </div>
      {settings?.supportPhone ? (
        <a className={s.care} href={`tel:${settings.supportPhone}`}>
          <Icon name="phone" size={15} />
          {t('needHelp')} <b>{settings.supportPhone}</b>
        </a>
      ) : null}
      {/* Point 18: the header's delivery time is not repeated here. A same-day
          address only gets the other times on offer, as an optional change. */}
      {slots.length > 1 && !(quote && quote.days > 0) ? <DeliverySlots compact laterOnly /> : null}

      <div className="page-head">
        <div>
          <h1 className="h1">{t('yourCart')}</h1>
          <p className="body-sm">
            {cart.itemCount} item{cart.itemCount > 1 ? 's' : ''} in your cart
          </p>
        </div>
        <Button variant="ghost" size="sm" icon="trash" onClick={() => run(clear)}>
          Clear cart
        </Button>
      </div>

      {quote && !quote.meetsMinOrder ? (
        <Alert tone="bad">
          {quote.subtotal < quote.minOrder
            ? `Shop at least ₹${quote.minOrder} to check out — add ₹${Math.ceil(quote.minOrder - quote.subtotal)} more.`
            : // The basket is big enough, but one warehouse's part of it is not.
              `Each delivery needs at least ₹${quote.minOrder}. Add more from the delivery marked below, or remove it.`}
        </Alert>
      ) : null}
      {quote?.longDistance ? (
        <Alert tone="brand" icon="truck">
          You are far from our warehouse, so delivery takes about {quote.days} days. Cash on delivery is not available for long distance.
        </Alert>
      ) : null}

      {cart.hasIssues ? <Alert tone="bad">Some items need your attention — please review them below.</Alert> : null}

      <div className="side-grid">
        <div className="stack" style={{ gap: 16 }}>
          {/* One basket: the warehouses filling it stay behind the scenes, so every item is in one list. */}
          {[cart.groups.length > 1 ? {
            ...cart.groups[0],
            shop: { ...cart.groups[0].shop, isOpen: cart.groups.every((x) => x.shop.isOpen) },
            items: cart.groups.flatMap((x) => x.items),
            subtotal: Math.round(cart.groups.reduce((n, x) => n + x.subtotal, 0) * 100) / 100,
            meetsMinOrder: true,
          } : cart.groups[0]].filter(Boolean).map((g) => (
            <section key={g.shop.id} className={`card ${s.shopCard}`}>
              <header className={s.shopHead}>
                <span className={s.shopIcon}>
                  <Icon name="store" size={17} />
                </span>
                <span className={`${s.shopName} clamp-1`}>Your items</span>
                {g.shop.isOpen ? null : <Badge tone="bad">Closed</Badge>}
              </header>

              {g.items.map((it) => (
                <div key={it.productId} className={s.line}>
                  <Link href={`/products/${it.slug}`} className={s.thumb}>
                    <Image src={it.image || it.art} alt="" width={96} height={96} className={fitClass(it.image, s.thumbArt)} unoptimized />
                  </Link>
                  <div className={s.lineBody}>
                    <Link href={`/products/${it.slug}`} className={`${s.lineName} clamp-2`}>
                      {name(it)}
                    </Link>
                    {it.unit ? <span className={s.lineUnit}>{it.unit}</span> : null}
                    {it.issue ? <span className={s.lineIssue}>{it.issue}</span> : null}
                    <div className={s.lineFoot}>
                      <QuantityStepper
                        size="sm"
                        quantity={it.quantity}
                        busy={busy}
                        onAdd={() => {}}
                        onIncrement={() => run(() => updateItem(it.productId, it.quantity + 1))}
                        onDecrement={() => run(() => updateItem(it.productId, it.quantity - 1))}
                      />
                      <button className={s.rm} onClick={() => run(() => removeItem(it.productId))} aria-label="Remove">
                        <Icon name="trash" size={15} />
                      </button>
                      <span className={`num ${s.lineTotal}`}>₹{it.lineTotal}</span>
                    </div>
                  </div>
                </div>
              ))}

              <footer className={s.shopFoot}>
                {!g.meetsMinOrder ? (
                  <span className={s.minWarn}>
                    <Icon name="info" size={14} />
                    Minimum order of ₹{g.shop.minOrderAmount}
                  </span>
                ) : (
                  <span className="body-sm">Item total</span>
                )}
                <span className="num" style={{ fontWeight: 700 }}>
                  ₹{g.subtotal}
                </span>
              </footer>
            </section>
          ))}
          {cart.points.enabled && !cart.points.met && minMet && cart.points.suggestions.length > 0 ? (
            <section className={`card ${s.topup}`}>
              {removedAuto ? (
                <p id="topup-warn" className={s.topupWarn} role="alert">
                  <Icon name="info" size={16} />
                  <span>
                    Don&apos;t delete this product, this is mandatory. If you delete this, then add at least any 1 product from the
                    product list below, else within {AUTO_ADD_SECONDS} seconds 1 product will be added automatically from the list
                    below. Then you can place your order and make payment easily.
                    {countdown !== null ? <b className={s.topupTimer}> Adding 1 product in {countdown}s</b> : null}
                  </span>
                </p>
              ) : (
                <p className={s.topupNote}>Add any one product from below to proceed to payment</p>
              )}
              {/* Blinkit-style: the first products as full cards (ADD on the photo), then "See all". */}
              <div className={s.topupGrid}>
                {topProducts
                  ? topProducts
                      .filter((p) => suggestionIds.has(p.id))
                      .slice(0, 6)
                      .map((p) => <ProductCard key={p.id} product={p} compact />)
                  : Array.from({ length: 3 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
              <button type="button" className={s.topupAll} onClick={() => setShowAll(true)}>
                {cart.points.suggestions.some((x) => x.image || x.art) ? (
                  <span className={s.topupAllImgs} aria-hidden="true">
                    {cart.points.suggestions
                      .filter((x) => x.image || x.art)
                      .slice(0, 3)
                      .map((sg) => (
                        <span key={sg.productId} className={s.topupAllImg}>
                          <img src={sg.image || sg.art} alt="" />
                        </span>
                      ))}
                  </span>
                ) : null}
                See all products
                <Icon name="chevron-right" size={16} />
              </button>
            </section>
          ) : null}
        </div>

        <TopUpSheet open={showAll} onClose={() => setShowAll(false)} onlyIds={suggestionIds} />

        <aside className={`card side-sticky ${s.summary}`}>
          <h2 className="h3" style={{ marginBottom: 14 }}>
            Bill summary
          </h2>
          <Row label={t('itemTotal')} value={`₹${cart.subtotal}`} />
          <Row
            label={t('handling')}
            value={`₹${quote?.handlingFee ?? settings?.pricing?.handlingFee ?? 2}`}
          />
          {quote ? (
            <Row
              label={t('delivery')}
              value={quote.deliveryFee === 0 ? `${t('free')}` : `₹${quote.deliveryFee}`}
              good={quote.deliveryFee === 0}
              was={quote.deliveryFee === 0 && quote.baseDeliveryFee > 0 ? `₹${quote.baseDeliveryFee}` : undefined}
            />
          ) : (
            <Row label={t('delivery')} value={cart.deliveryFee === 0 ? t('free') : `₹${cart.deliveryFee}`} good={cart.deliveryFee === 0} />
          )}
          {/* Blinkit-style: how far from free delivery, right under the delivery charge. */}
          {freeGap > 0 ? <p className={s.freeHint}>Shop for ₹{freeGap} more to get FREE delivery</p> : null}
          {quote && quote.twoHourFee > 0 ? <Row label="2 hour delivery" value={`₹${quote.twoHourFee}`} /> : null}
          <hr className="divider" style={{ margin: '12px 0' }} />
          {tip > 0 ? <Row label="Tip for delivery partner" value={`₹${tip}`} /> : null}
          <Row label={t('toPay')} value={`₹${(quote ? quote.total : cart.total) + tip}`} big />
          <TipPicker tip={tip} onPick={chooseTip} />
          <div className={s.policy}>
            <b>Cancellation policy</b>
            <p>
              Orders cannot be cancelled once packed for delivery. If an item is damaged, missing or the order is delayed a lot, you get a refund.{' '}
              <Link href="/cancellation">Read the full policy</Link>
            </p>
          </div>
          {(() => {
            const blocked = cart.hasIssues || !cart.points.met || (quote ? !quote.meetsMinOrder : false);
            return (
              <div style={{ marginTop: 18 }}>
                <Link
                  href="/checkout"
                  className={`btn btn-lg btn-primary btn-full ${blocked ? s.off : ''} ${!cart.points.met ? s.mono : ''}`}
                  aria-disabled={blocked}
                  onClick={(e) => {
                    if (blocked) return e.preventDefault();
                    // #23: browsing and the cart are open to everyone; an account is needed only to pay.
                    if (guest) {
                      e.preventDefault();
                      setAskLogin(true);
                      // The choice opens right under the button; keep it on screen.
                      requestAnimationFrame(() => document.getElementById('ask-login')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
                    }
                  }}
                >
                  {t('proceed')}
                  <Icon name="arrow-right" size={17} />
                </Link>
                {askLogin ? (
                  <div id="ask-login" className={s.ask} role="dialog" aria-labelledby="ask-login-title">
                    <button type="button" className={s.askClose} onClick={() => setAskLogin(false)} aria-label="Close">
                      <Icon name="x" size={18} />
                    </button>
                    <h2 id="ask-login-title" className="h3">
                      Create your account to continue
                    </h2>
                    <p className="body-sm" style={{ margin: '6px 0 14px' }}>
                      Your cart is saved. Make a free account (or sign in) and we will take you straight to payment.
                    </p>
                    <Link href="/signup?next=%2Fcheckout" className="btn btn-lg btn-primary btn-full">
                      Create account
                    </Link>
                    <Link href="/login?next=%2Fcheckout" className="btn btn-lg btn-outline btn-full" style={{ marginTop: 10 }}>
                      I already have an account
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })()}
          <p className={`body-sm ${s.safe}`}>
            <Icon name="shield" size={14} />
            Choose cash on delivery or online payment at checkout
          </p>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, big, good, was }: { label: string; value: string; big?: boolean; good?: boolean; was?: string }) {
  return (
    <div className={s.row} data-big={big ? 'true' : 'false'}>
      <span>{label}</span>
      <span className={`num ${good ? s.good : ''}`}>
        {was ? <s className={s.was}>{was} </s> : null}
        {value}
      </span>
    </div>
  );
}

export default function CartPage() {
  return <CartInner />;
}

function TipPicker({ tip, onPick }: { tip: number; onPick: (n: number) => void }) {
  const [custom, setCustom] = useState('');
  return (
    <div className={s.tip}>
      <b>Tip your delivery partner</b>
      <p>Your kindness means a lot. 100% of the tip goes to the delivery partner.</p>
      <div className={s.tipRow}>
        {[10, 20, 30, 50].map((n) => (
          <button key={n} type="button" className={s.tipChip} data-on={tip === n} onClick={() => onPick(n)}>
            ₹{n}
          </button>
        ))}
        <input
          className={s.tipInput}
          inputMode="numeric"
          placeholder="Other"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onBlur={() => {
            const n = Number(custom);
            if (n > 0) onPick(Math.min(500, n));
          }}
        />
      </div>
    </div>
  );
}
