import Icon from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import { ms, radius, space, useStyles, useTheme } from '../theme';
import { Txt } from './Text';

/** Shortens a review count the way Indian shopping apps do: 8200 -> "8.2k". */
export function shortCount(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1).replace(/\.0$/, '')} cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1).replace(/\.0$/, '')} lac`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** Compact green chip: "4.3 ★" plus an optional review count. */
export function RatingChip({ value, count, style }: { value: number; count?: number; style?: ViewStyle }) {
  const { c } = useTheme();
  const s = useStyles(({ c: p }) => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: p.success,
      paddingHorizontal: ms(5),
      paddingVertical: ms(2),
      borderRadius: radius.xs,
    },
    text: { fontWeight: '800', fontSize: ms(10.5), color: p.mode === 'dark' ? '#0C2418' : '#FFFFFF' },
    star: { marginLeft: ms(2) },
    count: { marginLeft: space.xs },
  }));
  if (!value) return null;
  return (
    <View style={s.row}>
      <View style={[s.chip, style]}>
        <Txt variant="caption" style={s.text}>
          {value.toFixed(1)}
        </Txt>
        <Icon name="star" size={ms(9)} color={c.mode === 'dark' ? '#0C2418' : '#FFFFFF'} style={s.star} />
      </View>
      {count ? (
        <Txt variant="caption" tone="faint" style={s.count}>
          ({shortCount(count)})
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * Inline stars with the review count beside them - the form used on product
 * cards, where a coloured chip would fight with the price for attention.
 */
export function StarLine({ value, count, size = 11 }: { value: number; count?: number; size?: number }) {
  const { c } = useTheme();
  const s = useStyles(() => ({ row: { flexDirection: 'row', alignItems: 'center', gap: ms(2) } }));
  if (!value) return null;
  return (
    <View style={s.row} accessibilityLabel={`Rated ${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={ms(size)}
          color={value >= i - 0.5 ? c.gold : c.borderStrong}
        />
      ))}
      {count ? (
        <Txt variant="caption" tone="muted" style={{ marginLeft: ms(3) }}>
          {shortCount(count)}
        </Txt>
      ) : null}
    </View>
  );
}

/** Row of five stars. Pass onChange to make it an input. */
export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (next: number) => void }) {
  const { c } = useTheme();
  const s = useStyles(() => ({
    stars: { flexDirection: 'row', alignItems: 'center' },
    star: { marginRight: ms(2) },
    tap: { padding: ms(3) },
  }));
  const px = ms(size);
  return (
    <View style={s.stars} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const star = <Icon name={name} size={px} color={value >= i - 0.5 ? c.gold : c.borderStrong} />;
        if (!onChange) {
          return (
            <View key={i} style={s.star}>
              {star}
            </View>
          );
        }
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${i} star${i > 1 ? 's' : ''}`}
            style={s.tap}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
