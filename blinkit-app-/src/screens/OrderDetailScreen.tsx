import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Dimensions, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { cancelOrder, fetchOrder } from '../api/orders';
import { DeliveryMap } from '../components/DeliveryMap';
import { ORDER_META, TRACK_STEPS } from '../components/OrderStatusChip';
import type { AppNav, AppRoute } from '../navigation/types';
import { colors, currency, gutter, ms, radius, space, themed } from '../theme';
import { Order, OrderStatus } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner, EmptyState, FullScreenLoader } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { SmartImage } from '../ui/SmartImage';
import { Pill } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { useToast } from '../ui/Toast';
import { formatDateTime } from '../utils/validation';

const CANCELLABLE: OrderStatus[] = ['placed', 'accepted'];

export function OrderDetailScreen() {
  const navigation = useNavigation<AppNav>();
  const { params } = useRoute<AppRoute<'OrderDetail'>>();
  const toast = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        setOrder(await fetchOrder(params.id));
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setRefreshing(false);
      }
    },
    [params.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // A live order changes on the shop's side, so poll while it is in progress -
  // every 10 s once it is on the road, so the rider's position stays fresh.
  const liveStatus = order?.status;
  useEffect(() => {
    if (!liveStatus || ['delivered', 'cancelled', 'rejected'].includes(liveStatus)) return;
    const timer = setInterval(() => void load(), liveStatus === 'out_for_delivery' ? 10000 : 30000);
    return () => clearInterval(timer);
  }, [liveStatus, load]);

  const confirmCancel = () => {
    if (!order) return;
    Alert.alert('Cancel this order?', `Order ${order.orderNumber} will be cancelled and the shop notified.`, [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            setOrder(await cancelOrder(order._id, 'Cancelled from the app'));
            toast.success('Order cancelled');
          } catch (err) {
            toast.error(getErrorMessage(err));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const call = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => toast.error('Could not open the dialler'));
  };

  if (error && !order) {
    return (
      <Screen>
        <AppHeader title="Order" />
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title="Could not load this order"
          message={error}
          actionLabel="Try again"
          onAction={() => load()}
        />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <AppHeader title="Order" />
        <FullScreenLoader label="Fetching your order…" />
      </Screen>
    );
  }

  const meta = ORDER_META[order.status];
  const ended = ['cancelled', 'rejected'].includes(order.status);
  const currentStep = TRACK_STEPS.indexOf(order.status);
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const savings = order.items.reduce((s, i) => s + Math.max(0, i.mrp - i.price) * i.quantity, 0);

  return (
    <Screen>
      <AppHeader
        title={order.orderNumber}
        subtitle={formatDateTime(order.createdAt)}
        actions={[{ icon: 'storefront-outline', label: 'View shop', onPress: () => navigation.navigate('ShopDetail', { id: order.shop._id, name: order.shop.name }) }]}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.brand]} />}
      >
        {/* ------------------------------------------------- status -- */}
        <View style={[styles.statusCard, ended && styles.statusCardEnded]}>
          <View style={[styles.statusIcon, ended && styles.statusIconEnded]}>
            <Ionicons name={meta.icon as never} size={ms(24)} color={ended ? colors.danger : colors.brand} />
          </View>
          <View style={styles.statusBody}>
            <Txt variant="h2" center>
              {meta.label}
            </Txt>
            <Txt variant="bodySm" tone="muted" center style={styles.statusBlurb}>
              {order.cancelReason && ended ? order.cancelReason : meta.blurb}
            </Txt>
          </View>
        </View>

        {/* ------------------------------------------------ tracker -- */}
        {!ended ? (
          <View style={styles.card}>
            <Txt variant="h3" style={styles.cardTitle}>
              Order progress
            </Txt>
            {TRACK_STEPS.map((step, index) => {
              const done = index <= currentStep;
              const isCurrent = index === currentStep;
              const stepMeta = ORDER_META[step];
              const history = order.statusHistory?.find((h) => h.status === step);
              return (
                <View key={step} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepDot, done && styles.stepDotDone, isCurrent && styles.stepDotCurrent]}>
                      {done ? <Ionicons name="checkmark" size={ms(12)} color={colors.onBrand} /> : null}
                    </View>
                    {index < TRACK_STEPS.length - 1 ? (
                      <View style={[styles.stepLine, index < currentStep && styles.stepLineDone]} />
                    ) : null}
                  </View>
                  <View style={styles.stepBody}>
                    <Txt variant={isCurrent ? 'h4' : 'body'} tone={done ? 'ink' : 'faint'}>
                      {stepMeta.label}
                    </Txt>
                    {history ? (
                      <Txt variant="caption" tone="faint" style={styles.stepTime}>
                        {formatDateTime(history.at)}
                      </Txt>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ---------------------------------------------------- otp -- */}
        {order.deliveryOtp && order.status === 'out_for_delivery' ? (
          <View style={styles.otpCard}>
            <View style={styles.flex}>
              <Txt variant="caption" tone="onBrand" style={styles.otpLabel}>
                SHARE THIS OTP ON DELIVERY
              </Txt>
              <Txt variant="display" tone="onBrand" style={styles.otpValue}>
                {order.deliveryOtp}
              </Txt>
            </View>
            <Ionicons name="shield-checkmark-outline" size={ms(38)} color="rgba(255,255,255,0.7)" />
          </View>
        ) : null}

        {/* -------------------------------------------------- rider -- */}
        {order.rider ? (
          <View style={styles.card}>
            <Txt variant="h3" style={styles.cardTitle}>
              Delivery partner
            </Txt>
            <View style={styles.riderRow}>
              <View style={styles.riderAvatar}>
                <Txt variant="h3" tone="brand">
                  {order.rider.name.charAt(0).toUpperCase()}
                </Txt>
              </View>
              <View style={styles.flex}>
                <Txt variant="h4">{order.rider.name}</Txt>
                <Txt variant="bodySm" tone="muted">
                  {order.rider.phone}
                </Txt>
              </View>
              <Button label="Call" icon="call-outline" size="sm" block={false} onPress={() => call(order.rider?.phone)} />
            </View>
            {order.status === 'out_for_delivery' ? <LiveTracking order={order} /> : null}
          </View>
        ) : null}

        {/* -------------------------------------------------- items -- */}
        <View style={styles.card}>
          <View style={styles.shopRow}>
            <SmartImage uri={order.shop?.logo} icon="shopping-cart" style={styles.shopLogo} radius={radius.sm} />
            <View style={styles.flex}>
              <Txt variant="h4" numberOfLines={1}>
                {order.shop?.name ?? 'Bingoor shop'}
              </Txt>
              <Txt variant="caption" tone="faint">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Txt>
            </View>
            {order.shop?.phone ? (
              <Pressable onPress={() => call(order.shop.phone)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Call the shop" style={styles.callBtn}>
                <Ionicons name="call-outline" size={ms(18)} color={colors.brand} />
              </Pressable>
            ) : null}
          </View>

          {order.items.map((item, index) => (
            <Pressable
              key={`${item.product}-${index}`}
              onPress={() => navigation.navigate('ProductDetail', { id: item.product, name: item.name })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <SmartImage uri={item.image} icon={item.icon} style={styles.itemImage} radius={radius.xs} />
              <View style={styles.itemBody}>
                <Txt variant="body" weight="600" numberOfLines={2}>
                  {item.name}
                </Txt>
                <Txt variant="caption" tone="faint" style={styles.itemMeta}>
                  {item.unit} {'·'} {currency(item.price)} {'×'} {item.quantity}
                </Txt>
              </View>
              <Txt variant="label">{currency(item.lineTotal)}</Txt>
            </Pressable>
          ))}
        </View>

        {/* --------------------------------------------------- bill -- */}
        <View style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            Bill details
          </Txt>
          <Row label="Item total" value={currency(order.subtotal)} />
          <Row label="Delivery fee" value={order.deliveryFee === 0 ? 'FREE' : currency(order.deliveryFee)} highlight={order.deliveryFee === 0} />
          {order.discount > 0 ? <Row label="Discount" value={`- ${currency(order.discount)}`} highlight /> : null}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Txt variant="h3">Total</Txt>
            <Txt variant="h2">{currency(order.total)}</Txt>
          </View>
          <View style={styles.payRow}>
            <Pill
              label={order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'}
              tone={order.paymentStatus === 'paid' ? 'success' : 'neutral'}
            />
            <Txt variant="caption" tone="faint" style={styles.payStatus}>
              Payment {order.paymentStatus.replace(/_/g, ' ')}
            </Txt>
          </View>
          {savings > 0 ? (
            <Banner tone="success" icon="pricetags-outline" message={`You saved ${currency(savings)} on this order.`} style={styles.savingsBanner} />
          ) : null}
        </View>

        {/* ------------------------------------------------ address -- */}
        <View style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            Delivery address
          </Txt>
          <Txt variant="body" weight="600">
            {order.address.name}
          </Txt>
          <Txt variant="body" tone="muted">
            {[order.address.line1, order.address.line2, order.address.landmark].filter(Boolean).join(', ')}
          </Txt>
          <Txt variant="body" tone="muted">
            {order.address.city}, {order.address.state} {order.address.pincode}
          </Txt>
          <Txt variant="caption" tone="faint" style={styles.addressPhone}>
            Phone {order.address.phone}
          </Txt>
          {order.note ? (
            <View style={styles.noteBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={ms(15)} color={colors.inkMuted} />
              <Txt variant="bodySm" tone="muted" style={styles.noteText}>
                {order.note}
              </Txt>
            </View>
          ) : null}
        </View>

        {CANCELLABLE.includes(order.status) ? (
          <View style={styles.actions}>
            <Button label="Cancel this order" variant="secondary" loading={cancelling} onPress={confirmCancel} />
            <Txt variant="caption" tone="faint" center style={styles.cancelNote}>
              You can cancel until the shop starts packing your order.
            </Txt>
          </View>
        ) : null}

        <View style={styles.helpRow}>
          <Ionicons name="headset-outline" size={ms(16)} color={colors.inkMuted} />
          <Txt variant="caption" tone="muted" style={styles.helpText}>
            Something wrong with this order? Call the shop from the card above.
          </Txt>
        </View>
      </ScrollView>
    </Screen>
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

const styles = themed(({ c }) => ({
  flex: { flex: 1 },
  content: { padding: gutter, paddingBottom: space.xxxl },

  statusCard: {
    alignItems: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.brandSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.brandBorder,
  },
  statusCardEnded: { backgroundColor: c.dangerSurface, borderColor: c.danger },
  statusIcon: {
    width: ms(56),
    height: ms(56),
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconEnded: { backgroundColor: c.surface },
  statusBody: { alignItems: 'center', marginTop: space.md, maxWidth: ms(300) },
  statusBlurb: { marginTop: ms(2) },

  card: {
    padding: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  cardTitle: { marginBottom: space.md, textAlign: 'center' },

  step: { flexDirection: 'row' },
  stepRail: { alignItems: 'center', width: ms(24) },
  stepDot: {
    width: ms(22),
    height: ms(22),
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: c.brand, borderColor: c.brand },
  stepDotCurrent: { borderWidth: 3, borderColor: c.brandLight },
  stepLine: { width: 2, flex: 1, minHeight: ms(22), backgroundColor: c.border },
  stepLineDone: { backgroundColor: c.brand },
  stepBody: { flex: 1, marginLeft: space.md, paddingBottom: space.lg },
  stepTime: { marginTop: ms(1) },

  otpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.brand,
  },
  otpLabel: { color: 'rgba(255,255,255,0.78)', letterSpacing: 0.8, fontWeight: '700' },
  otpValue: { letterSpacing: 8, marginTop: space.xs },

  riderRow: { flexDirection: 'row', alignItems: 'center' },
  trackScreen: { flex: 1, backgroundColor: c.surface },
  trackBar: { flexDirection: 'row', alignItems: 'center', paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 44) + space.xs, paddingBottom: space.sm, paddingHorizontal: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, backgroundColor: c.surface },
  trackClose: { width: ms(38), height: ms(38), alignItems: 'center', justifyContent: 'center' },
  trackFoot: { padding: gutter, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.surface },
  track: { marginTop: space.md, gap: space.sm },
  trackText: { marginTop: space.sm },
  riderAvatar: {
    width: ms(46),
    height: ms(46),
    borderRadius: radius.pill,
    backgroundColor: c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },

  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space.md,
    marginBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  shopLogo: { width: ms(38), height: ms(38), marginRight: space.md },
  callBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: radius.pill,
    backgroundColor: c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  itemPressed: { backgroundColor: c.surfaceSunken },
  itemImage: { width: ms(46), height: ms(46) },
  itemBody: { flex: 1, marginHorizontal: space.md },
  itemMeta: { marginTop: ms(2) },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.xs },
  rowLabel: { flex: 1, marginRight: space.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space.md },
  payRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.md, gap: space.sm },
  payStatus: { textTransform: 'capitalize' },
  savingsBanner: { marginTop: space.md },

  addressPhone: { marginTop: space.sm },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceSunken,
  },
  noteText: { flex: 1, marginLeft: space.sm },

  actions: { marginTop: space.sm },
  cancelNote: { marginTop: space.sm },

  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.xxl, paddingHorizontal: space.lg },
  helpText: { flexShrink: 1, marginLeft: space.xs },}));

/** Straight-line distance in km between two points. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Where the rider is now. The rider app reports its position every few
 * seconds and this screen polls, so the distance counts down as they come
 * closer; the button opens the live pin in Google Maps.
 */
function LiveTracking({ order }: { order: Order }) {
  const [trackOpen, setTrackOpen] = useState(false);
  const at = order.riderLocation;
  const home = order.address.location;
  if (!at) {
    return (
      <Txt variant="bodySm" tone="muted" style={styles.trackText}>
        Live location will appear here as soon as the rider's phone shares it.
      </Txt>
    );
  }
  const away = home ? distanceKm(at, home) : null;
  // A scooter in town averages about 20 km/h, plus a minute to find the door.
  const minutes = away === null ? null : Math.max(1, Math.round((away / 20) * 60) + 1);
  const headline =
    away === null
      ? 'On the way to you'
      : away < 0.1
        ? 'Rider is at your door'
        : `Arriving in about ${minutes} min`;
  const distance = away === null || away < 0.1 ? '' : away < 1 ? `${Math.round(away * 1000)} m away` : `${away.toFixed(1)} km away`;
  // With a home pin, open the whole route from the rider to the door; otherwise just the rider.
  const mapUrl = home
    ? `https://www.google.com/maps/dir/?api=1&origin=${at.lat},${at.lng}&destination=${home.lat},${home.lng}&travelmode=driving`
    : `https://www.google.com/maps?q=${at.lat},${at.lng}`;
  return (
    <>
    <View>
      <Pressable onPress={() => setTrackOpen(true)} accessibilityRole="button" accessibilityLabel="Open the full tracking map">
        <DeliveryMap destination={home} rider={at} />
      </Pressable>
      <Txt variant="caption" tone="muted">{at.at ? `Last location update: ${formatDateTime(at.at)}` : 'Latest reported rider location'}</Txt>
    <View style={styles.track}>
      <View style={styles.trackText}>
        <Txt variant="label" tone="brand">
          {headline}
        </Txt>
        {distance ? (
          <Txt variant="bodySm" tone="muted">
            {order.rider?.name ? `${order.rider.name} is ${distance}` : `Rider is ${distance}`}
          </Txt>
        ) : null}
      </View>
      <Button label="Track on full map" icon="navigate-outline" variant="secondary" size="sm" onPress={() => setTrackOpen(true)} />
    </View>
    </View>
    {/* The full tracking map opens inside the app: the rider's live pin, your
        address, the route between them and how soon it arrives. */}
    <Modal visible={trackOpen} animationType="slide" onRequestClose={() => setTrackOpen(false)}>
      <View style={styles.trackScreen}>
        <View style={styles.trackBar}>
          <Pressable onPress={() => setTrackOpen(false)} hitSlop={10} style={styles.trackClose} accessibilityRole="button" accessibilityLabel="Close map">
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="h4" numberOfLines={1}>{headline}</Txt>
            {distance ? <Txt variant="caption" tone="muted" numberOfLines={1}>{order.rider?.name ? `${order.rider.name} · ${distance}` : `Rider · ${distance}`}</Txt> : null}
          </View>
        </View>
        <DeliveryMap destination={home} rider={at} height={Dimensions.get('window').height - ms(190)} />
        <View style={styles.trackFoot}>
          <Txt variant="caption" tone="muted" numberOfLines={2} style={{ marginBottom: space.sm }}>
            {[order.address.line1, order.address.line2, order.address.city].filter(Boolean).join(', ')}
          </Txt>
          <Button label="Open in Google Maps" variant="secondary" size="sm" onPress={() => void Linking.openURL(mapUrl)} />
        </View>
      </View>
    </Modal>
    </>
  );
}
