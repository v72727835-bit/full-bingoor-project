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
import { useQuote } from '../../lib/useQuote';
import { DeliverySlots } from '../../components/DeliverySlots';
import { fitClass } from '../../lib/art';
import { getErrorMessage } from '../../lib/client';
import { shortDelivery } from '../../lib/deliveryText';
import { Icon } from '../../components/Icon';
import { QuantityStepper } from '../../components/QuantityStepper';
import { RequireAuth } from '../../components/RequireAuth';
import { Alert, Badge, Button, EmptyState, PageLoader } from '../../components/ui';
import s from './cart.module.css';

function CartInner() {
  const { cart, loading, updateItem, removeItem, clear, addItem } = useCart();
  const { home } = useCatalog();
  const { show } = useToast();
  const { t, name } = useLanguage();
  const settings = useSettings();
  const { slot, label } = useSlot();
  const quote = useQuote(slot, cart?.total);
  const [busy, setBusy] = useState(false);

  // The hidden points rule: when the basket is short, one top-up product is
  // added for the customer - once. If they take it out again they are told
  // to pick one from the row instead of having it added back.
  const autoTried = useRef(false);
  const [removedAuto, setRemovedAuto] = useState(false);
  useEffect(() => {
    const pts = cart?.points;
    if (!pts?.enabled) return;
    if (pts.met) {
      autoTried.current = false;
      return;
    }
    if (!autoTried.current && pts.autoAddId) {
      autoTried.current = true;
      addItem(pts.autoAddId).catch(() => undefined);
    } else if (autoTried.current) {
      setRemovedAuto(true);
    }
  }, [cart?.points, addItem]);

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
      <DeliverySlots compact />

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
        </div>

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
          <Row label={t('toPay')} value={`₹${quote ? quote.total : cart.total}`} big />
          {cart.points.enabled && !cart.points.met && cart.points.suggestions.length > 0 ? (
            <div className={s.topup}>
              <p className={s.topupNote}>
                {removedAuto ? 'Please add 1 product from below list for free delivery' : 'Add one of these to continue'}
              </p>
              <div className={`rail ${s.topupRail}`}>
                {cart.points.suggestions.map((sg) => (
                  <button key={sg.productId} type="button" className={s.topupItem} onClick={() => run(() => addItem(sg.productId))}>
                    <Image src={sg.image || sg.art} alt="" width={64} height={64} className={s.topupImg} unoptimized />
                    <span className={`${s.topupName} clamp-2`}>{sg.name}</span>
                    <span className="num">₹{sg.price}</span>
                    <span className={s.topupAdd}>+ Add</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {(() => {
            const blocked = cart.hasIssues || !cart.points.met || (quote ? !quote.meetsMinOrder : false);
            return (
              <div style={{ marginTop: 18 }}>
                <Link
                  href="/checkout"
                  className={`btn btn-lg btn-primary btn-full ${blocked ? s.off : ''} ${!cart.points.met ? s.mono : ''}`}
                  aria-disabled={blocked}
                  onClick={(e) => blocked && e.preventDefault()}
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
  return (
    <RequireAuth>
      <CartInner />
    </RequireAuth>
  );
}
