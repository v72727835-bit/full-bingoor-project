import React from 'react';
import { Image, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { ms, radius, space, themed, useTheme } from '../theme';
import { Category } from '../types';
import { Illustration } from '../ui/Illustration';
import { Txt } from '../ui/Text';
import { smallPhoto } from '../ui/SmartImage';

/**
 * An uploaded photo covers the whole tile edge to edge; without one, the
 * bundled artwork sits centred on the tint. The parent must clip
 * (`overflow: 'hidden'`) and carry the corner radius.
 */
export function CategoryArt({ category, size }: { category: Pick<Category, 'icon' | 'image'>; size: number }) {
  const [failed, setFailed] = React.useState(false);
  if (category.image && !failed) {
    return (
      <Image
        source={{ uri: smallPhoto(category.image) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return <Illustration name={category.icon} size={size} />;
}

/**
 * A square of colour with the aisle's artwork in it, label underneath.
 *
 * The label sits below the tile rather than on top of it so two- and
 * three-word names never overlap the picture or get cut - the failure mode
 * of every grid that tries to put text inside the swatch.
 */
export function CategoryTile({
  category,
  width,
  onPress,
  style,
}: {
  category: Category;
  width: number;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const { tint } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      style={({ pressed }) => [{ width }, pressed && styles.pressed, style]}
    >
      <View
        style={[
          styles.tile,
          { height: Math.round(width * 0.96), backgroundColor: tint(category.tint) },
        ]}
      >
        <CategoryArt category={category} size={width * 0.5} />
      </View>
      <Txt variant="caption" tone="ink" weight="600" center numberOfLines={2} style={styles.label}>
        {category.name}
      </Txt>
    </Pressable>
  );
}

/** The round version used in the quick-access rail at the top of the feed. */
export function CategoryCircle({
  category,
  size,
  onPress,
}: {
  category: Category;
  size: number;
  onPress: () => void;
}) {
  const { tint } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      style={({ pressed }) => [{ width: size }, pressed && styles.pressed]}
    >
      <View style={[styles.circle, { width: size, height: size, backgroundColor: tint(category.tint) }]}>
        <CategoryArt category={category} size={size * 0.52} />
      </View>
      <Txt variant="caption" tone="body" center numberOfLines={2} style={styles.label}>
        {category.name}
      </Txt>
    </Pressable>
  );
}

const styles = themed(({ c }) => ({
  pressed: { opacity: 0.65 },
  tile: {
    width: '100%',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  circle: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  label: { marginTop: space.xs, minHeight: ms(30) },
}));
