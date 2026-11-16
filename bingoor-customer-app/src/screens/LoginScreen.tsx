import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getErrorMessage, getFieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AuthNav } from '../navigation/types';
import { gutter, space, themed } from '../theme';
import { Button } from '../ui/Button';
import { SocialButtons } from '../components/SocialButtons';
import { Banner } from '../ui/Feedback';
import { Logo } from '../ui/Logo';
import { Txt } from '../ui/Text';
import { TextField, TextInputRef } from '../ui/TextField';
import { isValidEmail, isValidPhone, normalizePhone } from '../utils/validation';

export function LoginScreen() {
  const navigation = useNavigation<AuthNav>();
  const { signIn } = useAuth();
  const [usePhone] = useState(true);
  const passwordRef = useRef<TextInputRef>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const id = identifier.trim();
    if (!id) next.identifier = 'Enter your mobile number or email';
    else if (!isValidPhone(id) && !isValidEmail(id)) next.identifier = 'Enter a valid 10-digit mobile number or email';
    if (!password) next.password = 'Enter your password';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      const id = identifier.trim();
      await signIn(isValidPhone(id) ? normalizePhone(id) : id.toLowerCase(), password);
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Logo size={44} style={styles.logo} />

          <Txt variant="h1" center style={styles.title}>
            Welcome back
          </Txt>
          <Txt variant="bodyLg" tone="muted" center style={styles.subtitle}>
            Sign in to pick up where you left off.
          </Txt>

          {formError ? <Banner tone="danger" message={formError} style={styles.banner} /> : null}

          <SocialButtons onError={setFormError} onBusy={setBusy} />

          {usePhone ? (
            <View>
          <TextField
            label="Mobile number or email"
            placeholder="9876543210"
            icon="person-outline"
            keyboardType="email-address"
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            value={identifier}
            onChangeText={(t) => {
              setIdentifier(t);
              if (errors.identifier) setErrors((e) => ({ ...e, identifier: '' }));
            }}
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.identifier}
          />

          <TextField
            label="Password"
            placeholder="Your password"
            icon="lock-closed-outline"
            secure
            inputRef={passwordRef}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (errors.password) setErrors((e) => ({ ...e, password: '' }));
            }}
            onSubmitEditing={submit}
            error={errors.password}
          />

          <Button label="Sign in" onPress={submit} loading={busy} size="lg" block style={styles.submit} />
          <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8} accessibilityRole="button" style={styles.forgot}>
            <Txt variant="label" tone="brand">
              Forgot password?
            </Txt>
          </Pressable>

            </View>
          ) : null}

        </ScrollView>

        <View style={styles.footer}>
          <Txt variant="body" tone="muted">
            New to Bingoor?{' '}
          </Txt>
          <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8} accessibilityRole="button">
            <Txt variant="label" tone="brand">
              Create an account
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
  logo: { alignSelf: 'center', marginBottom: space.xxl, marginTop: space.lg },
  title: { marginBottom: space.xs },
  subtitle: { marginBottom: space.xxl },
  banner: { marginBottom: space.lg },
  submit: { marginTop: space.sm },
  forgot: { alignSelf: 'center', marginTop: space.lg },
  methods: { gap: space.sm, marginBottom: space.xl },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xs },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong },
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
