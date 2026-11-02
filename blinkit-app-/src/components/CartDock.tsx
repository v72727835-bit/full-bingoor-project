import Icon from '@react-native-vector-icons/ionicons/static';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useCart } from '../context/CartContext';
import { currency, gutter, ms, radius, space, themed } from '../theme';
import { SmartImage } from '../ui/SmartImage';
import { Txt } from '../ui/Text';

/**
 * The "View cart" pill that floats above the tab bar once something is in the
 * basket.
 *
 * It sits where the thumb already is, shows the last few things you added so
 * you can see the tap landed, and slides away on the Cart tab itself where it
 * would only be pointing at the page you are already on.
 */
export function CartDock({ hidden, bottom, onPress }: { hidden: boolean; bottom: number; onPress: () => void }) {
  const { cart } = useCart();
  const show = !hidden && cart.itemCount > 0;
  const anim = useRef(new Animated.Value(show ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: show ? 1 : 0,
      duration: show ? 260 : 180,
      easing: show ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [show, anim]);

  const recent = cart.groups.flatMap((g) => g.items).slice(-3).reverse();

  return (
    <Animated.View
      pointerEvents={show ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        {
          bottom: bottom + space.md,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${cart.itemCount} items, ${currency(cart.total)}`}
        style={({ pressed }) => [styles.bar, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        <View style={styles.thumbs}>
          {recent.map((item, i) => (
            <View key={item.productId} style={[styles.thumb, { marginLeft: i === 0 ? 0 : -ms(10), zIndex: 3 - i }]}>
              <SmartImage uri={item.image} icon={item.icon} style={styles.thumbImage} radius={radius.sm} artScale={0.68} />
            </View>
          ))}
        </View>
        <View style={styles.text}>
          <Txt variant="caption" numberOfLines={1} style={styles.sub}>
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
          </Txt>
          <Txt variant="h4" tone="onBrand" numberOfLines={1}>
            {currency(cart.total)}
          </Txt>
        </View>
        <View style={styles.arrow}>
          <Txt variant="labelSm" tone="onBrand">
            View cart
          </Txt>
          <Icon name="chevron-forward" size={ms(15)} color="#FFFFFF" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = themed(({ c }) => ({
  wrap: { position: 'absolute', left: gutter, right: gutter },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: ms(8),
    paddingLeft: ms(8),
    paddingRight: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.brand,
    boxShadow: '0px 6px 16px 0px rgba(10, 46, 25, 0.22)',
  },
  thumbs: { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: ms(36),
    height: ms(36),
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: c.brand,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
  text: { flex: 1 },
  sub: { color: 'rgba(255,255,255,0.9)' },
  arrow: {
    flexDirection: 'row',
    gap: ms(2),
    paddingLeft: ms(10),
    paddingRight: ms(6),
    height: ms(32),
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
