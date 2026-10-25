import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useCart } from '../context/CartContext';
import { currency, gutter, ms, radius, space, themed } from '../theme';
import { SmartImage } from '../ui/SmartImage';
import { Txt } from '../ui/Text';

/**
 * #35: the hidden cart-points rule in the app. When the basket is short, one
 * product is added for the customer. If they take it out they have 60 seconds
 * to pick one from the rows; after that one is added again. The rows (up to
 * three) slide sideways and follow the admin's sort code.
 */
export function CartPoints() {
  const { cart, add, pending } = useCart();
  const pts = cart.points;
  const tried = useRef(false);
  const [removed, setRemoved] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!pts?.enabled) return;
    if (pts.met) {
      tried.current = false;
      setRemoved(false);
      return;
    }
    if (!tried.current && pts.autoAddId) {
      tried.current = true;
      void add(pts.autoAddId);
    } else if (tried.current) {
      setRemoved(true);
    }
  }, [pts, add]);

  useEffect(() => {
    if (!removed) {
      setLeft(null);
      return;
    }
    setLeft(60);
    const t = setInterval(() => setLeft((c) => (c === null ? null : Math.max(0, c - 1))), 1000);
    return () => clearInterval(t);
  }, [removed]);

  useEffect(() => {
    if (left !== 0) return;
    const id = pts?.autoAddId ?? pts?.suggestions[0]?.productId;
    setRemoved(false);
    if (id) void add(id);
  }, [left, pts, add]);

  if (!pts?.enabled || pts.met || pts.suggestions.length === 0) return null;

  const list = pts.suggestions;
  const count = list.length > 16 ? 3 : list.length > 8 ? 2 : 1;
  const size = Math.ceil(list.length / count);
  const rows = Array.from({ length: count }, (_, i) => list.slice(i * size, (i + 1) * size)).filter((r) => r.length);

  return (
    <View style={styles.box}>
      <Txt variant="label" style={styles.note}>
        {removed
          ? 'This product is mandatory to buy for proceed to payment, or add any one product from the list below. Otherwise one product will be added again automatically.'
          : 'Add any one product from below to proceed to payment'}
        {removed && left !== null ? <Txt variant="label" tone="danger">{`  Adding one in ${left}s`}</Txt> : null}
      </Txt>
      {rows.map((row, r) => (
        <ScrollView key={r} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {row.map((sg) => (
            <View key={sg.productId} style={styles.card}>
              <SmartImage uri={sg.image ?? undefined} icon={sg.icon} style={styles.art} radius={radius.sm} />
              <Txt variant="bodySm" numberOfLines={2} style={styles.name}>
                {sg.name}
              </Txt>
              {sg.unit ? (
                <Txt variant="caption" tone="muted">
                  {sg.unit}
                </Txt>
              ) : null}
              <Txt variant="label">{currency(sg.price)}</Txt>
              <Pressable
                onPress={() => void add(sg.productId)}
                disabled={pending.has(sg.productId)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${sg.name}`}
                style={styles.add}
              >
                <Txt variant="label" tone="brand">
                  ADD
                </Txt>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ))}
    </View>
  );
}

const styles = themed(({ c }) => ({
  box: { marginHorizontal: gutter, marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.surface },
  note: { marginBottom: space.sm },
  row: { gap: space.sm, paddingBottom: space.sm },
  card: { width: ms(120), padding: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, gap: 2 },
  art: { width: '100%', height: ms(84) },
  name: { minHeight: ms(34) },
  add: { marginTop: space.xs, paddingVertical: ms(5), alignItems: 'center', borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.brand },
}));
