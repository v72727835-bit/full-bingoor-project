import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NearestWarehouse } from '../api/catalog';
import { ms, radius, space, themed, useTheme } from '../theme';
import { Txt } from '../ui/Text';

/** Under the pin map: how far the warehouse the order comes from is, and when it arrives. */
export function NearestWarehouseCard({ nearest, loading }: { nearest: NearestWarehouse | null; loading: boolean }) {
  const { c } = useTheme();
  if (!nearest && !loading) return null;
  const km = nearest ? (nearest.distanceKm < 1 ? `${Math.round(nearest.distanceKm * 1000)} m` : `${nearest.distanceKm} km`) : '';
  const when = nearest ? (nearest.deliveryDays === 0 ? 'Delivery in 19 minutes' : nearest.deliveryText) : '';
  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={nearest ? `Nearest warehouse ${km} by road. ${when}` : 'Finding the nearest warehouse'}>
      <View style={styles.icon}>
        <Ionicons name="storefront" size={ms(18)} color={c.onBrand} />
      </View>
      <View style={{ flex: 1 }}>
        {nearest ? (
          <>
            <Txt variant="label">Nearest warehouse: {km} {nearest.road === false ? 'away (about)' : 'by road'}</Txt>
            <View style={styles.row}>
              <Ionicons name={nearest.deliveryDays > 0 ? 'calendar-outline' : 'flash'} size={ms(13)} color={c.brandText} />
              <Txt variant="caption" tone="brand">{when}{nearest.isOpen ? '' : ' · warehouse closed right now'}</Txt>
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={c.brand} />
            <Txt variant="caption" tone="muted">Finding the nearest warehouse…</Txt>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = themed(({ c }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.brandBorder,
    backgroundColor: c.brandSurface,
  },
  icon: { width: ms(34), height: ms(34), borderRadius: ms(17), backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(2) },
}));
