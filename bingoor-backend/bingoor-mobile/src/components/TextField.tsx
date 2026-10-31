import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius } from '../theme';

export type TextInputRef = React.ComponentRef<typeof TextInput>;

interface Props extends TextInputProps {
  label: string;
  error?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Renders a password field with a show/hide toggle */
  secure?: boolean;
  inputRef?: React.Ref<TextInputRef>;
}

export function TextField({ label, error, icon, secure, inputRef, style, ...rest }: Props) {
  const [hidden, setHidden] = useState(!!secure);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.focused, !!error && styles.errored]}>
        {icon ? <Ionicons name={icon} size={20} color={colors.muted} style={styles.icon} /> : null}
        <TextInput
          ref={inputRef}
          style={[styles.input, style]}
          placeholderTextColor="#94A3B8"
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  focused: { borderColor: colors.primary },
  errored: { borderColor: colors.danger },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
  error: { marginTop: 5, fontSize: 12.5, color: colors.danger },
});
