'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { addAddress, fetchAddresses, updateAddress, updateMe } from '../../api/account';
import { confirmOnlinePayment, placeOrder, PlaceResult } from '../../api/orders';
import { payWithRazorpay } from '../../lib/razorpay';
import { getErrorMessage } from '../../lib/client';
import { fitClass } from '../../lib/art';
import { Address, PayKey, PaymentOption } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSlot } from '../../context/SlotContext';
import { getTip, setTip } from '../../lib/tip';
import { useQuote } from '../../lib/useQuote';
import { DeliverySlots } from '../../components/DeliverySlots';
import { useCatalog } from '../../context/CatalogContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { AddressForm } from '../../components/AddressForm';
import { shortDelivery } from '../../lib/deliveryText';
import { Icon, IconName } from '../../components/Icon';
import { RequireAuth } from '../../components/RequireAuth';
import { Alert, Badge, Button, EmptyState, Field, Input, PageLoader, Textarea } from '../../components/ui';
import s from './checkout.module.css';

/*
 * #36: six ways to pay. Each shows what it costs once it is picked, and the (?)
 * next to it gives the charge as a percent. The charge is added to the bill.
 * The names, notes and percents come from the admin panel.
 */
const PAY_ICON: Record<PayKey, IconName> = { upi: 'bolt', cod: 'wallet', debit: 'shield', netbanking: 'store', credit: 'shield', rupay: 'shield' };
const FALLBACK_OPTIONS: PaymentOption[] = [
  { key: 'upi', label: 'UPI ID / UPI scanner', note: 'PhonePe, Google Pay, Paytm, BHIM, CRED UPI or any UPI app / scanner - free', pct: 0 },
  { key: 'cod', label: 'Cash on delivery', note: 'Free', pct: 0 },
  { key: 'debit', label: 'Debit card', pct: 0.4, highPct: 0.9, highFrom: 2000 },
  { key: 'netbanking', label: 'Net banking', pct: 1.8 },
  { key: 'credit', label: 'Credit card', pct: 2 },
  { key: 'rupay', label: 'RuPay debit card', note: 'Free', pct: 0 },
];

function pctText(o: PaymentOption): string {
  if (!o.pct && !o.highPct) return 'No extra charge';
  if (o.highPct !== undefined && o.highFrom) return `${o.pct}% up to ₹${o.highFrom - 1} shopping, ${o.highPct}% from ₹${o.highFrom}`;
  return `${o.pct}% of the total bill`;
}

function CheckoutInner() {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const { home } = useCatalog();
  const settings = useSettings();
  const { show } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { slot, label } = useSlot();
  const options = settings?.paymentOptions?.length ? settings.paymentOptions : FALLBACK_OPTIONS;
  const onlineOn = !!settings?.onlinePaymentOn;

  const [list, setList] = useState<Address[] | null>(null);
  const [picked, setPicked] = useState('');
  const [adding, setAdding] = useState(false);
  const [opt, setOpt] = useState<PayKey>('cod');
  const [tipFor, setTipFor] = useState<PayKey | null>(null);
  // #35: the tip picked on the cart page.
  const [tip, setTipAmount] = useState(0);
  useEffect(() => setTipAmount(getTip()), []);
  const pay: 'cod' | 'online' = opt === 'cod' ? 'cod' : 'online';
  const setPay = (v: 'cod' | 'online') => setOpt((cur) => (v === 'cod' ? 'cod' : cur === 'cod' ? 'upi' : cur));
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  // Why the last attempt to place the order failed; shown right above the button, where the customer is looking.
  const [placeError, setPlaceError] = useState('');
  const errorBox = useRef<HTMLDivElement>(null);
  const [landmark, setLandmark] = useState('');
  const [email, setEmail] = useState('');
  const quote = useQuote(slot, cart?.total, picked || undefined);

  // Admin payment-mode edits must be reflected on entering checkout or
  // returning to it from another tab, even when the cart total is unchanged.
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, [refresh]);
  useEffect(() => { setPlaceError(''); }, [pay, picked, cart]);

  // Billing details: the landmark of the chosen address and an optional email,
  // each filled in from what we already know.
  useEffect(() => {
    setLandmark(list?.find((a) => a.id === picked)?.landmark ?? '');
  }, [list, picked]);
  useEffect(() => {
    setEmail((cur) => cur || (user as { email?: string } | null)?.email || '');
  }, [user]);

  // Pick the payment method the cart allows: a cash-only item needs COD, an online-only item needs online payment.
  useEffect(() => {
    const items = (cart?.groups ?? []).flatMap((g) => g.items);
    const noCod = items.some((i) => i.codAvailable === false);
    const noOnline = items.some((i) => i.onlineAvailable === false);
    if (noCod && !noOnline && settings?.onlinePaymentOn) setPay('online');
    else if (noOnline && !noCod) setPay('cod');
  }, [cart, settings?.onlinePaymentOn]);

  const load = useCallback(async () => {
    const data = await fetchAddresses();
    setList(data);
    setPicked((cur) => cur || data.find((a) => a.isDefault)?.id || data[0]?.id || '');
  }, []);

  useEffect(() => {
    load().catch((e) => {
      setError(getErrorMessage(e));
      setList([]);
    });
  }, [load]);

  if (!list) return <PageLoader label="Preparing checkout…" />;

  if (!cart || cart.itemCount === 0)
    return (
      <div className="page">
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          body="Add a few items before you check out."
          action={
            <Link href="/" className="btn btn-md btn-primary">
              Start shopping
            </Link>
          }
        />
      </div>
    );

  // Items from aisles where the admin turned cash on delivery off.
  const codBlocked = cart.groups
    .flatMap((g) => g.items)
    .filter((i) => i.codAvailable === false)
    .map((i) => i.name);
  // Items the shop sells for cash only.
  const onlineBlocked = cart.groups
    .flatMap((g) => g.items)
    .filter((i) => i.onlineAvailable === false)
    .map((i) => i.name);
  const incompatiblePayments = codBlocked.length > 0 && onlineBlocked.length > 0;
  // #37: past the last distance band the warehouse will not send a rider out
  // carrying cash, so COD is refused however the cart is made up.
  const codTooFar = quote ? quote.codAllowed === false : false;
  const farCodMessage = quote?.codMessage || 'For long distance "COD" option is not available';
  const subtotalShort = quote ? !quote.meetsMinOrder : false;

  const place = async () => {
    setError('');
    setPlaceError('');
    setPlacing(true);
    try {
      const current = list.find((a) => a.id === picked);
      if (current && landmark.trim() !== (current.landmark ?? '')) {
        await updateAddress(picked, { landmark: landmark.trim() || undefined }).catch(() => undefined);
      }
      const known = (user as { email?: string } | null)?.email ?? '';
      if (email.trim() && email.trim() !== known) await updateMe({ email: email.trim() }).catch(() => undefined);
      let result: PlaceResult = await placeOrder(picked, pay, note.trim() || undefined, slot, opt, tip);
      if (result.kind === 'pay') {
        // The money is taken first; the orders are only created once the server has checked the payment.
        const paid = await payWithRazorpay({
          keyId: result.keyId,
          orderId: result.razorpayOrderId,
          amountPaise: result.amount,
          name: user?.name ?? '',
          phone: user?.phone,
          email: email.trim() || undefined,
          method: result.payOption,
        });
        result = await confirmOnlinePayment(paid);
      }
      if (result.kind !== 'placed') throw new Error('Could not place the order. Please try again.');
      setTip(0);
      await refresh();
      // Several warehouses can mean several orders; the list shows all of them.
      router.replace(result.count > 1 ? '/orders?placed=1' : `/orders/${result.order.id}?placed=1`);
    } catch (e) {
      // Errors from the payment window are plain Errors with a readable message.
      const msg = e instanceof Error && !('isAxiosError' in e) ? e.message : getErrorMessage(e);
      setPlaceError(msg);
      show(msg, 'error');
      // Bring the reason into view: the button is far from the top of a long page.
      setTimeout(() => errorBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } finally {
      setPlacing(false);
    }
  };

  const showForm = adding || list.length === 0;
  const chosen = options.find((o) => o.key === opt);
  const payFee = quote?.paymentFees?.[opt] ?? 0;
  const toPay = Math.round(((quote ? quote.total : cart.total) + payFee + tip) * 100) / 100;

  // Everything that stops the button from working, in plain words, so it is never a silent grey button.
  const pickedAddress = list.find((a) => a.id === picked);
  const blockers: string[] = [];
  if (showForm) blockers.push('Save your delivery address first: fill in the address form and press “Save address”.');
  else if (pickedAddress && !pickedAddress.location) {
    blockers.push('Your address needs an exact map pin. Tap “Use my current location”, allow location access and save the address again.');
  }
  if (cart.hasIssues) blockers.push('Some items in your cart need attention. Go back to the cart and fix the items marked in red.');
  if (!cart.points.met) blockers.push('Add 1 product from the list below your cart to continue.');
  if (quote && !quote.meetsMinOrder) {
    blockers.push(`The minimum order is ₹${quote.minOrder}. Add ₹${Math.max(1, Math.round(quote.minOrder - quote.subtotal))} more to continue.`);
  }
  if (pay === 'cod' && codTooFar) blockers.push(farCodMessage);
  if (incompatiblePayments) blockers.push('This cart contains both COD-only and online-only items. Place separate orders for these items.');
  else if (pay === 'cod' && codBlocked.length > 0) blockers.push(`Cash on delivery is not available for: ${codBlocked.join(', ')}.`);
  else if (pay === 'online' && onlineBlocked.length > 0) blockers.push(`Online payment is not available for: ${onlineBlocked.join(', ')}. Choose Cash on Delivery.`);

  return (
    <div className="page rise" style={{ paddingTop: 22 }}>
      <h1 className="h1" style={{ marginBottom: 4 }}>
        Checkout
      </h1>
      <p className="body-sm" style={{ marginBottom: 24 }}>
        Confirm your address, choose a payment method and place your order.
      </p>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      <div className="side-grid">
        <div className="stack" style={{ gap: 22 }}>
          <section className="card card-pad">
            <div className={s.secHead}>
              <span className={s.step}>1</span>
              <h2 className="h3">Delivery address</h2>
              {!showForm ? (
                <span className={s.secAction}>
                  <Button variant="ghost" size="sm" icon="plus" onClick={() => setAdding(true)}>
                    Add new
                  </Button>
                </span>
              ) : null}
            </div>

            {showForm ? (
              <AddressForm
                onSubmit={async (body) => {
                  const a = await addAddress({ ...body, isDefault: body.isDefault || list.length === 0 });
                  await load();
                  setPicked(a.id);
                  setAdding(false);
                }}
                onCancel={list.length ? () => setAdding(false) : undefined}
              />
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {list.map((a) => (
                  <label key={a.id} className={s.pick} data-on={picked === a.id}>
                    <input type="radio" name="address" checked={picked === a.id} onChange={() => setPicked(a.id)} />
                    <span className={s.pickBody}>
                      <span className={s.pickTop}>
                        <b className={s.cap}>{a.label}</b>
                        {a.isDefault ? <Badge>Default</Badge> : null}
                      </span>
                      <span className={s.pickWho}>
                        {a.name} · {a.phone}
                      </span>
                      <span className={s.pickAddr}>
                        {[a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {!showForm ? (
            <section className="card card-pad">
              <div className={s.secHead}>
                <span className={s.step}>2</span>
                <h2 className="h3">Billing details</h2>
              </div>
              <p className="body-sm" style={{ marginBottom: 12 }}>
                Your name and phone come from the address above. Add a landmark so the rider finds you, and an email if you want the bill sent there.
              </p>
              <div className="two-col">
                <Field label="Landmark name">
                  <Input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near the temple" />
                </Field>
                <Field label="Email id" hint="optional">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
              </div>
            </section>
          ) : null}

          <section className="card card-pad">
            <div className={s.secHead}>
              <span className={s.step}>3</span>
              <h2 className="h3">Delivery time &amp; payment</h2>
            </div>
            <DeliverySlots compact />
            {codTooFar && pay === 'cod' ? (
              <div style={{ marginBottom: 14 }}>
                <Alert tone="bad" icon="wallet">
                  {farCodMessage}
                </Alert>
              </div>
            ) : null}
            {codBlocked.length > 0 && !codTooFar && !incompatiblePayments && pay === 'cod' ? (
              <div style={{ marginBottom: 14 }}>
                <Alert tone="bad" icon="wallet">
                  {settings?.codMessage ||
                    'Cash on delivery is not available for some items in this order.'}{' '}
                  ({codBlocked.join(', ')})
                </Alert>
              </div>
            ) : null}
            {onlineBlocked.length > 0 && !incompatiblePayments && pay === 'online' ? (
              <div style={{ marginBottom: 14 }}>
                <Alert tone="bad" icon="wallet">
                  Online payment is not available for some items in this order ({onlineBlocked.join(', ')}). Please pay by Cash on Delivery.
                </Alert>
              </div>
            ) : null}
            <div className={s.pays}>
              {options.map((o) => {
                const online = o.key !== 'cod';
                const off = (online && (!onlineOn || onlineBlocked.length > 0)) || (!online && (codBlocked.length > 0 || codTooFar));
                const fee = quote?.paymentFees?.[o.key] ?? 0;
                const on = opt === o.key;
                return (
                  <label key={o.key} className={s.pay} data-on={on} style={off ? { opacity: 0.5 } : undefined}>
                    <input type="radio" name="pay" checked={on} disabled={(online && (!onlineOn || onlineBlocked.length > 0)) || (!online && codBlocked.length > 0)} onChange={() => setOpt(o.key)} />
                    <span className={s.payIcon}>
                      <Icon name={PAY_ICON[o.key]} size={19} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className={s.payTitle}>
                        {o.label}
                        <button
                          type="button"
                          className={s.payQ}
                          aria-label={`Charges for ${o.label}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setTipFor((cur) => (cur === o.key ? null : o.key));
                          }}
                        >
                          ?
                        </button>
                      </span>
                      {tipFor === o.key ? <span className={s.payBody}>{pctText(o)}</span> : null}
                      {online && !onlineOn ? <span className={s.payBody}>Coming soon</span> : null}
                      {on ? (
                        <span className={s.payFee}>
                          {o.key === 'cod' && codTooFar ? farCodMessage : fee > 0 ? `${o.label} charges: ₹${fee}` : o.note || 'Free'}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>

          </section>

          <section className="card card-pad">
            <div className={s.secHead}>
              <span className={s.step}>4</span>
              <h2 className="h3">Delivery instructions</h2>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: call at the gate, second floor"
              rows={3}
            />
          </section>
        </div>

        <aside className={`card side-sticky ${s.summary}`}>
          <h2 className="h3" style={{ marginBottom: 14 }}>
            Order summary
          </h2>

          <div className={s.items}>
            {cart.groups
              .flatMap((g) => g.items)
              .map((it) => (
                <div key={it.productId} className={s.item}>
                  <span className={s.itemArt}>
                    <Image
                      src={it.image || it.art}
                      alt=""
                      width={30}
                      height={30}
                      className={fitClass(it.image, s.itemArtImg)}
                      unoptimized
                    />
                    <span className={`num ${s.itemQty}`}>{it.quantity}</span>
                  </span>
                  <span className={`${s.itemName} clamp-1`}>{it.name}</span>
                  <span className={`num ${s.itemPrice}`}>₹{it.lineTotal}</span>
                </div>
              ))}
          </div>

          <hr className="divider" style={{ margin: '14px 0' }} />

          <Row label={t('itemTotal')} value={`₹${cart.subtotal}`} />
          <Row label={t('handling')} value={`₹${quote?.handlingFee ?? 2}`} />
          <Row
            label={t('delivery')}
            value={(quote ? quote.deliveryFee : cart.deliveryFee) === 0 ? t('free') : `₹${quote ? quote.deliveryFee : cart.deliveryFee}`}
            good={(quote ? quote.deliveryFee : cart.deliveryFee) === 0}
          />
          {quote && quote.twoHourFee > 0 ? <Row label="2 hour delivery" value={`₹${quote.twoHourFee}`} /> : null}
          {payFee > 0 ? <Row label={`${chosen?.label ?? 'Payment'} charges`} value={`₹${payFee}`} /> : null}
          {tip > 0 ? <Row label="Tip for delivery partner" value={`₹${tip}`} /> : null}
          <hr className="divider" style={{ margin: '12px 0' }} />
          <Row label={t('toPay')} value={`₹${toPay}`} big />
          {quote && quote.addForFree > 0 ? (
            <p className={`body-sm ${s.hint}`}>For free delivery, shop ₹{quote.freeAbove} — add ₹{quote.addForFree} more.</p>
          ) : null}

          <div style={{ marginTop: 18 }}>
            <Button
              full
              size="lg"
              loading={placing}
              disabled={!picked || blockers.length > 0}
              onClick={place}
            >
              {t('placeOrder')} · ₹{toPay}
            </Button>
          </div>

          {blockers.length > 0 ? (
            <div className={s.blockers} role="alert">
              <b>Your order cannot be placed yet:</b>
              <ul>
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {placeError ? (
            <div className={s.blockers} role="alert" ref={errorBox}>
              <b>The order was not placed:</b>
              <p style={{ margin: '6px 0 0' }}>{placeError}</p>
            </div>
          ) : null}

          {showForm ? null : (
            <p className={`body-sm ${s.hint}`}>
              <Icon name="bolt" size={13} />
              {slot === 'instant' && home ? `Delivery time: ${shortDelivery(home)}` : `Delivery time: ${label}`}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, big, good }: { label: string; value: string; big?: boolean; good?: boolean }) {
  return (
    <div className={s.row} data-big={big ? 'true' : 'false'}>
      <span>{label}</span>
      <span className={`num ${good ? s.good : ''}`}>{value}</span>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <CheckoutInner />
    </RequireAuth>
  );
}
