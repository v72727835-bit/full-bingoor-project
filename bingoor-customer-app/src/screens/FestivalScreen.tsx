import Icon from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { ProductCard } from '../components/ProductCard';
import type { TabScreenProps } from '../navigation/TabsContext';
import type { AppNav } from '../navigation/types';
import { useFestivalQuery } from '../store/catalogApi';
import { useDeliveryPointKey } from '../store/deliveryPoint';
import { gutter, ms, radius, space, themed, useTheme } from '../theme';
import { Banner, EmptyState } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { ProductCardSkeleton, SkeletonBlock } from '../ui/Skeleton';
import { SectionHeader } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { useGrid } from '../utils/layout';

/**
 * The festival tab - Rakhi, Diwali, whatever the admin has running.
 *
 * Everything on it comes from Store Settings: the name on the tab, the cover
 * art, and which aisles make up the rows. A new festival is a few minutes in
 * the admin panel rather than a release.
 */
export function FestivalScreen({ active }: TabScreenProps) {
  const nav = useNavigation<AppNav>();
  const { c } = useTheme();
  const grid = useGrid(158, space.md);
  const { width } = useWindowDimensions();
  // Three cards across, the same size as on Home.
  const railWidth = Math.floor((width - gutter * 2 - space.sm * 2) / 3);
  const area = useDeliveryPointKey();
  // Load on the first visit, then keep the data: skipping while hidden threw it away, so
  // every return to the tab showed the loading skeleton again.
  const [started, setStarted] = useState(active);
  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);
  const { data, error: queryError, isLoading, refetch } = useFestivalQuery(area, { skip: !started });
  const [refreshing, setRefreshing] = useState(false);

  const error = typeof queryError === 'string' ? queryError : queryError ? 'Something went wrong' : null;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading && !data) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonBlock height={ms(150)} radius={radius.lg} style={styles.bannerSkeleton} />
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <ProductCardSkeleton key={i} width={grid.cardWidth} />
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.brand]} />}
      >
        {error ? <Banner tone="danger" message={error} style={styles.banner} /> : null}

        {data?.banner ? (
          <Image source={{ uri: data.banner }} style={styles.bannerArt} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <Txt variant="display" center style={styles.title}>
            {data?.name ?? 'Festival'}
          </Txt>
        )}

        {data && (!data.enabled || data.sections.length === 0) ? (
          <EmptyState
            icon="gift-outline"
            title={`${data.name} is on its way`}
            message="Nothing here just yet. Come back soon for the festival picks."
          />
        ) : null}

        {data?.sections.map((section) => (
          <View key={section.category._id} style={styles.section}>
            <SectionHeader title={section.title || section.category.name} padded={false} style={styles.sectionTitle} />

            {/* Like Home's aisles: a sideways row, three cards on screen at a time. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {section.items.map((p) => (
                <ProductCard
                  key={p._id}
                  product={p}
                  width={railWidth}
                  onPress={() => nav.navigate('ProductDetail', { id: p._id, name: p.name })}
                />
              ))}
            </ScrollView>

            {/* Straight into the aisle, where every child aisle is listed. */}
            <Pressable
              onPress={() =>
                nav.navigate('CategoryBrowse', { slug: section.category.slug, name: section.category.name })
              }
              accessibilityRole="button"
              accessibilityLabel={`See all ${section.category.name}`}
              style={({ pressed }) => [styles.seeAll, pressed && { opacity: 0.8 }]}
            >
              <Txt variant="label" tone="brand">
                See all {section.category.name}
              </Txt>
              <Icon name="arrow-forward" size={ms(16)} color={c.brandText} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = themed(({ c }) => ({
  content: { paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: space.xxl },
  banner: { marginBottom: space.md },
  bannerSkeleton: { marginBottom: space.lg },
  bannerArt: {
    width: '100%',
    aspectRatio: 26 / 9,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceSunken,
    marginBottom: space.lg,
  },
  title: { marginBottom: space.lg },
  section: { marginBottom: space.xl },
  sectionTitle: { marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  rail: { gap: space.sm, paddingRight: space.sm },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.xs,
    marginTop: space.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.brandBorder,
    backgroundColor: c.brandSurface,
  },}));
