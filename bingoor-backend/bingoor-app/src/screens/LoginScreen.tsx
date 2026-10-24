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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const next: Record<string, string> = {};
    if (identifier.trim().length < 3) next.identifier = 'Enter your mobile number or email';
    if (!password) next.password = 'Enter your password';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await signIn(identifier.trim(), password);
      // On success the navigator swaps to the Dashboard by itself.
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to order from shops near you.">
      {formError ? <ErrorBanner message={formError} /> : null}

      <TextField
        label="Mobile number or email"
        icon="person-outline"
        placeholder="9876543210"
        value={identifier}
        onChangeText={setIdentifier}
        error={errors.identifier}
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        autoComplete="username"
      />

      <TextField
        label="Password"
        icon="lock-closed-outline"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        inputRef={passwordRef}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        autoComplete="password"
      />

      <Button title="Log in" onPress={onSubmit} loading={submitting} style={{ marginTop: 4 }} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Bingoor? </Text>
        <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8}>
          <Text style={styles.link}>Create an account</Text>
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
