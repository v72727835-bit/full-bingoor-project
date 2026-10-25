import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, gradient, gutter, ms, radius, space, themed } from '../theme';
import { Button, IconName } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { Txt } from '../ui/Text';
import type { AuthNav } from '../navigation/types';

const PITCH: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'storefront-outline',
    title: 'Real shops around you',
    body: 'Order from the kirana, bakery and dairy you already trust, all in one basket.',
  },
  {
    icon: 'flash-outline',
    title: 'Delivered the same day',
    body: 'Live tracking from the moment the shop packs your order until it reaches your door.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Pay how you like',
    body: 'Cash on delivery or online, with a clear bill and no surprise charges at the end.',
  },
];

export function OnboardingScreen() {
  const navigation = useNavigation<AuthNav>();
  const { browseAsGuest } = useAuth();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView edges={['top']} style={styles.hero}>
        <View style={styles.heroInner}>
          <Logo size={46} onDark />
          <Txt variant="display" tone="onBrand" style={styles.heroTitle}>
            Your neighbourhood,{'\n'}delivered
          </Txt>
          <Txt variant="bodyLg" style={styles.heroBody}>
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
          {PITCH.map((item) => (
            <View key={item.title} style={styles.point}>
              <View style={styles.pointIcon}>
                <Ionicons name={item.icon as never} size={ms(21)} color={colors.brand} />
              </View>
              <View style={styles.pointText}>
                <Txt variant="h4">{item.title}</Txt>
                <Txt variant="bodySm" tone="muted" style={styles.pointBody}>
                  {item.body}
                </Txt>
              </View>
            </View>
          ))}

          <Button label="Create an account" onPress={() => navigation.navigate('Signup')} size="lg" style={styles.cta} />
          <Button
            label="I already have an account"
            variant="secondary"
            size="lg"
            onPress={() => navigation.navigate('Login')}
            style={styles.ctaSecondary}
          />
          <Button label="Skip, look around first" variant="ghostOnBrand" size="lg" onPress={browseAsGuest} style={styles.ctaSecondary} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.headerTo,
    backgroundImage: `${gradient.glow(c.headerGlow, '100% 0%')}, ${gradient.down(c.headerFrom, c.headerTo)}` },
  hero: { flexShrink: 1 },
  heroInner: { paddingHorizontal: gutter, paddingTop: space.xxl, paddingBottom: space.xxxl },
  heroTitle: { marginTop: space.xxl },
  heroBody: { color: 'rgba(255,255,255,0.78)', marginTop: space.md },

  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  sheetContent: { paddingHorizontal: gutter, paddingTop: space.xxl, paddingBottom: space.xl },

  point: { flexDirection: 'row', marginBottom: space.xl },
  pointIcon: {
    width: ms(42),
    height: ms(42),
    borderRadius: radius.md,
    backgroundColor: c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1, marginLeft: space.lg },
  pointBody: { marginTop: ms(3) },

  cta: { marginTop: space.sm },
  ctaSecondary: { marginTop: space.md },}));
