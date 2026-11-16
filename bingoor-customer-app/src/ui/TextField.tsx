import React, { useState } from 'react';
import { Pressable, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons/static';
import { HIT_SIZE, MAX_FONT_SCALE, font, ms, radius, space, type as typeScale, useStyles, useTheme } from '../theme';
import { Txt } from './Text';

export type TextInputRef = React.ComponentRef<typeof TextInput>;

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: string;
  secure?: boolean;
  prefix?: string;
  inputRef?: React.Ref<TextInputRef>;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Label, field, and one line of help underneath.
 *
 * The help line is always rendered when there is a hint or an error, so the
 * form does not jump a row taller the moment validation fails.
 */
export function TextField({
  label,
  error,
  hint,
  icon,
  secure,
  prefix,
  inputRef,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  const s = useStyles(({ c: p }) => ({
    wrap: { marginBottom: space.md },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      minHeight: ms(50),
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      backgroundColor: p.surface,
      borderColor: p.border,
    },
    input: { flex: 1, paddingVertical: ms(12), color: p.ink },
    help: { marginTop: ms(5), minHeight: ms(16) },
    eye: { minWidth: HIT_SIZE - ms(10), minHeight: HIT_SIZE - ms(10), alignItems: 'center', justifyContent: 'center' },
  }));

  const borderColor = error ? c.danger : focused ? c.brand : c.border;

  return (
    <View style={[s.wrap, containerStyle]}>
      {label ? (
        <Txt variant="label" tone="body" style={{ marginBottom: ms(6) }}>
          {label}
        </Txt>
      ) : null}

      <View style={[s.field, { borderColor }]}>
        {icon ? <Icon name={icon as never} size={ms(18)} color={focused ? c.brand : c.inkFaint} /> : null}
        {prefix ? (
          <Txt variant="body" tone="muted">
            {prefix}
          </Txt>
        ) : null}
        <TextInput
          ref={inputRef}
          style={[typeScale.body, font('500'), s.input]}
          placeholderTextColor={c.inkFaint}
          selectionColor={c.brand}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          secureTextEntry={secure && !reveal}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setReveal((r) => !r)}
            style={s.eye}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
          >
            <Icon name={reveal ? 'eye-off-outline' : 'eye-outline'} size={ms(19)} color={c.inkMuted} />
          </Pressable>
        ) : null}
      </View>

      {error || hint ? (
        <Txt variant="caption" tone={error ? 'danger' : 'muted'} style={s.help}>
          {error || hint}
        </Txt>
      ) : null}
    </View>
  );
}
