import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getErrorMessage, getFieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AuthNav } from '../navigation/types';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Feedback';
import { SocialButtons } from '../components/SocialButtons';
import { Txt } from '../ui/Text';
import { TextField, TextInputRef } from '../ui/TextField';
import { generatePassword } from '../utils/password';
import { isValidPhone, normalizePhone, passwordStrength } from '../utils/validation';

/** none, weak, fair, strong - resolved live so dark mode gets its own set. */
const meterColor = (i: number) => [colors.borderStrong, colors.danger, colors.warning, colors.success][i];

export function SignupScreen() {
  const navigation = useNavigation<AuthNav>();
  const { signUp } = useAuth();

  const phoneRef = useRef<TextInputRef>(null);
  const passwordRef = useRef<TextInputRef>(null);

  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [generated, setGenerated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name';
    if (!isValidPhone(form.phone)) next.phone = 'Enter a valid 10-digit mobile number';
    if (form.password.length < 6) next.password = 'Use at least 6 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      await signUp({
        name: form.name.trim(),
        phone: normalizePhone(form.phone),
        password: form.password,
      });
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader title="Create account" showBack />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Txt variant="h1" center style={styles.title}>
            Let&apos;s get you set up
          </Txt>
          <Txt variant="bodyLg" tone="muted" center style={styles.subtitle}>
            It takes about a minute. Your number is how shops reach you about an order.
          </Txt>

          {formError ? <Banner tone="danger" message={formError} style={styles.banner} /> : null}

          <SocialButtons onError={setFormError} />
          <Txt variant="caption" tone="muted" center style={{ marginBottom: 12 }}>or sign up with your phone number</Txt>

          <TextField
            label="Full name"
            placeholder="Vikas Kumar"
            icon="person-outline"
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
            value={form.name}
            onChangeText={set('name')}
            onSubmitEditing={() => phoneRef.current?.focus()}
            error={errors.name}
          />

          <TextField
            label="Mobile number"
            placeholder="9876543210"
            prefix="+91"
            keyboardType="number-pad"
            maxLength={13}
            autoComplete="tel"
            returnKeyType="next"
            inputRef={phoneRef}
            value={form.phone}
            onChangeText={set('phone')}
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.phone}
            hint="We send order updates to this number."
          />

          <TextField
            label="Password"
            placeholder="At least 6 characters"
            icon="lock-closed-outline"
            secure
            autoComplete="new-password"
            returnKeyType="go"
            inputRef={passwordRef}
            value={form.password}
            onChangeText={set('password')}
            onSubmitEditing={submit}
            error={errors.password}
          />

          <Pressable
            onPress={() => {
              const pw = generatePassword();
              setForm((f) => ({ ...f, password: pw }));
              setErrors((e) => ({ ...e, password: '' }));
              setGenerated(true);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.generate, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="key-outline" size={ms(16)} color={colors.brand} />
            <Txt variant="label" tone="brand" weight="700">
              {generated ? 'Generate another password' : 'Generate a strong password'}
            </Txt>
          </Pressable>
          {generated ? (
            <Txt variant="caption" tone="muted" style={styles.generatedNote}>
              Your password: <Txt variant="label">{form.password}</Txt> — you will get a chance to copy it.
            </Txt>
          ) : null}

          {form.password.length > 0 && !errors.password ? (
            <View style={styles.meterRow}>
              <View style={styles.meterTrack}>
                {[1, 2, 3].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.meterSegment,
                      { backgroundColor: strength.score >= step ? meterColor(strength.score) : colors.border },
                    ]}
                  />
                ))}
              </View>
              <Txt variant="caption" tone="muted" style={styles.meterLabel}>
                {strength.label}
              </Txt>
            </View>
          ) : null}

          <Button label="Create account" onPress={submit} loading={busy} size="lg" style={styles.submit} />

          <Txt variant="caption" tone="faint" center style={styles.legal}>
            By continuing you agree to Bingoor&apos;s Terms of Service and Privacy Policy.
          </Txt>
        </ScrollView>

        <View style={styles.footer}>
          <Txt variant="body" tone="muted">
            Already registered?{' '}
          </Txt>
          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} accessibilityRole="button">
            <Txt variant="label" tone="brand">
              Sign in
            </Txt>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.surface },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: space.xxl },
  title: { marginBottom: space.xs },
  subtitle: { marginBottom: space.xxl },
  banner: { marginBottom: space.lg },
  meterRow: { flexDirection: 'row', alignItems: 'center', marginTop: -space.sm, marginBottom: space.lg },
  meterTrack: { flexDirection: 'row', flex: 1 },
  meterSegment: { flex: 1, height: ms(4), borderRadius: radius.pill, marginRight: space.xs },
  meterLabel: { marginLeft: space.sm, minWidth: ms(58), textAlign: 'right' },
  submit: { marginTop: space.sm },
  generate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: ms(10),
    marginBottom: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.brand,
    backgroundColor: c.brandSurface,
  },
  generatedNote: { marginBottom: space.md },
  legal: { marginTop: space.lg, paddingHorizontal: space.md },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: gutter,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },}));
