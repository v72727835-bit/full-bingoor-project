import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { ProductCard } from '../components/ProductCard';
import { useWishlist } from '../context/WishlistContext';
import { useGoToTab } from '../navigation/TabsContext';
import type { AppNav } from '../navigation/types';
import { colors, space } from '../theme';
import { AppHeader } from '../ui/AppHeader';
import { EmptyState } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { ProductCardSkeleton } from '../ui/Skeleton';
import { useGrid } from '../utils/layout';

export function WishlistScreen() {
  const navigation = useNavigation<AppNav>();
  const goToTab = useGoToTab();
  const { items, loading, refresh } = useWishlist();
  const grid = useGrid(158, space.md);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (loading && items.length === 0) {
    return (
      <Screen>
        <AppHeader title="Saved items" />
        <FlatList
          key={`w-skel-${grid.columns}`}
          data={[0, 1, 2, 3]}
          keyExtractor={(i) => String(i)}
          numColumns={grid.columns}
          columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap } : undefined}
          contentContainerStyle={[styles.content, { paddingHorizontal: grid.padding }]}
          renderItem={() => <ProductCardSkeleton width={grid.cardWidth} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Saved items"
        subtitle={items.length ? `${items.length} ${items.length === 1 ? 'product' : 'products'}` : undefined}
      />

      <FlatList
        key={`w-${grid.columns}`}
        data={items}
        keyExtractor={(p) => p._id}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap } : undefined}
        contentContainerStyle={[styles.content, { paddingHorizontal: grid.padding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.brand]} />}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="Nothing saved yet"
            message="Tap the heart on any product to keep it here for later. Saved items stay on your account across devices."
            actionLabel="Browse products"
            onAction={() => {
              navigation.navigate('MainTabs');
              goToTab('home');
            }}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.lg, paddingBottom: space.xxxl, flexGrow: 1 },
  card: { marginBottom: space.md },
});
