import Icon from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedFooter, HomeSectionView, SectionHandlers } from '../components/HomeSections';
import { NoticeBell } from '../components/NoticeBell';
import { useAuth } from '../context/AuthContext';
import type { AppNav } from '../navigation/types';
import type { TabScreenProps } from '../navigation/TabsContext';
import { useTabs } from '../navigation/TabsContext';
import { gradient, gutter, hitSlop, ms, radius, space, themed, useTheme } from '../theme';
import { catalogApi, useHomeQuery } from '../store/catalogApi';
import { useDeliveryPointKey } from '../store/deliveryPoint';
import type { Category } from '../types';
import { Banner, EmptyState } from '../ui/Feedback';
import { Illustration } from '../ui/Illustration';
import { ProductCardSkeleton, SkeletonBlock } from '../ui/Skeleton';
import { Txt } from '../ui/Text';
import { shortDelivery } from '../utils/delivery';
import { tapConfirm } from '../utils/haptics';
import { useGrid, useRailCardWidth } from '../utils/layout';
import { setLang, useLang } from '../store/language';

const TRUST = [
  { icon: 'leaf-outline', label: 'Fresh every day' },
  { icon: 'pricetag-outline', label: 'Honest prices' },
  { icon: 'shield-checkmark-outline', label: 'Easy returns' },
] as const;

const ALL: Category = { _id: 'all', name: 'All', nameHi: 'सभी', slug: 'all', icon: 'shopping-bags', short: 'All' };

/** What the search box suggests, one at a time - the things people type most. */
const HINTS = ['milk', 'atta', 'paneer', 'chips', 'maggi', 'shampoo', 'eggs', 'chocolate'];

/**
 * The shopfront.
 *
 * Everything below the search bar comes from the server as typed sections, so
 * the shop can be re-merchandised without a release. The screen owns three
 * things: the header, which tab is selected, and turning taps into navigation.
 */
export function HomeScreen({ active }: TabScreenProps) {
  const nav = useNavigation<AppNav>();
  const { user } = useAuth();
  const { goToTab } = useTabs();
  const { c } = useTheme();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const grid = useGrid();
  const railWidth = useRailCardWidth();

  const [tab, setTab] = useState('all');

  // Tabs mount lazily: start fetching the first time Home is shown, then keep
  // the cached feed (Redux / RTK Query) so coming back is instant.
  const [started, setStarted] = useState(active);
  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);
  const area = useDeliveryPointKey();
  const { data, error: queryError, isLoading: loading, refetch } = useHomeQuery(area, { skip: !started });
  const error = typeof queryError === 'string' ? queryError : queryError ? 'Something went wrong' : null;

  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        await refetch();
      } finally {
        setRefreshing(false);
      }
    },
    [refetch],
  );

  // Warm the Categories tab while the customer is still looking at Home.
  const prefetchTree = catalogApi.usePrefetch('categoryTree');
  useEffect(() => {
    if (data) prefetchTree();
  }, [data, prefetchTree]);

  const address = user?.addresses?.find((a) => a.isDefault) ?? user?.addresses?.[0];
  const firstName = (user?.name ?? '').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Never two tabs with the same label, whatever the data says.
  const tabs = useMemo(() => {
    const seen = new Set<string>();
    return [ALL, ...(data?.topTabs ?? [])].filter((t) => {
      const key = (t.short ?? t.name).toLowerCase();
      if (seen.has(key) || seen.has(t._id)) return false;
      seen.add(key);
      seen.add(t._id);
      return true;
    });
  }, [data]);

  /** A group tab narrows the feed to that aisle's own grid and rails. */
  const sections = useMemo(() => {
    const all = data?.sections ?? [];
    if (tab === 'all') return all;
    const own = all.filter((s) => s.groupSlug === tab);
    return own.length ? own : all;
  }, [data, tab]);

  const handlers: SectionHandlers = {
    deliveryText: shortDelivery(data),
    onProduct: (p) => nav.navigate('ProductDetail', { id: p._id, name: p.name }),
    onCategory: (cat) =>
      cat.level === 3
        ? nav.navigate('ProductList', { title: cat.name, category: cat.slug })
        : nav.navigate('CategoryBrowse', { slug: cat.slug, name: cat.name }),
    onShop: (s) => nav.navigate('ShopDetail', { id: s._id, name: s.name }),
    onSeeAll: (slug, title) => nav.navigate('CategoryBrowse', { slug, name: title }),
    // A banner without a linked category opens the full category list.
    onBanner: (b) => (b.slug ? nav.navigate('CategoryBrowse', { slug: b.slug, name: b.categoryName }) : goToTab('browse')),
  };

  /* ------------------------------------------------------------- header -- */

  const hero = (
    <View style={[styles.hero, { paddingTop: insets.top + space.md }]}>
      <View style={styles.heroTop}>
        {/* The delivery promise answers "how soon?", so a tap buzzes back and
            opens the live order. */}
        <Pressable
          onPress={() => {
            tapConfirm();
            goToTab('orders');
          }}
          accessibilityRole="button"
          accessibilityLabel="Delivery time, see your orders"
          style={styles.heroTitle}
        >
          <Txt variant="labelSm" style={styles.kicker}>
            {firstName ? `${greeting}, ${firstName}! Delivery in` : `${greeting}! Delivery in`}
          </Txt>
          <View style={styles.timeRow}>
            <Icon name="flash" size={ms(24)} color={c.priceMark} />
            <Txt variant="display" tone="onHeader" numberOfLines={1}>
              {shortDelivery(data)}
            </Txt>
          </View>
        </Pressable>

        {/* English / Hindi names, like the website's language menu. */}
        <Pressable
          onPress={() => {
            tapConfirm();
            setLang(lang === 'hi' ? 'en' : 'hi');
          }}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={lang === 'hi' ? 'Switch to English' : 'हिंदी में देखें'}
          style={({ pressed }) => [styles.langChip, pressed && { opacity: 0.8 }]}
        >
          <Txt variant="labelSm" tone="onHeader">
            {lang === 'hi' ? 'EN' : 'हिं'}
          </Txt>
        </Pressable>

        <NoticeBell onDark />

        <Pressable
          onPress={() => goToTab('profile')}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Your account"
          style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}
        >
          {firstName ? (
            <Txt variant="h3" style={styles.avatarText}>
              {firstName[0].toUpperCase()}
            </Txt>
          ) : (
            <Icon name="person" size={ms(19)} color={c.brand} />
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={() => nav.navigate('AddressList', { pickMode: false })}
        accessibilityRole="button"
        accessibilityLabel="Change delivery address"
        style={({ pressed }) => [styles.addressRow, pressed && { opacity: 0.75 }]}
      >
        <Icon name="location" size={ms(15)} color={c.onHeader} />
        <Txt variant="label" tone="onHeader" numberOfLines={1}>
          {address ? address.label.charAt(0).toUpperCase() + address.label.slice(1) : 'Add address'}
        </Txt>
        <Txt variant="bodySm" numberOfLines={1} style={styles.addressText}>
          {address ? `· ${address.line1}, ${address.city}` : '· so we can show what delivers to you'}
        </Txt>
        <Icon name="chevron-down" size={ms(15)} color={c.onHeader} />
      </Pressable>

      {/* The three promises we keep, small enough not to push products down. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trustRow}>
        {TRUST.map((item) => (
          <View key={item.label} style={styles.trustChip}>
            <Icon name={item.icon} size={ms(13)} color={c.priceMark} />
            <Txt variant="caption" tone="onHeader" weight="700">
              {item.label}
            </Txt>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const stickyBar = (
    <View style={styles.sticky}>
      <Pressable
        onPress={() => nav.navigate('Search')}
        accessibilityRole="search"
        accessibilityLabel="Search products"
        style={({ pressed }) => [styles.search, pressed && { opacity: 0.9 }]}
      >
        <Icon name="search" size={ms(19)} color={c.brand} />
        <RotatingHint />
        <View style={styles.searchDivider} />
        <Icon name="mic" size={ms(18)} color={c.inkMuted} />
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsPad}>
        {tabs.map((t) => {
          const on = t.slug === tab;
          return (
            <Pressable
              key={t._id}
              onPress={() => setTab(t.slug)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.name}
              style={styles.tab}
            >
              <View style={[styles.tabArt, on && styles.tabArtOn]}>
                <Illustration name={t.icon} size={24} />
              </View>
              <Txt
                variant="caption"
                numberOfLines={1}
                weight={on ? '800' : '600'}
                style={{ color: on ? c.onHeader : c.onHeaderMuted }}
              >
                {lang === 'hi' && t.nameHi ? t.nameHi : t.short ?? t.name}
              </Txt>
              <View style={[styles.tabLine, on && styles.tabLineOn]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  /* --------------------------------------------------------------- body -- */

  let body: React.ReactNode;
  if (loading && !data) {
    body = (
      <View style={styles.loading}>
        <SkeletonBlock height={ms(150)} radius={radius.xl} />
        <SkeletonBlock height={ms(20)} width="46%" style={{ marginTop: space.xl }} />
        <View style={[styles.loadingRow, { gap: grid.gap }]}>
          {Array.from({ length: grid.columns }).map((_, i) => (
            <ProductCardSkeleton key={i} width={grid.cardWidth} />
          ))}
        </View>
      </View>
    );
  } else if (error && !data) {
    body = (
      <EmptyState
        icon="cloud-offline-outline"
        tone="danger"
        title="Could not load the shop"
        message={error}
        actionLabel="Try again"
        onAction={() => void load()}
      />
    );
  } else {
    body = (
      <>
        {data?.serviceable === false ? (
          <Banner
            tone="warning"
            message="We don't deliver to your pinned address yet. Choose another address in Profile > Addresses."
            style={styles.notServiceable}
          />
        ) : null}
        {sections.map((s) => (
          <View key={s.id} style={styles.sectionWrap}>
            <HomeSectionView
              section={s}
              handlers={handlers}
              cardWidth={railWidth}
              gridWidth={grid.cardWidth * grid.columns + grid.gap * (grid.columns - 1)}
              columns={grid.columns}
            />
          </View>
        ))}
        <FeedFooter />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: ms(150) }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.brand} colors={[c.brand]} />
        }
      >
        {hero}
        {stickyBar}
        {body}
      </ScrollView>
    </View>
  );
}

/**
 * `Search "milk"` → `Search "atta"` → ... The word slides up and out every
 * couple of seconds, which both hints at the range and makes an idle screen
 * feel alive.
 */
function RotatingHint() {
  const [i, setI] = useState(0);
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(y, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        setI((n) => (n + 1) % HINTS.length);
        y.setValue(-1);
        Animated.timing(y, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      });
    }, 2400);
    return () => clearInterval(t);
  }, [y]);

  return (
    <View style={styles.hint}>
      <Txt variant="body" tone="faint">
        Search{' '}
      </Txt>
      <Animated.View
        style={{
          opacity: y.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
          transform: [{ translateY: y.interpolate({ inputRange: [-1, 0, 1], outputRange: [10, 0, -10] }) }],
        }}
      >
        <Txt variant="body" tone="body" weight="600">
          “{HINTS[i]}”
        </Txt>
      </Animated.View>
    </View>
  );
}

const styles = themed(({ c }) => ({
  notServiceable: { marginHorizontal: gutter, marginTop: space.md },
  root: { flex: 1, backgroundColor: c.surfaceSunken },

  hero: {
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
    // The glow sits in the top-right corner, behind the avatar, where there is
    // no small text to lose contrast against it.
    backgroundImage: `${gradient.glow(c.headerGlow, '100% 0%')}, ${gradient.down(c.headerFrom, c.headerTo)}`,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroTitle: { flex: 1 },
  kicker: { color: c.onHeaderMuted, letterSpacing: 0.3 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: ms(2), marginTop: ms(1) },
  avatar: {
    width: ms(42),
    height: ms(42),
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    boxShadow: '0px 4px 14px 0px rgba(0,0,0,0.22)',
  },
  langChip: {
    minWidth: ms(36),
    height: ms(30),
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarText: { color: c.mode === 'dark' ? c.headerTo : c.brand },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: ms(5), marginTop: space.sm },
  addressText: { flexShrink: 1, color: c.onHeaderMuted },

  sticky: { backgroundColor: c.headerTo, paddingTop: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: gutter,
    // On the dark header a plain card surface disappears; the raised tone and
    // a hairline keep the box readable as a box.
    backgroundColor: c.mode === 'dark' ? c.surfaceRaised : c.surface,
    borderWidth: c.mode === 'dark' ? StyleSheet.hairlineWidth : 0,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: ms(48),
    boxShadow: '0px 6px 18px 0px rgba(0,0,0,0.18)',
  },
  hint: { flex: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  searchDivider: { width: StyleSheet.hairlineWidth, height: ms(22), backgroundColor: c.borderStrong },

  tabsPad: { paddingHorizontal: gutter - space.sm, paddingTop: space.sm },
  tab: { alignItems: 'center', gap: ms(3), paddingHorizontal: space.sm, minWidth: ms(66) },
  tabArt: {
    width: ms(38),
    height: ms(38),
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabArtOn: { backgroundColor: 'rgba(255,255,255,0.95)' },
  tabLine: { height: ms(3), width: '70%', borderTopLeftRadius: ms(3), borderTopRightRadius: ms(3), marginTop: ms(4) },
  tabLineOn: { backgroundColor: c.priceMark },

  trustRow: { gap: space.sm, marginTop: space.md, paddingRight: gutter },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(5),
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 210, 63, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 210, 63, 0.55)',
  },
  sectionWrap: { marginBottom: space.sm },

  loading: { padding: gutter, gap: space.md, backgroundColor: c.surface },
  loadingRow: { flexDirection: 'row', marginTop: space.md },
}));
