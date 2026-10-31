import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, PressableProps, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';

/**
 * A small, dependency-free animation kit so every screen feels alive and
 * hand-made: content fades up as it mounts, numbers count up, and buttons
 * press in. All on the native driver where it can, so it stays smooth.
 */

/** Fades a block in while sliding it up a little. `delay` staggers a list. */
export function FadeSlide({ children, delay = 0, from = 16, style }: { children: React.ReactNode; delay?: number; from?: number; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Counts a number up to `value` over a short time — makes figures feel earned. */
export function AnimatedNumber({ value, format, style, duration = 650 }: { value: number; format?: (n: number) => string; style?: StyleProp<TextStyle>; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const begin = from.current;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(begin + (value - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <Text style={style}>{format ? format(display) : String(display)}</Text>;
}

/** A pressable that gently scales in when touched, for a tactile feel. */
export function PressableScale({ children, style, onPress, ...rest }: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} {...rest}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** A soft looping pulse (used behind the splash/login logo). */
export function Pulse({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <Animated.View style={[style, { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Fades between values when a dependency changes (e.g. switching tabs). */
export function CrossFade({ dep, children, style }: { dep: unknown; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [dep, a]);
  return <Animated.View style={[style, { flex: 1, opacity: a }]}>{children}</Animated.View>;
}

/** No-op view kept for symmetry in imports. */
export const Row = View;
