import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getErrorMessage } from '../api/client';
import { fetchOrders, fetchQuote, placeOrder } from '../api/orders';
import { WEB_URL } from '../config';
import { tokenStore } from '../storage/tokens';
import { fetchAddresses } from '../api/user';
import { useCart } from '../context/CartContext';
import { useTabs } from '../navigation/TabsContext';
import type { AppNav } from '../navigation/types';
import { usePublicSettingsQuery } from '../store/catalogApi';
import { colors, currency, gutter, ms, radius, space, themed } from '../theme';
import { Address, CheckoutProblem, PayKey, PayOptionDef, PaymentMethod } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner, EmptyState, FullScreenLoader } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { SmartImage } from '../ui/SmartImage';
import { Pill } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { TextField } from '../ui/TextField';
import { useToast } from '../ui/Toast';

const LABEL_ICON = { home: 'home-outline', work: 'briefcase-outline', other: 'location-outline' } as const;

/** Turns the server's machine-readable checkout blockers into plain English. */
function describeProblem(p: CheckoutProblem): string {
  const where = p.name ? `"${p.name}"` : p.shop ?? 'An item';
  if (p.reason === 'shop_closed') return `${p.shop ?? 'A shop'} is closed right now.`;
  if (p.reason === 'out_of_stock') return `${where} just went out of stock.`;
  if (p.reason === 'insufficient_stock') return `${where} does not have enough stock left.`;
  if (p.reason === 'unavailable') return `${where} is no longer available.`;
  if (p.reason === 'points_short') return 'Add 1 product from the list below your cart to continue.';
  if (p.reason === 'cod_unavailable') return `${where}: cash on delivery is not available. Choose Pay online or remove it.`;
  if (p.reason === 'online_unavailable') return `${where}: online payment is not available. Choose Cash on delivery or remove it.`;
  if (p.reason === 'cod_long_distance') return `${p.shop ?? 'A shop'} is far from your address, so cash on delivery is not available. Choose Pay online.`;
  if (p.reason.startsWith('min_order_')) {
    return `${p.shop ?? 'A shop'} needs a minimum order of ${currency(Number(p.reason.replace('min_order_', '')) || 0)}.`;
  }
  if (p.reason.startsWith('out_of_delivery_range_')) {
    return `${p.shop ?? 'A shop'} does not deliver to this address (${p.reason.replace('out_of_delivery_range_', '')}).`;
  }
  return `${where}: ${p.reason.replace(/_/g, ' ')}`;
}

/* The six ways to pay (names, notes and % come from the admin panel; these are the defaults). */
const PAY_ICON: Record<PayKey, React.ComponentProps<typeof Ionicons>['name']> = {
  upi: 'flash-outline', cod: 'cash-outline', debit: 'card-outline', netbanking: 'business-outline', credit: 'card-outline', rupay: 'card-outline',
};
const FALLBACK_PAY: PayOptionDef[] = [
  { key: 'upi', label: 'UPI ID / UPI scanner', note: 'PhonePe, Google Pay, Paytm, BHIM or any UPI app - free', pct: 0 },
  { key: 'cod', label: 'Cash on delivery', note: 'Pay the delivery partner when your order arrives', pct: 0 },
  { key: 'debit', label: 'Debit card', pct: 0.4, highPct: 0.9, highFrom: 2000 },
  { key: 'netbanking', label: 'Net banking', pct: 1.8 },
  { key: 'credit', label: 'Credit card', pct: 2 },
  { key: 'rupay', label: 'RuPay debit card', note: 'Free', pct: 0 },
];
const pctOf = (o: PayOptionDef, amount: number) =>
  o.highPct !== undefined && o.highPct !== null && o.highFrom && amount >= o.highFrom ? o.highPct : o.pct;
/** The same sum the server makes, used until its quote arrives. */
const localFee = (o: PayOptionDef, amount: number) => Math.round(amount * pctOf(o, amount)) / 100;
const pctText = (o: PayOptionDef, amount: number) => `${pctOf(o, amount)}% of the bill`;

export function CheckoutScreen() {
  const navigation = useNavigation<AppNav>();
  const { settle, cart, refresh } = useCart();
  const { goToTab } = useTabs();
  const toast = useToast();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('cod');
  const { data: settings } = usePublicSettingsQuery();
  // Which of the six ways to pay; the online ones add their admin-set % charge to the bill.
  const [opt, setOpt] = useState<PayKey>('cod');
  const [fees, setFees] = useState<Record<string, number> | null>(null);
  const options = (settings?.paymentOptions?.length ? settings.paymentOptions : FALLBACK_PAY).filter(
    (o) => o.enabled !== false && (o.key === 'cod' || settings?.onlinePaymentOn),
  );
  const choose = (o: PayOptionDef) => {
    if (o.key === 'cod') {
      if (codBlocked.length || codTimeBlocked) return;
      setOpt('cod');
      setPayment('cod');
    } else {
      if (onlineBlocked.length) return;
      setOpt(o.key);
      setPayment('online');
    }
  };
  const feeFor = (o: PayOptionDef) => fees?.[o.key] ?? localFee(o, cart.total);
  const chosen = options.find((o) => o.key === opt);
  const payFee = chosen ? feeFor(chosen) : 0;
  const payable = Math.round((cart.total + payFee) * 100) / 100;

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

  // Point 8: cash on delivery switched off after the admin's daily cut-off (IST).
  // Trust the server's flag, but also recompute live so it flips at the cut-off
  // minute without a refetch.
  const codCut = settings?.codCutoff;
  const codTimeBlocked = (() => {
    if (!codCut?.enabled) return false;
    if (codCut.blocked) return true;
    const [h, m] = (codCut.time || '19:00').split(':').map((n) => Number(n));
    const cutoffMin = (Number.isFinite(h) ? h : 19) * 60 + (Number.isFinite(m) ? m : 0);
    const local = new Date(Date.now() + 330 * 60_000);
    return local.getUTCHours() * 60 + local.getUTCMinutes() >= cutoffMin;
  })();
  const codTimeMessage = codCut?.message || 'After 7 PM COD option is not available';
  // Pick the method the cart allows.
  useEffect(() => {
    const items = cart.groups.flatMap((g) => g.items);
    const noCod = items.some((i) => i.codAvailable === false);
    const noOnline = items.some((i) => i.onlineAvailable === false);
    if (noCod && !noOnline && settings?.onlinePaymentOn) {
      setPayment('online');
      setOpt('upi');
    } else if (noOnline && !noCod) {
      setPayment('cod');
      setOpt('cod');
    }
  }, [cart, settings?.onlinePaymentOn]);
  // The server's charge for each way to pay, for this basket and address.
  useEffect(() => {
    if (!selectedId) return;
    let live = true;
    fetchQuote(selectedId)
      .then((q) => { if (live) setFees(q.paymentFees ?? null); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [selectedId, cart.total]);
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const paymentStartedAt = useRef(0);
  const [problems, setProblems] = useState<CheckoutProblem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Why the last attempt failed, kept on screen (a toast disappears before it can be read).
  const [placeError, setPlaceError] = useState<string | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const loadAddresses = useCallback(async () => {
    try {
      const list = await fetchAddresses();
      setAddresses(list);
      setSelectedId(list.find((a) => a.isDefault)?._id ?? list[0]?._id ?? null);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setAddresses([]);
    }
  }, []);

  // Refresh on focus so a newly added address shows up when we come back.
  useFocusEffect(
    useCallback(() => {
      void loadAddresses();
    }, [loadAddresses]),
  );

  const selected = addresses?.find((a) => a._id === selectedId) ?? null;

  /** Back from the payment page: has the order appeared yet? */
  const checkPaid = useCallback(async () => {
    try {
      const list = await fetchOrders({ page: 1 });
      const fresh = list.items.filter((o) => new Date(o.createdAt).getTime() >= paymentStartedAt.current - 60_000);
      if (fresh.length) {
        setAwaiting(false);
        await refresh();
        navigation.replace('OrderSuccess', {
          orderIds: fresh.map((o) => o._id),
          grandTotal: fresh.reduce((sum, o) => sum + o.total, 0),
        });
        return true;
      }
    } catch {
      /* try again on the next return */
    }
    return false;
  }, [navigation, refresh]);

  useEffect(() => {
    if (!awaiting) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkPaid();
    });
    return () => sub.remove();
  }, [awaiting, checkPaid]);

  const submit = async () => {
    if (!selected) {
      toast.error('Choose a delivery address first');
      return;
    }
    if (payment === 'cod' && codTimeBlocked) {
      toast.error(codTimeMessage);
      return;
    }
    setPlacing(true);
    setProblems([]);
    setPlaceError(null);
    try {
      await settle();
      const result = await placeOrder({
        addressId: selected._id,
        paymentMethod: payment,
        note: note.trim() || undefined,
        ...(payment === 'online' && opt !== 'cod' ? { payOption: opt } : {}),
      });
      if ('requiresPayment' in result) {
        // Razorpay's window runs on the website; the order appears once the payment is verified there.
        const token = await tokenStore.getAccess();
        const hash = `o=${encodeURIComponent(result.razorpayOrderId)}&k=${encodeURIComponent(result.keyId)}&a=${result.amount}&t=${encodeURIComponent(token ?? '')}`;
        paymentStartedAt.current = Date.now();
        setAwaiting(true);
        await Linking.openURL(`${WEB_URL}/pay#${hash}`);
        return;
      }
      await refresh();
      navigation.replace('OrderSuccess', {
        orderIds: result.orders.map((o) => o._id),
        grandTotal: result.grandTotal,
      });
    } catch (err) {
      // 409 carries a list of exactly what is blocking the order
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const details = (err.response.data as { details?: CheckoutProblem[] } | undefined)?.details;
        if (Array.isArray(details) && details.length) {
          setProblems(details);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
          await refresh();
          setPlacing(false);
          return;
        }
      }
      const msg = getErrorMessage(err);
      setPlaceError(msg);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      toast.error(msg);
    } finally {
      setPlacing(false);
    }
  };

  if (addresses === null) {
    return (
      <Screen>
        <AppHeader title="Checkout" />
        <FullScreenLoader label="Getting your details…" />
      </Screen>
    );
  }

  if (cart.itemCount === 0) {
    return (
      <Screen>
        <AppHeader title="Checkout" />
        <EmptyState
          icon="cart-outline"
          title="Nothing to check out"
          message="Your cart is empty. Add a few items and come back."
          actionLabel="Start shopping"
          onAction={() => {
            navigation.navigate('MainTabs');
            goToTab('home');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Checkout" subtitle={`${cart.itemCount} items · ${currency(cart.total)}`} />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {placeError && problems.length === 0 ? (
          <View style={styles.problemBox}>
            <View style={styles.problemHead}>
              <Ionicons name="alert-circle" size={ms(19)} color={colors.danger} />
              <Txt variant="h4" tone="danger" style={styles.problemTitle}>
                The order was not placed
              </Txt>
            </View>
            <Txt variant="bodySm" tone="danger">
              {placeError}
            </Txt>
          </View>
        ) : null}
        {problems.length > 0 ? (
          <View style={styles.problemBox}>
            <View style={styles.problemHead}>
              <Ionicons name="alert-circle" size={ms(19)} color={colors.danger} />
              <Txt variant="h4" tone="danger" style={styles.problemTitle}>
                We could not place this order
              </Txt>
            </View>
            {problems.map((p, i) => (
              <View key={`${p.reason}-${i}`} style={styles.problemRow}>
                <Txt variant="bodySm" tone="danger" style={styles.problemBullet}>
                  {'•'}
                </Txt>
                <Txt variant="bodySm" tone="danger" style={styles.problemText}>
                  {describeProblem(p)}
                </Txt>
              </View>
            ))}
            <Button
              label="Back to cart"
              variant="secondary"
              size="sm"
              onPress={() => navigation.goBack()}
              style={styles.problemBtn}
            />
          </View>
        ) : null}

        {error ? <Banner tone="danger" message={error} style={styles.block} /> : null}

        {/* ------------------------------------------------- address -- */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Txt variant="h3">Delivery address</Txt>
            <Pressable
              onPress={() => navigation.navigate('AddressForm')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add a new address"
            >
              <Txt variant="label" tone="brand">
                Add new address
              </Txt>
            </Pressable>
          </View>

          {addresses.length === 0 ? (
            <View style={styles.noAddress}>
              <Ionicons name="location-outline" size={ms(26)} color={colors.inkFaint} />
              <Txt variant="body" tone="muted" center style={styles.noAddressText}>
                You have not saved an address yet. We need one to deliver your order.
              </Txt>
              <Button label="Add delivery address" onPress={() => navigation.navigate('AddressForm')} style={styles.noAddressBtn} />
            </View>
          ) : (
            addresses.map((address) => {
              const on = address._id === selectedId;
              return (
                <Pressable
                  key={address._id}
                  onPress={() => setSelectedId(address._id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.addressCard, on && styles.addressCardOn]}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  <View style={styles.addressBody}>
                    <View style={styles.addressTop}>
                      <Ionicons name={LABEL_ICON[address.label]} size={ms(14)} color={colors.brand} />
                      <Txt variant="label" style={styles.addressLabel} numberOfLines={1}>
                        {address.label.charAt(0).toUpperCase() + address.label.slice(1)}
                      </Txt>
                      {address.isDefault ? <Pill label="Default" tone="brand" /> : null}
                    </View>
                    <Txt variant="body" weight="600" style={styles.addressName}>
                      {address.name}
                    </Txt>
                    <Txt variant="bodySm" tone="muted">
                      {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')}
                    </Txt>
                    <Txt variant="bodySm" tone="muted">
                      {address.city}, {address.state} {address.pincode}
                    </Txt>
                    <Txt variant="caption" tone="faint" style={styles.addressPhone}>
                      Phone {address.phone}
                    </Txt>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ------------------------------------------------- payment -- */}
        <View style={styles.section}>
          <Txt variant="h3" style={styles.sectionTitle}>
            Payment method
          </Txt>

          {/* Some aisles are switched off for cash on delivery, and the admin
              writes the line the customer reads here. */}
          {codBlocked.length > 0 ? (
            <Banner
              tone="warning"
              message={`${
                settings?.codMessage ?? 'Cash on delivery is not available for some items in this order.'
              } (${codBlocked.join(', ')})`}
              style={styles.codBanner}
            />
          ) : null}

          {codTimeBlocked && codBlocked.length === 0 ? (
            <Banner tone="warning" message={codTimeMessage} style={styles.codBanner} />
          ) : null}

          {onlineBlocked.length > 0 ? (
            <Banner tone="warning" message={`Online payment is not available for some items in this order (${onlineBlocked.join(', ')}). Please pay by cash on delivery.`} style={styles.codBanner} />
          ) : null}

          {options.map((o) => {
            const fee = feeFor(o);
            const blocked = o.key === 'cod' ? codBlocked.length > 0 || codTimeBlocked : onlineBlocked.length > 0;
            return (
              <PaymentOption
                key={o.key}
                selected={opt === o.key}
                onPress={() => choose(o)}
                icon={PAY_ICON[o.key]}
                title={o.label}
                subtitle={o.key === 'cod' && codTimeBlocked && !codBlocked.length ? codTimeMessage : blocked ? 'Not available for this order' : fee > 0 ? `${o.label} charges: ${currency(fee)} (${pctText(o, cart.total)})` : o.note || 'No extra charge'}
              />
            );
          })}
          {awaiting ? (
            <Banner
              tone="info"
              message="Finish the payment in your browser, then come back to the app. Your order will appear here by itself."
              style={styles.codBanner}
            />
          ) : null}
        </View>

        {/* -------------------------------------------------- items --- */}
        <View style={styles.section}>
          <Txt variant="h3" style={styles.sectionTitle}>
            Order summary
          </Txt>
          {cart.groups.map((group) => (
            <View key={group.shop.id} style={styles.summaryGroup}>
              <View style={styles.summaryHead}>
                <SmartImage uri={group.shop.logo} icon="shopping-cart" style={styles.summaryLogo} radius={radius.xs} />
                <Txt variant="label" numberOfLines={1} style={styles.summaryShop}>
                  {group.shop.name}
                </Txt>
                <Txt variant="label">{currency(group.total)}</Txt>
              </View>
              {group.items.map((item) => (
                <View key={item.productId} style={styles.summaryItem}>
                  <Txt variant="bodySm" tone="muted" style={styles.summaryQty}>
                    {item.quantity} {'×'}
                  </Txt>
                  <Txt variant="bodySm" tone="body" style={styles.summaryName} numberOfLines={2}>
                    {item.name}
                  </Txt>
                  <Txt variant="bodySm">{currency(item.lineTotal)}</Txt>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* ---------------------------------------------------- note -- */}
        <View style={styles.section}>
          <Txt variant="h3" style={styles.sectionTitle}>
            Delivery instructions
          </Txt>
          <TextField
            placeholder="Ring the bell twice, leave at the gate…"
            multiline
            numberOfLines={3}
            maxLength={300}
            value={note}
            onChangeText={setNote}
            hint={`Optional · ${note.length}/300`}
            containerStyle={styles.noteField}
          />
        </View>

        {/* ---------------------------------------------------- bill -- */}
        <View style={styles.section}>
          <Txt variant="h3" style={styles.sectionTitle}>
            Bill details
          </Txt>
          <Row label="Item total" value={currency(cart.subtotal)} />
          <Row label="Delivery fee" value={cart.deliveryFee === 0 ? 'FREE' : currency(cart.deliveryFee)} highlight={cart.deliveryFee === 0} />
          {payFee > 0 && chosen ? <Row label={`${chosen.label} charges`} value={currency(payFee)} /> : null}
          <View style={styles.billDivider} />
          <View style={styles.row}>
            <Txt variant="h3">Amount payable</Txt>
            <Txt variant="h2">{currency(payable)}</Txt>
          </View>
          {payment === 'cod' ? (
            <Txt variant="caption" tone="faint" style={styles.codNote}>
              Please keep {currency(cart.total)} ready for the delivery partner.
            </Txt>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bar}>
        {!selected ? (
          <Txt variant="bodySm" tone="danger" center style={{ paddingTop: space.sm }}>
            Add or choose a delivery address above to place your order.
          </Txt>
        ) : null}
        <View style={styles.barInner}>
          <View style={styles.barPrice}>
            <Txt variant="caption" tone="muted">
              Payable
            </Txt>
            <Txt variant="h2" numberOfLines={1}>
              {currency(payable)}
            </Txt>
          </View>
          <Button
            label={placing ? 'Placing…' : 'Place order'}
            size="lg"
            block={false}
            loading={placing}
            disabled={!selected || (payment === 'cod' && codTimeBlocked)}
            onPress={submit}
            style={styles.barBtn}
          />
        </View>
      </SafeAreaView>
    </Screen>
  );
}

function PaymentOption({
  selected,
  onPress,
  icon,
  title,
  subtitle,
}: {
  selected: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.payCard, selected && styles.payCardOn]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.payIcon}>
        <Ionicons name={icon} size={ms(19)} color={colors.brand} />
      </View>
      <View style={styles.payBody}>
        <Txt variant="h4">{title}</Txt>
        <Txt variant="bodySm" tone="muted" style={styles.paySub}>
          {subtitle}
        </Txt>
      </View>
    </Pressable>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Txt variant="body" tone="muted" style={styles.rowLabel} numberOfLines={2}>
        {label}
      </Txt>
      <Txt variant="label" tone={highlight ? 'success' : 'ink'}>
        {value}
      </Txt>
    </View>
  );
}

const styles = themed(({ c, elevation }) => ({
  content: { paddingVertical: space.lg, paddingBottom: ms(110) },
  block: { marginHorizontal: gutter, marginBottom: space.lg },

  section: {
    marginHorizontal: gutter,
    marginBottom: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  sectionHead: { alignItems: 'center', gap: ms(2), marginBottom: space.md },
  sectionTitle: { marginBottom: space.md, textAlign: 'center' },

  problemBox: {
    marginHorizontal: gutter,
    marginBottom: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.dangerSurface,
    borderWidth: 1,
    borderColor: c.danger,
  },
  problemHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  problemTitle: { flex: 1, marginLeft: space.sm },
  problemRow: { flexDirection: 'row', marginTop: space.xs },
  problemBullet: { marginRight: space.sm },
  problemText: { flex: 1 },
  problemBtn: { marginTop: space.md },

  noAddress: { alignItems: 'center', paddingVertical: space.xl },
  noAddressText: { marginTop: space.md, maxWidth: ms(280) },
  noAddressBtn: { marginTop: space.lg },

  addressCard: {
    flexDirection: 'row',
    padding: space.md,
    marginBottom: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  addressCardOn: { borderColor: c.brand, backgroundColor: c.brandSurface },
  addressBody: { flex: 1, marginLeft: space.md },
  addressTop: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs, gap: space.sm },
  addressLabel: { marginLeft: space.xxs },
  addressName: { marginBottom: ms(2) },
  addressPhone: { marginTop: space.xs },

  radio: {
    width: ms(20),
    height: ms(20),
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: ms(2),
  },
  radioOn: { borderColor: c.brand },
  radioDot: { width: ms(10), height: ms(10), borderRadius: radius.pill, backgroundColor: c.brand },

  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    marginBottom: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  payCardOn: { borderColor: c.brand, backgroundColor: c.brandSurface },
  payIcon: {
    width: ms(38),
    height: ms(38),
    borderRadius: radius.sm,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.md,
  },
  payBody: { flex: 1, marginLeft: space.md },
  paySub: { marginTop: ms(1) },

  summaryGroup: { marginBottom: space.md },
  summaryHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  summaryLogo: { width: ms(22), height: ms(22) },
  summaryShop: { flex: 1, marginHorizontal: space.sm },
  summaryItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: space.xxs },
  summaryQty: { width: ms(34) },
  summaryName: { flex: 1, marginRight: space.sm },

  noteField: { marginBottom: 0 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.xs },
  rowLabel: { flex: 1, marginRight: space.md },
  billDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space.md },
  codBanner: { marginBottom: space.md },
  codNote: { marginTop: space.sm },

  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    ...elevation.lg,
  },
  barInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, paddingVertical: space.md },
  barPrice: { flexShrink: 1, marginRight: space.md },
  barBtn: { flex: 1 },}));
