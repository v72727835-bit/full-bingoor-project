import Icon from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCategoryTreeQuery } from '../store/catalogApi';
import { useDeliveryPointKey } from '../store/deliveryPoint';
import { CategoryTile } from '../components/CategoryTile';
import type { AppNav } from '../navigation/types';
import type { TabScreenProps } from '../navigation/TabsContext';
import { gutter, ms, radius, space, themed, useTheme } from '../theme';
import { EmptyState } from '../ui/Feedback';
import { SkeletonBlock } from '../ui/Skeleton';
import { SectionHeader } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { useGrid } from '../utils/layout';

/**
 * The full shop, laid out the way the aisles are.
 *
 * Group headings ("Grocery & Kitchen") are not tappable on purpose - they are
 * signposts, not destinations. Tapping a tile is what takes you somewhere,
 * which keeps the two levels from feeling like the same control twice.
 */
export function BrowseScreen({ active }: TabScreenProps) {
  const nav = useNavigation<AppNav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const grid = useGrid();

  // Fetched once (usually prefetched by Home) and kept in the Redux cache.
  const [started, setStarted] = useState(active);
  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);
  const { data: groups = null, error: queryError, refetch } = useCategoryTreeQuery(useDeliveryPointKey(), { skip: !started });
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

  const cols = Math.max(3, Math.min(4, grid.columns));
  const inner = grid.cardWidth * grid.columns + grid.gap * (grid.columns - 1);
  const tileWidth = Math.floor((inner - space.sm * (cols - 1)) / cols);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <Txt variant="h2" tone="onHeader" center>
          All categories
        </Txt>
        <Pressable
          onPress={() => nav.navigate('Search')}
          accessibilityRole="search"
          accessibilityLabel="Search products"
          style={({ pressed }) => [styles.search, pressed && { opacity: 0.85 }]}
        >
          <Icon name="search" size={ms(18)} color={c.inkMuted} />
          <Txt variant="body" tone="faint" numberOfLines={1} style={styles.searchText}>
            Search in all categories
          </Txt>
        </Pressable>
      </View>

      {error && !groups ? (
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title="Could not load categories"
          message={error}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: ms(96) }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.brand} colors={[c.brand]} />
          }
        >
          {groups
            ? groups.map((group) => (
                <View key={group._id} style={styles.group}>
                  <SectionHeader title={group.name} style={styles.groupTitle} />
                  <View style={[styles.grid, { gap: space.sm }]}>
                    {(group.children ?? []).map((cat) => (
                      <CategoryTile
                        key={cat._id}
                        category={cat}
                        width={tileWidth}
                        onPress={() => nav.navigate('CategoryBrowse', { slug: cat.slug, name: cat.name })}
                      />
                    ))}
                  </View>
                </View>
              ))
            : Array.from({ length: 3 }).map((_, g) => (
                <View key={g} style={styles.group}>
                  <SkeletonBlock height={ms(20)} width="44%" style={styles.groupTitle} />
                  <View style={[styles.grid, { gap: space.sm }]}>
                    {Array.from({ length: cols * 2 }).map((__, i) => (
                      <View key={i} style={{ width: tileWidth }}>
                        <SkeletonBlock height={Math.round(tileWidth * 0.96)} radius={radius.md} />
                        <SkeletonBlock height={ms(11)} style={{ marginTop: space.xs }} />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.surfaceSunken },
  header: { backgroundColor: c.headerFrom, paddingHorizontal: gutter, paddingBottom: space.md, gap: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: ms(44),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  searchText: { flex: 1 },

  group: { backgroundColor: c.surface, paddingVertical: space.xl, marginBottom: space.sm },
  groupTitle: { marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: gutter },
}));
