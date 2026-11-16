import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { fetchProducts } from '../api/catalog';
import { getErrorMessage } from '../api/client';
import { BrandFilter } from '../components/BrandFilter';
import { ProductCard } from '../components/ProductCard';
import type { AppNav, AppRoute } from '../navigation/types';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { PageMeta, ProductSort, ProductSummary } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { EmptyState } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { ProductCardSkeleton } from '../ui/Skeleton';
import { Txt } from '../ui/Text';
import { productGridPerf, useGrid } from '../utils/layout';

const SORTS: { key: ProductSort; label: string }[] = [
  { key: 'relevance', label: 'Recommended' },
  { key: 'popular', label: 'Most bought' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'rating', label: 'Top rated' },
  { key: 'newest', label: 'Newest' },
];

export function ProductListScreen() {
  const navigation = useNavigation<AppNav>();
  const { params } = useRoute<AppRoute<'ProductList'>>();
  const grid = useGrid();

  const [sort, setSort] = useState<ProductSort>(params.sort ?? 'relevance');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [brand, setBrand] = useState<string | undefined>();
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [meta, setMeta] = useState<PageMeta | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (page: number) => {
      const id = ++requestId.current;
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const result = await fetchProducts({
          category: params.category,
          shop: params.shop,
          q: params.q,
          sort,
          inStock: inStockOnly || undefined,
          brand,
          page,
          limit: 20,
        });
        if (id !== requestId.current) return; // a newer filter won the race
        setItems((prev) => (page === 1 ? result.items : [...prev, ...result.items]));
        setMeta(result.meta);
        setError(null);
      } catch (err) {
        if (id === requestId.current) setError(getErrorMessage(err));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [params.category, params.shop, params.q, sort, inStockOnly, brand],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const loadMore = () => {
    if (loadingMore || loading || !meta?.hasNext) return;
    void load(meta.page + 1);
  };

  const total = meta?.total ?? items.length;

  return (
    <Screen>
      <AppHeader
        title={params.title}
        subtitle={loading ? 'Loading…' : `${total} ${total === 1 ? 'product' : 'products'}`}
        actions={[{ icon: 'search', label: 'Search', onPress: () => navigation.navigate('Search') }]}
      />

      {/* filter strip */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            onPress={() => setInStockOnly((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: inStockOnly }}
            style={[styles.chip, inStockOnly && styles.chipOn]}
          >
            <Ionicons
              name={inStockOnly ? 'checkmark-circle' : 'ellipse-outline'}
              size={ms(15)}
              color={inStockOnly ? colors.brandText : colors.inkMuted}
            />
            <Txt variant="labelSm" style={[styles.chipText, inStockOnly && styles.chipTextOn]}>
              In stock
            </Txt>
          </Pressable>

          <BrandFilter category={params.category} value={brand} onChange={setBrand} />

          <View style={styles.chipSpacer} />

          {SORTS.map((option) => {
            const on = sort === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setSort(option.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Txt variant="labelSm" numberOfLines={1} style={[styles.chipText, on && styles.chipTextOn]}>
                  {option.label}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={[styles.skeletonGrid, { paddingHorizontal: grid.padding }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} width={grid.cardWidth} />
          ))}
        </View>
      ) : error && items.length === 0 ? (
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title="Could not load products"
          message={error}
          actionLabel="Try again"
          onAction={() => load(1)}
        />
      ) : (
        <FlatList
          key={`grid-${grid.columns}`}
          {...productGridPerf}
          data={items}
          keyExtractor={(p) => p._id}
          numColumns={grid.columns}
          columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap } : undefined}
          ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: grid.padding }]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          removeClippedSubviews={false}
          ListEmptyComponent={
            <EmptyState
              icon="basket-outline"
              title="Nothing here yet"
              message={
                inStockOnly
                  ? 'Nothing in this list is in stock right now. Try turning off the in-stock filter.'
                  : 'This list is empty. Try another category or search for something specific.'
              }
              actionLabel={inStockOnly ? 'Show out of stock too' : 'Search products'}
              onAction={() => (inStockOnly ? setInStockOnly(false) : navigation.navigate('Search'))}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : items.length > 0 && !meta?.hasNext ? (
              <Txt variant="caption" tone="faint" center style={styles.footerText}>
                You have seen all {total} products
              </Txt>
            ) : undefined
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={grid.cardWidth}
              onPress={() => navigation.navigate('ProductDetail', { id: item._id, name: item.name })}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = themed(({ c }) => ({
  filters: {
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  filterRow: { paddingHorizontal: gutter, paddingVertical: space.md, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ms(34),
    paddingHorizontal: space.md,
    marginRight: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSunken,
  },
  chipOn: { backgroundColor: c.brandSurface, borderColor: c.brandBorder },
  chipText: { color: c.inkMuted, marginLeft: ms(3) },
  chipTextOn: { color: c.brandInk, fontWeight: '700' },
  chipSpacer: { width: 1, height: ms(20), backgroundColor: c.border, marginRight: space.sm },

  listContent: { paddingTop: space.lg, paddingBottom: space.xxxl, flexGrow: 1 },
  card: { marginBottom: space.md },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingTop: space.lg,
  },
  footer: { paddingVertical: space.xl },
  footerText: { paddingVertical: space.xl },}));
