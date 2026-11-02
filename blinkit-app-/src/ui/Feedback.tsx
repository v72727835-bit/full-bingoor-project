import Icon from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { ActivityIndicator, View, ViewStyle } from 'react-native';
import { gutter, ms, radius, space, useStyles, useTheme } from '../theme';
import { Button, IconName } from './Button';
import { Txt } from './Text';

/* ------------------------------------------------------------ EmptyState -- */

interface EmptyProps {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'danger';
  style?: ViewStyle;
}

/**
 * Used for both "nothing here yet" and "that failed". One component keeps the
 * two states visually consistent, which is how the app avoids looking like it
 * was assembled by different people.
 */
export function EmptyState({ icon, title, message, actionLabel, onAction, tone = 'neutral', style }: EmptyProps) {
  const { c } = useTheme();
  const danger = tone === 'danger';
  const s = useStyles(({ c: p }) => ({
    empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: gutter + space.md, paddingVertical: space.huge },
    icon: {
      width: ms(76),
      height: ms(76),
      borderRadius: radius.pill,
      backgroundColor: p.brandSurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space.xl,
    },
    iconDanger: { backgroundColor: p.dangerSurface },
    title: { marginBottom: space.sm },
    msg: { maxWidth: ms(320) },
    btn: { marginTop: space.xl, paddingHorizontal: space.xxl, alignSelf: 'center' },
  }));

  return (
    <View style={[s.empty, style]}>
      <View style={[s.icon, danger && s.iconDanger]}>
        <Icon name={icon as never} size={ms(34)} color={danger ? c.danger : c.brand} />
      </View>
      <Txt variant="h2" center style={s.title}>
        {title}
      </Txt>
      <Txt variant="body" tone="muted" center style={s.msg}>
        {message}
      </Txt>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant={danger ? 'secondary' : 'primary'} style={s.btn} />
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------- Loading views -- */

export function FullScreenLoader({ label }: { label?: string }) {
  const { c } = useTheme();
  const s = useStyles(() => ({
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
    label: { marginTop: space.md },
  }));
  return (
    <View style={s.loader}>
      <ActivityIndicator size="large" color={c.brand} />
      {label ? (
        <Txt variant="bodySm" tone="muted" center style={s.label}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------- Banner -- */

export function Banner({
  tone = 'info',
  icon,
  message,
  style,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  icon?: IconName;
  message: string;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const skin = {
    info: { bg: c.infoSurface, fg: c.info, icon: 'information-circle-outline' as IconName },
    warning: { bg: c.warningSurface, fg: c.warning, icon: 'alert-circle-outline' as IconName },
    danger: { bg: c.dangerSurface, fg: c.danger, icon: 'alert-circle-outline' as IconName },
    success: { bg: c.successSurface, fg: c.success, icon: 'checkmark-circle-outline' as IconName },
  }[tone];

  const s = useStyles(() => ({
    banner: { flexDirection: 'row', alignItems: 'flex-start', padding: space.md, borderRadius: radius.sm },
    icon: { marginRight: space.sm, marginTop: ms(1) },
    text: { flex: 1 },
  }));

  return (
    <View style={[s.banner, { backgroundColor: skin.bg }, style]}>
      <Icon name={(icon ?? skin.icon) as never} size={ms(18)} color={skin.fg} style={s.icon} />
      <Txt variant="bodySm" style={[s.text, { color: skin.fg }]}>
        {message}
      </Txt>
    </View>
  );
}
