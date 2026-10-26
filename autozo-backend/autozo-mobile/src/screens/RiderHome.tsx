import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useCallback, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { fetchRiderProfile } from '../api/rider';
import { useAuth } from '../context/AuthContext';
import { useForegroundPoll } from '../utils/useForegroundPoll';
import { RiderProfile } from '../types';
import { colors, radius, shadow } from '../theme';
import { CrossFade } from '../components/anim';
import OrdersScreen from './OrdersScreen';
import EarningsScreen from './EarningsScreen';
import WalletScreen from './WalletScreen';
import ProfileScreen from './ProfileScreen';

const LOGO = require('../assets/logo-mark.png');

type Tab = 'orders' | 'earnings' | 'wallet' | 'profile';
const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'orders', label: 'Orders', icon: 'bicycle' },
  { key: 'earnings', label: 'Earnings', icon: 'stats-chart' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

/**
 * The rider's home: a brand bar that clears the status bar, the active screen,
 * and a bottom tab bar. Orders / Earnings / Wallet / Profile each run on their
 * own so moving between them never loses what the rider was doing.
 */
export default function RiderHome() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [bellOpen, setBellOpen] = useState(false);

  const loadProfile = useCallback(() => { fetchRiderProfile().then(setProfile).catch(() => undefined); }, []);
  useForegroundPoll(loadProfile, 30000);
  const notices = profile?.notices ?? [];

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (profile?.name ?? user?.name ?? 'Rider').split(' ')[0];
  const title = tab === 'orders' ? `${greet}, ${firstName}` : tab === 'earnings' ? 'My earnings' : tab === 'wallet' ? 'My wallet' : 'My profile';
  const warehouse = profile?.warehouses?.[0]?.name ?? user?.warehouse?.name ?? 'Delivery partner';

  return (
    <View style={styles.root}>
      {/* Brand bar — padded below the status bar so nothing is cut off. */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logo} />
          <View><Text style={styles.brand}>{title}</Text><Text style={styles.sub}>{warehouse}</Text></View>
        </View>
        <Pressable onPress={() => setBellOpen(true)} style={styles.iconBtn} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={21} color={colors.text} />
          {notices.length > 0 ? <View style={styles.bellDot}><Text style={styles.bellDotText}>{notices.length}</Text></View> : null}
        </Pressable>
      </View>

      <CrossFade dep={tab} style={{ flex: 1 }}>
        {tab === 'orders' ? <OrdersScreen /> : tab === 'earnings' ? <EarningsScreen /> : tab === 'wallet' ? <WalletScreen /> : <ProfileScreen />}
      </CrossFade>

      {/* Bottom tabs */}
      <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabBtn} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Ionicons name={on ? t.icon : (`${t.icon}-outline` as React.ComponentProps<typeof Ionicons>['name'])} size={23} color={on ? colors.primary : colors.muted} />
              <Text style={[styles.tabLabel, on && { color: colors.primary }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={bellOpen} transparent animationType="slide" onRequestClose={() => setBellOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBellOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Notifications</Text>
            {notices.length === 0 ? <Text style={styles.muted}>Nothing to action right now. Keep riding.</Text> : notices.map((n, i) => (
              <View key={i} style={styles.notice}><Ionicons name="alert-circle" size={19} color={colors.primaryDark} /><Text style={styles.noticeText}>{n}</Text></View>
            ))}
            <Button title="Close" variant="outline" onPress={() => setBellOpen(false)} style={{ marginTop: 14 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.background },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, borderRadius: 13, marginRight: 10 },
  brand: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  bellDot: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  bellDotText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  tabbar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '700', color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 30 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 },
  muted: { color: colors.muted, lineHeight: 20 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: radius.md, backgroundColor: colors.primarySoft, marginBottom: 9 },
  noticeText: { flex: 1, color: colors.primaryDark, fontSize: 13.5, lineHeight: 19, fontWeight: '700' },
});
