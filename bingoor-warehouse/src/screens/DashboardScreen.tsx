import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { sellerDashboard } from '../api/seller';
import { Dashboard } from '../types';
import { colors } from '../theme';
import { Card, Center, ErrorText, H, Pill, Section, StatTile, STATUS_LABEL, money, row, statusTone, when } from '../ui';
import { AnimatedNumber, FadeSlide } from '../components/anim';

export default function DashboardScreen() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setD(await sellerDashboard()); setError(''); } catch (e) { setError(getErrorMessage(e)); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (!d) return error ? <Center><ErrorText message={error} /></Center> : <Center />;
  const by = d.orders.byStatus;
  const active = (by.accepted ?? 0) + (by.preparing ?? 0) + (by.ready_for_pickup ?? 0) + (by.out_for_delivery ?? 0);
  const max = Math.max(1, ...d.trend.map((t) => t.revenue));

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <H title="Dashboard" sub="How your warehouse is doing today." center />
      <ErrorText message={error} />
      <View style={{ padding: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <StatTile label="Today's orders" num={d.today.orders} hint={`${d.orders.total} orders in all`} icon="receipt" accent="blue" />
          <StatTile label="Today's sales" num={d.today.revenue} fmt={money} hint={`${money(d.deliveredRevenue)} delivered`} icon="cash" accent="emerald" />
          <StatTile label="Waiting to accept" value={String(by.placed ?? 0)} hint={`${active} in progress`} icon="hourglass" accent="amber" />
          <StatTile label="Low / out of stock" value={`${d.lowStock.length} / ${d.outOfStock}`} hint={`${d.products.live} live · ${d.products.off} off`} icon="alert-circle" accent="rose" />
        </View>

        <FadeSlide delay={60}><Card style={{ marginTop: 12 }}>
          <Section title="Sales, last 7 days" color={colors.primary} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 }}>
            {d.trend.map((t) => (
              <View key={t.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <View style={{ width: '100%', height: Math.max(3, (t.revenue / max) * 90), backgroundColor: colors.primary, borderRadius: 4 }} />
                <Text style={{ fontSize: 10, color: colors.muted, marginTop: 3 }}>{t.date.slice(8, 10)}/{t.date.slice(5, 7)}</Text>
              </View>
            ))}
          </View>
        </Card></FadeSlide>

        <FadeSlide delay={120}><Card>
          <Section title="Order pipeline" color="#3B82F6" />
          {(['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'] as const).map((st) => (
            <View key={st} style={[row, { paddingVertical: 5 }]}><Pill text={STATUS_LABEL[st]} tone={statusTone(st)} /><Text style={{ fontWeight: '700' }}>{by[st] ?? 0}</Text></View>
          ))}
        </Card></FadeSlide>

        <FadeSlide delay={180}><Card>
          <Section title="Best sellers" color="#8B5CF6" />
          {d.topProducts.length === 0 ? <Text style={{ color: colors.muted }}>No sales yet.</Text> : d.topProducts.map((p) => (
            <View key={p._id} style={[row, { paddingVertical: 5 }]}><Text style={{ flex: 1 }}>{p.name}</Text><Text style={{ color: colors.muted }}>{p.qty} sold · {money(p.revenue)}</Text></View>
          ))}
        </Card></FadeSlide>

        <FadeSlide delay={220}><Card>
          <Section title="Running low" color="#F59E0B" />
          {d.lowStock.length === 0 ? <Text style={{ color: colors.muted }}>Everything is well stocked.</Text> : d.lowStock.map((p) => (
            <View key={p._id} style={[row, { paddingVertical: 5 }]}><Text style={{ flex: 1 }}>{p.name} <Text style={{ color: colors.muted }}>{p.unit}</Text></Text><Pill text={`${p.stock} left`} tone="warn" /></View>
          ))}
        </Card></FadeSlide>

        <FadeSlide delay={260}><Card>
          <Section title="Recent orders" color="#06B6D4" />
          {d.recent.length === 0 ? <Text style={{ color: colors.muted }}>No orders yet.</Text> : d.recent.map((o) => (
            <View key={o._id} style={[row, { paddingVertical: 6 }]}>
              <View><Text style={{ fontWeight: '700' }}>#{o.orderNumber}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{when(o.createdAt)} · {o.paymentMethod === 'cod' ? 'COD' : 'Paid online'}</Text></View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}><Text style={{ fontWeight: '700' }}>{money(o.total)}</Text><Pill text={STATUS_LABEL[o.status] ?? o.status} tone={statusTone(o.status)} /></View>
            </View>
          ))}
        </Card></FadeSlide>
      </View>
    </ScrollView>
  );
}
