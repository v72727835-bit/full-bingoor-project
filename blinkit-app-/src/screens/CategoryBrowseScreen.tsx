import Icon from '@react-native-vector-icons/ionicons/static';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryArt } from '../components/CategoryTile';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import type { AppNav, AppRoute } from '../navigation/types';
import { colors, currency, gutter, hitSlop, ms, radius, space, themed, useTheme } from '../theme';
import { BrandFilter } from '../components/BrandFilter';
import { useCategoryQuery, useProductsQuery } from '../store/catalogApi';
import { useDeliveryPointKey } from '../store/deliveryPoint';
import type { Category, ProductSort, ProductSummary } from '../types';
import { EmptyState } from '../ui/Feedback';
import { ProductCardSkeleton } from '../ui/Skeleton';
import { Txt } from '../ui/Text';
import { productGridPerf, useGrid } from '../utils/layout';
import { shareLink } from '../utils/share';

/**
 * A category tile's page: child aisles down the left, products on the right.
 *
 * The rail is a list rather than a row of tabs because a category can have a
 * dozen children - tabs would either scroll out of sight or shrink their
 * labels to nothing. A vertical rail shows every option at a readable size and
 * keeps the customer's place while the grid on the right reloads.
 */
const SORTS: { key: ProductSort; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'rating', label: 'Top rated' },
];

export function CategoryBrowseScreen() {
  const nav = useNavigation<AppNav>();
  const { params } = useRoute<AppRoute<'CategoryBrowse'>>();
  const insets = useSafeAreaInsets();
  const { c, tint } = useTheme();
  const { cart } = useCart();
  const grid = useGrid();
  const { width } = useWindowDimensions();

  const [childSlug, setChildSlug] = useState<string | undefined>(params.childSlug);
  const [sort, setSort] = useState<ProductSort>('popular');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [brand, setBrand] = useState<string | undefined>();
  const listRef = useRef<FlatList<ProductSummary>>(null);

  /* Two columns of products fit beside the rail even on a small phone. The
     grid's own padding comes out first so the last column never runs off. */
  const railWidth = ms(84);
  const gridPad = space.md;
  const columns = Math.max(2, Math.min(3, grid.columns - 1));
  const gridInner = width - railWidth - gridPad * 2;
  const cardWidth = Math.floor((gridInner - space.sm * (columns - 1)) / columns);

  // Both the aisle and its products come from the Redux cache, so switching
  // back to a child you already opened is instant.
  const { data: page, isLoading: loadingPage, isError: pageFailed } = useCategoryQuery({ slug: params.slug, at: useDeliveryPointKey() });
  useEffect(() => {
    if (page) setChildSlug((prev) => prev ?? page.children[0]?.slug);
  }, [page]);

  // Wait for the page so the first request is the first child, not the parent
  // (fall back to the parent if it has no children or the page failed).
  const activeSlug = childSlug ?? ((page && !page.children.length) || pageFailed ? params.slug : undefined);
  const area = useDeliveryPointKey();
  // A brand picked in one aisle may not exist in the next one.
  useEffect(() => setBrand(undefined), [activeSlug]);
  const products = useProductsQuery({ category: activeSlug, limit: 40, sort, inStock: inStockOnly || undefined, brand, at: area }, { skip: !activeSlug });
  // currentData is only ever this aisle's list, never the previous child's.
  const items: ProductSummary[] = products.currentData?.items ?? [];
  const loadingItems = !activeSlug || (products.isFetching && !products.currentData);
  const error = typeof products.error === 'string' ? products.error : products.error ? 'Something went wrong' : null;
  const loadItems = () => void products.refetch();

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeSlug]);

  const children: Category[] = useMemo(() => page?.children ?? [], [page]);
  const activeChild = children.find((ch) => ch.slug === activeSlug);
  const title = page?.name ?? params.name ?? 'Category';

  return (
    <View style={styles.root}>
      {/* --------------------------------------------------------- header -- */}
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          onPress={() => nav.goBack()}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.headerBtn}
        >
          <Icon name="chevron-back" size={ms(22)} color={c.ink} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Txt variant="h3" numberOfLines={1}>
            {title}
          </Txt>
          {activeChild ? (
            <Txt variant="caption" tone="muted" numberOfLines={1}>
              {activeChild.name}
            </Txt>
          ) : null}
        </View>
        {/* Sharing an aisle is how one shopper sends another straight to the
            shelf they meant. */}
        <Pressable
          onPress={() =>
            void shareLink(activeChild?.name ?? title, `/categories/${activeChild?.slug ?? params.slug}`)
          }
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={`Share ${activeChild?.name ?? title}`}
          style={styles.headerBtn}
        >
          <Icon name="share-social-outline" size={ms(20)} color={c.ink} />
        </Pressable>
        <Pressable
          onPress={() => nav.navigate('Search')}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={styles.headerBtn}
        >
          <Icon name="search" size={ms(20)} color={c.ink} />
        </Pressable>
      </View>

      {error && !items.length && !loadingItems ? (
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title="Could not load this aisle"
          message={error}
          actionLabel="Try again"
          onAction={loadItems}
        />
      ) : (
        <View style={styles.body}>
          {/* ------------------------------------------------------- rail -- */}
          <ScrollView
            style={[styles.rail, { width: railWidth }]}
            contentContainerStyle={{ paddingBottom: ms(120) }}
            showsVerticalScrollIndicator={false}
          >
            {(loadingPage ? Array.from({ length: 8 }).map(() => null) : children).map((ch, i) => {
              if (!ch) {
                return <View key={`s${i}`} style={[styles.railItem, styles.railSkeleton]} />;
              }
              const on = ch.slug === activeSlug;
              return (
                <Pressable
                  key={ch._id}
                  onPress={() => setChildSlug(ch.slug)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={ch.name}
                  style={[styles.railItem, on && styles.railItemOn]}
                >
                  {on ? <View style={styles.railMark} /> : null}
                  <View style={[styles.railArt, { backgroundColor: tint(ch.tint) }, on && styles.railArtOn]}>
                    <CategoryArt category={ch} size={30} />
                  </View>
                  <Txt variant="caption" center numberOfLines={2} tone={on ? 'brand' : 'muted'} weight={on ? '800' : '600'}>
                    {ch.name}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ------------------------------------------------------- grid -- */}
          <View style={styles.gridWrap}>
            {/* Point: sort and filter inside a child aisle. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterRow}>
              <Pressable
                onPress={() => setInStockOnly((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ selected: inStockOnly }}
                style={[styles.chip, inStockOnly && styles.chipOn]}
              >
                <Icon name={inStockOnly ? 'checkmark-circle' : 'ellipse-outline'} size={ms(13)} color={inStockOnly ? colors.brandInk : colors.inkMuted} />
                <Txt variant="labelSm" style={[styles.chipText, inStockOnly && styles.chipTextOn]}>In stock</Txt>
              </Pressable>
              <BrandFilter category={activeSlug} value={brand} onChange={setBrand} />
              {SORTS.map((option) => {
                const on = sort === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setSort(option.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Txt variant="labelSm" style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
            {loadingItems ? (
              <View style={styles.skeletonGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} width={cardWidth} />
                ))}
              </View>
            ) : items.length === 0 ? (
              <EmptyState
                icon="basket-outline"
                title="Nothing here yet"
                message={`We are still stocking ${activeChild?.name ?? title}. Try another aisle on the left.`}
              />
            ) : (
              <FlatList
                ref={listRef}
                {...productGridPerf}
                data={items}
                keyExtractor={(p) => p._id}
                numColumns={columns}
                key={columns}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={columns > 1 ? { gap: space.sm } : undefined}
                contentContainerStyle={styles.gridContent}
                ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
                renderItem={({ item }) => (
                  <ProductCard
                    product={item}
                    width={cardWidth}
                    onPress={() => nav.navigate('ProductDetail', { id: item._id, name: item.name })}
                  />
                )}
              />
            )}
          </View>
        </View>
      )}

      {/* Standing reminder of the basket, so a long browse never loses it. */}
      {cart.itemCount > 0 ? (
        <Pressable
          onPress={() => nav.navigate('Checkout')}
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${cart.itemCount} items, ${currency(cart.total)}`}
          style={({ pressed }) => [styles.cartBar, { bottom: insets.bottom + space.md }, pressed && { opacity: 0.9 }]}
        >
          <Icon name="basket" size={ms(19)} color={c.onBrand} />
          <View style={{ flex: 1 }}>
            <Txt variant="label" tone="onBrand" numberOfLines={1}>
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
            </Txt>
            <Txt variant="caption" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.86)' }}>
              {currency(cart.total)}
            </Txt>
          </View>
          <Txt variant="label" tone="onBrand">
            Checkout
          </Txt>
          <Icon name="chevron-forward" size={ms(17)} color={c.onBrand} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themed(({ c, elevation }) => ({
  root: { flex: 1, backgroundColor: c.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerBtn: { width: ms(40), height: ms(40), borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1 },

  body: { flex: 1, flexDirection: 'row' },

  /* ScrollView grows by default; in this row that let the rail take half the
     screen and pushed the second product column off the edge. */
  rail: { flexGrow: 0, flexShrink: 0, backgroundColor: c.surfaceSunken, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border },
  railItem: { alignItems: 'center', paddingVertical: space.md, paddingHorizontal: ms(4), gap: ms(4) },
  railItemOn: { backgroundColor: c.surface },
  railSkeleton: { height: ms(84), backgroundColor: c.skeleton, marginBottom: 1, opacity: 0.5 },
  railMark: { position: 'absolute', left: 0, top: ms(10), bottom: ms(10), width: ms(3), borderRadius: radius.pill, backgroundColor: c.brand },
  railArt: {
    width: ms(50),
    height: ms(50),
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  railArtOn: { borderColor: c.brandBorder, borderWidth: 1.5 },

  gridWrap: { flex: 1, backgroundColor: c.surface },
  gridContent: { padding: space.md, paddingBottom: ms(120) },
  filterBar: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  filterRow: { paddingHorizontal: space.md, paddingVertical: space.sm, alignItems: 'center', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: ms(4), paddingHorizontal: ms(10), paddingVertical: ms(6), borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipOn: { backgroundColor: c.brandSurface, borderColor: c.brandBorder },
  chipText: { color: c.inkMuted },
  chipTextOn: { color: c.brandInk, fontWeight: '700' },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md },

  cartBar: {
    position: 'absolute',
    left: gutter,
    right: gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.brand,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...elevation.lg,
  },
}));
