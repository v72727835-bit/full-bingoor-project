import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPointQuote } from '../api/cart';
import { CartPoints } from '../components/CartPoints';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import type { TabScreenProps } from '../navigation/TabsContext';
import { useTabs } from '../navigation/TabsContext';
import type { AppNav } from '../navigation/types';
import { useHomeQuery } from '../store/catalogApi';
import { deliveryPointParams, useDeliveryPointKey } from '../store/deliveryPoint';
import { shortDelivery } from '../utils/delivery';
import { colors, currency, gutter, ms, radius, space, themed } from '../theme';
import { CartGroup, CartItem } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner, EmptyState } from '../ui/Feedback';
import { SmartImage } from '../ui/SmartImage';
import { Stepper } from '../ui/Stepper';
import { Pill } from '../ui/Surface';
import { Txt } from '../ui/Text';

const ISSUE_TEXT: Record<string, string> = {
  unavailable: 'No longer available',
  out_of_stock: 'Out of stock',
  insufficient_stock: 'Not enough stock left',
};

export function CartScreen({ active }: TabScreenProps) {
  const navigation = useNavigation<AppNav>();
  const { goToTab } = useTabs();
  const { cart, loading, refresh, setQuantity, remove, clear, pending } = useCart();
  const area = useDeliveryPointKey();
  const { data: home } = useHomeQuery(area);
  const { user } = useAuth();

  // #28: the delivery time at the top follows the distance to the customer
  // (up to 15 km same day, then next day, beyond 30 km a few working days).
  const [farDays, setFarDays] = useState(0);
  // Point 15: whether the basket meets the shopping minimum for this distance
  // (null = not priced; the shops' own minimums decide then).
  const [quoteMinMet, setQuoteMinMet] = useState<boolean | null>(null);
  useEffect(() => {
    const point = deliveryPointParams();
    if (!user || !point || cart.itemCount === 0) {
      setFarDays(0);
      setQuoteMinMet(null);
      return;
    }
    let live = true;
    fetchPointQuote(point)
      .then((q) => {
        if (!live) return;
        setFarDays(q.days);
        // The basket as a whole is what counts (a top-up from another warehouse must not flip it).
        setQuoteMinMet(typeof q.minOrder === 'number' ? q.subtotal >= q.minOrder : typeof q.meetsMinOrder === 'boolean' ? q.meetsMinOrder : null);
      })
      .catch(() => {
        if (!live) return;
        setFarDays(0);
        setQuoteMinMet(null);
      });
    return () => {
      live = false;
    };
  }, [user, area, cart.itemCount, cart.subtotal]);
  const minMet = quoteMinMet ?? cart.groups.every((g) => g.meetsMinOrder);
  const etaText = farDays > 0 ? (farDays === 1 ? 'Next day delivery' : `${farDays} working days`) : shortDelivery(home);

  // The slowest promise in the basket - the whole order lands on that day.
  const slowDays = cart.groups
    .flatMap((g) => g.items)
    .reduce((max, i) => Math.max(max, i.deliveryDays ?? 0), 0);

  // #35: checkout stays grey until the hidden points rule is met.
  const pointsShort = !!cart.points?.enabled && !cart.points.met;

  // Prices and stock move while the user is elsewhere, so re-check on entry.
  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  const confirmClear = () =>
    Alert.alert('Empty your cart?', 'This removes every item from all shops in your cart.', [
      { text: 'Keep items', style: 'cancel' },
      { text: 'Empty cart', style: 'destructive', onPress: () => void clear() },
    ]);

  if (cart.itemCount === 0) {
    return (
      <View style={styles.root}>
        <AppHeader title="Your cart" showBack={false} />
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          message="Browse your nearby shops and add a few things. Items from different shops are delivered as separate orders."
          actionLabel="Start shopping"
          onAction={() => goToTab('home')}
        />
      </View>
    );
  }

  const awayFromFree = cart.freeDeliveryAbove - cart.subtotal;
  const savings = cart.groups.reduce(
    (sum, g) => sum + g.items.reduce((s, i) => s + Math.max(0, i.mrp - i.price) * i.quantity, 0),
    0,
  );

  return (
    <View style={styles.root}>
      <AppHeader
        title="Your cart"
        subtitle={`${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'} from ${cart.groups.length} ${
          cart.groups.length === 1 ? 'shop' : 'shops'
        }`}
        showBack={false}
        actions={[{ icon: 'trash-outline', label: 'Empty cart', onPress: confirmClear }]}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={[colors.brand]} />}
      >
        {/* The delivery promise is what a customer checks before paying, so it
            leads the page, centred and large rather than tucked in a subtitle. */}
        <View style={styles.eta}>
          <Ionicons name="flash" size={ms(20)} color={colors.brand} />
          <Txt variant="h2" numberOfLines={1}>
            Delivery time: {etaText}
          </Txt>
        </View>

        {slowDays ? (
          <Banner
            tone="info"
            message={`Some items in this order are delivered in ${slowDays} days.`}
            style={styles.topBanner}
          />
        ) : null}

        {cart.hasIssues ? (
          <Banner
            tone="warning"
            message="Some items need attention before you can check out. Check the notes below."
            style={styles.topBanner}
          />
        ) : awayFromFree > 0 ? (
          <Banner tone="info" message={`Add ${currency(awayFromFree)} more to get free delivery.`} style={styles.topBanner} />
        ) : (
          <Banner tone="success" message="Nice - your order qualifies for free delivery." style={styles.topBanner} />
        )}

        {cart.groups.map((group) => (
          <ShopGroup
            key={group.shop.id}
            group={group}
            pending={pending}
            onOpenShop={() => navigation.navigate('ShopDetail', { id: group.shop.id, name: group.shop.name })}
            onOpenProduct={(item) => navigation.navigate('ProductDetail', { id: item.productId, name: item.name })}
            onChange={setQuantity}
            onRemove={remove}
          />
        ))}

        {/* ------------------------------------------------ bill ------- */}
        <View style={styles.bill}>
          <Txt variant="h3" style={styles.billTitle}>
            Bill summary
          </Txt>

          <BillRow label={`Item total (${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'})`} value={currency(cart.subtotal)} />
          <BillRow
            label="Delivery fee"
            value={cart.deliveryFee === 0 ? 'FREE' : currency(cart.deliveryFee)}
            highlight={cart.deliveryFee === 0}
          />
          {savings > 0 ? <BillRow label="Discount on MRP" value={`- ${currency(savings)}`} highlight /> : null}

          <View style={styles.billDivider} />
          <View style={styles.billRow}>
            <Txt variant="h3">To pay</Txt>
            <Txt variant="h2">{currency(cart.total)}</Txt>
          </View>

          {savings > 0 ? (
            <View style={styles.savingsStrip}>
              <Ionicons name="pricetags-outline" size={ms(15)} color={colors.success} />
              <Txt variant="labelSm" tone="success" style={styles.savingsText}>
                You are saving {currency(savings)} on this order
              </Txt>
            </View>
          ) : null}
        </View>

        <CartPoints ready={minMet} />

        <Pressable onPress={() => goToTab('home')} accessibilityRole="button" style={styles.keepShopping} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={ms(17)} color={colors.brand} />
          <Txt variant="label" tone="brand" style={styles.keepShoppingText}>
            Add more items
          </Txt>
        </Pressable>
      </ScrollView>

      {/* ------------------------------------------------ checkout bar -- */}
      <SafeAreaView edges={['bottom']} style={styles.bar}>
        <View style={styles.barInner}>
          <View style={styles.barPrice}>
            <Txt variant="caption" tone="muted">
              Total
            </Txt>
            <Txt variant="h2" numberOfLines={1}>
              {currency(cart.total)}
            </Txt>
          </View>
          <Button
            label={cart.hasIssues ? 'Fix items to continue' : pointsShort ? 'Add 1 product above' : 'Proceed to checkout'}
            iconRight={cart.hasIssues || pointsShort ? undefined : 'arrow-forward'}
            size="lg"
            block={false}
            disabled={cart.hasIssues || pointsShort}
            onPress={() => navigation.navigate('Checkout')}
            style={styles.barBtn}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ------------------------------------------------------------ sub-views -- */

function ShopGroup({
  group,
  pending,
  onOpenShop,
  onOpenProduct,
  onChange,
  onRemove,
}: {
  group: CartGroup;
  pending: Set<string>;
  onOpenShop: () => void;
  onOpenProduct: (item: CartItem) => void;
  onChange: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
}) {
  const shortfall = group.shop.minOrderAmount - group.subtotal;

  return (
    <View style={styles.group}>
      <Pressable onPress={onOpenShop} accessibilityRole="button" style={styles.groupHeader}>
        <SmartImage uri={group.shop.logo} icon="shopping-cart" style={styles.groupLogo} radius={radius.sm} />
        <View style={styles.groupTitles}>
          <Txt variant="h4" numberOfLines={1}>
            {group.shop.name}
          </Txt>
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
            {'  ·  '}
            {group.deliveryFee === 0 ? 'Free delivery' : `${currency(group.deliveryFee)} delivery`}
          </Txt>
        </View>
        {!group.shop.isOpen ? <Pill label="Closed" tone="danger" /> : null}
        <Ionicons name="chevron-forward" size={ms(17)} color={colors.inkFaint} style={styles.groupChevron} />
      </Pressable>

      {!group.shop.isOpen ? (
        <Banner tone="danger" message="This shop is closed right now. You can order once it reopens." style={styles.groupBanner} />
      ) : !group.meetsMinOrder ? (
        <Banner
          tone="warning"
          message={`Add ${currency(shortfall)} more from this shop to reach its ${currency(
            group.shop.minOrderAmount,
          )} minimum.`}
          style={styles.groupBanner}
        />
      ) : null}

      {group.items.map((item, index) => (
        <View key={item.productId}>
          {index > 0 ? <View style={styles.itemDivider} /> : null}
          <CartLine
            item={item}
            busy={pending.has(item.productId)}
            onPress={() => onOpenProduct(item)}
            onChange={(q) => onChange(item.productId, q)}
            onRemove={() => onRemove(item.productId)}
          />
        </View>
      ))}

      <View style={styles.groupFooter}>
        <Txt variant="bodySm" tone="muted">
          Shop subtotal
        </Txt>
        <Txt variant="h4">{currency(group.total)}</Txt>
      </View>
    </View>
  );
}

function CartLine({
  item,
  busy,
  onPress,
  onChange,
  onRemove,
}: {
  item: CartItem;
  busy: boolean;
  onPress: () => void;
  onChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const issue = item.issue ? ISSUE_TEXT[item.issue] ?? 'Unavailable' : null;

  return (
    <View style={styles.line}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={item.name}>
        <SmartImage uri={item.image} icon={item.icon} style={styles.lineImage} radius={radius.sm} />
      </Pressable>

      <View style={styles.lineBody}>
        <Pressable onPress={onPress} accessibilityRole="button">
          <Txt variant="body" weight="600" numberOfLines={2}>
            {item.name}
          </Txt>
        </Pressable>
        <Txt variant="caption" tone="faint" style={styles.lineUnit}>
          {item.unit}
        </Txt>

        {issue ? (
          <View style={styles.issueRow}>
            <Ionicons name="alert-circle-outline" size={ms(13)} color={colors.danger} />
            <Txt variant="caption" tone="danger" style={styles.issueText}>
              {issue}
              {item.issue === 'insufficient_stock' ? ` · only ${item.stock} left` : ''}
            </Txt>
          </View>
        ) : null}

        <View style={styles.lineFooter}>
          <View style={styles.linePrices}>
            <Txt variant="priceSm">{currency(item.lineTotal)}</Txt>
            {item.mrp > item.price ? (
              <Txt variant="caption" tone="faint" style={styles.lineMrp}>
                {currency(item.mrp * item.quantity)}
              </Txt>
            ) : null}
          </View>

          <Stepper
            value={item.quantity}
            size="sm"
            max={Math.max(1, Math.min(20, item.stock))}
            busy={busy}
            onChange={onChange}
            onRemove={onRemove}
          />
        </View>
      </View>
    </View>
  );
}

function BillRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Txt variant="body" tone="muted" style={styles.billLabel} numberOfLines={2}>
        {label}
      </Txt>
      <Txt variant="label" tone={highlight ? 'success' : 'ink'}>
        {value}
      </Txt>
    </View>
  );
}

const styles = themed(({ c, elevation }) => ({
  root: { flex: 1, backgroundColor: c.surfaceSunken },
  content: { paddingBottom: ms(110), paddingTop: space.md },
  eta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginBottom: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.brandBorder,
    backgroundColor: c.brandSurface,
  },
  topBanner: { marginHorizontal: gutter, marginBottom: space.lg },

  group: {
    marginHorizontal: gutter,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    backgroundColor: c.surfaceRaised,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  groupLogo: { width: ms(36), height: ms(36) },
  groupTitles: { flex: 1, marginHorizontal: space.md },
  groupChevron: { marginLeft: space.xs },
  groupBanner: { margin: space.md, marginBottom: 0 },

  line: { flexDirection: 'row', padding: space.md },
  lineImage: { width: ms(64), height: ms(64) },
  lineBody: { flex: 1, marginLeft: space.md },
  lineUnit: { marginTop: ms(1) },
  issueRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs },
  issueText: { flex: 1, marginLeft: space.xxs },
  lineFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm },
  linePrices: { flexShrink: 1, marginRight: space.sm },
  lineMrp: { textDecorationLine: 'line-through', marginTop: ms(1) },
  itemDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: ms(88) },

  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    backgroundColor: c.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },

  bill: {
    marginHorizontal: gutter,
    marginTop: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  billTitle: { marginBottom: space.md },
  billRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.xs },
  billLabel: { flex: 1, marginRight: space.md },
  billDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginVertical: space.md,
  },
  savingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: c.successSurface,
  },
  savingsText: { flex: 1, marginLeft: space.xs },

  keepShopping: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: space.xl },
  keepShoppingText: { marginLeft: space.xs },

  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    ...elevation.lg,
  },
  barInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, paddingVertical: space.md },
  barPrice: { flexShrink: 1, marginRight: space.md },
  barBtn: { flexShrink: 1, paddingHorizontal: space.lg },}));
