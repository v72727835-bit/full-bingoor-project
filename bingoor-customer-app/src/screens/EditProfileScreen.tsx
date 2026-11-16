import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getErrorMessage, getFieldErrors } from '../api/client';
import { updateProfile } from '../api/user';
import { useAuth } from '../context/AuthContext';
import type { AppNav } from '../navigation/types';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Text';
import { TextField, TextInputRef } from '../ui/TextField';
import { useToast } from '../ui/Toast';
import { isValidEmail } from '../utils/validation';

export function EditProfileScreen() {
  const navigation = useNavigation<AppNav>();
  const { user, applyUser } = useAuth();
  const toast = useToast();
  const emailRef = useRef<TextInputRef>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const changed = name.trim() !== (user?.name ?? '') || email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase();

  const submit = async () => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter your full name';
    if (email.trim() && !isValidEmail(email)) next.email = 'Enter a valid email address, or leave it blank';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const payload: { name?: string; email?: string } = {};
      if (name.trim() !== user?.name) payload.name = name.trim();
      if (email.trim() && email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase()) {
        payload.email = email.trim().toLowerCase();
      }
      if (Object.keys(payload).length === 0) {
        navigation.goBack();
        return;
      }
      applyUser(await updateProfile(payload));
      toast.success('Profile updated');
      navigation.goBack();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || 'B').trim().charAt(0).toUpperCase();

  return (
    <Screen background="surface">
      <AppHeader title="Personal details" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.avatarBlock}>
            <View style={styles.avatar}>
              <Txt variant="display" tone="brand">
                {initial}
              </Txt>
            </View>
          </View>

          {formError ? <Banner tone="danger" message={formError} style={styles.banner} /> : null}

          <TextField
            label="Full name"
            placeholder="Your name"
            icon="person-outline"
            autoCapitalize="words"
            returnKeyType="next"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (errors.name) setErrors((e) => ({ ...e, name: '' }));
            }}
            onSubmitEditing={() => emailRef.current?.focus()}
            error={errors.name}
          />

          <TextField
            label="Email address"
            placeholder="you@example.com"
            icon="mail-outline"
            keyboardType="email-address"
            returnKeyType="done"
            inputRef={emailRef}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (errors.email) setErrors((e) => ({ ...e, email: '' }));
            }}
            onSubmitEditing={submit}
            error={errors.email}
            hint="Used for order receipts. Optional."
          />

          <View style={styles.lockedField}>
            <View style={styles.lockedIcon}>
              <Ionicons name="call-outline" size={ms(18)} color={colors.inkMuted} />
            </View>
            <View style={styles.flex}>
              <Txt variant="label" tone="body">
                Mobile number
              </Txt>
              <Txt variant="bodyLg" style={styles.lockedValue}>
                +91 {user?.phone}
              </Txt>
            </View>
            <Ionicons name="lock-closed-outline" size={ms(17)} color={colors.inkFaint} />
          </View>
          <Txt variant="caption" tone="faint" style={styles.lockedNote}>
            Your mobile number is how shops and delivery partners reach you, so it cannot be changed from the app. Contact
            support if you need to update it.
          </Txt>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.bar}>
          <View style={styles.barInner}>
            <Button label="Save changes" loading={saving} disabled={!changed} onPress={submit} size="lg" />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = themed(({ c, elevation }) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: ms(110) },

  avatarBlock: { alignItems: 'center', marginBottom: space.xxl },
  avatar: {
    width: ms(92),
    height: ms(92),
    borderRadius: radius.pill,
    backgroundColor: c.brandSurface,
    borderWidth: 2,
    borderColor: c.brandBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  banner: { marginBottom: space.lg },

  lockedField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ms(64),
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: c.surfaceSunken,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  lockedIcon: { marginRight: space.md },
  lockedValue: { marginTop: ms(1) },
  lockedNote: { marginTop: space.sm },

  bar: {
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    ...elevation.lg,
  },
  barInner: { paddingHorizontal: gutter, paddingVertical: space.md },}));
