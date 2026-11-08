import React from 'react';
import { Pressable, View } from 'react-native';
import { useCart } from '../context/CartContext';
import { currency, ms, radius, space, themed } from '../theme';
import { CardVariant, ProductSummary } from '../types';
import { Sheet } from '../ui/Sheet';
import { SmartImage } from '../ui/SmartImage';
import { Stepper } from '../ui/Stepper';
import { Txt } from '../ui/Text';
import { tapAdd } from '../utils/haptics';

/**
 * Point 22: the size picker a card opens when its item has more than one size
 * ("ADD - 3 options"). Each size is its own product, so the cart holds them
 * independently; the row shows a stepper once a size is in the cart.
 */
export function VariantPickerSheet({
  visible,
  onClose,
  product,
}: {
  visible: boolean;
  onClose: () => void;
  product: ProductSummary;
}) {
  const { quantityOf, add, setQuantity, remove } = useCart();
  const variants = product.variants ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} title={`${product.name} - select size`}>
      <View style={styles.list}>
        {variants.map((v: CardVariant) => {
          const qty = quantityOf(v._id);
          const off = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
          const asSummary: ProductSummary = {
            ...product,
            _id: v._id,
            slug: v.slug,
            unit: v.unit,
            price: v.price,
            mrp: v.mrp,
            stock: v.stock,
            inStock: v.inStock,
            images: v.images ?? product.images,
            icon: v.icon ?? product.icon,
            variants: undefined,
          };
          return (
            <View key={v._id} style={styles.row}>
              <SmartImage uri={v.images?.[0] ?? product.images?.[0]} icon={v.icon ?? product.icon} style={styles.thumb} radius={radius.sm} artScale={0.7} />
              <View style={styles.info}>
                <Txt variant="label" numberOfLines={1}>
                  {v.label || v.unit}
                </Txt>
                <View style={styles.priceRow}>
                  <Txt variant="labelSm" weight="800">
                    {currency(v.price)}
                  </Txt>
                  {off > 0 ? (
                    <Txt variant="caption" tone="faint" style={styles.mrp}>
                      {currency(v.mrp)}
                    </Txt>
                  ) : null}
                  {off > 0 ? (
                    <Txt variant="caption" tone="brand" weight="800">
                      {off}% OFF
                    </Txt>
                  ) : null}
                </View>
              </View>
              {!v.inStock ? (
                <View style={styles.outChip}>
                  <Txt variant="caption" tone="muted">
                    Out of stock
                  </Txt>
                </View>
              ) : qty > 0 ? (
                <Stepper
                  value={qty}
                  size="sm"
                  solid
                  max={Math.min(20, v.stock)}
                  onChange={(next) => setQuantity(v._id, next)}
                  onRemove={() => remove(v._id)}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${product.name} ${v.label || v.unit} to cart`}
                  onPress={() => {
                    tapAdd();
                    add(v._id, 1, `${product.name} ${v.label || v.unit}`, asSummary);
                  }}
                  style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
                >
                  <Txt variant="labelSm" tone="brand" style={styles.addLabel}>
                    ADD
                  </Txt>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = themed(({ c }) => ({
  list: { gap: space.sm, paddingTop: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
  },
  thumb: { width: ms(48), height: ms(48), backgroundColor: c.surfaceSunken },
  info: { flex: 1, gap: ms(3) },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  mrp: { textDecorationLine: 'line-through' },
  outChip: { paddingHorizontal: ms(8), paddingVertical: ms(5) },
  addBtn: {
    minWidth: ms(58),
    height: ms(32),
    paddingHorizontal: ms(10),
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: c.brand,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnPressed: { backgroundColor: c.brandSurface },
  addLabel: { fontWeight: '800', letterSpacing: 0.7 },
}));
