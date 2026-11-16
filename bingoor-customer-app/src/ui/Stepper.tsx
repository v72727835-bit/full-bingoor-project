import Icon from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { ActivityIndicator, Pressable, View, ViewStyle } from 'react-native';
import { ms, radius, space, useStyles, useTheme } from '../theme';
import { Txt } from './Text';
import { tapAdd } from '../utils/haptics';

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  busy?: boolean;
  size?: 'sm' | 'md';
  /** Solid brand fill, the way a quick-commerce card shows quantity. */
  solid?: boolean;
  /** Called instead of onChange(0) when the user taps minus at the minimum. */
  onRemove?: () => void;
  style?: ViewStyle;
}

/** Quantity control used on product cards, in the cart and on the detail page. */
export function Stepper({ value, onChange, min = 1, max = 20, busy, size = 'md', solid, onRemove, style }: Props) {
  const { c } = useTheme();
  const small = size === 'sm';
  const box = small ? ms(28) : ms(34);
  const atMin = value <= min;
  const atMax = value >= max;

  // A short buzz on both + and - (same as ADD), so every quantity change is felt.
  const dec = () => {
    tapAdd();
    if (atMin && onRemove) onRemove();
    else onChange(Math.max(min, value - 1));
  };
  const inc = () => {
    tapAdd();
    onChange(Math.min(max, value + 1));
  };
  const minusIcon = atMin && onRemove ? 'trash-outline' : 'remove';

  const s = useStyles(({ c: p }) => ({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: p.brandSurface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: p.brandBorder,
      padding: 2,
    },
    solid: { backgroundColor: p.brand, borderColor: p.brand },
    btn: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.xs },
    disabled: { opacity: 0.4 },
    valueBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  }));

  const fg = solid ? c.onBrand : c.brandText;

  return (
    <View style={[s.root, solid && s.solid, { height: box + 4 }, style]}>
      <Pressable
        onPress={dec}
        disabled={busy || (atMin && !onRemove)}
        accessibilityRole="button"
        accessibilityLabel={atMin && onRemove ? 'Remove item' : 'Decrease quantity'}
        style={({ pressed }) => [s.btn, { width: box, height: box }, pressed && { opacity: 0.6 }, atMin && !onRemove && s.disabled]}
      >
        <Icon name={minusIcon} size={small ? ms(14) : ms(17)} color={fg} />
      </Pressable>

      <View style={[s.valueBox, { minWidth: small ? ms(20) : box }]}>
        {busy ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Txt variant="h4" center style={{ color: fg }} accessibilityLabel={`Quantity ${value}`}>
            {value}
          </Txt>
        )}
      </View>

      <Pressable
        onPress={inc}
        disabled={busy || atMax}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        style={({ pressed }) => [s.btn, { width: box, height: box }, pressed && { opacity: 0.6 }, atMax && s.disabled]}
      >
        <Icon name="add" size={small ? ms(14) : ms(17)} color={fg} />
      </Pressable>
    </View>
  );
}
