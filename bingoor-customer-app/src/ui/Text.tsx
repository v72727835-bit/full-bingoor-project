import React from 'react';
import { StyleProp, StyleSheet, Text as RNText, TextProps, TextStyle } from 'react-native';
import { MAX_FONT_SCALE, TypeVariant, font, type as typeScale, useTheme } from '../theme';

type Tone = 'ink' | 'body' | 'muted' | 'faint' | 'brand' | 'onBrand' | 'onHeader' | 'success' | 'danger' | 'warning' | 'save' | 'gold';

export interface TxtProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  center?: boolean;
  weight?: TextStyle['fontWeight'];
  style?: StyleProp<TextStyle>;
}

/**
 * Every piece of text in the app goes through here.
 *
 * That is what guarantees the two things this product promised: nothing is ever
 * clipped (`maxFontSizeMultiplier` caps runaway OS font scaling) and nothing is
 * ever invisible, because the tone names resolve against the active palette
 * rather than a hard-coded hex that only works on a white page.
 */
export function Txt({ variant = 'body', tone = 'ink', center, weight, style, ...rest }: TxtProps) {
  const { c } = useTheme();
  const toneColor: Record<Tone, string> = {
    ink: c.ink,
    body: c.inkBody,
    muted: c.inkMuted,
    faint: c.inkFaint,
    brand: c.brandText,
    onBrand: c.onBrand,
    onHeader: c.onHeader,
    success: c.success,
    danger: c.danger,
    warning: c.warning,
    save: c.save,
    gold: c.gold,
  };
  // Resolve the final weight after every override, then swap it for the
  // matching font file - see `font()` for why weight alone is not enough.
  const flat = StyleSheet.flatten([
    typeScale[variant],
    { color: toneColor[tone] },
    center && { textAlign: 'center' as const },
    weight ? { fontWeight: weight } : null,
    style,
  ]) as TextStyle;

  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...rest} style={[flat, font(flat.fontWeight)]} />;
}
