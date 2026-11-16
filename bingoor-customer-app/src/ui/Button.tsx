import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons/static';
import { HIT_SIZE, ms, radius, space, useStyles, useTheme } from '../theme';
import { Txt } from './Text';

export type IconName = string;
export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'onBrand' | 'ghostOnBrand';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PAD: Record<ButtonSize, { v: number; h: number; gap: number; icon: number; min: number }> = {
  sm: { v: ms(7), h: ms(12), gap: ms(5), icon: ms(15), min: ms(36) },
  md: { v: ms(11), h: ms(16), gap: ms(7), icon: ms(17), min: HIT_SIZE },
  lg: { v: ms(14), h: ms(20), gap: ms(8), icon: ms(19), min: ms(52) },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabled,
  // A large button is a page's main action, so it spans the column unless a
  // layout (a bar with a price beside it) asks otherwise.
  block = size === 'lg',
  style,
}: ButtonProps) {
  const { c } = useTheme();
  const off = disabled || loading;

  const look: Record<ButtonVariant, { bg: string; fg: string; bd: string; press: string }> = {
    primary: { bg: c.brand, fg: c.onBrand, bd: c.brand, press: c.brandPressed },
    secondary: { bg: c.surface, fg: c.brandText, bd: c.brandBorder, press: c.brandSurface },
    tonal: { bg: c.brandSurface, fg: c.brandText, bd: c.brandSurface, press: c.brandSurfaceStrong },
    ghost: { bg: 'transparent', fg: c.brandText, bd: 'transparent', press: c.brandSurface },
    danger: { bg: c.danger, fg: '#FFFFFF', bd: c.danger, press: c.danger },
    onBrand: { bg: c.onBrand, fg: c.brand, bd: c.onBrand, press: 'rgba(255,255,255,0.86)' },
    ghostOnBrand: { bg: 'rgba(255,255,255,0.16)', fg: c.onHeader, bd: 'rgba(255,255,255,0.34)', press: 'rgba(255,255,255,0.28)' },
  };
  const t = look[variant];
  const p = PAD[size];

  const s = useStyles(() => ({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    block: { alignSelf: 'stretch', width: '100%' },
    label: { flexShrink: 1 },
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        s.base,
        { backgroundColor: pressed ? t.press : t.bg, borderColor: t.bd, paddingVertical: p.v, paddingHorizontal: p.h, minHeight: p.min, gap: p.gap },
        block && s.block,
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={t.fg} /> : icon ? <Icon name={icon as never} size={p.icon} color={t.fg} /> : null}
      <Txt variant="button" style={[s.label, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Txt>
      {iconRight && !loading ? <Icon name={iconRight as never} size={p.icon} color={t.fg} /> : null}
    </Pressable>
  );
}

/** Square icon-only button used in headers and on cards. */
export function IconButton({
  name,
  onPress,
  size = 20,
  tone = 'ink',
  bubble,
  accessibilityLabel,
  style,
}: {
  name: IconName;
  onPress?: () => void;
  size?: number;
  tone?: 'ink' | 'muted' | 'brand' | 'onHeader' | 'danger';
  bubble?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const fg = { ink: c.ink, muted: c.inkMuted, brand: c.brandText, onHeader: c.onHeader, danger: c.danger }[tone];
  const s = useStyles(({ c: p }) => ({
    btn: { minWidth: HIT_SIZE, minHeight: HIT_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
    bubble: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, width: ms(34), height: ms(34), minWidth: 0, minHeight: 0 },
  }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [s.btn, bubble && s.bubble, pressed && { opacity: 0.6 }, style]}
    >
      <Icon name={name as never} size={ms(size)} color={fg} />
    </Pressable>
  );
}

/** Row of buttons pinned above the home indicator on action screens. */
export function ActionBar({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { elevation } = useTheme();
  const s = useStyles(({ c }) => ({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      paddingBottom: space.md,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
  }));
  return <View style={[s.bar, elevation.lg, style]}>{children}</View>;
}
