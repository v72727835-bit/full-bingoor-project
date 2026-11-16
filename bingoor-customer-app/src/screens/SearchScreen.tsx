import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { fetchProducts, suggestProducts } from '../api/catalog';
import { getErrorMessage } from '../api/client';
import { ProductCard } from '../components/ProductCard';
import type { AppNav, AppRoute } from '../navigation/types';
import { colors, currency, font, gutter, hitSlop, MAX_FONT_SCALE, ms, radius, space, themed, type } from '../theme';
import { ProductSummary, Suggestion } from '../types';
import { EmptyState } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import type { TextInputRef } from '../ui/TextField';
import { ProductCardSkeleton } from '../ui/Skeleton';
import { SmartImage } from '../ui/SmartImage';
import { Txt } from '../ui/Text';
import { productGridPerf, useGrid } from '../utils/layout';
import { loadPopularTerms } from '../utils/popularTerms';

/** Survives navigation within a session; deliberately not persisted to disk. */
const recentSearches: string[] = [];

export function SearchScreen() {
  const navigation = useNavigation<AppNav>();
  const { params } = useRoute<AppRoute<'Search'>>();
  const grid = useGrid(158, space.md);
  const inputRef = useRef<TextInputRef>(null);

  const [query, setQuery] = useState(params?.initialQuery ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [results, setResults] = useState<ProductSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [popular, setPopular] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    loadPopularTerms().then((list) => { if (alive) setPopular(list); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  // Debounced type-ahead. Results are cleared as soon as the query changes so
  // the user never sees stale rows under a new search term.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const list = await suggestProducts(term);
        if (id === requestId.current) setSuggestions(list);
      } catch {
        if (id === requestId.current) setSuggestions([]);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const runSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) return;

    if (!recentSearches.includes(q)) {
      recentSearches.unshift(q);
      if (recentSearches.length > 8) recentSearches.pop();
    }

    setQuery(q);
    setSuggestions([]);
    setSearching(true);
    setError(null);
    try {
      const page = await fetchProducts({ q, limit: 30 });
      setResults(page.items);
    } catch (err) {
      setError(getErrorMessage(err));
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const clear = () => {
    setQuery('');
    setResults(null);
    setSuggestions([]);
    setError(null);
    inputRef.current?.focus();
  };

  const showSuggestions = suggestions.length > 0 && !searching;
  const showIdle = results === null && !showSuggestions && !searching;

  return (
    <Screen background="surface">
      {/* search bar doubles as the header */}
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={colors.ink} />
        </Pressable>

        <View style={styles.inputWrap}>
          <Ionicons name="search" size={ms(18)} color={colors.inkMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (results !== null) setResults(null);
            }}
            onSubmitEditing={() => runSearch(query)}
            placeholder="Search products and brands"
            placeholderTextColor={colors.inkFaint}
            returnKeyType="search"
            autoCorrect={false}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            selectionColor={colors.brand}
            cursorColor={colors.brand}
            style={[styles.input, font('500')]}
            accessibilityLabel="Search products"
          />
          {query.length > 0 ? (
            <Pressable onPress={clear} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={ms(18)} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* --------------------------------------------------- idle state -- */}
      {showIdle ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.idle} showsVerticalScrollIndicator={false}>
          <>
              {recentSearches.length > 0 ? (
                <View style={styles.block}>
                  <Txt variant="overline" tone="muted" style={styles.blockTitle}>
                    Recent searches
                  </Txt>
                  {recentSearches.map((term) => (
                    <Pressable
                      key={term}
                      onPress={() => runSearch(term)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.recentRow, pressed && styles.rowPressed]}
                    >
                      <Ionicons name="time-outline" size={ms(17)} color={colors.inkFaint} />
                      <Txt variant="body" numberOfLines={1} style={styles.recentText}>
                        {term}
                      </Txt>
                      <Ionicons name="arrow-forward" size={ms(15)} color={colors.inkFaint} />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {popular.length ? (
                <View style={styles.block}>
                  <Txt variant="overline" tone="muted" style={styles.blockTitle}>
                    Popular right now
                  </Txt>
                  <View style={styles.tagWrap}>
                    {popular.map((term) => (
                      <Pressable
                        key={term}
                        onPress={() => runSearch(term)}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.tag, pressed && styles.tagPressed]}
                      >
                        <Txt variant="labelSm" tone="body">
                          {term}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
          </>
        </ScrollView>
      ) : null}

      {/* -------------------------------------------------- suggestions -- */}
      {showSuggestions ? (
        <FlatList
          data={suggestions}
          keyExtractor={(s) => s._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.suggestList}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('ProductDetail', { id: item._id, name: item.name })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.suggestRow, pressed && styles.rowPressed]}
            >
              <SmartImage uri={item.images?.[0]} icon={item.icon} style={styles.suggestImage} radius={radius.sm} />
              <View style={styles.suggestBody}>
                <Txt variant="body" numberOfLines={2}>
                  {item.name}
                </Txt>
                <Txt variant="labelSm" tone="brand" style={styles.suggestPrice}>
                  {currency(item.price)}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={ms(17)} color={colors.inkFaint} />
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable
              onPress={() => runSearch(query)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.seeAllRow, pressed && styles.rowPressed]}
            >
              <Ionicons name="search" size={ms(17)} color={colors.brand} />
              <Txt variant="label" tone="brand" style={styles.seeAllText} numberOfLines={2}>
                See all results for &ldquo;{query.trim()}&rdquo;
              </Txt>
            </Pressable>
          }
        />
      ) : null}

      {/* ------------------------------------------------------ results -- */}
      {searching ? (
        <View style={[styles.skeletonGrid, { paddingHorizontal: grid.padding }]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} width={grid.cardWidth} />
          ))}
        </View>
      ) : results !== null ? (
        <FlatList
          key={`res-${grid.columns}`}
          {...productGridPerf}
          data={results}
          keyExtractor={(p) => p._id}
          numColumns={grid.columns}
          columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap } : undefined}
          contentContainerStyle={[styles.resultList, { paddingHorizontal: grid.padding }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            results.length > 0 ? (
              <Txt variant="bodySm" tone="muted" style={styles.resultCount}>
                {results.length} {results.length === 1 ? 'result' : 'results'} for &ldquo;{query.trim()}&rdquo;
              </Txt>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={error ? 'cloud-offline-outline' : 'search-outline'}
              tone={error ? 'danger' : 'neutral'}
              title={error ? 'Search failed' : `No match for "${query.trim()}"`}
              message={error ?? 'Try a shorter word, check the spelling, or browse by category instead.'}
              actionLabel={error ? 'Try again' : 'Browse categories'}
              onAction={() => (error ? runSearch(query) : navigation.goBack())}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={grid.cardWidth}
              onPress={() => navigation.navigate('ProductDetail', { id: item._id, name: item.name })}
              style={styles.card}
            />
          )}
        />
      ) : null}
    </Screen>
  );
}

const styles = themed(({ c }) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter - space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  backBtn: { width: ms(38), height: ms(38), alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ms(44),
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceSunken,
  },
  input: {
    flex: 1,
    marginHorizontal: space.sm,
    paddingVertical: space.sm,
    color: c.ink,
    fontSize: type.bodyLg.fontSize,
  },

  idle: { paddingTop: space.xl, paddingBottom: space.xxxl },
  block: { marginBottom: space.xxl },
  blockTitle: { paddingHorizontal: gutter, marginBottom: space.md },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  rowPressed: { backgroundColor: c.surfaceSunken },
  recentText: { flex: 1, marginHorizontal: space.md },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: gutter, gap: space.sm },
  tag: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSunken,
  },
  tagPressed: { backgroundColor: c.brandSurface, borderColor: c.brandBorder },

  suggestList: { paddingVertical: space.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: gutter + ms(52) },
  suggestRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, paddingVertical: space.md },
  suggestImage: { width: ms(44), height: ms(44) },
  suggestBody: { flex: 1, marginHorizontal: space.md },
  suggestPrice: { marginTop: ms(2) },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  seeAllText: { flex: 1, marginLeft: space.md },

  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingTop: space.lg },
  resultList: { paddingTop: space.md, paddingBottom: space.xxxl, flexGrow: 1 },
  resultCount: { marginBottom: space.md },
  card: { marginBottom: space.md },}));
