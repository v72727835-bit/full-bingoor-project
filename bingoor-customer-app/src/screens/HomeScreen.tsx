import Icon from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedFooter, HomeSectionView, SectionHandlers } from '../components/HomeSections';
import { CategoryArt } from '../components/CategoryTile';
import { NoticeBell } from '../components/NoticeBell';
import { useAuth } from '../context/AuthContext';
import type { AppNav } from '../navigation/types';
import type { TabScreenProps } from '../navigation/TabsContext';
import { useGoToTab } from '../navigation/TabsContext';
import { gutter, hitSlop, ms, radius, space, themed, useTheme } from '../theme';
import { catalogApi, useHomeQuery } from '../store/catalogApi';
import { useDeliveryPointKey } from '../store/deliveryPoint';
import { offerLocationFix, useLocationProblem } from '../utils/location';
import type { Category } from '../types';
import { Button } from '../ui/Button';
import { Banner, EmptyState } from '../ui/Feedback';
import { ProductCardSkeleton, SkeletonBlock } from '../ui/Skeleton';
import { Txt } from '../ui/Text';
import { shortDelivery } from '../utils/delivery';
import { setDeliveryPromise } from '../store/deliveryPromise';
import { tapConfirm, tapTab } from '../utils/haptics';
import { usePublicSettingsQuery } from '../store/catalogApi';
import { useGrid, useRailCardWidth } from '../utils/layout';
import { setLang, useLang } from '../store/language';
import { loadPopularTerms } from '../utils/popularTerms';

const ALL: Category = { _id: 'all', name: 'All', slug: 'all', icon: 'shopping-bags', short: 'All' };

/** What the search box suggests, one at a time - the things people type most. */

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
  const goToTab = useGoToTab();
  const { c } = useTheme();
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
  const treeArea = useDeliveryPointKey();
  const locationProblem = useLocationProblem();
  useEffect(() => {
    if (data) prefetchTree(treeArea);
  }, [data, prefetchTree, treeArea]);

  const address = user?.addresses?.find((a) => a.isDefault) ?? user?.addresses?.[0];
  const { data: publicSettings } = usePublicSettingsQuery();
  const lang = useLang();
  const festival = publicSettings?.festival?.enabled && publicSettings.festival.name ? publicSettings.festival : null;
  const firstName = (user?.name ?? '').split(' ')[0];

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

  // Share the location's real promise so product cards on every other screen match the header.
  useEffect(() => {
    if (data) setDeliveryPromise(shortDelivery(data));
  }, [data]);

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
          <Txt variant="overline" center style={styles.kicker}>
            bingoor.com
          </Txt>
          <View style={styles.timeRow}>
            {/* The promise follows the customer's distance: within 15 km it is
                "19 min", 15-30 km "Next day delivery", beyond "3 days delivery". */}
            <Icon name={(data?.deliveryDays ?? 0) > 0 ? 'calendar-outline' : 'flash'} size={ms(20)} color={c.headerAccent} />
            <Txt variant="h1" tone="onHeader" numberOfLines={1}>
              {(data?.deliveryDays ?? 0) >= 2
                ? `${data?.deliveryDays} days delivery`
                : (data?.deliveryDays ?? 0) === 1
                ? 'Next day delivery'
                : shortDelivery(data) || `${data?.deliveryMins ?? 19} min`}
            </Txt>
          </View>
        </Pressable>

        <Pressable
          onPress={() => goToTab('profile')}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Your account"
          style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}
        >
          {firstName ? (
            <Txt variant="h4" style={styles.avatarText}>
              {firstName[0].toUpperCase()}
            </Txt>
          ) : (
            <Icon name="person" size={ms(17)} color={c.brand} />
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={() => nav.navigate('AddressList', { pickMode: false })}
        accessibilityRole="button"
        accessibilityLabel="Change delivery address"
        style={({ pressed }) => [styles.addressRow, pressed && { opacity: 0.75 }]}
      >
        <Icon name="location-sharp" size={ms(13)} color={c.headerAccent} />
        <Txt variant="labelSm" tone="onHeader" numberOfLines={1}>
          {address ? address.label.charAt(0).toUpperCase() + address.label.slice(1) : area ? 'Current location' : 'Add address'}
        </Txt>
        <Txt variant="caption" numberOfLines={1} style={styles.addressText}>
          {address ? `${address.line1}, ${address.city}` : area ? 'Showing shops that deliver here' : 'to see what delivers to you'}
        </Txt>
        <Icon name="chevron-down" size={ms(13)} color={c.onHeader} />
      </Pressable>

      {locationProblem && !address && !area ? (
        <Pressable
          onPress={() => offerLocationFix(locationProblem)}
          accessibilityRole="button"
          accessibilityLabel="Turn on location"
          style={({ pressed }) => [styles.addressRow, pressed && { opacity: 0.75 }]}
        >
          <Icon name="navigate-circle" size={ms(14)} color={c.headerAccent} />
          <Txt variant="caption" tone="onHeader" numberOfLines={1} style={{ flex: 1 }}>
            {locationProblem === 'off' ? 'Turn on location for your exact delivery time' : 'Allow location for your exact delivery time'}
          </Txt>
          <Icon name="chevron-forward" size={ms(13)} color={c.onHeader} />
        </Pressable>
      ) : null}
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
        {/* The festival (while the admin has it on) comes first, then every aisle. */}
        {festival ? (
          <Pressable
            onPress={() => {
              tapTab();
              goToTab('festival');
            }}
            accessibilityRole="tab"
            accessibilityLabel={festival.name}
            style={styles.tab}
          >
            <View style={[styles.tabArt, styles.festivalArt]}>
              <Icon name="gift" size={ms(22)} color="#B91C1C" />
            </View>
            <Txt variant="caption" numberOfLines={1} weight="800" style={{ color: c.onHeader }}>
              {festival.name}
            </Txt>
            <View style={styles.tabLine} />
          </Pressable>
        ) : null}
        {tabs.map((t) => {
          const on = t.slug === tab;
          return (
            <Pressable
              key={t._id}
              onPress={() => {
                tapTab();
                setTab(t.slug);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.name}
              style={styles.tab}
            >
              <View style={[styles.tabArt, on && styles.tabArtOn]}>
                {/* The uploaded brand / aisle photo, like the website; bundled artwork when there is none. */}
                <CategoryArt category={t} size={24} />
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
        {!address ? <View style={{ padding: gutter, gap: space.sm }}>
          <Txt variant="h4">{area ? 'Deliver to your current location' : 'Choose your delivery location'}</Txt>
          <Txt variant="bodySm" tone="muted">Confirm your map pin and save your address for doorstep delivery.</Txt>
          <Button label="Set pin and save address" onPress={() => nav.navigate('AddressForm')} />
        </View> : null}
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
 * `Search "Bajaj Pulsar"` → `Search "Volvo"` → ... real products and aisles
 * from the store. The word slides up and out every couple of seconds, which
 * both hints at the range and makes an idle screen feel alive.
 */
function RotatingHint() {
  const [i, setI] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    loadPopularTerms().then((list) => { if (alive) setHints(list); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (hints.length < 2) return;
    const t = setInterval(() => {
      Animated.timing(y, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        setI((n) => (n + 1) % hints.length);
        y.setValue(-1);
        Animated.timing(y, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      });
    }, 2400);
    return () => clearInterval(t);
  }, [y, hints.length]);

  if (!hints.length) {
    return (
      <View style={styles.hint}>
        <Txt variant="body" tone="faint">Search products</Txt>
      </View>
    );
  }

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
          “{hints[i % hints.length]}”
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
    paddingBottom: space.xs,
    backgroundColor: c.headerFrom,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroTitle: { flex: 1, alignItems: 'center' },
  kicker: { color: c.onHeaderMuted },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ms(4), marginTop: ms(2) },
  avatar: {
    width: ms(40),
    height: ms(40),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: { color: c.onHeader },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
    gap: ms(5),
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: ms(5),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
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
    height: ms(46),
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
    overflow: 'hidden', // the photo fills the tile edge to edge
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  tabArtOn: { backgroundColor: 'rgba(255,255,255,0.95)' },
  festivalArt: { backgroundColor: '#FFF3C4' },
  langChip: { minWidth: ms(38), height: ms(32), paddingHorizontal: ms(8), borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.onHeader, marginRight: ms(6) },
  tabLine: { height: ms(3), width: '70%', borderTopLeftRadius: ms(3), borderTopRightRadius: ms(3), marginTop: ms(4) },
  tabLineOn: { backgroundColor: c.headerAccent },

  sectionWrap: { marginBottom: space.sm },

  loading: { padding: gutter, gap: space.md, backgroundColor: c.surface },
  loadingRow: { flexDirection: 'row', marginTop: space.md },
}));
