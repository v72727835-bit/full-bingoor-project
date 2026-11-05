import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Modal, PermissionsAndroid, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { DeliveryMap as RouteMap } from '../components/DeliveryMap';
import { AnimatedNumber, FadeSlide } from '../components/anim';
import { cancelRiderOrder, deliverRiderOrder, fetchRiderOrders, fetchRiderProfile, acceptRiderOrder, sendRiderLocation } from '../api/rider';
import { getErrorMessage } from '../api/client';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/AuthLayout';
import { RiderOrder, RiderProfile } from '../types';
import { bell } from '../lib/bell';
import { colors, radius, shadow } from '../theme';


/** Shown in New orders: being packed at the warehouse, or ready to take. */
const isNew = (o: RiderOrder) => o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready_for_pickup';

/**
 * Bingoor has no push service, so the 10-second order poll is what tells the
 * rider about a new pickup: the loud bell plays for a few seconds (alarm
 * stream, so it is heard on silent too) and the phone buzzes.
 */
let bellTimer: ReturnType<typeof setTimeout> | null = null;
function ringForNewOrder() {
  Vibration.vibrate([0, 400, 200, 400]);
  bell.start();
  if (bellTimer) clearTimeout(bellTimer);
  bellTimer = setTimeout(() => { bell.stop(); bellTimer = null; }, 12000);
}
const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const statusLabel: Record<RiderOrder['status'], string> = { accepted: 'Being packed', preparing: 'Being packed', ready_for_pickup: 'Ready for pickup', out_for_delivery: 'On the way', delivered: 'Delivered' };

export default function OrdersScreen() {
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [tab, setTab] = useState<'available' | 'active' | 'history'>('available');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [routeId, setRouteId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<RiderOrder | null>(null);
  const [otp, setOtp] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationIssue, setLocationIssue] = useState<'denied' | 'blocked' | 'off' | null>(null);

  const [newCount, setNewCount] = useState(0);
  const seenIds = useRef<Set<string> | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  // Delivered orders come from their own request, so History is never cut short by the open orders.
  const [history, setHistory] = useState<RiderOrder[]>([]);
  const loadHistory = useCallback(async () => {
    try { setHistory(await fetchRiderOrders('delivered')); } catch (err) { setError(getErrorMessage(err)); }
  }, []);
  useEffect(() => { if (tab === 'history') void loadHistory(); }, [tab, loadHistory]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const list = await fetchRiderOrders();
      // Buzz for an order we have not seen before: once when the warehouse accepts it, again when it is ready.
      const ready = list.filter(isNew).map((o) => `${o._id}:${o.status === 'ready_for_pickup' ? 'ready' : 'packing'}`);
      if (seenIds.current) {
        const fresh = ready.filter((id) => !seenIds.current!.has(id));
        if (fresh.length) { ringForNewOrder(); setNewCount(fresh.length); }
      }
      seenIds.current = new Set(ready);
      setOrders(list); setError('');
    }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  // Every 10 s so a new pickup reaches the rider quickly.
  useEffect(() => { load(); const timer = setInterval(() => load(true), 10000); return () => clearInterval(timer); }, [load]);

  // Cash in hand, the counts and the bell messages, refreshed alongside.
  const loadProfile = useCallback(async () => {
    try { setProfile(await fetchRiderProfile()); } catch { /* keep the last figures */ }
  }, []);
  useEffect(() => { void loadProfile(); const timer = setInterval(loadProfile, 30000); return () => clearInterval(timer); }, [loadProfile]);

  const visible = useMemo(() => tab === 'history' ? history : orders.filter((o) => tab === 'available' ? isNew(o) : o.status === 'out_for_delivery'), [orders, history, tab]);  const activeOrder = orders.find((order) => order._id === routeId && order.status === 'out_for_delivery') ?? orders.find((order) => order.status === 'out_for_delivery');
  const carrying = !!activeOrder;
  useEffect(() => {
    if (tab !== 'active' && !carrying) return;
    let watchId: number | null = null;
    let cancelled = false;
    const startLocation = async () => {
      let precise = true;
      if (Platform.OS === 'android') {
        // Android 12+ lets the rider pick "Approximate", which grants only COARSE: accept that too.
        const result = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]);
        const fine = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
        const coarse = result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
        const ok = PermissionsAndroid.RESULTS.GRANTED;
        if (fine !== ok && coarse !== ok) {
          if (!cancelled) setLocationIssue(fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied');
          return;
        }
        precise = fine === ok;
      }
      if (cancelled) return;
      const onPosition = (position: { coords: { latitude: number; longitude: number } }) => {
        if (cancelled) return;
        setLocationIssue(null);
        setRiderLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      };
      // Code 1 = permission denied, 2 = location turned off / no fix, 3 = timeout (keep waiting on the watch).
      const onError = (e: { code: number }) => { if (!cancelled && e.code !== 3) setLocationIssue(e.code === 1 ? 'denied' : 'off'); };
      Geolocation.getCurrentPosition(onPosition, onError, { enableHighAccuracy: precise, timeout: 15000, maximumAge: 15000 });
      watchId = Geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: precise, distanceFilter: 25, interval: 10000, fastestInterval: 5000 });
    };
    void startLocation();
    return () => { cancelled = true; if (watchId !== null) Geolocation.clearWatch(watchId); };
  }, [tab, carrying]);

  // Share the position with the customer while carrying a parcel, at most every 10 s.
  const lastSent = useRef(0);
  useEffect(() => {
    if (!carrying || !riderLocation) return;
    const now = Date.now();
    if (now - lastSent.current < 10000) return;
    lastSent.current = now;
    sendRiderLocation(riderLocation.latitude, riderLocation.longitude).catch(() => undefined);
  }, [carrying, riderLocation]);
  const accept = async (order: RiderOrder) => { setSaving(order._id); try { const updated = await acceptRiderOrder(order._id); setOrders((items) => [updated, ...items.filter((item) => item._id !== order._id)]); setRouteId(updated._id); setTab('active'); } catch (err) { setError(getErrorMessage(err)); } finally { setSaving(null); } };
  const cancel = async (order: RiderOrder) => {
    setSaving(order._id);
    try { await cancelRiderOrder(order._id); await load(true); await loadProfile(); setTab('available'); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setSaving(null); }
  };
  const deliver = async () => {
    if (!delivery || otp.length !== 4 || saving) return;
    setDeliveryError('');
    setSaving(delivery._id);
    try {
      const updated = await deliverRiderOrder(delivery._id, otp);
      setOrders((items) => [updated, ...items.filter((item) => item._id !== delivery._id)]);
      setDelivery(null);
      setOtp('');
      setTab('history');
      setError('');
      void loadProfile();
      void loadHistory();
    } catch (err) {
      setDeliveryError(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const openDelivery = (order: RiderOrder) => { setDelivery(order); setOtp(''); setDeliveryError(''); };

  const header = <View>
    {/* Cash in hand is the number a rider is accountable for, so it leads. */}
    <FadeSlide><View style={styles.hero}>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroEyebrow}>CASH TO SUBMIT</Text>
        <AnimatedNumber value={profile?.codPending ?? 0} format={money} style={styles.heroTitle} />
        <Text style={styles.heroText}>Collected in total {money(profile?.codCollected ?? 0)}{profile?.codLimit ? ` · hand in before ${money(profile.codLimit)}` : ''}</Text>
      </View>
      <Ionicons name="cash-outline" size={44} color="#fff" />
    </View></FadeSlide>
    {/* Today's cash from COD deliveries (since midnight). */}
    <FadeSlide delay={40}><View style={styles.todayBox}>
      <Ionicons name="today-outline" size={22} color={colors.primary} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.todayLabel}>COD collected today</Text>
        <Text style={styles.muted}>{profile?.codTodayDeliveries ?? 0} cash deliver{(profile?.codTodayDeliveries ?? 0) === 1 ? 'y' : 'ies'} today</Text>
      </View>
      <Text style={styles.todayValue}>{money(profile?.codToday ?? 0)}</Text>
    </View></FadeSlide>
    {profile?.paused ? <View style={styles.pausedBar}><Ionicons name="pause-circle" size={18} color="#fff" /><Text style={styles.newBannerText}>Your delivery service is stopped. Submit the cash to clear it.</Text></View> : null}
    <FadeSlide delay={70}><View style={styles.stats}><Stat value={String(orders.filter(isNew).length)} label="Available" /><Stat value={String(orders.filter((o) => o.status === 'out_for_delivery').length)} label="Active" /><Stat value={String(profile?.deliveredCount ?? history.length)} label="Delivered" /><Stat value={String(profile?.cancelledCount ?? 0)} label="Cancelled" last /></View></FadeSlide>
    <View style={styles.tabs}>{(['available', 'active', 'history'] as const).map((value) => <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value === 'available' ? 'New orders' : value === 'active' ? 'My deliveries' : 'History'}</Text></Pressable>)}</View>
    {newCount > 0 ? <Pressable onPress={() => { setTab('available'); setNewCount(0); bell.stop(); }} style={styles.newBanner} accessibilityRole="button"><Ionicons name="notifications" size={18} color="#fff" /><Text style={styles.newBannerText}>{newCount} new order update{newCount > 1 ? 's' : ''}</Text></Pressable> : null}
    {error ? <ErrorBanner message={error} /> : null}
    {locationIssue && (carrying || tab === 'active') ? <Pressable onPress={() => { if (locationIssue === 'blocked') void Linking.openSettings(); }} style={styles.locationBar} accessibilityRole="alert"><Ionicons name="location-outline" size={18} color="#fff" /><Text style={styles.newBannerText}>{locationIssue === 'off' ? 'Turn on location (GPS) so the customer can track the delivery.' : locationIssue === 'blocked' ? 'Location permission is off. Tap to open settings and allow it.' : 'Allow location so the customer can track the delivery.'}</Text></Pressable> : null}
    {tab === 'active' && activeOrder ? <DeliveryMap order={activeOrder} riderLocation={riderLocation} /> : null}
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : null}
  </View>;

  // Everything scrolls together, so on a small phone the order card is never squeezed under the header.
  return <View style={{ flex: 1 }}>
    <FlatList data={loading ? [] : visible} keyExtractor={(item) => item._id} ListHeaderComponent={header} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); void loadProfile(); if (tab === 'history') void loadHistory(); }} tintColor={colors.primary} />} contentContainerStyle={styles.list} ListEmptyComponent={loading ? undefined : <View style={styles.empty}><Ionicons name={tab === 'history' ? 'checkmark-done-circle-outline' : 'bicycle-outline'} size={50} color={colors.primary} /><Text style={styles.emptyTitle}>{tab === 'available' ? 'No new orders' : tab === 'active' ? 'No active deliveries' : 'No delivery history'}</Text><Text style={styles.emptyText}>New updates will appear here automatically.</Text></View>} renderItem={({ item, index }) => <FadeSlide delay={Math.min(index, 6) * 55}><View style={styles.cardWrap}><OrderCard onShowRoute={() => { setRouteId(item._id); setTab('active'); }} order={item} saving={saving === item._id} riderLocation={riderLocation} onAccept={() => accept(item)} onDeliver={() => openDelivery(item)} onCancel={() => void cancel(item)} /></View></FadeSlide>} />
    {/* Always on screen while a parcel is out: the card's own button can sit below the map, out of sight on small phones. */}
    {activeOrder ? <View style={styles.deliverBar}><View style={{ flex: 1, marginRight: 10 }}><Text style={styles.deliverBarTitle} numberOfLines={1}>Delivering #{activeOrder.orderNumber}</Text><Text style={styles.muted} numberOfLines={1}>{activeOrder.paymentMethod === 'cod' ? `Collect ${money(activeOrder.total)} in cash` : 'Paid online'} · ask for the OTP</Text></View><Button title="Enter delivery OTP" onPress={() => openDelivery(activeOrder)} disabled={!!saving} style={{ paddingHorizontal: 16 }} /></View> : null}
    <Modal visible={!!delivery} transparent animationType="slide" onRequestClose={() => { if (!saving) setDelivery(null); }}><KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding"><View style={styles.modal}><Text style={styles.modalTitle}>Confirm delivery</Text><Text style={styles.modalSub}>Order #{delivery?.orderNumber} · {delivery?.shop?.name ?? 'Warehouse'}{'\n'}Ask the customer to open this same order and share its 4-digit delivery OTP.</Text>{deliveryError ? <ErrorBanner message={deliveryError} /> : null}<TextInput value={otp} onChangeText={(value) => { setOtp(value.replace(/\D/g, '').slice(0, 4)); setDeliveryError(''); }} editable={!saving} keyboardType="number-pad" placeholder="••••" placeholderTextColor="#94A3B8" style={styles.otp} autoFocus /><Button title="Mark as delivered" onPress={() => void deliver()} loading={saving === delivery?._id} disabled={otp.length !== 4 || !!saving} /><Button title="Cancel" variant="outline" disabled={!!saving} onPress={() => setDelivery(null)} style={{ marginTop: 10 }} /></View></KeyboardAvoidingView></Modal>
  </View>;
}

function DeliveryMap({ order, riderLocation }: { order: RiderOrder; riderLocation: { latitude: number; longitude: number } | null }) {
  const destination = order.address.location ? { latitude: order.address.location.lat, longitude: order.address.location.lng } : null;
  if (!destination) return <View style={styles.mapUnavailable}><Ionicons name="map-outline" size={20} color={colors.primary} /><Text style={styles.mapUnavailableText}>Customer location is not available for this order.</Text></View>;
  return <View style={styles.mapWrap}>
    <RouteMap rider={riderLocation ? { lat: riderLocation.latitude, lng: riderLocation.longitude } : undefined}
      destination={order.address.location}
      pickup={order.shop?.location?.coordinates ? { lat: order.shop.location.coordinates[1], lng: order.shop.location.coordinates[0] } : undefined}
      height={280} />
    <Text style={styles.mapCaptionText}>Pickup: {order.shop?.name} · {[order.shop?.address?.line1, order.shop?.address?.city].filter(Boolean).join(', ')}</Text>
    <Text style={styles.mapCaptionText}>Deliver to: {[order.address.line1, order.address.line2, order.address.city].filter(Boolean).join(', ')}</Text>
    <Button title="Navigate to pickup" onPress={() => {
      const c = order.shop?.location?.coordinates;
      const dest = c ? `${c[1]},${c[0]}` : [order.shop?.name, order.shop?.address?.line1, order.shop?.address?.city].filter(Boolean).join(', ');
      void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`);
    }} />
    <View style={styles.mapCaption}><Ionicons name="navigate" size={16} color={colors.primary} /><Text style={styles.mapCaptionText}>Live delivery route</Text><Text style={styles.mapCaptionAddress}>{order.address.city}</Text></View>
  </View>;
}

function Stat({ value, label, last }: { value: string; label: string; last?: boolean }) { return <View style={[styles.stat, last && styles.statLast]}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

/** Straight-line kilometres between two pins - close enough to judge a run. */
function kmBetween(a: { latitude: number; longitude: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.latitude);
  const dLng = toRad(b.lng - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
/** Google Maps (or any maps app) with the customer's pin, else their written address. */
function openDirections(order: RiderOrder) {
  const loc = order.address.location;
  const dest = loc ? `${loc.lat},${loc.lng}` : encodeURIComponent([order.address.line1, order.address.line2, order.address.city, order.address.pincode].filter(Boolean).join(', '));
  void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`);
}

function callCustomer(order: RiderOrder) {
  const phone = (order.address.phone || order.user?.phone || '').replace(/[^\d+]/g, '');
  if (phone) void Linking.openURL(`tel:${phone}`);
}

function OrderCard({ order, saving, riderLocation, onAccept, onDeliver, onCancel, onShowRoute }: { order: RiderOrder; saving: boolean; riderLocation: { latitude: number; longitude: number } | null; onAccept: () => void; onDeliver: () => void; onCancel: () => void; onShowRoute: () => void }) {
  // The distance is not shown before the order is accepted: riders were
  // cherry-picking the short runs and leaving the far ones for nobody.
  const accepted = !isNew(order);
  const km = accepted && riderLocation && order.address.location ? kmBetween(riderLocation, order.address.location) : null;

  const slotText = order.deliveryDays ? `${order.deliveryDays} day${order.deliveryDays > 1 ? 's' : ''} delivery` : order.slot === 'twoHour' ? 'Within 2 hours' : order.slot === 'nextDay' ? 'Next day delivery' : 'Deliver in 19 minutes';
  const placed = new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return <View style={[styles.card, order.redOrder ? styles.redCard : null]}>
    <View style={styles.cardTop}><Text style={styles.orderNo}>#{order.orderNumber}</Text><View style={[styles.badge, order.status === 'delivered' ? styles.greenBadge : order.status === 'out_for_delivery' ? styles.blueBadge : styles.orangeBadge]}><Text style={styles.badgeText}>{statusLabel[order.status]}</Text></View></View>
    {accepted && order.status !== 'delivered' ? <Button title="View pickup and delivery map" onPress={onShowRoute} variant="outline" /> : null}
    <Text style={styles.address}>Pickup: {order.shop?.name} · {[order.shop?.address?.line1, order.shop?.address?.city].filter(Boolean).join(', ')}</Text>
    <View style={styles.customer}><Ionicons name="person-circle-outline" size={30} color={colors.primary} /><View style={{ flex: 1, marginLeft: 10 }}><Text style={styles.customerName}>{order.user?.name ?? order.address.name}</Text><Text style={styles.muted}>{order.user?.phone ?? order.address.phone}</Text></View><Text style={styles.total}>{money(order.total)}</Text></View>
    <View style={styles.route}><Ionicons name="storefront-outline" size={17} color={colors.primary} /><Text style={styles.routeText}>{order.shop?.name ?? 'Warehouse'}  →  {order.address.city}</Text></View>
    <Text style={styles.address}>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.pincode}</Text>
    <Text style={[styles.slotText, order.redOrder ? styles.redText : null]}>{order.redOrder ? 'LONG RUN · ' : order.longDistance ? 'LONG DISTANCE · ' : ''}{slotText} · placed {placed}</Text>
    {/* What is in the parcel, and what to collect. */}
    <View style={styles.itemsBox}>
      {order.items.map((item, i) => <View key={i} style={styles.itemRow}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemQty}>× {item.quantity}</Text>
        <Text style={styles.itemPrice}>{money(item.lineTotal ?? (item.price ?? 0) * item.quantity)}</Text>
      </View>)}
      <View style={[styles.itemRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{money(order.total)}</Text>
      </View>
      <View style={styles.payRow}>
        <Ionicons name={order.paymentMethod === 'cod' ? 'cash-outline' : 'card-outline'} size={16} color={order.paymentMethod === 'cod' ? '#B45309' : colors.success} />
        <Text style={[styles.payText, { color: order.paymentMethod === 'cod' ? '#B45309' : colors.success }]}>{order.paymentMethod === 'cod' ? `Cash on delivery · collect ${money(order.total)}` : 'Paid online · nothing to collect'}</Text>
      </View>
    </View>
    {km !== null ? <Text style={styles.items}>{km.toFixed(1)} km away</Text> : null}
    {isNew(order) ? <View>
      <Button title={saving ? 'Accepting...' : 'Accept order'} onPress={onAccept} loading={saving} style={{ marginTop: 14 }} />
      {order.status !== 'ready_for_pickup' ? <Text style={styles.packNote}>The warehouse is packing it - accept now and pick it up when it is ready.</Text> : null}
    </View>
      : order.status === 'out_for_delivery' ? <>
        {/* Right after accepting: the way to the door, and the customer's phone. */}
        <View style={styles.actionRow}>
          <Pressable onPress={() => openDirections(order)} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel="Directions"><Ionicons name="navigate" size={18} color={colors.primary} /><Text style={styles.actionText}>Directions</Text></Pressable>
          <Pressable onPress={() => callCustomer(order)} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel="Call customer"><Ionicons name="call" size={18} color={colors.primary} /><Text style={styles.actionText}>Call customer</Text></Pressable>
        </View>
        <Button title="Delivered order" onPress={onDeliver} disabled={saving} style={{ marginTop: 10 }} />
        <Button title="Cancel order" variant="outline" onPress={onCancel} disabled={saving} style={{ marginTop: 10 }} />
      </>
      : order.status === 'delivered' ? <View style={styles.payRow}><Ionicons name="checkmark-circle" size={16} color={colors.success} /><Text style={[styles.payText, { color: colors.success }]}>Delivered{order.deliveredAt ? ` · ${new Date(order.deliveredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</Text></View>
      : null}
  </View>;
}

const styles = StyleSheet.create({ deliverBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }, deliverBarTitle: { color: colors.text, fontWeight: '800', fontSize: 14 }, redCard: { borderWidth: 2, borderColor: '#DC2626', backgroundColor: '#FEF2F2' }, slotText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12.5, marginTop: 10 }, redText: { color: '#B91C1C' }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, bellDot: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }, bellDotText: { color: '#fff', fontSize: 9.5, fontWeight: '800' }, locationBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.md, backgroundColor: '#B45309' }, pausedBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.md, backgroundColor: '#B91C1C' }, statLast: { borderRightWidth: 0 }, notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: radius.md, backgroundColor: colors.primarySoft, marginBottom: 9 }, noticeText: { flex: 1, color: colors.primaryDark, fontSize: 13.5, lineHeight: 19, fontWeight: '700' }, newBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.md, backgroundColor: colors.primary }, newBannerText: { color: '#fff', fontWeight: '800', fontSize: 14, marginLeft: 8 }, mapWrap: { marginHorizontal: 16, marginBottom: 8, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card, ...shadow }, map: { height: 210, width: '100%' }, riderMarker: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', ...shadow }, customerMarker: { alignItems: 'center', justifyContent: 'center' }, mapCaption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.card }, mapCaptionText: { color: colors.text, fontWeight: '800', fontSize: 12.5, marginLeft: 6 }, mapCaptionAddress: { color: colors.muted, fontSize: 12, marginLeft: 'auto' }, mapUnavailable: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft }, mapUnavailableText: { flex: 1, color: colors.primaryDark, fontSize: 12.5, marginLeft: 8 }, safe: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }, brandRow: { flexDirection: 'row', alignItems: 'center' }, logo: { width: 43, height: 43, borderRadius: 14, marginRight: 10 }, brand: { fontSize: 19, fontWeight: '800', color: colors.text }, sub: { color: colors.muted, fontSize: 12.5, marginTop: 2 }, iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow }, hero: { marginHorizontal: 16, marginTop: 6, padding: 18, flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, backgroundColor: colors.primary }, heroEyebrow: { color: '#FFEDD5', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, heroTitle: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 5 }, heroText: { color: '#FFF7ED', fontSize: 13, lineHeight: 18, marginTop: 5, paddingRight: 8 }, stats: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: 13, ...shadow }, stat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border }, statValue: { fontSize: 21, fontWeight: '800', color: colors.text }, statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 }, tabs: { flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: radius.md, padding: 4, ...shadow }, tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 }, tabActive: { backgroundColor: colors.primary }, tabText: { fontSize: 13, fontWeight: '700', color: colors.muted }, tabTextActive: { color: '#fff' }, list: { paddingBottom: 28 }, cardWrap: { paddingHorizontal: 16 }, todayBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primarySoft, ...shadow }, todayLabel: { color: colors.text, fontWeight: '800', fontSize: 14.5 }, todayValue: { color: colors.primaryDark, fontWeight: '800', fontSize: 22 }, itemsBox: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.background }, itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }, itemName: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: '600' }, itemQty: { width: 44, textAlign: 'center', color: colors.muted, fontWeight: '700' }, itemPrice: { minWidth: 64, textAlign: 'right', color: colors.text, fontWeight: '700' }, totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 8 }, totalLabel: { flex: 1, color: colors.text, fontWeight: '800' }, totalValue: { color: colors.text, fontWeight: '800', fontSize: 16 }, payRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, payText: { marginLeft: 6, fontWeight: '800', fontSize: 13 }, packNote: { color: colors.muted, fontSize: 12, marginTop: 6, textAlign: 'center' }, actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 }, actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft }, actionText: { marginLeft: 6, color: colors.primaryDark, fontWeight: '800' }, emptyList: { flexGrow: 1, padding: 20 }, empty: { alignItems: 'center', justifyContent: 'center', marginTop: 55 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 12 }, emptyText: { color: colors.muted, textAlign: 'center', marginTop: 6 }, card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, orderNo: { fontSize: 14, fontWeight: '800', color: colors.text }, badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }, orangeBadge: { backgroundColor: colors.primarySoft }, blueBadge: { backgroundColor: '#E0F2FE' }, greenBadge: { backgroundColor: colors.successSoft }, badgeText: { fontSize: 11.5, fontWeight: '800', color: colors.primaryDark }, customer: { flexDirection: 'row', alignItems: 'center', marginTop: 16 }, customerName: { color: colors.text, fontWeight: '800', fontSize: 15 }, muted: { color: colors.muted, fontSize: 12.5, marginTop: 2 }, total: { color: colors.text, fontWeight: '800', fontSize: 17 }, route: { flexDirection: 'row', alignItems: 'center', marginTop: 14 }, routeText: { color: colors.text, fontWeight: '700', marginLeft: 7, flex: 1 }, address: { color: colors.muted, marginTop: 7, lineHeight: 19 }, items: { color: colors.muted, fontSize: 12.5, marginTop: 10 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }, modal: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 30 }, modalTitle: { fontSize: 21, fontWeight: '800', color: colors.text }, modalSub: { color: colors.muted, lineHeight: 20, marginTop: 6, marginBottom: 18 }, otp: { height: 58, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, textAlign: 'center', fontSize: 27, letterSpacing: 10, color: colors.text, marginBottom: 15 }
});