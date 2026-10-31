import React, { useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { AuthLayout, ErrorBanner } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { TextField, TextInputRef } from '../components/TextField';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInputRef>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (identifier.trim().length < 3 || !password) return setError('Enter your warehouse phone number (or email) and password.');
    setBusy(true);
    try { await signIn(identifier.trim(), password); }
    catch (e) { setError(getErrorMessage(e)); setBusy(false); }
  };

  return (
    <AuthLayout title="Warehouse sign in" subtitle="Manage your orders, products, stock and riders with Bingoor.">
      {error ? <ErrorBanner message={error} /> : null}
      <TextField label="Phone number or email" icon="person-outline" placeholder="9876543210" value={identifier} onChangeText={setIdentifier} keyboardType="email-address" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} autoComplete="username" />
      <TextField label="Password" icon="lock-closed-outline" placeholder="Your password" value={password} onChangeText={setPassword} secure inputRef={passwordRef} returnKeyType="done" onSubmitEditing={submit} autoComplete="password" />
      <Button title="Sign in" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
    </AuthLayout>
  );
}
