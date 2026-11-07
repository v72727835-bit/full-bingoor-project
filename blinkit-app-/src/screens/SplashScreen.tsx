import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { ms, space, themed } from '../theme';
import { LogoMark } from '../ui/Logo';
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
          alignItems: 'center',
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        <LogoMark size={132} onDark />
        <Txt variant="display" style={styles.word}>
          Bingoor
        </Txt>
        <Txt variant="caption" style={styles.tag}>
          Shops near you
        </Txt>
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
  footerText: { color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  word: { color: '#FFFFFF', fontWeight: '800', letterSpacing: -0.6, textAlign: 'center', marginTop: ms(14) },
  tag: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: ms(2) },}));
