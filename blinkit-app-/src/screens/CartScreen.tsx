import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useCart } from '../context/CartContext';
import type { TabScreenProps } from '../navigation/TabsContext';
import { useTabs } from '../navigation/TabsContext';
import type { AppNav } from '../navigation/types';
import { useHomeQuery } from '../store/catalogApi';
import { deliveryPointParams, useDeliveryPointKey } from '../store/deliveryPoint';
import { fetchCartQuote } from '../api/orders';
import { shortDelivery } from '../utils/delivery';
import { colors, currency, gutter, ms, radius, space, themed } from '../theme';
import { CartGroup, CartItem } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner, EmptyState } from '../ui/Feedback';
import { SmartImage } from '../ui/SmartImage';
import { Stepper } from '../ui/Stepper';
import { Pill } from '../ui/Surface';
import { CartPoints } from '../components/CartPoints';
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
  // Checkout stays grey until the cart-points rule is met.
  const pointsShort = !!cart.points?.enabled && !cart.points.met;
  const area = useDeliveryPointKey();
  const { data: home } = useHomeQuery(area);

  // 6-day aisles: the basket only takes the slow promise when EVERY item is from
  // one. Mixed with anything else, the customer's location decides the time.
  const cartItems = cart.groups.flatMap((g) => g.items);
  const allSlow = cartItems.length > 0 && cartItems.every((i) => (i.deliveryDays ?? 0) > 1);
  const slowDays = allSlow ? cartItems.reduce((max, i) => Math.max(max, i.deliveryDays ?? 0), 0) : 0;

  // The shopping minimum for this customer's distance (e.g. Rs 199 nearby, Rs 1199 far), the same
  // rule the website shows first. Without a priced quote the shops' own minimums stand in.
  const [minQuote, setMinQuote] = useState<{ subtotal: number; minOrder: number } | null>(null);
  useEffect(() => {
    if (!active || cart.itemCount === 0) return;
    let live = true;
    fetchCartQuote(deliveryPointParams())
      .then((q) => { if (live) setMinQuote({ subtotal: q.subtotal, minOrder: q.minOrder }); })
      .catch(() => { if (live) setMinQuote(null); });
    return () => { live = false; };
  }, [active, area, cart.subtotal, cart.itemCount]);
  const minMet = minQuote ? minQuote.subtotal >= minQuote.minOrder : cart.groups.every((g) => g.meetsMinOrder);
  const minShort = minQuote ? Math.max(0, Math.ceil(minQuote.minOrder - minQuote.subtotal)) : 0;

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
          <Ionicons name="flash" size={ms(17)} color={colors.brand} />
          <Txt variant="h3" tone="brand" numberOfLines={1}>
            Delivery in {slowDays ? `${slowDays} days` : shortDelivery(home)}
          </Txt>
        </View>

        {!minMet && minQuote ? (
          <Banner
            tone="warning"
            message={`Shop at least ${currency(minQuote.minOrder)} to check out - add ${currency(minShort)} more.`}
            style={styles.topBanner}
          />
        ) : null}

        {slowDays ? (
          <Banner
            tone="info"
            message={`Items in this order are delivered in ${slowDays} days.`}
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
          <Banner tone="success" message="Your order gets free delivery." style={styles.topBanner} />
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
          <Txt variant="overline" tone="muted" center style={styles.billTitle}>
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

          {pointsShort ? (
            <View style={styles.billWarn} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={ms(15)} color={colors.danger} />
              <Txt variant="labelSm" tone="danger" style={styles.savingsText}>
                Add any one product from the list below to continue to payment.
              </Txt>
            </View>
          ) : null}
        </View>

        {/* The cart-points rule (admin panel): a top-up product before checkout. */}
        <CartPoints ready={minMet} />

        <Pressable onPress={() => goToTab('home')} accessibilityRole="button" style={styles.keepShopping} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={ms(17)} color={colors.brand} />
          <Txt variant="label" tone="brand" style={styles.keepShoppingText}>
            Add more items
          </Txt>
        </Pressable>
      </ScrollView>

      {/* ------------------------------------------------ checkout bar -- */}
      {/* A plain View: the tab bar below already keeps clear of the phone's bottom edge, so a
          safe-area inset here only left an empty strip under the button. */}
      <View style={styles.bar}>
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
            label={cart.hasIssues ? 'Fix items to continue' : !minMet && minQuote ? `Add ${currency(minShort)} more to continue` : pointsShort ? 'Add 1 product above' : 'Proceed to checkout'}
            iconRight={cart.hasIssues || pointsShort || !minMet ? undefined : 'arrow-forward'}
            size="lg"
            disabled={cart.hasIssues || pointsShort || !minMet}
            onPress={() => navigation.navigate('Checkout')}
            style={styles.barBtn}
          />
        </View>
      </View>
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
            busy={false}
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
    marginHorizontal: gutter,
    marginBottom: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
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

  billWarn: { flexDirection: 'row', alignItems: 'center', gap: ms(6), marginTop: space.sm, padding: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: c.danger, backgroundColor: c.dangerSurface },
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
  barBtn: { flex: 1 },}));
