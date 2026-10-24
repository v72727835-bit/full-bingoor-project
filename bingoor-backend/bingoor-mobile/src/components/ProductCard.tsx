import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, shadow } from '../theme';
import { ProductSummary } from '../types';
import { formatPrice } from '../utils/validation';

export function ProductCard({ product, style }: { product: ProductSummary; style?: ViewStyle }) {
  const image = product.images?.[0];

  return (
    <View style={[styles.card, style]}>
      <View style={styles.imageBox}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <Ionicons name="image-outline" size={32} color="#CBD5E1" />
        )}
        {product.discountPercent > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.discountPercent}% OFF</Text>
          </View>
        ) : null}
        {!product.inStock ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>Out of stock</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.unit}>{product.unit}</Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(product.price)}</Text>
        {product.mrp > product.price ? <Text style={styles.mrp}>{formatPrice(product.mrp)}</Text> : null}
      </View>

      {product.shop ? (
        <Text style={styles.shop} numberOfLines={1}>
          {product.shop.name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 156,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 10,
    ...shadow,
  },
  imageBox: {
    height: 112,
    borderRadius: radius.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  soldOut: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text, minHeight: 38 },
  unit: { fontSize: 12, color: colors.muted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  price: { fontSize: 16, fontWeight: '800', color: colors.text },
  mrp: { fontSize: 12, color: colors.muted, textDecorationLine: 'line-through', marginLeft: 6 },
  shop: { fontSize: 11.5, color: colors.muted, marginTop: 4 },
});
