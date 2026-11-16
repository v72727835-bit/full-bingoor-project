import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { radius, useStyles } from '../theme';
import { illustrationSource } from './Illustration';

/**
 * Product and shop imagery.
 *
 * Most of the catalogue ships with artwork rather than photography, so the
 * illustration is the real first choice and the network image is the upgrade -
 * not the other way round. Either way something meaningful is on screen from
 * the first frame, and a dead URL never leaves a grey hole.
 */
/**
 * Uploaded photos have a 480 px copy made at upload time. Cards and lists ask
 * for it (`?w=480`), so a list of products downloads ~25 KB a photo instead of
 * the full image; photos without a copy get the original back.
 */
export const smallPhoto = (uri: string): string =>
  /\/uploads\/products\/[^/?#]+\.(jpe?g|png|webp)$/i.test(uri) ? `${uri}?w=480` : uri;

export function SmartImage({
  uri,
  icon,
  size,
  style,
  radius: r = radius.md,
  contain,
  artScale = 0.6,
  full,
}: {
  uri?: string | null;
  icon?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
  radius?: number;
  contain?: boolean;
  /** How much of the box the artwork fills, as a fraction. */
  artScale?: number;
  /** Load the full-size photo (product gallery, shop banners) instead of the card-sized copy. */
  full?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const s = useStyles(({ c }) => ({
    box: { backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  }));

  const dims = size ? { width: size, height: size } : undefined;
  const showPhoto = !!uri && !failed;

  return (
    <View style={[s.box, { borderRadius: r }, dims, style as never]}>
      {showPhoto ? (
        <Image
          source={{ uri: full ? (uri as string) : smallPhoto(uri as string) }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={contain ? 'contain' : 'cover'}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Image
          source={illustrationSource(icon)}
          style={{ width: `${Math.round(artScale * 100)}%`, height: `${Math.round(artScale * 100)}%` }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}
