import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchProducts, fetchShop } from '../api/catalog';
import { getErrorMessage } from '../api/client';
import { ProductCard } from '../components/ProductCard';
import type { AppNav, AppRoute } from '../navigation/types';
import { colors, currency, fillParent, gutter, hitSlop, ms, radius, space, themed } from '../theme';
import { ProductSummary, ShopDetail } from '../types';
import { EmptyState, FullScreenLoader } from '../ui/Feedback';
import { RatingChip } from '../ui/Rating';
import { ProductCardSkeleton } from '../ui/Skeleton';
import { SmartImage } from '../ui/SmartImage';
import { Pill } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { useGrid } from '../utils/layout';

export function ShopDetailScreen() {
  const navigation = useNavigation<AppNav>();
  const { params } = useRoute<AppRoute<'ShopDetail'>>();
  const { width } = useWindowDimensions();
  const grid = useGrid(158, space.md);

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await fetchShop(params.id);
      setShop(detail);
      setError(null);
      const page = await fetchProducts({ shop: detail._id, limit: 30 });
      setProducts(page.items);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !shop) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <BackButton onPress={() => navigation.goBack()} />
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title="Could not load this shop"
          message={error}
          actionLabel="Try again"
          onAction={() => load()}
        />
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <BackButton onPress={() => navigation.goBack()} />
        <FullScreenLoader label={params.name ?? 'Loading shop…'} />
      </SafeAreaView>
    );
  }

  const addressLine = [shop.address?.line1, shop.address?.city, shop.address?.pincode].filter(Boolean).join(', ');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <FlatList
        key={`shop-${grid.columns}`}
        data={products ?? []}
        keyExtractor={(p) => p._id}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap } : undefined}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: grid.padding }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.header, { marginHorizontal: -grid.padding }]}>
            <View style={[styles.banner, { height: width * 0.44 }]}>
              <SmartImage full uri={shop.banner || shop.logo} icon="shopping-cart" style={styles.bannerImage} />
              <View style={styles.bannerVeil} />
            </View>

            <View style={styles.card}>
              <View style={styles.cardTop}>
                <SmartImage uri={shop.logo} icon="shopping-cart" style={styles.logo} radius={radius.md} />
                <View style={styles.cardTitles}>
                  <Txt variant="h2" center numberOfLines={2}>
                    {shop.name}
                  </Txt>
                  <View style={styles.badgeRow}>
                    <Pill label={shop.isOpen ? 'Open now' : 'Closed'} tone={shop.isOpen ? 'success' : 'neutral'} />
                    {shop.rating > 0 ? <RatingChip value={shop.rating} count={shop.ratingCount} style={styles.ratingChip} /> : null}
                  </View>
                </View>
              </View>

              {shop.description ? (
                <Txt variant="body" tone="muted" center style={styles.description}>
                  {shop.description}
                </Txt>
              ) : null}

              <View style={styles.statRow}>
                <Stat
                  icon="bicycle-outline"
                  label="Delivery"
                  value={shop.deliveryFee === 0 ? 'Free' : currency(shop.deliveryFee)}
                />
                <View style={styles.statDivider} />
                <Stat icon="basket-outline" label="Min order" value={currency(shop.minOrderAmount)} />
                <View style={styles.statDivider} />
                <Stat icon="navigate-outline" label="Serves" value={`${shop.deliveryRadiusKm ?? 5} km`} />
              </View>

              {addressLine ? (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={ms(16)} color={colors.inkMuted} />
                  <Txt variant="bodySm" tone="muted" style={styles.addressText}>
                    {addressLine}
                  </Txt>
                </View>
              ) : null}
            </View>

            {shop.categories?.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {shop.categories.map((c) => (
                  <Pressable
                    key={c._id}
                    onPress={() => navigation.navigate('ProductList', { title: c.name, category: c.slug, shop: shop._id })}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                  >
                    <Txt variant="labelSm" tone="body" numberOfLines={1}>
                      {c.name}
                    </Txt>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <View style={[styles.listTitle, { paddingHorizontal: grid.padding }]}>
              <Txt variant="h3" center>
                {products ? `${products.length} ${products.length === 1 ? 'product' : 'products'}` : 'Products'}
              </Txt>
            </View>
          </View>
        }
        ListEmptyComponent={
          products === null ? (
            <View style={styles.skeletonGrid}>
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} width={grid.cardWidth} />
              ))}
            </View>
          ) : (
            <EmptyState icon="basket-outline" title="No products listed" message="This shop has not added anything to its catalogue yet." />
          )
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            width={grid.cardWidth}
            onPress={() => navigation.navigate('ProductDetail', { id: item._id, name: item.name })}
            style={styles.productCard}
          />
        )}
      />

      <SafeAreaView edges={['top']} style={styles.floatBar} pointerEvents="box-none">
        <BackButton onPress={() => navigation.goBack()} />
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={ms(16)} color={colors.brand} />
      <Txt variant="h4" center numberOfLines={1} style={styles.statValue}>
        {value}
      </Txt>
      <Txt variant="caption" tone="faint" center numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn}>
      <Ionicons name="chevron-back" size={ms(23)} color={colors.ink} />
    </Pressable>
  );
}

const styles = themed(({ c, elevation }) => ({
  root: { flex: 1, backgroundColor: c.surfaceSunken },
  listContent: { paddingBottom: space.xxxl, flexGrow: 1 },

  header: { marginBottom: space.md },
  banner: { width: '100%', backgroundColor: c.headerFrom },
  bannerImage: { width: '100%', height: '100%' },
  bannerVeil: { ...fillParent, backgroundColor: c.mode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(6,40,20,0.30)' },

  card: {
    marginHorizontal: gutter,
    marginTop: -ms(34),
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    ...elevation.md,
  },
  cardTop: { alignItems: 'center' },
  logo: { width: ms(64), height: ms(64), marginTop: -ms(48), borderWidth: 3, borderColor: c.surface, backgroundColor: c.surface },
  cardTitles: { alignItems: 'center', marginTop: space.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: space.sm, gap: space.sm },
  ratingChip: {},
  description: { marginTop: space.md },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { marginTop: space.xs },
  statDivider: { width: StyleSheet.hairlineWidth, height: ms(30), backgroundColor: c.border },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginTop: space.md },
  addressText: { flexShrink: 1, marginLeft: space.xs, textAlign: 'center' },

  chipRow: { paddingHorizontal: gutter, paddingTop: space.xl, gap: space.sm },
  chip: {
    minHeight: ms(34),
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipPressed: { backgroundColor: c.brandSurface, borderColor: c.brandBorder },

  listTitle: { marginTop: space.xxl, marginBottom: space.md },
  productCard: { marginBottom: space.md },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },

  floatBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: gutter },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
    ...elevation.sm,
  },}));
