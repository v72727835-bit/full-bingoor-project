import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useCart } from '../context/CartContext';
import { fetchPointsProducts } from '../api/catalog';
import type { AppNav } from '../navigation/types';
import type { ProductSummary } from '../types';
import { ProductCard } from './ProductCard';
import { Sheet } from '../ui/Sheet';
import { ActivityIndicator } from 'react-native';
import { currency, gutter, ms, radius, space, themed } from '../theme';
import { SmartImage } from '../ui/SmartImage';
import { Txt } from '../ui/Text';

/** Point 15: how long a customer has to pick a top-up product after removing the one added for them. */
const AUTO_ADD_SECONDS = 30;

/**
 * #35 / point 15: the hidden cart-points rule in the app. Once the basket meets
 * the shopping minimum (`ready`), one top-up product is added for the customer
 * straight away. If they take it out they are told it is mandatory and have
 * 30 seconds to pick one from the rows; after that one is added again. The
 * rows (up to three) slide sideways and follow the admin's sort code.
 */
export function CartPoints({ ready = true }: { ready?: boolean }) {
  const { cart, add, pending } = useCart();
  const pts = cart.points;
  const tried = useRef(false);
  const [removed, setRemoved] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const nav = useNavigation<AppNav>();
  const { width } = useWindowDimensions();
  const [allOpen, setAllOpen] = useState(false);
  const [allItems, setAllItems] = useState<ProductSummary[] | null>(null);
  const [allError, setAllError] = useState('');
  useEffect(() => {
    if (!allOpen || allItems) return;
    let live = true;
    setAllError('');
    fetchPointsProducts()
      .then((list) => { if (live) setAllItems(list); })
      .catch(() => { if (live) { setAllItems([]); setAllError('Could not load products. Pull to retry.'); } });
    return () => { live = false; };
  }, [allOpen, allItems]);
  const sheetCardWidth = Math.floor((Math.min(width, 520) - gutter * 2 - space.md) / 2);

  useEffect(() => {
    if (!pts?.enabled) return;
    if (pts.met) {
      // Keep `tried`: if the added product is taken out, the customer is
      // warned instead of it silently coming straight back.
      setRemoved(false);
      return;
    }
    if (!ready) {
      // Back under the minimum: start over once it is reached again.
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
  }, [pts, ready, add]);

  useEffect(() => {
    if (!removed) {
      setLeft(null);
      return;
    }
    setLeft(AUTO_ADD_SECONDS);
    const t = setInterval(() => setLeft((c) => (c === null ? null : Math.max(0, c - 1))), 1000);
    return () => clearInterval(t);
  }, [removed]);

  useEffect(() => {
    if (left !== 0) return;
    const id = pts?.autoAddId ?? pts?.suggestions[0]?.productId;
    setRemoved(false);
    if (id) void add(id);
  }, [left, pts, add]);

  if (!ready || !pts?.enabled || pts.met || pts.suggestions.length === 0) return null;

  const list = pts.suggestions;
  const count = list.length > 16 ? 3 : list.length > 8 ? 2 : 1;
  const size = Math.ceil(list.length / count);
  const rows = Array.from({ length: count }, (_, i) => list.slice(i * size, (i + 1) * size)).filter((r) => r.length);

  return (
    <View style={styles.box}>
      {removed ? (
        <View style={styles.warn} accessibilityRole="alert">
          <Txt variant="label">
            {`Don't delete this product, this is mandatory. If you delete this, then add at least any 1 product from the product list below, else within ${AUTO_ADD_SECONDS} seconds 1 product will be added automatically from the list below. Then you can place your order and make payment easily.`}
            {left !== null ? <Txt variant="label" tone="danger">{`  Adding 1 product in ${left}s`}</Txt> : null}
          </Txt>
        </View>
      ) : (
        <Txt variant="label" style={styles.note}>
          Add any one product from below to proceed to payment
        </Txt>
      )}
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

      <Pressable
        onPress={() => setAllOpen(true)}
        accessibilityRole="button"
        style={styles.seeAll}
      >
        <Txt variant="label" tone="brand">See all products</Txt>
      </Pressable>

      <Sheet visible={allOpen} onClose={() => setAllOpen(false)} title="Add more to your order">
        {!allItems ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator />
          </View>
        ) : allItems.length === 0 ? (
          <Txt variant="body" tone="muted" center style={styles.sheetEmpty}>
            {allError || 'No products to show right now.'}
          </Txt>
        ) : (
          <View style={styles.sheetGrid}>
            {allItems.map((item) => (
              <ProductCard
                key={item._id}
                product={item}
                width={sheetCardWidth}
                onPress={() => {
                  setAllOpen(false);
                  nav.navigate('ProductDetail', { id: item._id, name: item.name });
                }}
              />
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = themed(({ c }) => ({
  box: { marginHorizontal: gutter, marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.surface },
  note: { marginBottom: space.sm },
  warn: { marginBottom: space.sm, padding: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: c.danger, backgroundColor: c.dangerSurface },
  row: { gap: space.sm, paddingBottom: space.sm },
  card: { width: ms(120), padding: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, gap: 2 },
  art: { width: '100%', height: ms(84) },
  name: { minHeight: ms(34) },
  add: { marginTop: space.xs, paddingVertical: ms(5), alignItems: 'center', borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.brand },
  seeAll: { alignSelf: 'flex-start', marginTop: space.xs, paddingVertical: ms(6), paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSurface },
  sheetLoading: { paddingVertical: ms(40), alignItems: 'center' },
  sheetEmpty: { paddingVertical: ms(30) },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' },
}));
