import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, currency, elevation, fillParent, ms, radius, space, themed } from '../theme';
import { ShopSummary } from '../types';
import { RatingChip } from '../ui/Rating';
import { SmartImage } from '../ui/SmartImage';
import { Txt } from '../ui/Text';

interface Props {
  shop: ShopSummary;
  onPress: () => void;
  /** 'rail' for the horizontal home row, 'row' for a full-width list. */
  layout?: 'rail' | 'row';
  width?: number;
  style?: ViewStyle;
}

export function ShopCard({ shop, onPress, layout = 'row', width, style }: Props) {
  const closed = !shop.isOpen;
  const meta = [shop.address?.city, shop.deliveryFee === 0 ? 'Free delivery' : `${currency(shop.deliveryFee)} delivery`]
    .filter(Boolean)
    .join('  ·  ');

  if (layout === 'rail') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${shop.name}${closed ? ', closed' : ''}`}
        style={({ pressed }) => [styles.rail, { width }, elevation.sm, pressed && styles.pressed, style]}
      >
        <View style={styles.railBannerWrap}>
          <SmartImage full uri={shop.banner || shop.logo} icon="shopping-cart" style={styles.railBanner} />
          {closed ? (
            <View style={styles.closedVeil}>
              <Txt variant="caption" tone="onBrand" weight="700">
                CLOSED
              </Txt>
            </View>
          ) : null}
        </View>
        <View style={styles.railBody}>
          <Txt variant="h4" numberOfLines={1}>
            {shop.name}
          </Txt>
          <View style={styles.railMeta}>
            {shop.rating > 0 ? <RatingChip value={shop.rating} /> : null}
            <Txt variant="caption" tone="muted" numberOfLines={1} style={styles.railMetaText}>
              {shop.address?.city ?? 'Nearby'}
            </Txt>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${shop.name}${closed ? ', closed' : ''}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      <View>
        <SmartImage uri={shop.logo || shop.banner} icon="shopping-cart" style={styles.logo} radius={radius.md} />
        {closed ? <View style={styles.logoDot} /> : null}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Txt variant="h4" numberOfLines={1} style={styles.rowTitle}>
            {shop.name}
          </Txt>
          {shop.rating > 0 ? <RatingChip value={shop.rating} count={shop.ratingCount} /> : null}
        </View>

        {shop.description ? (
          <Txt variant="bodySm" tone="muted" numberOfLines={1} style={styles.rowDesc}>
            {shop.description}
          </Txt>
        ) : null}

        <View style={styles.rowFooter}>
          <Ionicons name="bicycle-outline" size={ms(13)} color={colors.inkFaint} />
          <Txt variant="caption" tone="faint" numberOfLines={1} style={styles.rowMeta}>
            {meta}
          </Txt>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={ms(18)} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = themed(({ c }) => ({
  pressed: { backgroundColor: c.surfaceRaised },

  rail: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  railBannerWrap: { width: '100%', height: ms(96) },
  railBanner: { width: '100%', height: '100%' },
  closedVeil: {
    ...fillParent,
    backgroundColor: c.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railBody: { padding: space.md },
  railMeta: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs },
  railMetaText: { flexShrink: 1, marginLeft: space.xs },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: c.surface,
  },
  logo: { width: ms(58), height: ms(58) },
  logoDot: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: ms(12),
    height: ms(12),
    borderRadius: radius.pill,
    backgroundColor: c.inkFaint,
    borderWidth: 2,
    borderColor: c.surface,
  },
  rowBody: { flex: 1, marginHorizontal: space.md },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { flexShrink: 1, marginRight: space.sm },
  rowDesc: { marginTop: ms(2) },
  rowFooter: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs },
  rowMeta: { flexShrink: 1, marginLeft: space.xs },}));
