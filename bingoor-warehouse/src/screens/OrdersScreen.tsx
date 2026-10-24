import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Modal, ScrollView, Text, Vibration, View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { assignRider, assignShiprocket, invoiceLinks, orderRiders, sellerOrders, setOrderStatus } from '../api/seller';
import { colors } from '../theme';
import { Order, OrderRiders } from '../types';
import { Btn, Card, Center, Chips, Empty, ErrorText, H, Pill, STATUS_LABEL, SearchBar, money, row, statusTone, when } from '../ui';

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  placed: { to: 'accepted', label: 'Accept order' },
  accepted: { to: 'preparing', label: 'Start preparing' },
  preparing: { to: 'ready_for_pickup', label: 'Ready for pickup' },
};
const TABS = [['', 'All'], ['placed', 'New'], ['accepted', 'Accepted'], ['preparing', 'Preparing'], ['ready_for_pickup', 'Ready'], ['out_for_delivery', 'On the way'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']] as const;
const STATE_LABEL: Record<string, string> = { free: 'Free', busy: 'On a delivery', offline: 'Offline', paused: 'Paused', long_distance_only: 'Long-distance only', not_long_distance: 'Not long-distance' };

export default function OrdersScreen({ onChanged }: { onChanged: (newCount: number) => void }) {
  const [rows, setRows] = useState<Order[] | null>(null);
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [assign, setAssign] = useState<Order | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const seenNew = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await sellerOrders({ page: 1, limit: 40, status: status || undefined, q: query || undefined });
      setRows(r.items);
      setError('');
      const n = await sellerOrders({ page: 1, limit: 1, status: 'placed' });
      const total = n.meta?.total ?? 0;
      if (seenNew.current !== null && total > seenNew.current) Vibration.vibrate([0, 400, 200, 400]);
      seenNew.current = total;
      onChanged(total);
    } catch (e) { setError(getErrorMessage(e)); }
  }, [status, query, onChanged]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const openBill = async (o: Order, kind: 'a4' | 'pos') => {
    setError('');
    try {
      const links = await invoiceLinks(o._id);
      await Linking.openURL(links[kind]);
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const move = (o: Order, to: string) => {
    const go = async () => {
      setBusy(o._id); setError('');
      try { await setOrderStatus(o._id, to); await load(); } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(''); }
    };
    if (to === 'rejected' || to === 'cancelled') Alert.alert(to === 'rejected' ? 'Reject this order?' : 'Cancel this order?', 'The customer will be told it was cancelled.', [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: go }]);
    else go();
  };

  const renderItem = ({ item: o }: { item: Order }) => {
    const next = NEXT[o.status];
    const rider = typeof o.rider === 'object' ? o.rider : null;
    const expanded = open === o._id;
    const canAssign = ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status);
    return (
      <Card>
        <View style={row}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 16 }}>#{o.orderNumber}</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5 }}>{when(o.createdAt)} · {o.paymentMethod === 'cod' ? 'Cash on delivery' : `Online (${o.paymentStatus})`}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}><Text style={{ fontWeight: '800' }}>{money(o.total)}</Text><Pill text={STATUS_LABEL[o.status] ?? o.status} tone={statusTone(o.status)} /></View>
        </View>
        <Text style={{ color: colors.muted, marginVertical: 8 }}>{o.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}</Text>
        {rider ? <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>Rider: {rider.name}{rider.phone ? ` · ${rider.phone}` : ''}</Text> : null}
        {!rider && o.riderPool ? <RiderPoolLine order={o} /> : null}
        {o.fulfillment === 'shiprocket' ? <Text style={{ color: colors.muted, marginBottom: 6 }}>📦 Shiprocket{o.shiprocket?.courier ? ` · ${o.shiprocket.courier}` : ''}{o.shiprocket?.awb ? ` · AWB ${o.shiprocket.awb}` : ''}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {next ? <Btn small title={next.label} disabled={busy === o._id} onPress={() => move(o, next.to)} /> : null}
          {o.status === 'placed' ? <Btn small tone="danger" title="Reject" disabled={busy === o._id} onPress={() => move(o, 'rejected')} /> : null}
          {canAssign && !o.rider && o.fulfillment !== 'shiprocket' ? <Btn small tone="outline" title="Rider / Shiprocket" onPress={() => setAssign(o)} /> : null}
          {canAssign ? <Btn small tone="danger" title="Cancel" disabled={busy === o._id} onPress={() => move(o, 'cancelled')} /> : null}
          <Btn small tone="outline" title="Invoice" onPress={() => openBill(o, 'a4')} />
          <Btn small tone="outline" title="POS bill" onPress={() => openBill(o, 'pos')} />
          <Btn small tone="outline" title={expanded ? 'Hide details' : 'Details'} onPress={() => setOpen(expanded ? null : o._id)} />
        </View>
        {expanded ? (
          <View style={{ marginTop: 12, gap: 4 }}>
            <Text style={{ fontWeight: '800' }}>Customer and address</Text>
            <Text>{o.address.name} · {o.address.phone}</Text>
            <Text style={{ color: colors.muted }}>{[o.address.line1, o.address.line2, o.address.city, o.address.state, o.address.pincode].filter(Boolean).join(', ')}</Text>
            {o.note ? <Text style={{ color: colors.muted }}>Note: {o.note}</Text> : null}
            <Text style={{ fontWeight: '800', marginTop: 8 }}>Items</Text>
            {o.items.map((i) => <View key={`${i.product}-${i.unit}`} style={row}><Text style={{ flex: 1 }}>{i.name} <Text style={{ color: colors.muted }}>{i.unit} × {i.quantity}</Text></Text><Text>{money(i.lineTotal)}</Text></View>)}
            <View style={row}><Text style={{ color: colors.muted }}>Subtotal</Text><Text>{money(o.subtotal)}</Text></View>
            <View style={row}><Text style={{ color: colors.muted }}>Delivery</Text><Text>{money(o.deliveryFee)}</Text></View>
            {o.discount > 0 ? <View style={row}><Text style={{ color: colors.muted }}>Discount</Text><Text>-{money(o.discount)}</Text></View> : null}
            <View style={row}><Text style={{ fontWeight: '800' }}>Total</Text><Text style={{ fontWeight: '800' }}>{money(o.total)}</Text></View>
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <H title="Orders" sub="Accept new orders, prepare them and hand them to a free rider." center />
      <SearchBar value={q} onChangeText={setQ} onSubmit={() => setQuery(q.trim())} placeholder="Search order number" />
      <View style={{ height: 52 }}><Chips value={status} options={TABS} onChange={(v) => { setRows(null); setStatus(v); }} /></View>
      <ErrorText message={error} />
      {!rows ? <Center /> : rows.length === 0 ? <Empty text="No orders here." /> : (
        <FlatList data={rows} keyExtractor={(o) => o._id} renderItem={renderItem} contentContainerStyle={{ padding: 16, paddingTop: 4 }} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />
      )}
      {assign ? <AssignModal order={assign} onClose={() => setAssign(null)} onDone={() => { setAssign(null); load(); }} /> : null}
    </View>
  );
}

function AssignModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<OrderRiders | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(() => { orderRiders(order._id).then(setData).catch((e) => setError(getErrorMessage(e))); }, [order._id]);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);
  const pick = async (id: string) => {
    setBusy(id); setError('');
    try { await assignRider(order._id, id); onDone(); } catch (e) { setError(getErrorMessage(e)); setBusy(''); }
  };
  const sendShiprocket = async () => {
    setBusy('shiprocket'); setError('');
    try { await assignShiprocket(order._id); onDone(); } catch (e) { setError(getErrorMessage(e)); setBusy(''); }
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '75%' }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Deliver order #{order.orderNumber}</Text>
          {data?.distanceKm != null ? <Text style={{ color: colors.muted, marginTop: 2 }}>{data.distanceKm.toFixed(1)} km away{data.longDistance ? ' · long-distance order' : ''}</Text> : null}
          <ErrorText message={error} />
          <View style={[row, { paddingVertical: 10, marginTop: 6 }]}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>📦 Shiprocket courier</Text><Text style={{ color: colors.muted, fontSize: 12.5 }}>Send this order for courier pickup</Text></View>
            <Btn small title={busy === 'shiprocket' ? 'Sending…' : 'Send'} disabled={!!busy} onPress={sendShiprocket} />
          </View>
          <Text style={{ fontWeight: '800', marginTop: 6 }}>Or give it to a rider</Text>
          {!data ? <Center /> : (
            <ScrollView style={{ marginTop: 8 }}>
              {data.riders.length === 0 ? <Empty text="No riders in this warehouse yet. Add one from More → Riders." /> : data.riders.map((r) => (
                <View key={r._id} style={[row, { paddingVertical: 8, opacity: r.free ? 1 : 0.6 }]}>
                  <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{r.name}</Text><Text style={{ color: colors.muted, fontSize: 12.5 }}>{r.phone}</Text></View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Pill text={STATE_LABEL[r.state] ?? r.state} tone={r.free ? 'success' : 'muted'} />
                    {r.free ? <Btn small title="Assign" disabled={!!busy} onPress={() => pick(r._id)} /> : null}
                  </View>
                </View>
              ))}
              {!data.riders.some((r) => r.free) && data.riders.length > 0 ? <Text style={{ color: colors.muted, marginTop: 6 }}>No rider is free right now. This list refreshes every 15 seconds.</Text> : null}
            </ScrollView>
          )}
          <View style={{ marginTop: 10 }}><Btn tone="outline" title="Close" onPress={onClose} /></View>
        </View>
      </View>
    </Modal>
  );
}

/** While an order waits for a rider: how many riders see it in their app, or why nobody can. */
function RiderPoolLine({ order }: { order: Order }) {
  const pool = order.riderPool!;
  const problem = !pool.linked ? 'No rider linked to this warehouse' : !pool.canSee ? (order.longDistance ? 'Long distance: no long-distance rider' : 'All riders paused or long-distance only') : '';
  if (problem) return <Text style={{ color: colors.danger, fontWeight: '700', marginBottom: 6 }}>Rider: {problem}</Text>;
  return <Text style={{ color: colors.muted, marginBottom: 6 }}>Rider: not assigned · {pool.canSee} can see it, {pool.online} online</Text>;
}
