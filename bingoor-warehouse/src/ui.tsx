import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { accents, colors, radius, shadow, softShadow } from './theme';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { AnimatedNumber } from './components/anim';

export const money = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN')}`;
export const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const STATUS_LABEL: Record<string, string> = {
  placed: 'New', accepted: 'Accepted', preparing: 'Preparing', ready_for_pickup: 'Ready for pickup',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', rejected: 'Rejected',
};
export type Tone = 'brand' | 'success' | 'danger' | 'warn' | 'muted';
export const statusTone = (s: string): Tone => (s === 'delivered' ? 'success' : s === 'cancelled' || s === 'rejected' ? 'danger' : s === 'placed' ? 'warn' : 'brand');

const TONES: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: colors.primarySoft, fg: colors.primaryDark },
  success: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warn: { bg: '#FEF3C7', fg: '#B45309' },
  muted: { bg: '#F1F5F9', fg: colors.muted },
};

export function Pill({ text, tone = 'brand' }: { text: string; tone?: Tone }) {
  return <View style={[s.pill, { backgroundColor: TONES[tone].bg }]}><Text style={[s.pillText, { color: TONES[tone].fg }]}>{text}</Text></View>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) { return <View style={[s.card, style]}>{children}</View>; }

export function Section({ title, color = colors.primary, right }: { title: string; color?: string; right?: React.ReactNode }) {
  return (
    <View style={[row, { marginBottom: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function StatTile({ label, value, num, fmt, hint, icon, accent = 'blue' }: { label: string; value?: string; num?: number; fmt?: (n: number) => string; hint?: string; icon: React.ComponentProps<typeof Ionicons>['name']; accent?: keyof typeof accents }) {
  const a = accents[accent];
  return (
    <View style={[s.tile, { flex: 1, minWidth: '45%' }]}>
      <View style={[s.tileIcon, { backgroundColor: a.soft }]}><Ionicons name={icon} size={18} color={a.base} /></View>
      <Text style={s.tileLabel}>{label}</Text>
      {num !== undefined ? <AnimatedNumber value={num} format={fmt} style={[s.tileValue, { color: a.ink }]} /> : <Text style={[s.tileValue, { color: a.ink }]}>{value}</Text>}
      {hint ? <Text style={s.tileHint}>{hint}</Text> : null}
    </View>
  );
}
export function H({ title, sub, center }: { title: string; sub?: string; center?: boolean }) {
  return <View style={[s.head, center && { alignItems: 'center' }]}><Text style={[s.title, center && { textAlign: 'center' }]}>{title}</Text>{sub ? <Text style={[s.sub, center && { textAlign: 'center' }]}>{sub}</Text> : null}</View>;
}
export function Center({ children }: { children?: React.ReactNode }) { return <View style={s.center}>{children ?? <ActivityIndicator color={colors.primary} size="large" />}</View>; }
export function Empty({ text }: { text: string }) { return <View style={s.center}><Text style={s.sub}>{text}</Text></View>; }
export function ErrorText({ message }: { message: string }) { return message ? <View style={s.err}><Text style={s.errText}>{message}</Text></View> : null; }
export function Btn({ title, onPress, tone = 'primary', disabled, small }: { title: string; onPress: () => void; tone?: 'primary' | 'outline' | 'danger'; disabled?: boolean; small?: boolean }) {
  const bg = tone === 'primary' ? colors.primary : tone === 'danger' ? colors.dangerSoft : 'transparent';
  const fg = tone === 'primary' ? '#fff' : tone === 'danger' ? colors.danger : colors.primary;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 7 }).start();
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => !disabled && to(0.96)} onPressOut={() => to(1)}>
      <Animated.View style={[s.btn, small && s.btnSm, { backgroundColor: bg, borderColor: tone === 'outline' ? colors.primary : bg, transform: [{ scale }] }, disabled && { opacity: 0.6 }]}>
        <Text style={[s.btnText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}
export function Chips<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[s.chip, value === v && s.chipOn]}>
          <Text style={[s.chipText, value === v && { color: '#fff' }]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function SearchBar({ value, onChangeText, onSubmit, placeholder }: { value: string; onChangeText: (t: string) => void; onSubmit: () => void; placeholder: string }) {
  return <TextInput style={s.search} value={value} onChangeText={onChangeText} onSubmitEditing={onSubmit} returnKeyType="search" placeholder={placeholder} placeholderTextColor="#94A3B8" autoCapitalize="none" />;
}
export function Input({ label, value, onChangeText, keyboardType, multiline, placeholder, secure }: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'decimal-pad'; multiline?: boolean; placeholder?: string; secure?: boolean }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={[s.input, multiline && { height: 80, textAlignVertical: 'top', paddingTop: 10 }]} value={value} onChangeText={onChangeText} keyboardType={keyboardType} multiline={multiline} placeholder={placeholder} placeholderTextColor="#94A3B8" secureTextEntry={secure} autoCapitalize="none" />
    </View>
  );
}
export const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };

const s = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 16, marginBottom: 14, ...softShadow },
  head: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  err: { backgroundColor: colors.dangerSoft, padding: 10, borderRadius: radius.md, marginHorizontal: 16, marginBottom: 8 },
  errText: { color: colors.danger, fontSize: 13.5, fontWeight: '500' },
  btn: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1.5 },
  btnSm: { height: 36, paddingHorizontal: 12 },
  btnText: { fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  chips: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: '#EEF2F8' },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  search: { height: 48, marginHorizontal: 16, marginVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 18, fontSize: 15, color: colors.text, ...softShadow },
  tile: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, ...softShadow },
  tileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileLabel: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  tileValue: { fontSize: 22, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 },
  tileHint: { color: colors.muted, fontSize: 11.5, marginTop: 3 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 5 },
  input: { height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#FBFCFE', paddingHorizontal: 14, fontSize: 15, color: colors.text },
});
