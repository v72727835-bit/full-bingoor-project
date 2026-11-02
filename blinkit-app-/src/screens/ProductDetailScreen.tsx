import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchReviews, submitReview } from '../api/catalog';
import { getErrorMessage } from '../api/client';
import { NotifyMeSheet } from '../components/NotifyMeSheet';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useTabs } from '../navigation/TabsContext';
import type { AppNav, AppRoute } from '../navigation/types';
import { colors, currency, gutter, hitSlop, ms, radius, space, themed } from '../theme';
import { useProductQuery } from '../store/catalogApi';
import { ReviewPage } from '../types';
import { Button } from '../ui/Button';
import { Banner, EmptyState, FullScreenLoader } from '../ui/Feedback';
import { Stars } from '../ui/Rating';
import { Sheet } from '../ui/Sheet';
import { SmartImage } from '../ui/SmartImage';
import { Stepper } from '../ui/Stepper';
import { Divider, Pill, SectionHeader } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { TextField } from '../ui/TextField';
import { useToast } from '../ui/Toast';
import { shareLink } from '../utils/share';
import { timeAgo } from '../utils/validation';
import { useRailCardWidth } from '../utils/layout';

export function ProductDetailScreen() {
  const navigation = useNavigation<AppNav>();
  const { params } = useRoute<AppRoute<'ProductDetail'>>();
  const { width } = useWindowDimensions();
  const railWidth = useRailCardWidth(0.42, 180);
  const toast = useToast();
  const { goToTab } = useTabs();

  const { quantityOf, add, setQuantity, remove, pending, cart } = useCart();
  const { isSaved, toggle } = useWishlist();

  const [reviews, setReviews] = useState<ReviewPage | null>(null);
  const [slide, setSlide] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => void (mounted.current = false), []);

  // The product comes from the Redux cache, so opening it again (or from a
  // second rail) is instant; reviews load alongside once we know its id.
  const { data, error: queryError, refetch } = useProductQuery(params.id);
  const product = data ?? null;
  const error = typeof queryError === 'string' ? queryError : queryError ? 'Something went wrong' : null;
  const load = useCallback(() => void refetch(), [refetch]);

  const productId = product?._id;
  useEffect(() => {
    if (!productId) return;
    fetchReviews(productId)
      .then((page) => mounted.current && setReviews(page))
      .catch(() => undefined);
  }, [productId]);

  const sendReview = async () => {
    if (!product) return;
    setSavingReview(true);
    try {
      await submitReview(product._id, myRating, myComment.trim() || undefined);
      toast.success('Thanks for the review');
      setReviewOpen(false);
      setMyComment('');
      const page = await fetchReviews(product._id).catch(() => null);
      if (page && mounted.current) setReviews(page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      if (mounted.current) setSavingReview(false);
    }
  };

  if (error && !product) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <FloatingBack onPress={() => navigation.goBack()} />
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title="Could not load this product"
          message={error}
          actionLabel="Try again"
          onAction={() => load()}
        />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <FloatingBack onPress={() => navigation.goBack()} />
        <FullScreenLoader label={params.name ?? 'Loading product…'} />
      </SafeAreaView>
    );
  }

  const qty = quantityOf(product._id);
  const busy = pending.has(product._id);
  const saved = isSaved(product._id);
  const soldOut = !product.inStock;
  const savings = product.mrp - product.price;
  const images = product.images?.length ? product.images : [''];
  const lowStock = product.inStock && product.stock <= 5;

  const onScrollImages = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setSlide(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------------------------- gallery -- */}
        <View style={[styles.gallery, { height: width * 0.92 }]}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollImages}
          >
            {images.map((uri, i) => (
              <Pressable
                key={`${uri}-${i}`}
                onPress={() => uri && setZoom(true)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`${product.name}, tap to zoom`}
              >
                <SmartImage full uri={uri} icon={product.icon} artScale={0.62} style={{ width, height: width * 0.92 }} />
              </Pressable>
            ))}
          </ScrollView>

          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === slide && styles.dotOn]} />
              ))}
            </View>
          ) : null}

          {product.discountPercent > 0 ? (
            <Pill label={`${product.discountPercent}% OFF`} tone="accent" solid style={styles.galleryBadge} />
          ) : null}

          {images[0] ? (
            <View style={styles.zoomHint}>
              <Ionicons name="search" size={ms(16)} color={colors.inkMuted} />
            </View>
          ) : null}
        </View>

        {/* ---------------------------------------------- main block -- */}
        <View style={styles.block}>
          {product.brand ? (
            <Txt variant="overline" tone="brand" center style={styles.brand}>
              {product.brand}
            </Txt>
          ) : null}

          <Txt variant="h1" center style={styles.name}>
            {product.name}
          </Txt>

          <View style={styles.metaRow}>
            <Txt variant="body" tone="muted">
              {product.unit}
            </Txt>
            {product.ratingCount > 0 ? (
              <>
                <View style={styles.metaDot} />
                <Stars value={product.rating} size={14} />
                <Txt variant="bodySm" tone="muted" style={styles.ratingText}>
                  {product.rating.toFixed(1)} ({product.ratingCount})
                </Txt>
              </>
            ) : null}
            {product.ratingLabel ? <Pill label={product.ratingLabel} /> : null}
          </View>

          <View style={styles.priceRow}>
            <Txt variant="display">{currency(product.price)}</Txt>
            {savings > 0 ? (
              <>
                <Txt variant="bodyLg" tone="faint" style={styles.mrp}>
                  {currency(product.mrp)}
                </Txt>
                <Pill label={`Save ${currency(savings)}`} tone="success" style={styles.savePill} />
              </>
            ) : null}
          </View>

          <Txt variant="caption" tone="faint" center style={styles.taxNote}>
            Inclusive of all taxes
          </Txt>

          {soldOut ? (
            <Banner tone="danger" message="This product is out of stock right now. Ask us to message you the moment it is back." style={styles.stockBanner} />
          ) : lowStock ? (
            <Banner tone="warning" message={`Hurry, only ${product.stock} left at this shop.`} style={styles.stockBanner} />
          ) : null}
        </View>

        {product.variants?.length ? (
          <>
            <Divider />
            <View style={styles.block}>
              <Txt variant="overline" tone="muted" center style={styles.blockTitle}>
                Select size
              </Txt>
              <View style={styles.variantRow}>
                {product.variants.map((v) => {
                  const on = v.slug === product.slug;
                  // The saving is the whole reason a bigger pack exists, so the
                  // chip carries it rather than leaving the customer to compare.
                  const off = v.mrp && v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
                  return (
                    <Pressable
                      key={v._id}
                      onPress={() => !on && navigation.push('ProductDetail', { id: v.slug, name: v.label })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={
                        `${v.label}, ${currency(v.price)}` +
                        (off ? `, ${off} percent off` : '') +
                        (v.inStock ? '' : ', out of stock')
                      }
                      style={[styles.variant, on && styles.variantOn, !v.inStock && styles.variantOut]}
                    >
                      {off > 0 ? (
                        <View style={styles.variantOffTag}>
                          <Txt variant="caption" style={styles.variantOffText}>
                            {off}% OFF
                          </Txt>
                        </View>
                      ) : null}
                      <Txt variant="label" numberOfLines={1}>
                        {v.label}
                      </Txt>
                      <View style={styles.variantPrices}>
                        <Txt variant="labelSm" tone="brand">
                          {currency(v.price)}
                        </Txt>
                        {off > 0 ? (
                          <Txt variant="caption" tone="faint" style={styles.variantMrp}>
                            {currency(v.mrp as number)}
                          </Txt>
                        ) : null}
                      </View>
                      {!v.inStock ? (
                        <Txt variant="caption" style={styles.variantOutText}>
                          Out of stock
                        </Txt>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        <Divider />

        {/* --------------------------------------------------- shop -- */}
        {product.shop ? (
          <Pressable
            onPress={() => navigation.navigate('ShopDetail', { id: product.shop!._id, name: product.shop!.name })}
            accessibilityRole="button"
            accessibilityLabel={`View shop ${product.shop.name}`}
            style={({ pressed }) => [styles.shopRow, pressed && styles.pressed]}
          >
            <SmartImage uri={product.shop.logo} icon="shopping-cart" style={styles.shopLogo} radius={radius.md} />
            <View style={styles.shopBody}>
              <Txt variant="caption" tone="muted">
                Sold by
              </Txt>
              <Txt variant="h4" numberOfLines={1}>
                {product.shop.name}
              </Txt>
              <Txt variant="caption" tone="faint" numberOfLines={1} style={styles.shopMeta}>
                {product.shop.isOpen ? 'Open now' : 'Currently closed'}
                {'  ·  '}
                {product.shop.deliveryFee === 0 ? 'Free delivery' : `${currency(product.shop.deliveryFee)} delivery`}
                {product.shop.minOrderAmount ? `  ·  Min ${currency(product.shop.minOrderAmount)}` : ''}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={ms(19)} color={colors.inkFaint} />
          </Pressable>
        ) : null}

        <Divider />

        {/* ------------------------------------------------ promises -- */}
        <View style={styles.promises}>
          {[
            { icon: 'shield-checkmark-outline' as const, title: 'Fulfilled by', body: 'Bingoor' },
            product.codAvailable === false
              ? { icon: 'card-outline' as const, title: 'Online payment only', body: 'No cash on delivery' }
              : product.onlineAvailable === false
                ? { icon: 'cash-outline' as const, title: 'COD only', body: 'Pay when it arrives' }
                : { icon: 'cash-outline' as const, title: 'COD & online', body: 'Pay as you like' },
            product.shop && product.shop.deliveryFee > 0
              ? { icon: 'bicycle-outline' as const, title: `${currency(product.shop.deliveryFee)} delivery`, body: 'From this shop' }
              : { icon: 'bicycle-outline' as const, title: 'Free delivery', body: 'From this shop' },
            product.deliveryDays && product.deliveryDays > 1
              ? { icon: 'calendar-outline' as const, title: `${product.deliveryDays} day delivery`, body: 'For this aisle' }
              : { icon: 'flash-outline' as const, title: 'Same-day delivery', body: 'Ordered before 6 pm' },
          ].map((p) => (
            <View key={p.title} style={styles.promise}>
              <View style={styles.promiseIcon}>
                <Ionicons name={p.icon} size={ms(18)} color={colors.brand} />
              </View>
              <Txt variant="caption" weight="700" center numberOfLines={2} style={styles.promiseTitle}>
                {p.title}
              </Txt>
              <Txt variant="caption" tone="faint" center numberOfLines={2}>
                {p.body}
              </Txt>
            </View>
          ))}
        </View>

        {/* --------------------------------------------- description -- */}
        {product.description ? (
          <>
            <Divider />
            <View style={styles.block}>
              <Txt variant="h3" center style={styles.blockTitle}>
                About this product
              </Txt>
              <Txt variant="body" tone="body" center>
                {product.description}
              </Txt>
              {product.category && typeof product.category === 'object' ? (
                <Pressable
                  onPress={() =>
                    navigation.navigate('ProductList', {
                      title: (product.category as { name: string }).name,
                      category: (product.category as { slug: string }).slug,
                    })
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  style={styles.categoryLink}
                >
                  <Ionicons name="pricetag-outline" size={ms(14)} color={colors.brand} />
                  <Txt variant="label" tone="brand" style={styles.categoryLinkText}>
                    More in {product.category.name}
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {/* ------------------------------------------------- reviews -- */}
        <Divider />
        <View style={styles.block}>
          <View style={styles.reviewHead}>
            <View style={styles.flex}>
              <Txt variant="h3" center>
                Ratings and reviews
              </Txt>
              <Txt variant="bodySm" tone="muted" center style={styles.blockSub}>
                {product.ratingCount > 0
                  ? `${product.rating.toFixed(1)} out of 5 from ${product.ratingCount} ${
                      product.ratingCount === 1 ? 'customer' : 'customers'
                    }`
                  : 'No reviews yet. Be the first to write one.'}
              </Txt>
            </View>
          </View>

          {reviews?.reviews?.length ? (
            <View style={styles.reviewList}>
              {reviews.reviews.slice(0, 3).map((r) => (
                <View key={r._id} style={styles.review}>
                  <View style={styles.reviewTop}>
                    <View style={styles.avatar}>
                      <Txt variant="labelSm" tone="brand">
                        {(r.user?.name ?? 'A').charAt(0).toUpperCase()}
                      </Txt>
                    </View>
                    <View style={styles.flex}>
                      <Txt variant="label" numberOfLines={1}>
                        {r.user?.name ?? 'Bingoor customer'}
                      </Txt>
                      <View style={styles.reviewMeta}>
                        <Stars value={r.rating} size={12} />
                        <Txt variant="caption" tone="faint" style={styles.reviewDate}>
                          {timeAgo(r.createdAt)}
                        </Txt>
                      </View>
                    </View>
                  </View>
                  {r.comment ? (
                    <Txt variant="body" tone="body" style={styles.reviewText}>
                      {r.comment}
                    </Txt>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <Button
            label={reviews?.reviews?.length ? 'Write your review' : 'Be the first to review'}
            variant="secondary"
            icon="create-outline"
            onPress={() => setReviewOpen(true)}
            style={styles.reviewBtn}
          />
          <Txt variant="caption" tone="faint" center style={styles.reviewNote}>
            You can review a product once it has been delivered to you.
          </Txt>
        </View>

        {/* ------------------------------------------------- related -- */}
        {product.related?.length ? (
          <View style={styles.relatedSection}>
            <SectionHeader title="You might also like" subtitle="Similar items from nearby shops" />
            <FlatList
              horizontal
              data={product.related}
              keyExtractor={(p) => p._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedRail}
              ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  width={railWidth}
                  onPress={() => navigation.push('ProductDetail', { id: item._id, name: item.name })}
                />
              )}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* --------------------------------------------- floating nav -- */}
      <SafeAreaView edges={['top']} style={styles.floatBar} pointerEvents="box-none">
        <FloatingBack onPress={() => navigation.goBack()} />
        <View style={styles.flex} />
        <Pressable
          onPress={() => void shareLink(product.name, `/products/${product.slug}`)}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={`Share ${product.name}`}
          style={styles.floatBtn}
        >
          <Ionicons name="share-social-outline" size={ms(20)} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={() => toggle(product)}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
          style={styles.floatBtn}
        >
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={ms(21)} color={saved ? colors.accent : colors.ink} />
        </Pressable>
      </SafeAreaView>

      {/* ------------------------------------------------ buy bar -- */}
      <SafeAreaView edges={['bottom']} style={styles.buyBar}>
        <View style={styles.buyInner}>
          <View style={styles.buyPrice}>
            <Txt variant="caption" tone="muted">
              {qty > 0 ? `${qty} in cart` : 'Total'}
            </Txt>
            <Txt variant="h2" numberOfLines={1}>
              {currency(product.price * Math.max(qty, 1))}
            </Txt>
          </View>

          {soldOut ? (
            <Button
              label="Notify me"
              variant="secondary"
              block={false}
              style={styles.buyBtn}
              onPress={() => setNotifyOpen(true)}
            />
          ) : qty > 0 ? (
            <View style={styles.buyActions}>
              <Stepper
                value={qty}
                max={Math.min(20, product.stock)}
                busy={busy}
                onChange={(next) => setQuantity(product._id, next)}
                onRemove={() => remove(product._id)}
              />
              <Button
                label={`Cart (${cart.itemCount})`}
                icon="cart-outline"
                block={false}
                onPress={() => {
                  navigation.navigate('MainTabs');
                  goToTab('cart');
                }}
                style={styles.cartBtn}
              />
            </View>
          ) : (
            <Button
              label="Add to cart"
              icon="cart-outline"
              size="lg"
              block={false}
              loading={busy}
              onPress={() => add(product._id, 1, product.name)}
              style={styles.buyBtn}
            />
          )}
        </View>
      </SafeAreaView>

      {/* --------------------------------------------- photo zoom -- */}
      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={styles.zoomScrim} onPress={() => setZoom(false)}>
          <Image
            source={{ uri: images[slide] || images[0] }}
            style={styles.zoomArt}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.zoomClose}>
            <Ionicons name="close" size={ms(24)} color="#FFFFFF" />
          </View>
        </Pressable>
      </Modal>

      <NotifyMeSheet
        visible={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        productId={product._id}
        productName={product.name}
      />

      {/* ------------------------------------------- review sheet -- */}
      <Sheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={`Rate ${product.name}`}
        footer={
          <Button
            label="Submit review"
            loading={savingReview}
            disabled={myRating < 1}
            onPress={sendReview}
            style={styles.sheetBtn}
          />
        }
      >
        <Txt variant="body" tone="muted" style={styles.sheetIntro}>
          Your rating helps other shoppers in your area decide.
        </Txt>
        <View style={styles.sheetStars}>
          <Stars value={myRating} size={32} onChange={setMyRating} />
        </View>
        <TextField
          label="Tell others what you think (optional)"
          placeholder="Fresh, well packed, arrived on time…"
          multiline
          numberOfLines={4}
          maxLength={1000}
          value={myComment}
          onChangeText={setMyComment}
          hint={`${myComment.length}/1000`}
        />
      </Sheet>
    </View>
  );
}

function FloatingBack({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Go back" style={styles.floatBtn}>
      <Ionicons name="chevron-back" size={ms(23)} color={colors.ink} />
    </Pressable>
  );
}

const styles = themed(({ c, elevation }) => ({
  root: { flex: 1, backgroundColor: c.surface },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: ms(110) },

  gallery: { width: '100%', backgroundColor: c.surfaceSunken },
  dots: { position: 'absolute', bottom: space.lg, alignSelf: 'center', flexDirection: 'row' },
  dot: {
    width: ms(6),
    height: ms(6),
    borderRadius: radius.pill,
    backgroundColor: c.borderStrong,
    marginHorizontal: ms(3),
  },
  dotOn: { backgroundColor: c.brand, width: ms(18) },
  galleryBadge: { position: 'absolute', top: ms(76), left: gutter },

  block: { paddingHorizontal: gutter, paddingVertical: space.xl },
  blockTitle: { marginBottom: space.sm },
  blockSub: { marginTop: ms(2) },
  brand: { marginBottom: space.xs },
  name: { marginBottom: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.inkFaint, marginHorizontal: space.sm },
  ratingText: { marginLeft: space.xs },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: space.lg },
  mrp: { textDecorationLine: 'line-through', marginLeft: space.md },
  savePill: { marginLeft: space.md },
  taxNote: { marginTop: space.xxs },
  stockBanner: { marginTop: space.lg },

  shopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, paddingVertical: space.lg },
  pressed: { backgroundColor: c.surfaceSunken },
  shopLogo: { width: ms(48), height: ms(48) },
  shopBody: { flex: 1, marginHorizontal: space.md },
  shopMeta: { marginTop: ms(2) },

  promises: { flexDirection: 'row', paddingHorizontal: gutter, paddingVertical: space.xl },
  promise: { flex: 1, alignItems: 'center', paddingHorizontal: space.xs },
  promiseIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: radius.pill,
    backgroundColor: c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  promiseTitle: { marginBottom: ms(1) },

  categoryLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: space.lg },
  categoryLinkText: { marginLeft: space.xs },

  reviewHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg },
  reviewList: { marginBottom: space.md },
  review: {
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: ms(34),
    height: ms(34),
    borderRadius: radius.pill,
    backgroundColor: c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', marginTop: ms(2) },
  reviewDate: { marginLeft: space.sm },
  reviewText: { marginTop: space.sm },
  reviewBtn: { marginTop: space.sm },
  reviewNote: { marginTop: space.sm },

  relatedSection: { paddingVertical: space.xl, backgroundColor: c.surfaceSunken },
  relatedRail: { paddingHorizontal: gutter, paddingVertical: space.xxs },

  floatBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter,
  },
  floatBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
    ...elevation.sm,
  },

  buyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    ...elevation.lg,
  },
  buyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  buyPrice: { flexShrink: 1, marginRight: space.md },
  buyBtn: { flex: 1 },
  buyActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  cartBtn: { marginLeft: space.sm, flex: 1 },

  sheetIntro: { marginBottom: space.lg },
  sheetStars: { alignItems: 'center', marginBottom: space.xl },
  sheetBtn: { marginBottom: space.sm },

  /* The magnifier only hints at the zoom; the photo itself is the target. */
  zoomHint: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    width: ms(34),
    height: ms(34),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  zoomScrim: { flex: 1, backgroundColor: 'rgba(12,6,10,0.9)', alignItems: 'center', justifyContent: 'center' },
  zoomArt: { width: '94%', height: '80%' },
  zoomClose: { position: 'absolute', top: ms(44), right: gutter },

  /* Each size is its own product, so a size is a link, not a toggle. */
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  variant: {
    minWidth: ms(86),
    gap: ms(2),
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  variantOn: { borderColor: c.brand, backgroundColor: c.brandSurface },
  variantOut: { opacity: 0.55 },
  /* Kept inside the chip rather than overhanging its top edge: Android clips
     a child drawn outside its parent, so an overhanging badge would vanish
     there while looking right on iOS. */
  variantOffTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: ms(6),
    paddingVertical: ms(1),
    borderRadius: radius.pill,
    backgroundColor: c.success,
    marginBottom: ms(3),
  },
  variantOffText: { color: '#FFFFFF', fontSize: ms(9.5), fontWeight: '800' },
  variantPrices: { flexDirection: 'row', alignItems: 'baseline', gap: ms(5) },
  variantMrp: { textDecorationLine: 'line-through' },
  variantOutText: { color: c.danger, fontWeight: '700', fontSize: ms(9.5) },}));
