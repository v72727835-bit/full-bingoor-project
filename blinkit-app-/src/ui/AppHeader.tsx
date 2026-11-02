import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { gutter, hitSlop, ms, radius, space, useStyles, useTheme } from '../theme';
import type { IconName } from './Button';
import { Txt } from './Text';

export interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  label: string;
  /** Small count bubble, e.g. items in the cart. */
  badge?: number;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Defaults to true whenever the navigator can go back. */
  showBack?: boolean;
  actions?: HeaderAction[];
  /** Removes the hairline - use when the screen below has its own tab strip. */
  flat?: boolean;
  style?: ViewStyle;
}

export function AppHeader({ title, subtitle, showBack, actions = [], flat, style }: Props) {
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const back = showBack ?? canGoBack;
  const { c } = useTheme();
  const styles = useStyles(({ c: p }) => ({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ms(56),
      paddingHorizontal: gutter - space.sm,
      paddingVertical: space.sm,
      backgroundColor: p.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.border,
    },
    flat: { borderBottomWidth: 0 },
    iconBtn: { width: ms(40), height: ms(40), borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    actionBtn: { marginLeft: space.xs },
    pressed: { backgroundColor: p.surfaceSunken },
    side: { flexDirection: 'row', alignItems: 'center' },
    sideRight: { justifyContent: 'flex-end' },
    titles: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
    subtitle: { marginTop: ms(1) },
    badge: {
      position: 'absolute',
      top: ms(3),
      right: ms(2),
      minWidth: ms(18),
      height: ms(18),
      paddingHorizontal: ms(4),
      borderRadius: radius.pill,
      backgroundColor: p.brand,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: p.surface,
    },
    badgeText: { fontSize: ms(9.5), lineHeight: ms(12), fontWeight: '800' },
  }));

  // Equal-width slots either side keep the title optically centred, whether
  // the screen has a back button, two actions, or neither.
  const slot = Math.max(back ? 1 : 0, actions.length) * (ms(40) + space.xs);

  return (
    <View style={[styles.root, flat && styles.flat, style]}>
      <View style={[styles.side, { width: slot }]}>
        {back ? (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={ms(24)} color={c.ink} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titles}>
        <Txt variant="h3" center numberOfLines={1} accessibilityRole="header">
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" center numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Txt>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight, { width: slot }]}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={({ pressed }) => [styles.iconBtn, styles.actionBtn, pressed && styles.pressed]}
          >
            <Ionicons name={a.icon as never} size={ms(21)} color={c.ink} />
            {a.badge ? (
              <View style={styles.badge}>
                <Txt variant="caption" tone="onBrand" style={styles.badgeText}>
                  {a.badge > 99 ? '99+' : a.badge}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
