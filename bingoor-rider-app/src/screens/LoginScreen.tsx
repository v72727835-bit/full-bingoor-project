import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { getErrorMessage, getFieldErrors } from '../api/client';
import { AuthLayout, ErrorBanner } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { TextField, TextInputRef } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { AuthStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signInRider } = useAuth();
  const passwordRef = useRef<TextInputRef>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const next: Record<string, string> = {};
    if (identifier.trim().length < 3) next.identifier = 'Enter your rider mobile number or email';
    if (!password) next.password = 'Enter your password';
    setErrors(next); setFormError(null);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try { await signInRider(identifier.trim(), password); }
    catch (err) {
      setErrors(getFieldErrors(err)); setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return <AuthLayout title="Rider sign in" subtitle="Manage pickups and deliveries with Bingoor.">
    {formError ? <ErrorBanner message={formError} /> : null}
    <TextField label="Rider mobile number or email" icon="person-outline" placeholder="9876543210" value={identifier} onChangeText={setIdentifier} error={errors.identifier} keyboardType="email-address" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} autoComplete="username" />
    <TextField label="Password" icon="lock-closed-outline" placeholder="Your rider password" value={password} onChangeText={setPassword} error={errors.password} secure inputRef={passwordRef} returnKeyType="done" onSubmitEditing={onSubmit} autoComplete="password" />
    <Button title="Sign in as rider" onPress={onSubmit} loading={submitting} style={{ marginTop: 4 }} />
    <Button title="Forgot password?" variant="outline" onPress={() => navigation.navigate('ForgotPassword')} style={{ marginTop: 8 }} />
  </AuthLayout>;
}

const styles = StyleSheet.create({});