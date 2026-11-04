import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { ms, space, themed } from '../theme';
import { Logo } from '../ui/Logo';
import { Txt } from '../ui/Text';

/** Shown for the moment it takes to restore a saved session. */
export function SplashScreen() {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  return (
    <View style={styles.root}>
      <Animated.View
        style={{
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        <Logo size={64} onDark showTagline />
      </Animated.View>

      <View style={styles.footer}>
        <Txt variant="caption" style={styles.footerText}>
          Groceries and daily needs, delivered
        </Txt>
      </View>
    </View>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: ms(48), paddingHorizontal: space.xl },
  footerText: { color: 'rgba(255,255,255,0.65)', textAlign: 'center' },}));
