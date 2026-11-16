import Icon from '@react-native-vector-icons/ionicons/static';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useCartItem } from '../context/CartContext';
import { NotifyMeSheet } from './NotifyMeSheet';
import { VariantPickerSheet } from './VariantPickerSheet';
import { tapAdd } from '../utils/haptics';
import { useWishlist } from '../context/WishlistContext';
import { colors, currency, hitSlop, ms, radius, space, themed } from '../theme';
import { ProductSummary } from '../types';
import { StarLine } from '../ui/Rating';
import { SmartImage } from '../ui/SmartImage';
import { Stepper } from '../ui/Stepper';
import { useLocalName } from '../store/language';
import { Txt } from '../ui/Text';

interface Props {
  product: ProductSummary;
  width: number;
  onPress: () => void;
  /** The delivery promise ("19 min"); the admin sets one for the whole basket. */
  deliveryText?: string;
  style?: ViewStyle;
}

/**
 * The tile the whole shop is built on - home rails, category grids, search.
 *
 * Picture first, with the pack size and the add control on its bottom edge,
 * then a centred column: name, price, rating, delivery time. The name keeps a
 * fixed two-line height so a row of cards lines up on the price.
 */
function ProductCardBase({ product, width, onPress, deliveryText = '19 min', style }: Props) {
  const { quantity: qty, add, setQuantity, remove } = useCartItem(product._id);
  const { isSaved, toggle } = useWishlist();
  const localName = useLocalName();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const variantCount = product.variants?.length ?? 0;
  const hasVariants = variantCount >= 2;

  const busy = false; // Quantities render immediately; requests are serialized by CartProvider.
  const saved = isSaved(product._id);
  const soldOut = !product.inStock;
  const imageHeight = Math.round(width * 0.94);
  const off = product.discountPercent;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.unit}, ${currency(product.price)}`}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed, style]}
    >
      {/* ---------------------------------------------------------- image -- */}
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        <SmartImage uri={product.images?.[0]} icon={product.icon} style={styles.image} radius={radius.md} artScale={0.66} />

        {off > 0 && !soldOut ? (
          <View style={styles.flag}>
            <Txt variant="caption" style={styles.flagText}>
              {off}% OFF
            </Txt>
          </View>
        ) : null}

        <Pressable
          onPress={() => toggle(product)}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
          style={styles.heart}
        >
          <Icon name={saved ? 'heart' : 'heart-outline'} size={ms(16)} color={saved ? colors.danger : colors.inkMuted} />
        </Pressable>

        {product.foodType ? (
          <View style={[styles.foodMark, { borderColor: product.foodType === 'veg' ? colors.veg : colors.nonveg }]}>
            <View style={[styles.foodDot, { backgroundColor: product.foodType === 'veg' ? colors.veg : colors.nonveg }]} />
          </View>
        ) : null}

        {/* Out of stock: the image stays sharp (like the website); the Notify me button says it. */}

      </View>

      {/* ----------------------------------------------------------- text -- */}
      {/* Laid out like the website's card: pack size, name, rating, then price on the left and ADD on the right. */}
      <View style={styles.body}>
        <Txt variant="caption" numberOfLines={1} style={styles.unit}>
          {product.unit}
        </Txt>
        <Txt variant="bodySm" tone="ink" weight="700" numberOfLines={2} style={styles.name}>
          {localName(product)}
        </Txt>

        {product.rating > 0 || product.ratingLabel ? (
          <View style={styles.rateRow}>
            {product.rating > 0 ? <StarLine value={product.rating} count={product.ratingCount} /> : null}
            {/* The admin's own badge, e.g. "5L+". */}
            {product.ratingLabel ? (
              <View style={styles.chip}>
                <Txt variant="caption" tone="muted" numberOfLines={1}>
                  {product.ratingLabel}
                </Txt>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.eta}>
          <Icon name="time-outline" size={ms(11)} color={colors.inkMuted} />
          <Txt variant="caption" tone="muted">
            {/* Aisles the admin put on the slower schedule say so here. */}
            {product.deliveryDays && product.deliveryDays > 1 ? `${product.deliveryDays} days` : deliveryText}
          </Txt>
        </View>

        <View style={styles.buyRow}>
          <View style={styles.priceCol}>
            <Txt variant="priceSm" weight="800" numberOfLines={1}>
              {currency(product.price)}
            </Txt>
            {product.mrp > product.price ? (
              <Txt variant="caption" tone="faint" numberOfLines={1} style={styles.mrp}>
                {currency(product.mrp)}
              </Txt>
            ) : null}
          </View>
            {soldOut ? (
              <Pressable
                onPress={() => setNotifyOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Notify me when ${product.name} is back`}
                style={({ pressed }) => [styles.addBtn, styles.notifyBtn, pressed && styles.addBtnPressed]}
              >
                <Txt variant="labelSm" style={styles.notifyLabel}>
                  Notify me
                </Txt>
              </Pressable>
            ) : qty > 0 ? (
              <Stepper
                value={qty}
                size="sm"
                solid
                max={Math.min(20, product.stock)}
                busy={busy}
                onChange={(next) => setQuantity(product._id, next)}
                onRemove={() => remove(product._id)}
              />
            ) : hasVariants ? (
              <Pressable
                onPress={() => setSizeOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${product.name}, ${variantCount} sizes to choose`}
                style={({ pressed }) => [styles.addBtn, styles.addBtnTall, pressed && styles.addBtnPressed]}
              >
                <Txt variant="labelSm" tone="brand" style={styles.addLabel}>
                  ADD
                </Txt>
                <Txt variant="caption" tone="brand" style={styles.optionsLabel} numberOfLines={1}>
                  {variantCount} options
                </Txt>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  tapAdd();
                  add(product._id, 1, product.name, product);
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Add ${product.name} to cart`}
                style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Txt variant="labelSm" tone="brand" style={styles.addLabel}>
                    ADD
                  </Txt>
                )}
              </Pressable>
            )}
        </View>
      </View>
      <NotifyMeSheet visible={notifyOpen} onClose={() => setNotifyOpen(false)} productId={product._id} productName={product.name} />
      {hasVariants ? <VariantPickerSheet visible={sizeOpen} onClose={() => setSizeOpen(false)} product={product} /> : null}
    </Pressable>
  );
}

const styles = themed(({ c }) => ({
  card: { backgroundColor: 'transparent' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: ms(5), flexWrap: 'wrap' },
  pressed: { opacity: 0.7 },

  imageWrap: {
    width: '100%',
    backgroundColor: c.surface,
    // A crisp frame round every photo so each product stands apart (Blinkit-style).
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.borderStrong,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%', backgroundColor: c.surface },

  flag: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: c.save,
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
    borderBottomRightRadius: radius.sm,
  },
  flagText: { color: '#FFFFFF', fontWeight: '700', fontSize: ms(9.5), letterSpacing: 0.3 },

  heart: {
    position: 'absolute',
    top: ms(4),
    right: ms(4),
    width: ms(24),
    height: ms(24),
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  foodMark: {
    position: 'absolute',
    top: ms(32),
    right: ms(5),
    width: ms(13),
    height: ms(13),
    borderRadius: ms(3),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  foodDot: { width: ms(6), height: ms(6), borderRadius: ms(3) },

  actionRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: ms(5),
    gap: ms(4),
  },
  unitChip: {
    flexShrink: 1,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.xs,
    paddingHorizontal: ms(5),
    paddingVertical: ms(2),
  },
  addBtn: {
    minWidth: ms(50),
    height: ms(30),
    paddingHorizontal: ms(8),
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: c.brand,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnPressed: { backgroundColor: c.brandSurface },
  addBtnTall: { height: ms(40), flexDirection: 'column', paddingVertical: ms(2) },
  optionsLabel: { fontWeight: '700', fontSize: ms(8.5), lineHeight: ms(10), marginTop: ms(-1) },
  notifyBtn: { borderColor: c.danger },
  notifyLabel: { color: c.danger, fontWeight: '800' },
  addLabel: { fontWeight: '800', letterSpacing: 0.7 },

  body: { paddingTop: space.sm, gap: ms(4), alignItems: 'stretch' },
  unit: { fontWeight: '800', color: c.inkBody },
  buyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: ms(4), gap: ms(6) },
  priceCol: { flexShrink: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: ms(5), flexWrap: 'wrap' },
  mrp: { textDecorationLine: 'line-through' },
  name: { minHeight: ms(38) },
  chip: {
    backgroundColor: c.surfaceSunken,
    borderRadius: radius.xs,
    paddingHorizontal: ms(5),
    paddingVertical: ms(1),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  eta: { flexDirection: 'row', alignItems: 'center', gap: ms(3) },
}));

/**
 * Cards on a long list only re-render when their product, width, delivery text or
 * style change. `onPress` is deliberately ignored: callers build it inline on every
 * render, and it only ever opens this same product.
 */
export const ProductCard = React.memo(
  ProductCardBase,
  (a, b) => a.product === b.product && a.width === b.width && a.deliveryText === b.deliveryText && a.style === b.style,
);
