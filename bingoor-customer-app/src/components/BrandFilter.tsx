import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { fetchBrands } from '../api/catalog';
import { colors, ms, radius, space, themed } from '../theme';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

/** "Brand" chip for the filter strip: opens a list of the aisle's brands, one can be picked. */
export function BrandFilter({ category, value, onChange }: { category?: string; value?: string; onChange: (brand?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<string[] | null>(null);

  useEffect(() => {
    setBrands(null);
  }, [category]);

  useEffect(() => {
    if (!open || brands) return;
    let live = true;
    fetchBrands(category)
      .then((list) => { if (live) setBrands(list); })
      .catch(() => { if (live) setBrands([]); });
    return () => { live = false; };
  }, [open, brands, category]);

  const on = !!value;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={on ? `Brand: ${value}` : 'Filter by brand'}
        style={[styles.chip, on && styles.chipOn]}
      >
        <Ionicons name="pricetags-outline" size={ms(13)} color={on ? colors.brandInk : colors.inkMuted} />
        <Txt variant="labelSm" numberOfLines={1} style={[styles.chipText, on && styles.chipTextOn]}>
          {on ? value : 'Brand'}
        </Txt>
        <Ionicons name="chevron-down" size={ms(12)} color={on ? colors.brandInk : colors.inkMuted} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Brand">
        {!brands ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : brands.length === 0 ? (
          <Txt variant="body" tone="muted" center style={styles.loading}>
            No brands in this aisle yet.
          </Txt>
        ) : (
          <ScrollView style={{ maxHeight: ms(420) }}>
            {[undefined, ...brands].map((b) => {
              const picked = value === b;
              return (
                <Pressable
                  key={b ?? '__all'}
                  onPress={() => {
                    onChange(b);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: picked }}
                  style={styles.row}
                >
                  <Ionicons name={picked ? 'radio-button-on' : 'radio-button-off'} size={ms(20)} color={picked ? colors.brand : colors.inkMuted} />
                  <Txt variant="body" weight={picked ? '800' : '500'} style={{ flex: 1 }}>
                    {b ?? 'All brands'}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </Sheet>
    </>
  );
}

const styles = themed(({ c }) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    maxWidth: ms(170),
    paddingHorizontal: ms(12),
    paddingVertical: ms(7),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipOn: { backgroundColor: c.brandSurface, borderColor: c.brandBorder },
  chipText: { color: c.inkMuted },
  chipTextOn: { color: c.brandInk, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: ms(12), borderBottomWidth: 1, borderBottomColor: c.border },
  loading: { paddingVertical: space.xl },
}));
