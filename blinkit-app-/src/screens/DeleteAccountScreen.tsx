import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { deleteMyAccount } from '../api/user';
import { useAuth } from '../context/AuthContext';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Text';
import { TextField } from '../ui/TextField';

/**
 * Delete my account (a Play Store requirement): the customer confirms with
 * their password and the account is removed for good, then they are signed out.
 */
export function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(password);
      await signOut();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!password) return setError('Enter your password to confirm.');
    Alert.alert('Delete your account?', 'Your profile, addresses, saved items and login are removed for good. This cannot be undone.', [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <Screen background="surface">
      <AppHeader title="Delete account" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Ionicons name="warning-outline" size={ms(22)} color={colors.danger} />
            <Txt variant="body" tone="body" style={styles.introText}>
              Deleting your account removes your name, phone number, email, addresses, cart and saved items, and you will not be able to
              sign in again. Bills of past orders are kept for the shop's records. If an order is still on its way, wait until it is
              delivered.
            </Txt>
          </View>
          {error ? <Banner tone="danger" message={error} style={styles.banner} /> : null}
          <TextField
            label="Your password"
            placeholder="Enter your password to confirm"
            icon="lock-closed-outline"
            secure
            autoComplete="current-password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
          />
          <Button label="Delete my account" variant="danger" size="lg" block loading={busy} onPress={confirm} style={styles.btn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = themed(({ c }) => ({
  flex: { flex: 1 },
  content: { padding: gutter, paddingBottom: space.xxl },
  intro: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.dangerSurface, marginBottom: space.lg },
  introText: { flex: 1 },
  banner: { marginBottom: space.lg },
  btn: { marginTop: space.md },
}));
