import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';
import { ms, useStyles, useTheme } from '../theme';
import { Txt } from './Text';

const MARK = require('../assets/logo-mark.png');
const MARK_WHITE = require('../assets/logo-white.png');

/** Just the tile - app bars, splash, order confirmations. */
export function LogoMark({ size = 40, onDark = false, style }: { size?: number; onDark?: boolean; style?: StyleProp<ImageStyle> }) {
  const px = ms(size);
  return <Image source={onDark ? MARK_WHITE : MARK} style={[{ width: px, height: px }, style]} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

/**
 * Mark plus wordmark. The wordmark is live text rather than a baked image so it
 * stays crisp at every density and respects the user's font settings.
 */
export function Logo({
  size = 38,
  onDark = false,
  showTagline = false,
  style,
}: {
  size?: number;
  onDark?: boolean;
  showTagline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const s = useStyles(() => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    words: { marginLeft: ms(9), justifyContent: 'center' },
    wordmark: { fontWeight: '800', letterSpacing: -0.7 },
    tagline: { marginTop: ms(1) },
  }));
  const px = ms(size);
  return (
    <View style={[s.row, style]} accessibilityRole="image" accessibilityLabel="Bingoor">
      <Image
        source={onDark ? MARK_WHITE : MARK}
        style={{ width: px, height: px }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={s.words}>
        <Txt style={[s.wordmark, { fontSize: px * 0.62, lineHeight: px * 0.74, color: onDark ? c.onHeader : c.ink }]}>
          Bingoor
        </Txt>
        {showTagline ? (
          <Txt variant="overline" style={[s.tagline, { color: onDark ? c.onHeaderMuted : c.inkMuted }]}>
            Shops near you
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
