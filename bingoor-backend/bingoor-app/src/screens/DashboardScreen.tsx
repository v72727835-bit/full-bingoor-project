import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchHome, searchProducts } from '../api/catalog';
import { getErrorMessage } from '../api/client';
import { ProductCard } from '../components/ProductCard';
import { ShopCard } from '../components/ShopCard';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow } from '../theme';
import { Category, HomeData, ProductSummary } from '../types';

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function CategoryItem({ category }: { category: Category }) {
  return (
    <View style={styles.category}>
      <View style={styles.categoryImage}>
        {category.image ? (
          <Image source={{ uri: category.image }} style={styles.categoryImg} />
        ) : (
          <Ionicons name="grid-outline" size={26} color={colors.primary} />
        )}
      </View>
      <Text style={styles.categoryName} numberOfLines={2}>
        {category.name}
      </Text>
    </View>
  );
}

function ProductRow({ products }: { products: ProductSummary[] }) {
  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p._id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.hList}
      ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
      renderItem={({ item }) => <ProductCard product={item} />}
    />
  );
}

export default function DashboardScreen() {
  const { user, signOut } = useAuth();

  const [home, setHome] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      setHome(await fetchHome());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchProducts(q));
    } catch (err) {
      setSearchError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setSearchError(null);
  };

  const confirmLogout = () => {
    Alert.alert('Log out', 'Do you want to log out of Bingoor?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? 'there';
  const inSearch = results !== null || searching || !!searchError;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hi, {firstName}</Text>
          <Text style={styles.helloSub}>What would you like to order today?</Text>
        </View>
        <Pressable onPress={confirmLogout} style={styles.iconBtn} accessibilityLabel="Log out" hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products, e.g. milk, atta"
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable onPress={clearSearch} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {inSearch ? (
        /* ---------- Search results ---------- */
        <View style={{ flex: 1 }}>
          {searching ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : searchError ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{searchError}</Text>
              <Pressable onPress={runSearch} style={styles.retry}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={results ?? []}
              keyExtractor={(p) => p._id}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Text style={styles.resultsTitle}>
                  {results?.length ?? 0} result{results?.length === 1 ? '' : 's'} for "{query.trim()}"
                </Text>
              }
              ListEmptyComponent={
                <View style={styles.center}>
                  <Ionicons name="search-outline" size={42} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No products found. Try a different word.</Text>
                </View>
              }
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => <ProductCard product={item} style={{ width: '48%' }} />}
            />
          )}
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : error && !home ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color="#CBD5E1" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        /* ---------- Home sections ---------- */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={colors.primary} />
          }
        >
          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Fast & reliable shopping</Text>
              <Text style={styles.heroText}>Groceries and daily needs from shops near you, delivered to your door.</Text>
            </View>
            <Ionicons name="bicycle" size={54} color="rgba(255,255,255,0.9)" />
          </View>

          {home && home.categories.length > 0 ? (
            <>
              <SectionHeader title="Shop by category" />
              <FlatList
                data={home.categories}
                keyExtractor={(c) => c._id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hList}
                renderItem={({ item }) => <CategoryItem category={item} />}
              />
            </>
          ) : null}

          {home && home.popularProducts.length > 0 ? (
            <>
              <SectionHeader title="Popular right now" subtitle="What others are buying" />
              <ProductRow products={home.popularProducts} />
            </>
          ) : null}

          {home && home.newArrivals.length > 0 ? (
            <>
              <SectionHeader title="New arrivals" />
              <ProductRow products={home.newArrivals} />
            </>
          ) : null}

          {home && home.shops.length > 0 ? (
            <>
              <SectionHeader title="Shops for you" />
              <View style={{ paddingHorizontal: 16 }}>
                {home.shops.map((s) => (
                  <ShopCard key={s._id} shop={s} />
                ))}
              </View>
            </>
          ) : null}

          {home &&
          home.categories.length === 0 &&
          home.popularProducts.length === 0 &&
          home.shops.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="storefront-outline" size={44} color="#CBD5E1" />
              <Text style={styles.emptyText}>No shops or products yet. Check back soon!</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  hello: { fontSize: 24, fontWeight: '800', color: colors.text },
  helloSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...shadow,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15.5, color: colors.text, height: '100%' },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroText: { color: 'rgba(255,255,255,0.92)', fontSize: 13.5, marginTop: 6, lineHeight: 19, paddingRight: 8 },
  sectionHeader: { paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sectionSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  hList: { paddingHorizontal: 16, paddingBottom: 4 },
  category: { width: 78, marginRight: 12, alignItems: 'center' },
  categoryImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryImg: { width: '100%', height: '100%' },
  categoryName: { marginTop: 6, fontSize: 12.5, fontWeight: '600', color: colors.text, textAlign: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 24 },
  errorText: { marginTop: 12, fontSize: 14.5, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  emptyText: { marginTop: 12, fontSize: 14.5, color: colors.muted, textAlign: 'center' },
  retry: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  retryText: { color: colors.primary, fontWeight: '700' },
  resultsTitle: { fontSize: 14, color: colors.muted, marginBottom: 12 },
});
