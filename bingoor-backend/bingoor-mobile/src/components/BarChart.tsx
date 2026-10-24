import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * A tiny earnings bar chart drawn with plain Views — one bar per day, the
 * tallest day full height. No chart library, so nothing extra to install.
 */
export function BarChart({ data, height = 120 }: { data: { date: string; amount: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const dayLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric' });
  };
  return (
    <View>
      <View style={[styles.row, { height }]}>
        {data.map((d, i) => {
          const h = Math.max(3, Math.round((d.amount / max) * (height - 18)));
          const today = i === data.length - 1;
          return (
            <View key={d.date} style={styles.col}>
              {d.amount > 0 ? <Text style={styles.val}>{d.amount}</Text> : <View style={{ height: 12 }} />}
              <View style={[styles.bar, { height: h, backgroundColor: today ? colors.primary : colors.primarySoft, borderColor: today ? colors.primaryDark : colors.border }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {data.map((d, i) => (
          <View key={d.date} style={styles.col}>
            {i % 2 === 0 || i === data.length - 1 ? <Text style={styles.axis}>{dayLabel(d.date)}</Text> : <Text style={styles.axis} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 6, borderWidth: 1 },
  val: { fontSize: 9, color: colors.muted, marginBottom: 2, fontWeight: '700' },
  axis: { fontSize: 10, color: colors.muted, marginTop: 4 },
});
