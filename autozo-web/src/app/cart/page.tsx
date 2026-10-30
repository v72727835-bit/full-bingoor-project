'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
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
import { Rail } from '../../components/Rail';
import { TopUpSheet } from '../../components/TopUpSheet';
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
      addItem(pts.autoAddId).catch(() => undefined);
    } else if (autoTried.current) {
      setRemovedAuto(true);
    }
  }, [cart?.points, minMet, addItem]);

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
    const id = cart?.points.autoAddId ?? cart?.points.suggestions[0]?.productId;
    setRemovedAuto(false);
    if (id) addItem(id).catch(() => undefined);
  }, [countdown, cart?.points, addItem]);

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
  const pct = cart.freeDeliveryAbove ? Math.min(100, (cart.subtotal / cart.freeDeliveryAbove) * 100) : 0;

  return (
    <div className="page rise" style={{ paddingTop: 22 }}>
      {/* The delivery promise is the headline of this page, so it sits centred
          and large rather than tucked under the title. */}
      <div className={s.eta}>
        <Icon name="bolt" size={20} />
        <span className={s.etaTime}>
          {/* The real promise comes from the distance: far addresses are next day or a few working days. */}
          {quote && quote.days > 0
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

      {quote && quote.addForFree > 0 ? (
        <div className={s.freeBar}>
          <div className={s.freeTop}>
            <Icon name="truck" size={17} />
            <span>
              For free delivery, shop ₹{quote.freeAbove} — add <b>₹{quote.addForFree}</b> more
            </span>
          </div>
          <div className={s.track}>
            <span className={s.fill} style={{ width: `${Math.min(100, (quote.subtotal / quote.freeAbove) * 100)}%` }} />
          </div>
        </div>
      ) : quote ? null : cart.freeDeliveryAbove > 0 ? (
        <div className={s.freeBar}>
          <div className={s.freeTop}>
            <Icon name="truck" size={17} />
            <span>
              {left > 0 ? (
                <>
                  Add <b>₹{left}</b> more to get free delivery
                </>
              ) : (
                'You have unlocked free delivery'
              )}
            </span>
          </div>
          <div className={s.track}>
            <span className={s.fill} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {quote && !quote.meetsMinOrder ? (
        <Alert tone="bad">
          Shop at least ₹{quote.minOrder} to check out — add ₹{Math.round(quote.minOrder - quote.subtotal)} more.
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
          {cart.groups.map((g) => (
            <section key={g.shop.id} className={`card ${s.shopCard}`}>
              <header className={s.shopHead}>
                <span className={s.shopIcon}>
                  <Icon name="store" size={17} />
                </span>
                <span className={`${s.shopName} clamp-1`}>{cart.groups.length > 1 ? `Delivery ${cart.groups.indexOf(g) + 1}` : 'Your items'}</span>
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
                    This shop has a minimum order of ₹{g.shop.minOrderAmount}
                  </span>
                ) : (
                  <span className="body-sm">Shop subtotal</span>
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
              {rowsOf(cart.points.suggestions).map((row, r) => (
                <Rail key={r} className={s.topupRail}>
                  {row.map((sg) => (
                    <div key={sg.productId} className={s.topupItem}>
                      <Link href={`/products/${sg.slug}`} className={s.topupArt}>
                        <Image src={sg.image || sg.art} alt="" width={80} height={80} className={s.topupImg} unoptimized />
                      </Link>
                      <span className={`${s.topupName} clamp-2`}>{sg.name}</span>
                      {sg.unit ? <span className={s.topupUnit}>{sg.unit}</span> : null}
                      <span className={s.topupFoot}>
                        <span className="num">₹{sg.price}</span>
                        {sg.mrp && sg.mrp > sg.price ? <s className={s.topupMrp}>₹{sg.mrp}</s> : null}
                      </span>
                      <button type="button" className={s.topupAdd} disabled={busy} onClick={() => run(() => addItem(sg.productId))}>
                        ADD
                      </button>
                    </div>
                  ))}
                </Rail>
              ))}
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

        <TopUpSheet open={showAll} onClose={() => setShowAll(false)} />

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
                    }
                  }}
                >
                  {t('proceed')}
                  <Icon name="arrow-right" size={17} />
                </Link>
              </div>
            );
          })()}
          <p className={`body-sm ${s.safe}`}>
            <Icon name="shield" size={14} />
            Choose cash on delivery or online payment at checkout
          </p>
        </aside>
      </div>
      {askLogin ? (
        <div className={s.askBack} role="dialog" aria-modal="true" aria-labelledby="ask-login" onClick={() => setAskLogin(false)}>
          <div className={`card ${s.ask}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={s.askClose} onClick={() => setAskLogin(false)} aria-label="Close">
              <Icon name="x" size={18} />
            </button>
            <h2 id="ask-login" className="h3">
              Create your account to continue
            </h2>
            <p className="body-sm" style={{ margin: '6px 0 16px' }}>
              Your cart is saved. Make a free account (or sign in) and we will take you straight to payment.
            </p>
            <Link href="/signup?next=%2Fcheckout" className="btn btn-lg btn-primary btn-full">
              Create account
            </Link>
            <Link href="/login?next=%2Fcheckout" className="btn btn-lg btn-outline btn-full" style={{ marginTop: 10 }}>
              I already have an account
            </Link>
          </div>
        </div>
      ) : null}
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

/** #35: the cart rows - one row up to 8 products, then two, then three, each sliding sideways. */
function rowsOf<T>(list: T[]): T[][] {
  const count = list.length > 16 ? 3 : list.length > 8 ? 2 : 1;
  const size = Math.ceil(list.length / count);
  return Array.from({ length: count }, (_, i) => list.slice(i * size, (i + 1) * size)).filter((r) => r.length > 0);
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
