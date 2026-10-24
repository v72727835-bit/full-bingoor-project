import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../theme';
import { ShopSummary } from '../types';
import { formatPrice } from '../utils/validation';

export function ShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <View style={styles.card}>
      <View style={styles.logoBox}>
        {shop.logo ? (
          <Image source={{ uri: shop.logo }} style={styles.logo} />
        ) : (
          <Ionicons name="storefront-outline" size={26} color={colors.primary} />
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {shop.name}
          </Text>
          <View style={[styles.status, { backgroundColor: shop.isOpen ? colors.successSoft : colors.dangerSoft }]}>
            <Text style={[styles.statusText, { color: shop.isOpen ? colors.success : colors.danger }]}>
              {shop.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        {shop.description ? (
          <Text style={styles.desc} numberOfLines={1}>
            {shop.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="star" size={13} color={colors.star} />
          <Text style={styles.meta}>
            {shop.rating > 0 ? shop.rating.toFixed(1) : 'New'}
            {shop.ratingCount > 0 ? ` (${shop.ratingCount})` : ''}
          </Text>
          <Text style={styles.dot}>{'•'}</Text>
          <Text style={styles.meta}>
            {shop.deliveryFee > 0 ? `${formatPrice(shop.deliveryFee)} delivery` : 'Free delivery'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 12,
    ...shadow,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: '100%', height: '100%' },
  info: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text, marginRight: 8 },
  status: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  desc: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  meta: { fontSize: 12.5, color: colors.muted, marginLeft: 4 },
  dot: { marginHorizontal: 6, color: colors.muted },
});
