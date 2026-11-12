import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { setTip, useTip } from '../store/tip';
import { ms, radius, space, themed } from '../theme';
import { Txt } from '../ui/Text';
import { TextField } from '../ui/TextField';

/** Tip for the delivery partner. Shared by the cart and checkout, so a tip picked in the cart is kept. */
export function TipPicker() {
  const tip = useTip();
  const [custom, setCustom] = useState('');
  return (
    <View>
      <Txt variant="h3" style={styles.title}>
        Tip your delivery partner
      </Txt>
      <Txt variant="caption" tone="muted" style={{ marginBottom: space.sm }}>
        Your kindness means a lot. All of the tip goes to the delivery partner.
      </Txt>
      <View style={styles.row}>
        {[10, 20, 30, 50].map((n) => {
          const on = tip === n && !custom;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setCustom('');
                setTip(on ? 0 : n);
              }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Txt variant="label" style={on ? styles.chipTextOn : undefined}>{`₹${n}`}</Txt>
            </Pressable>
          );
        })}
      </View>
      <TextField
        placeholder="Other amount (max ₹500)"
        keyboardType="number-pad"
        maxLength={3}
        value={custom}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 3);
          setCustom(digits);
          setTip(Number(digits) || 0);
        }}
        containerStyle={{ marginTop: space.sm }}
      />
    </View>
  );
}

const styles = themed(({ c }) => ({
  title: { marginBottom: space.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: ms(16), paddingVertical: ms(8), borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
  chipOn: { borderColor: c.brand, backgroundColor: c.brandSurface },
  chipTextOn: { color: c.brandInk, fontWeight: '800' },
}));
