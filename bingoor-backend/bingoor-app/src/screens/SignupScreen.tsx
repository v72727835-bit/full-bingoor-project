import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getErrorMessage, getFieldErrors } from '../api/client';
import { AuthLayout, ErrorBanner } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { AuthStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme';
import { isValidEmail, isValidPhone, normalizePhone } from '../utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter your full name';
    if (!isValidPhone(phone)) next.phone = 'Enter a valid 10-digit mobile number';
    if (email.trim() && !isValidEmail(email)) next.email = 'Enter a valid email address';
    if (password.length < 6) next.password = 'Password must be at least 6 characters';
    if (confirm !== password) next.confirm = 'Passwords do not match';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await signUp({
        name: name.trim(),
        phone: normalizePhone(phone),
        email: email.trim() || undefined,
        password,
      });
      // On success the navigator swaps to the Dashboard by itself.
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create account" subtitle="Sign up to start ordering in minutes.">
      {formError ? <ErrorBanner message={formError} /> : null}

      <TextField
        label="Full name"
        icon="person-outline"
        placeholder="Vikas Kumar"
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        autoComplete="name"
      />

      <TextField
        label="Mobile number"
        icon="call-outline"
        placeholder="9876543210"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        keyboardType="phone-pad"
        maxLength={14}
        inputRef={phoneRef}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        autoComplete="tel"
      />

      <TextField
        label="Email (optional)"
        icon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        inputRef={emailRef}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        autoComplete="email"
      />

      <TextField
        label="Password"
        icon="lock-closed-outline"
        placeholder="At least 6 characters"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        inputRef={passwordRef}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        autoComplete="new-password"
      />

      <TextField
        label="Confirm password"
        icon="lock-closed-outline"
        placeholder="Repeat your password"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secure
        inputRef={confirmRef}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        autoComplete="new-password"
      />

      <Button title="Sign up" onPress={onSubmit} loading={submitting} style={{ marginTop: 4 }} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Text style={styles.link}>Log in</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: colors.muted, fontSize: 14.5 },
  link: { color: colors.primary, fontSize: 14.5, fontWeight: '700' },
});
