import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getErrorMessage, getFieldErrors } from '../api/client';
import { changePassword } from '../api/user';
import type { AppNav } from '../navigation/types';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Text';
import { TextField, TextInputRef } from '../ui/TextField';
import { useToast } from '../ui/Toast';
import { passwordStrength } from '../utils/validation';

/** none, weak, fair, strong - resolved live so dark mode gets its own set. */
const meterColor = (i: number) => [colors.borderStrong, colors.danger, colors.warning, colors.success][i];

export function ChangePasswordScreen() {
  const navigation = useNavigation<AppNav>();
  const toast = useToast();

  const newRef = useRef<TextInputRef>(null);
  const confirmRef = useRef<TextInputRef>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const strength = useMemo(() => passwordStrength(next), [next]);

  const submit = async () => {
    setFormError(null);
    const found: Record<string, string> = {};
    if (!current) found.currentPassword = 'Enter your current password';
    if (next.length < 8) found.newPassword = 'Use at least 8 characters';
    else if (next === current) found.newPassword = 'Choose a password different from your current one';
    if (confirm !== next) found.confirm = 'The two passwords do not match';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await changePassword(current, next);
      toast.success('Password changed');
      navigation.goBack();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen background="surface">
      <AppHeader title="Change password" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons name="shield-checkmark-outline" size={ms(22)} color={colors.brand} />
            </View>
            <Txt variant="body" tone="muted" style={styles.introText}>
              Changing your password signs you out of your other devices. You will stay signed in here.
            </Txt>
          </View>

          {formError ? <Banner tone="danger" message={formError} style={styles.banner} /> : null}

          <TextField
            label="Current password"
            placeholder="Your current password"
            icon="lock-closed-outline"
            secure
            autoComplete="current-password"
            returnKeyType="next"
            value={current}
            onChangeText={(t) => {
              setCurrent(t);
              if (errors.currentPassword) setErrors((e) => ({ ...e, currentPassword: '' }));
            }}
            onSubmitEditing={() => newRef.current?.focus()}
            error={errors.currentPassword}
          />

          <TextField
            label="New password"
            placeholder="At least 6 characters"
            icon="lock-closed-outline"
            secure
            autoComplete="new-password"
            returnKeyType="next"
            inputRef={newRef}
            value={next}
            onChangeText={(t) => {
              setNext(t);
              if (errors.newPassword) setErrors((e) => ({ ...e, newPassword: '' }));
            }}
            onSubmitEditing={() => confirmRef.current?.focus()}
            error={errors.newPassword}
          />

          {next.length > 0 && !errors.newPassword ? (
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

          <TextField
            label="Confirm new password"
            placeholder="Type it once more"
            icon="lock-closed-outline"
            secure
            returnKeyType="go"
            inputRef={confirmRef}
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t);
              if (errors.confirm) setErrors((e) => ({ ...e, confirm: '' }));
            }}
            onSubmitEditing={submit}
            error={errors.confirm}
          />
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.bar}>
          <View style={styles.barInner}>
            <Button label="Update password" loading={saving} onPress={submit} size="lg" />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = themed(({ c, elevation }) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: ms(110) },

  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    marginBottom: space.xl,
    borderRadius: radius.lg,
    backgroundColor: c.brandSurface,
  },
  introIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: { flex: 1, marginLeft: space.md },

  banner: { marginBottom: space.lg },

  meterRow: { flexDirection: 'row', alignItems: 'center', marginTop: -space.sm, marginBottom: space.lg },
  meterTrack: { flexDirection: 'row', flex: 1 },
  meterSegment: { flex: 1, height: ms(4), borderRadius: radius.pill, marginRight: space.xs },
  meterLabel: { marginLeft: space.sm, minWidth: ms(58), textAlign: 'right' },

  bar: {
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    ...elevation.lg,
  },
  barInner: { paddingHorizontal: gutter, paddingVertical: space.md },}));
