import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { fetchOrders, reorder } from '../api/orders';
import { ORDER_META, OrderStatusChip } from '../components/OrderStatusChip';
import { useCart } from '../context/CartContext';
import type { TabScreenProps } from '../navigation/TabsContext';
import { useGoToTab } from '../navigation/TabsContext';
import type { AppNav } from '../navigation/types';
import { colors, currency, gutter, ms, radius, space, themed } from '../theme';
import { Order } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';
import { RowSkeleton } from '../ui/Skeleton';
import { SmartImage } from '../ui/SmartImage';
import { Txt } from '../ui/Text';
import { useToast } from '../ui/Toast';
import { timeAgo } from '../utils/validation';

type Filter = 'active' | 'past';

export function OrdersScreen({ active }: TabScreenProps) {
  const navigation = useNavigation<AppNav>();
  const goToTab = useGoToTab();
  const { applyCart } = useCart();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>('active');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      const id = ++requestId.current;
      if (isRefresh) setRefreshing(true);
      try {
        const page = await fetchOrders({ active: filter === 'active' });
        if (id !== requestId.current) return;
        setOrders(page.items);
        setError(null);
      } catch (err) {
        if (id === requestId.current) {
          setError(getErrorMessage(err));
          setOrders([]);
        }
      } finally {
        if (id === requestId.current) setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    setOrders(null);
    void load();
  }, [load]);

  // Statuses change while the user is browsing, so re-check when they come back.
  useEffect(() => {
    if (active && orders !== null) void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const runReorder = async (order: Order) => {
    setReordering(order._id);
    try {
      const result = await reorder(order._id);
      applyCart(result.cart);
      if (result.skipped?.length) {
        toast.show(`${result.skipped.length} item(s) could not be added`, {
          action: { label: 'View cart', onPress: () => goToTab('cart') },
        });
      } else {
        toast.success('Items added to your cart', {
          action: { label: 'View cart', onPress: () => goToTab('cart') },
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReordering(null);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Your orders" showBack={false} flat />

      <View style={styles.tabsWrap}>
        <View style={styles.tabs}>
          {(
            [
              { key: 'active' as Filter, label: 'In progress' },
              { key: 'past' as Filter, label: 'Completed' },
            ]
          ).map((item) => {
            const on = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Txt variant="label" numberOfLines={1} style={{ color: on ? colors.onBrand : colors.inkMuted }}>
                  {item.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      {orders === null ? (
        <View style={styles.skeleton}>
          {[0, 1, 2].map((i) => (
            <RowSkeleton key={i} lines={3} />
          ))}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.brand]} />}
          ListEmptyComponent={
            <EmptyState
              icon={error ? 'cloud-offline-outline' : filter === 'active' ? 'bicycle-outline' : 'receipt-outline'}
              tone={error ? 'danger' : 'neutral'}
              title={error ? 'Could not load orders' : filter === 'active' ? 'No orders on the way' : 'No past orders yet'}
              message={
                error ??
                (filter === 'active'
                  ? 'When you place an order you will be able to track it here, step by step.'
                  : 'Orders you have received or cancelled will be listed here.')
              }
              actionLabel={error ? 'Try again' : 'Start shopping'}
              onAction={() => (error ? load() : goToTab('home'))}
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              reordering={reordering === item._id}
              onPress={() => navigation.navigate('OrderDetail', { id: item._id })}
              onReorder={() => runReorder(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function OrderCard({
  order,
  reordering,
  onPress,
  onReorder,
}: {
  order: Order;
  reordering: boolean;
  onPress: () => void;
  onReorder: () => void;
}) {
  const meta = ORDER_META[order.status];
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const finished = ['delivered', 'cancelled', 'rejected'].includes(order.status);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.orderNumber}, ${meta.label}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <SmartImage uri={order.shop?.logo} icon="shopping-cart" style={styles.shopLogo} radius={radius.sm} />
        <View style={styles.cardTitles}>
          <Txt variant="h4" numberOfLines={1}>
            {order.shop?.name ?? 'Bingoor shop'}
          </Txt>
          <Txt variant="caption" tone="faint" numberOfLines={1}>
            {order.orderNumber} {'·'} {timeAgo(order.createdAt)}
          </Txt>
        </View>
        <OrderStatusChip status={order.status} />
      </View>

      <View style={styles.thumbRow}>
        {order.items.slice(0, 4).map((item, i) => (
          <SmartImage
            key={`${item.product}-${i}`}
            uri={item.image}
            icon={item.icon}
            style={styles.thumb}
            radius={radius.xs}
          />
        ))}
        {order.items.length > 4 ? (
          <View style={styles.thumbMore}>
            <Txt variant="labelSm" tone="muted">
              +{order.items.length - 4}
            </Txt>
          </View>
        ) : null}
        <View style={styles.thumbSpacer} />
        <View style={styles.amount}>
          <Txt variant="caption" tone="faint">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Txt>
          <Txt variant="h4">{currency(order.total)}</Txt>
        </View>
      </View>

      <Txt variant="bodySm" tone="muted" numberOfLines={2} style={styles.blurb}>
        {meta.blurb}
      </Txt>

      <View style={styles.cardFooter}>
        {finished ? (
          <Button
            label="Order again"
            variant="secondary"
            size="sm"
            icon="refresh"
            block={false}
            loading={reordering}
            onPress={onReorder}
          />
        ) : (
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Txt variant="labelSm" tone="brand">
              Live tracking available
            </Txt>
          </View>
        )}
        <View style={styles.thumbSpacer} />
        <Txt variant="label" tone="brand">
          Details
        </Txt>
        <Ionicons name="chevron-forward" size={ms(16)} color={colors.brand} />
      </View>
    </Pressable>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.surfaceSunken },
  tabsWrap: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  tabs: { flexDirection: 'row', backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: ms(3) },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ms(38),
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  tabOn: { backgroundColor: c.brand },

  skeleton: { paddingHorizontal: gutter, paddingTop: space.lg },
  content: { padding: gutter, flexGrow: 1 },

  card: {
    padding: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  cardPressed: { backgroundColor: c.surfaceRaised },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  shopLogo: { width: ms(38), height: ms(38) },
  cardTitles: { flex: 1, marginHorizontal: space.md },

  thumbRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg },
  thumb: { width: ms(40), height: ms(40), marginRight: space.xs },
  thumbMore: {
    width: ms(40),
    height: ms(40),
    borderRadius: radius.xs,
    backgroundColor: c.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbSpacer: { flex: 1 },
  amount: { alignItems: 'flex-end' },

  blurb: { marginTop: space.md },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center' },
  liveDot: {
    width: ms(7),
    height: ms(7),
    borderRadius: radius.pill,
    backgroundColor: c.brand,
    marginRight: space.xs,
  },}));
