import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/AuthLayout';
import { fetchRiderProfile, fetchWallet } from '../api/rider';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RiderProfile, RiderWallet } from '../types';
import { colors, radius, shadow } from '../theme';
import { FadeSlide } from '../components/anim';

const LOGO = require('../assets/logo-mark.png');
const money = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try { const [p, w] = await Promise.all([fetchRiderProfile(), fetchWallet().catch(() => null)]); setProfile(p); setWallet(w); setError(''); }
    catch (e) { setError(getErrorMessage(e)); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 42 }} />;
  const warehouses = profile?.warehouses?.length ? profile.warehouses : profile?.warehouse ? [profile.warehouse] : [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
      <ErrorBanner message={error} />
      <FadeSlide><View style={styles.card}>
        <View style={styles.avatar}><Image source={LOGO} style={{ width: 40, height: 40, borderRadius: 12 }} /></View>
        <Text style={styles.name}>{profile?.name ?? user?.name}</Text>
        <Text style={styles.muted}>{profile?.phone ?? user?.phone}</Text>
        {profile?.paused ? <View style={styles.pausedPill}><Ionicons name="pause-circle" size={14} color="#fff" /><Text style={styles.pausedText}>Service paused — submit your cash</Text></View> : null}
      </View></FadeSlide>

      <FadeSlide delay={80}><View style={styles.statRow}>
        <Stat label="Delivered" value={String(profile?.deliveredCount ?? 0)} />
        <Stat label="Cancelled" value={String(profile?.cancelledCount ?? 0)} />
        <Stat label="Earned" value={money(wallet?.lifetimeEarned ?? 0)} last />
      </View></FadeSlide>

      <Text style={styles.sectionTitle}>My warehouses</Text>
      <View style={styles.card2}>
        {warehouses.length === 0 ? <Text style={styles.muted}>No warehouse assigned yet.</Text> : warehouses.map((w, i) => (
          <View key={i} style={styles.whRow}><Ionicons name="storefront-outline" size={18} color={colors.primary} /><Text style={styles.whName}>{w.name}</Text></View>
        ))}
      </View>

      {profile?.notices && profile.notices.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Notices</Text>
          <View style={styles.card2}>
            {profile.notices.map((n, i) => (
              <View key={i} style={styles.noticeRow}><Ionicons name="alert-circle" size={18} color={colors.primaryDark} /><Text style={styles.noticeText}>{n}</Text></View>
            ))}
          </View>
        </>
      ) : null}

      <Button title="Log out" variant="outline" onPress={() => void signOut()} style={{ marginTop: 22 }} />
      <Text style={styles.version}>Bingoor Rider</Text>
    </ScrollView>
  );
}

function Stat({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.stat, !last && styles.statBorder]}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 22, alignItems: 'center', ...shadow },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 12 },
  muted: { color: colors.muted, fontSize: 13, marginTop: 3 },
  pausedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#B91C1C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 12 },
  pausedText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: 15, marginTop: 14, ...shadow },
  stat: { flex: 1, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  statValue: { color: colors.text, fontSize: 19, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 22, marginBottom: 10 },
  card2: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, ...shadow },
  whRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  whName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 6 },
  noticeText: { flex: 1, color: colors.primaryDark, fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  version: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 22 },
});
