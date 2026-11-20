import Icon from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fetchOrders } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import type { AppNav } from '../navigation/types';
import { gutter, hitSlop, ms, radius, space, themed, useTheme } from '../theme';
import type { Order } from '../types';
import { Txt } from '../ui/Text';

/** The reminder comes back five minutes after it is closed. */
const REMIND_AFTER_MS = 5 * 60_000;
const CHECK_EVERY_MS = 60_000;

/** Per order, the moment the customer's dismissal runs out. */
const snoozed = new Map<string, number>();

/**
 * "Order arriving soon" - a standing reminder while an order is on its
 * way, with the tap that opens the tracking screen. Closing it buys five
 * minutes of quiet; delivery or cancellation stops it for good.
 */
export function OrderProgressPopup({ hidden }: { hidden?: boolean }) {
  const nav = useNavigation<AppNav>();
  const { user } = useAuth();
  const { c } = useTheme();
  const [order, setOrder] = useState<Order | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) {
      setOrder(null);
      setVisible(false);
      return;
    }
    let alive = true;
    const check = async () => {
      try {
        const { items } = await fetchOrders({ active: true });
        if (!alive) return;
        const live = items.find((o) => !['delivered', 'cancelled', 'rejected'].includes(o.status)) ?? null;
        setOrder(live);
        setVisible(live ? (snoozed.get(live._id) ?? 0) < Date.now() : false);
      } catch {
        /* offline - try again on the next tick */
      }
    };
    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user]);

  if (!order || !visible || hidden) return null;

  const eta =
    order.deliveryDays && order.deliveryDays > 1
      ? `in about ${order.deliveryDays} days`
      : order.deliveryDays === 1
        ? 'by tomorrow'
        : 'soon';

  return (
    <Pressable
      onPress={() => nav.navigate('OrderDetail', { id: order._id })}
      accessibilityRole="button"
      accessibilityLabel={`Your order is on its way. Track order ${order.orderNumber}`}
      style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
    >
      <View style={styles.live} />
      <Txt variant="labelSm" tone="brand" numberOfLines={1} style={styles.body}>
        Order {order.orderNumber} arriving {eta}
      </Txt>
      <Txt variant="labelSm" tone="brand">
        Track
      </Txt>
      <Icon name="chevron-forward" size={ms(13)} color={c.brandText} />
      <Pressable
        onPress={() => {
          snoozed.set(order._id, Date.now() + REMIND_AFTER_MS);
          setVisible(false);
        }}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Hide this reminder"
        style={styles.close}
      >
        <Icon name="close" size={ms(16)} color={c.inkMuted} />
      </Pressable>
    </Pressable>
  );
}

const styles = themed(({ c }) => ({
  /* A slim strip that sits in flow on top of the tab bar, so it never covers
     the cart bar and never reads as a second floating card. */
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    paddingLeft: gutter,
    paddingRight: space.sm,
    paddingVertical: ms(9),
    backgroundColor: c.brandSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.brandBorder,
  },
  pressed: { backgroundColor: c.brandSurfaceStrong },
  live: { width: ms(8), height: ms(8), borderRadius: radius.pill, backgroundColor: c.brand },
  body: { flex: 1 },
  close: { marginLeft: space.xs, padding: ms(2) },
}));
