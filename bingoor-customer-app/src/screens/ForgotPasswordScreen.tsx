import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPublicSettings } from '../api/support';
import type { AuthNav } from '../navigation/types';
import { gutter, space, themed } from '../theme';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { Txt } from '../ui/Text';

/**
 * Bingoor has no OTP service, so a password cannot be reset from the phone on
 * its own: the customer calls support, who check the account and set a new one.
 */
export function ForgotPasswordScreen() {
  const navigation = useNavigation<AuthNav>();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicSettings()
      .then((s) => setPhone(((s as { supportPhone?: string }).supportPhone ?? '').trim() || null))
      .catch(() => setPhone(null));
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Logo size={44} style={styles.logo} />
        <Txt variant="h1" center style={styles.title}>
          Forgot password?
        </Txt>
        <Txt variant="bodyLg" tone="muted" center style={styles.subtitle}>
          Call Bingoor support from your registered mobile number. They will check your account and set a new password for you.
        </Txt>
        {phone ? (
          <Button label={`Call support · ${phone}`} onPress={() => void Linking.openURL(`tel:${phone}`)} size="lg" style={styles.submit} />
        ) : (
          <Txt variant="body" tone="muted" center>
            Please contact Bingoor support to reset your password.
          </Txt>
        )}
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" style={styles.back}>
          <Txt variant="label" tone="brand">
            Back to sign in
          </Txt>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { flexGrow: 1, paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: space.xxl },
  logo: { alignSelf: 'center', marginTop: space.lg, marginBottom: space.xxl },
  title: { marginBottom: space.xs },
  subtitle: { marginBottom: space.xxl },
  submit: { marginTop: space.sm },
  back: { alignSelf: 'center', marginTop: space.lg },
}));
