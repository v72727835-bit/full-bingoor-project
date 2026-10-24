import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme';
import { FadeSlide, Pulse } from './anim';

const LOGO = require('../assets/logo-mark.png');

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** Shared frame for Login and Signup: brand header on top, form card below. */
export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeSlide>
            <View style={styles.brandRow}>
              <Pulse style={styles.logo}>
                <Image source={LOGO} style={styles.logoImg} />
              </Pulse>
              <View>
                <Text style={styles.brand}>Bingoor</Text>
                <Text style={styles.brandSub}>Rider partner</Text>
              </View>
            </View>
          </FadeSlide>

          <FadeSlide delay={90}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </FadeSlide>

          <FadeSlide delay={160}>
            <View style={styles.card}>{children}</View>
          </FadeSlide>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  logoImg: { width: 34, height: 34, borderRadius: 9 },
  brandSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...shadow,
  },
  brand: { fontSize: 26, fontWeight: '800', color: colors.text },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 6, marginBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 20, ...shadow },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: { flex: 1, marginLeft: 8, color: colors.danger, fontSize: 13.5, fontWeight: '500' },
});
