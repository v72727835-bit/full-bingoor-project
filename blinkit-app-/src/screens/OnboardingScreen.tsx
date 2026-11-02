import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { Button, IconName } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { Txt } from '../ui/Text';
import type { AuthNav } from '../navigation/types';

const PITCH: { icon: IconName; title: string; body: string }[] = [
  { icon: 'storefront-outline', title: 'Local shops', body: 'Kirana, dairy and bakery you trust' },
  { icon: 'flash-outline', title: 'Fast delivery', body: 'Tracked live to your door' },
  { icon: 'wallet-outline', title: 'Pay your way', body: 'Cash or online, clear bill' },
];

export function OnboardingScreen() {
  const navigation = useNavigation<AuthNav>();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView edges={['top']} style={styles.hero}>
        <View style={styles.heroInner}>
          <Logo size={46} onDark />
          <Txt variant="display" tone="onBrand" center style={styles.heroTitle}>
            Your neighbourhood,{'\n'}delivered
          </Txt>
          <Txt variant="bodyLg" center style={styles.heroBody}>
            Everything from your local shops, in one order.
          </Txt>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.points}>
            {PITCH.map((item) => (
              <View key={item.title} style={styles.point}>
                <View style={styles.pointIcon}>
                  <Ionicons name={item.icon as never} size={ms(20)} color={colors.brand} />
                </View>
                <Txt variant="labelSm" center style={styles.pointTitle}>
                  {item.title}
                </Txt>
                <Txt variant="caption" tone="muted" center style={styles.pointBody}>
                  {item.body}
                </Txt>
              </View>
            ))}
          </View>

          <Button label="Create an account" onPress={() => navigation.navigate('Signup')} size="lg" block />
          <Button
            label="I already have an account"
            variant="secondary"
            size="lg"
            block
            onPress={() => navigation.navigate('Login')}
            style={styles.ctaSecondary}
          />
          <Txt variant="caption" tone="faint" center style={styles.legal}>
            By continuing you agree to our Terms and Privacy Policy.
          </Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.headerFrom },
  hero: { flex: 1, justifyContent: 'center' },
  heroInner: { alignItems: 'center', paddingHorizontal: gutter + space.sm, paddingVertical: space.xxxl },
  heroTitle: { marginTop: space.xxl },
  heroBody: { color: 'rgba(255,255,255,0.78)', marginTop: space.md, maxWidth: ms(300) },

  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  sheetContent: { paddingHorizontal: gutter + space.xs, paddingTop: space.xxl, paddingBottom: space.lg },

  points: { flexDirection: 'row', gap: space.sm, marginBottom: space.xxl },
  point: { flex: 1, alignItems: 'center' },
  pointIcon: {
    width: ms(46),
    height: ms(46),
    borderRadius: radius.pill,
    backgroundColor: c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointTitle: { marginTop: space.sm },
  pointBody: { marginTop: ms(2) },

  ctaSecondary: { marginTop: space.md },
  legal: { marginTop: space.lg },
}));
