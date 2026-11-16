import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';
import { radius as R, space, useStyles } from '../theme';

/** Softly pulsing block - the base for every loading placeholder. */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const s = useStyles(({ c }) => ({ shimmer: { backgroundColor: c.skeleton } }));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return <Animated.View pointerEvents="none" style={[s.shimmer, style, { opacity }]} />;
}

export function SkeletonBlock({
  width,
  height,
  radius = R.sm,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <Shimmer style={[{ width: width ?? '100%', height, borderRadius: radius }, style]} />;
}

/** Matches the product card so the grid does not jump when data lands. */
export function ProductCardSkeleton({ width }: { width: number }) {
  const s = useStyles(() => ({
    card: { width, gap: space.sm },
    line: { marginTop: space.xs },
    lineWide: { marginTop: space.sm },
  }));
  return (
    <View style={s.card}>
      <SkeletonBlock height={width * 0.92} radius={R.md} />
      <SkeletonBlock height={13} style={s.line} />
      <SkeletonBlock height={13} width="70%" style={s.line} />
      <SkeletonBlock height={17} width="45%" style={s.lineWide} />
    </View>
  );
}

export function RowSkeleton({ lines = 2 }: { lines?: number }) {
  const s = useStyles(() => ({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
    rowBody: { flex: 1, marginLeft: space.md, gap: space.xs },
    line: { marginTop: space.xs },
  }));
  return (
    <View style={s.row}>
      <SkeletonBlock width={56} height={56} radius={R.md} />
      <View style={s.rowBody}>
        <SkeletonBlock height={14} />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <SkeletonBlock key={i} height={12} width="60%" style={s.line} />
        ))}
      </View>
    </View>
  );
}
