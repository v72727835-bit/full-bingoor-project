import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '../components/BarChart';
import { ErrorBanner } from '../components/AuthLayout';
import { fetchEarnings, fetchWalletTxns } from '../api/rider';
import { getErrorMessage } from '../api/client';
import { EarningsSummary, WalletTxn } from '../types';
import { colors, radius, shadow } from '../theme';
import { AnimatedNumber, FadeSlide } from '../components/anim';

const money = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

export default function EarningsScreen() {
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [recent, setRecent] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [e, t] = await Promise.all([fetchEarnings(14), fetchWalletTxns(1, 'earning')]);
      setData(e); setRecent(t.slice(0, 8)); setError('');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 42 }} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
      <ErrorBanner message={error} />
      <FadeSlide>
        <View style={styles.cards}>
          <Metric label="Today" amount={data?.today ?? 0} tone />
          <Metric label="This week" amount={data?.week ?? 0} />
        </View>
      </FadeSlide>
      <FadeSlide delay={80}>
        <View style={styles.cards}>
          <Metric label="Last 14 days" amount={data?.month ?? 0} />
          <Metric label="Deliveries" amount={data?.deliveries ?? 0} money={false} />
        </View>
      </FadeSlide>

      <FadeSlide delay={160}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Earnings — last 14 days</Text>
          {data && data.series.length ? <BarChart data={data.series} height={130} /> : <Text style={styles.muted}>No earnings yet.</Text>}
        </View>
      </FadeSlide>

      <Text style={styles.sectionTitle}>Recent deliveries</Text>
      {recent.length === 0 ? (
        <View style={styles.empty}><Ionicons name="bicycle-outline" size={40} color={colors.primary} /><Text style={styles.muted}>Your delivery earnings will show here.</Text></View>
      ) : recent.map((t, i) => (
        <FadeSlide key={t._id} delay={i * 45}>
        <View style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="bicycle" size={18} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t.note || 'Delivery'}</Text>
            <Text style={styles.muted}>{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{t.km ? ` · ${t.km} km` : ''}</Text>
          </View>
          <Text style={styles.plus}>+{money(t.amount)}</Text>
        </View>
        </FadeSlide>
      ))}
    </ScrollView>
  );
}

function Metric({ label, amount, tone, money: asMoney = true }: { label: string; amount: number; tone?: boolean; money?: boolean }) {
  return (
    <View style={[styles.metric, tone && { backgroundColor: colors.primary }]}>
      <Text style={[styles.metricLabel, tone && { color: '#FFEDD5' }]}>{label}</Text>
      <AnimatedNumber value={amount} format={asMoney ? (v) => `₹${Math.round(v).toLocaleString('en-IN')}` : undefined} style={[styles.metricValue, tone && { color: '#fff' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metric: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow },
  metricLabel: { color: colors.muted, fontSize: 12.5, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 6 },
  panel: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginTop: 4, marginBottom: 16, ...shadow },
  panelTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: 14 },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginBottom: 9, ...shadow },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  muted: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  plus: { color: colors.success, fontWeight: '800', fontSize: 15 },
  empty: { alignItems: 'center', padding: 24 },
});
