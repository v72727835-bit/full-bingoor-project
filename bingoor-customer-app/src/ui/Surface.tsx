import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons/static';
import { gutter, hitSlop, ms, radius, space, useStyles, useTheme } from '../theme';
import { Txt } from './Text';

/** A raised panel. `flat` keeps the fill but drops the lift. */
export function Card({
  children,
  style,
  flat,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  flat?: boolean;
  padded?: boolean;
}) {
  const { elevation } = useTheme();
  const s = useStyles(({ c }) => ({
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderStrong },
    padded: { padding: space.lg },
  }));
  return <View style={[s.card, !flat && elevation.sm, padded && s.padded, style]}>{children}</View>;
}

export type PillTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/** Small rounded label: discounts, attributes, statuses. */
export function Pill({
  label,
  tone = 'neutral',
  icon,
  solid,
  style,
}: {
  label: string;
  tone?: PillTone;
  icon?: string;
  /** Filled version, for a flag that has to win against a photograph. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const map: Record<PillTone, { bg: string; fg: string; bd: string }> = {
    neutral: { bg: c.surfaceSunken, fg: c.inkMuted, bd: c.border },
    brand: { bg: c.brandSurface, fg: c.brandText, bd: c.brandBorder },
    success: { bg: c.successSurface, fg: c.success, bd: c.successBorder },
    warning: { bg: c.warningSurface, fg: c.warning, bd: c.warningSurface },
    danger: { bg: c.dangerSurface, fg: c.danger, bd: c.dangerSurface },
    info: { bg: c.infoSurface, fg: c.info, bd: c.infoSurface },
    accent: { bg: c.accentSurface, fg: c.accent, bd: c.accentSurface },
  };
  const flat = map[tone];
  const filled: Record<PillTone, { bg: string; fg: string; bd: string }> = {
    neutral: { bg: c.ink, fg: c.surface, bd: c.ink },
    brand: { bg: c.brand, fg: c.onBrand, bd: c.brand },
    success: { bg: c.success, fg: c.mode === 'dark' ? '#0C2418' : '#FFFFFF', bd: c.success },
    warning: { bg: c.gold, fg: '#3A2A00', bd: c.gold },
    danger: { bg: c.danger, fg: c.mode === 'dark' ? '#3A1010' : '#FFFFFF', bd: c.danger },
    info: { bg: c.info, fg: c.mode === 'dark' ? '#0B1C2E' : '#FFFFFF', bd: c.info },
    accent: { bg: c.accent, fg: c.mode === 'dark' ? '#2A1206' : '#FFFFFF', bd: c.accent },
  };
  const t = solid ? filled[tone] : flat;
  const s = useStyles(() => ({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: ms(8),
      paddingVertical: ms(3),
      borderRadius: radius.xs,
      borderWidth: 1,
      gap: ms(3),
    },
  }));
  return (
    <View style={[s.pill, { backgroundColor: t.bg, borderColor: t.bd }, style]}>
      {icon ? <Icon name={icon as never} size={ms(11)} color={t.fg} /> : null}
      <Txt variant="caption" style={{ color: t.fg }} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  const s = useStyles(({ c }) => ({ line: { height: 1, backgroundColor: c.border } }));
  return <View style={[s.line, inset ? { marginLeft: inset } : null, style]} />;
}

/** The grey breathing space between merchandised strips. */
export function SectionGap({ height = space.sm }: { height?: number }) {
  const s = useStyles(({ c }) => ({ gap: { backgroundColor: c.surfaceSunken } }));
  return <View style={[s.gap, { height }]} />;
}

/**
 * Section heading, set centred between two short rules - the way a printed
 * menu or a shop window names its shelves. The action sits under the title as
 * a quiet link so the title stays optically centred whatever its length.
 */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  onDark,
  right,
  style,
  padded = true,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Light ink for headings that sit on the brand band. */
  onDark?: boolean;
  /** Extra element under the subtitle, e.g. a countdown. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const s = useStyles(({ c: p }) => ({
    wrap: { alignItems: 'center' },
    padded: { paddingHorizontal: gutter },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', justifyContent: 'center' },
    rule: { flex: 1, maxWidth: ms(36), height: StyleSheet.hairlineWidth * 2, backgroundColor: p.borderStrong },
    ruleOnDark: { backgroundColor: 'rgba(255,255,255,0.35)' },
    title: { flexShrink: 1 },
    sub: { marginTop: ms(3), maxWidth: ms(300) },
    extra: { marginTop: space.sm },
    action: { flexDirection: 'row', alignItems: 'center', gap: ms(2), marginTop: space.sm, paddingVertical: ms(2) },
  }));
  const { c } = useTheme();
  const linkColor = onDark ? c.onHeader : c.brandText;
  return (
    <View style={[s.wrap, padded && s.padded, style]}>
      <View style={s.titleRow}>
        <View style={[s.rule, onDark && s.ruleOnDark]} />
        <Txt variant="h2" center tone={onDark ? 'onHeader' : 'ink'} numberOfLines={2} style={s.title} accessibilityRole="header">
          {title}
        </Txt>
        <View style={[s.rule, onDark && s.ruleOnDark]} />
      </View>
      {subtitle ? (
        <Txt variant="bodySm" center numberOfLines={2} style={[s.sub, { color: onDark ? c.onHeaderMuted : c.inkMuted }]}>
          {subtitle}
        </Txt>
      ) : null}
      {right ? <View style={s.extra}>{right}</View> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={hitSlop} style={({ pressed }) => [s.action, pressed && { opacity: 0.6 }]} accessibilityRole="button">
          <Txt variant="labelSm" style={{ color: linkColor }}>
            {actionLabel}
          </Txt>
          <Icon name="chevron-forward" size={ms(13)} color={linkColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Tappable settings-style row: icon, label, optional value, chevron. */
export function ListRow({
  icon,
  label,
  value,
  onPress,
  danger,
  right,
  style,
}: {
  icon?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const s = useStyles(({ c: p }) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: ms(13), paddingHorizontal: space.lg, minHeight: ms(52) },
    pressed: { backgroundColor: p.surfaceSunken },
    bubble: { width: ms(34), height: ms(34), borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1 },
  }));
  const fg = danger ? c.danger : c.ink;
  const bubbleBg = danger ? c.dangerSurface : c.brandSurface;
  const bubbleFg = danger ? c.danger : c.brandText;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.row, pressed && onPress ? s.pressed : null, style]}
    >
      {icon ? (
        <View style={[s.bubble, { backgroundColor: bubbleBg }]}>
          <Icon name={icon as never} size={ms(17)} color={bubbleFg} />
        </View>
      ) : null}
      <View style={s.body}>
        <Txt variant="h4" style={{ color: fg }} numberOfLines={2}>
          {label}
        </Txt>
        {value ? (
          <Txt variant="bodySm" tone="muted" numberOfLines={2}>
            {value}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={ms(17)} color={c.inkFaint} /> : null)}
    </Pressable>
  );
}
