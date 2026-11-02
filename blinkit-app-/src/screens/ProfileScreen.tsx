import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchCareUnread } from '../api/support';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { usePublicSettingsQuery } from '../store/catalogApi';
import type { TabScreenProps } from '../navigation/TabsContext';
import { useTabs } from '../navigation/TabsContext';
import type { AppNav } from '../navigation/types';
import { colors, gutter, ms, radius, space, themed, useTheme } from '../theme';
import type { ThemePreference } from '../theme';
import type { IconName } from '../ui/Button';
import { LogoMark } from '../ui/Logo';
import { Divider } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { useToast } from '../ui/Toast';

interface MenuItem {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Small red count, e.g. unopened replies from customer care. */
  badge?: number;
  danger?: boolean;
}

export function ProfileScreen(_props: TabScreenProps) {
  const navigation = useNavigation<AppNav>();
  const { user, signOut } = useAuth();
  const { cart } = useCart();
  const { items: saved } = useWishlist();
  const { goToTab } = useTabs();
  const toast = useToast();

  const confirmSignOut = () =>
    Alert.alert('Sign out of Bingoor?', 'Your cart and saved items stay on your account.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);

  // Replies the team has sent that the customer has not opened yet.
  const [careUnread, setCareUnread] = useState(0);
  useEffect(() => {
    fetchCareUnread()
      .then(setCareUnread)
      .catch(() => undefined);
  }, []);

  const account: MenuItem[] = [
    {
      icon: 'person-circle-outline',
      title: 'Personal details',
      subtitle: 'Name, email and how we reach you',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      icon: 'location-outline',
      title: 'Saved addresses',
      subtitle: 'Manage where your orders are delivered',
      onPress: () => navigation.navigate('AddressList'),
    },
    {
      icon: 'heart-outline',
      title: 'Saved items',
      subtitle: saved.length ? `${saved.length} ${saved.length === 1 ? 'product' : 'products'} on your list` : 'Products you keep for later',
      onPress: () => navigation.navigate('Wishlist'),
    },
    {
      icon: 'receipt-outline',
      title: 'Your orders',
      subtitle: 'Track deliveries and reorder in one tap',
      onPress: () => goToTab('orders'),
    },
  ];

  const settings: MenuItem[] = [
    {
      icon: 'lock-closed-outline',
      title: 'Change password',
      subtitle: 'Keep your account secure',
      onPress: () => navigation.navigate('ChangePassword'),
    },
    {
      icon: 'chatbubbles-outline',
      title: 'Chat with customer care',
      subtitle: careUnread > 0
        ? `${careUnread} new ${careUnread === 1 ? 'reply' : 'replies'} from our team`
        : 'We reply within a couple of hours',
      badge: careUnread || undefined,
      onPress: () => navigation.navigate('Support'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy and terms',
      subtitle: 'How your data is used',
      onPress: () => toast.show('Opening this in the app is coming soon'),
    },
  ];

  const initial = (user?.name ?? 'B').trim().charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ------------------------------------------------ header -- */}
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Txt variant="h1" tone="onBrand">
                {initial}
              </Txt>
            </View>
            <Txt variant="h2" tone="onBrand" center numberOfLines={2} style={styles.name}>
              {user?.name ?? 'Bingoor customer'}
            </Txt>
            <Txt variant="bodySm" center style={styles.identityMeta} numberOfLines={1}>
              +91 {user?.phone}
              {user?.email ? `  ·  ${user.email}` : ''}
            </Txt>
            <Pressable
              onPress={() => navigation.navigate('EditProfile')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.75 }]}
            >
              <Ionicons name="create-outline" size={ms(14)} color={colors.onBrand} />
              <Txt variant="labelSm" tone="onBrand">
                Edit profile
              </Txt>
            </Pressable>
          </View>

          <View style={styles.stats}>
            <Stat label="In cart" value={String(cart.itemCount)} onPress={() => goToTab('cart')} />
            <View style={styles.statDivider} />
            <Stat label="Saved" value={String(saved.length)} onPress={() => navigation.navigate('Wishlist')} />
            <View style={styles.statDivider} />
            <Stat label="Orders" value="View" onPress={() => goToTab('orders')} />
          </View>
        </SafeAreaView>

        {/* -------------------------------------------------- menus -- */}
        <Section title="Your account" items={account} />
        <AppearancePicker />
        <Section title="Settings" items={settings} />

        <Pressable
          onPress={confirmSignOut}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}
        >
          <Ionicons name="log-out-outline" size={ms(19)} color={colors.danger} />
          <Txt variant="h4" tone="danger" style={styles.signOutText}>
            Sign out
          </Txt>
        </Pressable>

        <FollowUs />

        <View style={styles.footer}>
          <LogoMark size={30} style={styles.footerMark} />
          <Txt variant="caption" tone="faint" center>
            Bingoor {'·'} version 1.0.0
          </Txt>
          <Txt variant="caption" tone="faint" center style={styles.footerNote}>
            Made for neighbourhood shops.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

/** Social pages the super admin set up. Only the ones that were filled in show; each opens in the phone's browser or the app. */
const SOCIAL_ICONS: Record<string, { label: string; icon: string }> = {
  facebook: { label: 'Facebook', icon: 'logo-facebook' },
  instagram: { label: 'Instagram', icon: 'logo-instagram' },
  youtube: { label: 'YouTube', icon: 'logo-youtube' },
  whatsapp: { label: 'WhatsApp', icon: 'logo-whatsapp' },
  x: { label: 'X', icon: 'logo-twitter' },
  telegram: { label: 'Telegram', icon: 'paper-plane-outline' },
  linkedin: { label: 'LinkedIn', icon: 'logo-linkedin' },
};
function FollowUs() {
  const { data } = usePublicSettingsQuery();
  const toast = useToast();
  const links: Record<string, string | undefined> = data?.socialLinks ?? {};
  const items = [
    ...Object.entries(SOCIAL_ICONS)
      .filter(([k]) => !!links[k])
      .map(([k, v]) => ({ key: k, label: v.label, icon: v.icon, url: links[k] as string })),
    ...(data?.socialOther ?? []).map((o) => ({ key: `o-${o.label}`, label: o.label, icon: 'link-outline', url: o.url })),
  ];
  if (!items.length) return null;
  return (
    <View style={styles.follow}>
      <Txt variant="overline" tone="muted" style={styles.appearanceTitle}>
        Follow us
      </Txt>
      <View style={styles.followRow}>
        {items.map((it) => (
          <Pressable
            key={it.key}
            accessibilityRole="link"
            accessibilityLabel={it.label}
            onPress={() => Linking.openURL(it.url).catch(() => toast.show('Could not open this link'))}
            style={({ pressed }) => [styles.followBtn, pressed && styles.rowPressed]}
          >
            <Ionicons name={it.icon as never} size={ms(20)} color={colors.brand} />
            <Txt variant="caption" tone="muted" numberOfLines={1} style={styles.followLabel}>
              {it.label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Light, dark, or whatever the phone is set to. It lives here, in Account,
 * because that is where people look for it - not as a moon icon on the
 * shopfront competing with the search bar.
 */
function AppearancePicker() {
  const { preference, setPreference } = useTheme();
  const options: { key: ThemePreference; label: string; icon: string }[] = [
    { key: 'light', label: 'Light', icon: 'sunny' },
    { key: 'dark', label: 'Dark', icon: 'moon' },
    { key: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
  ];
  return (
    <View style={styles.appearance}>
      <Txt variant="overline" tone="muted" style={styles.appearanceTitle}>
        Appearance
      </Txt>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = preference === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setPreference(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${o.label} theme`}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
            >
              <Ionicons name={o.icon as never} size={ms(16)} color={on ? colors.onBrand : colors.inkMuted} />
              <Txt variant="label" style={{ color: on ? colors.onBrand : colors.inkBody }}>
                {o.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Stat({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
      <Txt variant="h3" tone="onBrand" numberOfLines={1}>
        {value}
      </Txt>
      <Txt variant="caption" style={styles.statLabel} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

function Section({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <View style={styles.section}>
      <Txt variant="overline" tone="muted" style={styles.sectionTitle}>
        {title}
      </Txt>
      <View style={styles.card}>
        {items.map((item, index) => (
          <View key={item.title}>
            {index > 0 ? <Divider inset={ms(62)} /> : null}
            <Pressable
              onPress={item.onPress}
              accessibilityRole="button"
              android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon as never} size={ms(19)} color={colors.brand} />
              </View>
              <View style={styles.rowBody}>
                <Txt variant="h4">{item.title}</Txt>
                <Txt variant="bodySm" tone="muted" style={styles.rowSub}>
                  {item.subtitle}
                </Txt>
              </View>
              {item.badge ? (
                <View style={styles.rowBadge}>
                  <Txt variant="caption" style={styles.rowBadgeText}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </Txt>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={ms(18)} color={colors.inkFaint} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = themed(({ c }) => ({
  appearance: { marginTop: space.xl, paddingHorizontal: gutter },
  appearanceTitle: { marginBottom: space.sm, textAlign: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: ms(4),
    gap: ms(4),
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(6),
    paddingVertical: ms(10),
    borderRadius: radius.sm,
  },
  segmentItemOn: { backgroundColor: c.brand },
  root: { flex: 1, backgroundColor: c.surfaceSunken },
  follow: { marginTop: space.lg, marginHorizontal: gutter },
  followRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  followBtn: {
    minWidth: ms(74),
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    alignItems: 'center',
    gap: ms(3),
  },
  followLabel: { maxWidth: ms(90) },
  content: { paddingBottom: space.xxxl },

  header: {
    backgroundColor: c.headerFrom,
    paddingHorizontal: gutter,
    paddingBottom: space.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerRow: { alignItems: 'center', paddingTop: space.xl },
  avatar: {
    width: ms(72),
    height: ms(72),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { marginTop: space.md },
  identityMeta: { color: 'rgba(255,255,255,0.75)', marginTop: ms(2) },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(5),
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: ms(6),
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
  },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.xs },
  statLabel: { color: 'rgba(255,255,255,0.7)', marginTop: ms(2) },
  statDivider: { width: StyleSheet.hairlineWidth, height: ms(28), backgroundColor: 'rgba(255,255,255,0.2)' },

  section: { marginTop: space.xxl },
  sectionTitle: { paddingHorizontal: gutter, marginBottom: space.sm, textAlign: 'center' },
  card: {
    marginHorizontal: gutter,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.lg },
  rowPressed: { backgroundColor: c.surfaceSunken },
  rowIcon: {
    width: ms(38),
    height: ms(38),
    borderRadius: radius.sm,
    backgroundColor: c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, marginHorizontal: space.md },
  rowBadge: {
    minWidth: ms(20),
    height: ms(20),
    paddingHorizontal: ms(6),
    borderRadius: radius.pill,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.xs,
  },
  rowBadgeText: { color: '#FFFFFF', fontWeight: '800' },
  rowSub: { marginTop: ms(1) },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: gutter,
    marginTop: space.xxl,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  signOutText: { marginLeft: space.sm },

  footer: { alignItems: 'center', marginTop: space.xxxl },
  footerMark: { opacity: 0.4, marginBottom: space.sm },
  footerNote: { marginTop: ms(2) },}));
