import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { gutter, useStyles } from '../theme';

/**
 * Page shell: safe-area padding, the page background, and the one horizontal
 * gutter every screen shares so edges line up from Home to Checkout.
 */
export function Screen({
  children,
  edges = ['top'],
  padded = false,
  style,
  background,
}: {
  children: React.ReactNode;
  edges?: readonly Edge[];
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  background?: string;
}) {
  const s = useStyles(({ c }) => ({
    root: { flex: 1, backgroundColor: c.surfaceSunken },
    padded: { paddingHorizontal: gutter },
  }));
  return (
    <SafeAreaView edges={edges} style={[s.root, background ? { backgroundColor: background } : null, padded && s.padded, style]}>
      {children}
    </SafeAreaView>
  );
}

/** Lets a child run edge to edge inside a gutter-padded parent. */
export function Bleed({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ marginHorizontal: -gutter }, style]}>{children}</View>;
}
