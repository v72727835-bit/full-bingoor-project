import Icon from '@react-native-vector-icons/ionicons/static';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, glowShadow, gradient, gutter, ms, radius, space, themed, useTheme } from '../theme';
import type { Banner, Category, HomeSection, ProductSummary, ShopSummary } from '../types';
import { Illustration } from '../ui/Illustration';
import { SmartImage } from '../ui/SmartImage';
import { Txt } from '../ui/Text';
import { CategoryCircle, CategoryTile } from './CategoryTile';
import { ProductCard } from './ProductCard';

export interface SectionHandlers {
  onProduct: (p: ProductSummary) => void;
  onCategory: (c: Category) => void;
  onShop: (s: ShopSummary) => void;
  onSeeAll: (slug: string, title: string) => void;
  onBanner: (b: Banner) => void;
  deliveryText: string;
}

/* --------------------------------------------------------------- heading -- */

function Heading({
  title,
  subtitle,
  art,
  onDark,
  actionLabel,
  onAction,
  right,
}: {
  title?: string;
  subtitle?: string;
  art?: string;
  onDark?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  right?: React.ReactNode;
}) {
  if (!title) return null;
  return (
    <View style={styles.heading}>
      <View style={styles.headingText}>
        <View style={styles.headingTitleRow}>
          <Txt variant="h2" tone={onDark ? 'onHeader' : 'ink'} numberOfLines={2} style={styles.headingTitle}>
            {title}
          </Txt>
          {art ? <Illustration name={art} size={26} /> : null}
        </View>
        {subtitle ? (
          <Txt
            variant="bodySm"
            numberOfLines={2}
            style={[styles.headingSub, { color: onDark ? colors.onHeaderMuted : colors.inkMuted }]}
          >
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.seeAll, pressed && { opacity: 0.7 }]}
        >
          <Txt variant="labelSm" tone="brand">
            {actionLabel}
          </Txt>
          <Icon name="chevron-forward" size={ms(13)} color={colors.brandText} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------- countdown ---- */

/** Live "ends in" clock to local midnight, when the day's deals roll over. */
function MidnightCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const left = Math.max(0, Math.floor((end.getTime() - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const text = `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return (
    <View style={styles.clock} accessibilityLabel={`Deals end in ${text}`}>
      <Icon name="time" size={ms(12)} color={colors.onPriceMark} />
      <Txt variant="labelSm" style={styles.clockText}>
        {text}
      </Txt>
    </View>
  );
}

/* ------------------------------------------------------------- banners --- */

function BannerCarousel({ items: all, onPress }: { items: Banner[]; onPress: (b: Banner) => void }) {
  // An uploaded banner whose image fails to load is dropped, not shown as an empty card.
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const items = all.filter((b) => !broken.has(b.id));
  const dropBroken = (id: string) => setBroken((cur) => (cur.has(id) ? cur : new Set(cur).add(id)));
  const { width } = useWindowDimensions();
  const cardW = width - gutter * 2 - ms(22);
  const step = cardW + space.md;
  const listRef = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);
  const touching = useRef(false);

  // Drifts to the next offer on its own, but never while a finger is down -
  // a carousel that moves under your thumb is the fastest way to annoy people.
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      if (touching.current) return;
      setIndex((i) => {
        const next = (i + 1) % items.length;
        listRef.current?.scrollToOffset({ offset: next * step, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [items.length, step]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touching.current = false;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / step));
  };

  return (
    <View style={styles.bannerWrap}>
      <FlatList
        ref={listRef}
        horizontal
        data={items}
        keyExtractor={(b) => b.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: gutter, gap: space.md }}
        onScrollBeginDrag={() => (touching.current = true)}
        onMomentumScrollEnd={onEnd}
        renderItem={({ item }) => (
          <BannerSlide item={item} width={cardW} onPress={() => onPress(item)} onBroken={() => dropBroken(item.id)} />
        )}
      />
      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const FALLBACK_FROM = '#0E8A3E';
const FALLBACK_TO = '#0A4D29';

/**
 * One slide. A banner uploaded from the admin panel is a picture that fills
 * the whole card, with its text drawn on top only when the admin gave some;
 * the built-in offers keep their gradient-and-artwork look.
 */
const BannerSlide = React.memo(function BannerSlide({
  item,
  width,
  onPress,
  onBroken,
}: {
  item: Banner;
  width: number;
  onPress: () => void;
  onBroken: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const from = item.from ?? FALLBACK_FROM;
  const to = item.to ?? FALLBACK_TO;
  const photo = !!item.image && !failed;
  const label = [item.title, item.subtitle].filter(Boolean).join('. ') || item.categoryName || 'Offer';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.banner,
        photo
          ? [styles.bannerPhoto, { width, height: Math.round(width * (9 / 26)) }]
          : {
              width,
              backgroundImage: `${gradient.glow('rgba(255,255,255,0.22)', '92% 8%')}, ${gradient.diagonal(from, to)}`,
              boxShadow: glowShadow(`${to}55`, 8, 20),
            },
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: item.image }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => {
            setFailed(true);
            onBroken();
          }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {photo && item.title ? <View style={styles.bannerScrim} /> : null}

      {item.title ? (
        <View style={styles.bannerText}>
          <Txt variant="h2" tone="onHeader" numberOfLines={2}>
            {item.title}
          </Txt>
          {item.subtitle ? (
            <Txt variant="bodySm" numberOfLines={2} style={styles.bannerSub}>
              {item.subtitle}
            </Txt>
          ) : null}
          <View style={styles.bannerCta}>
            <Txt variant="labelSm" style={{ color: from }}>
              {item.cta || 'Shop now'}
            </Txt>
            <Icon name="arrow-forward" size={ms(13)} color={from} />
          </View>
        </View>
      ) : null}

      {photo ? null : (
        <View style={styles.bannerArtRing}>
          <Illustration name={item.icon} size={78} style={styles.bannerArt} />
        </View>
      )}
    </Pressable>
  );
});

/* --------------------------------------------------------------- section -- */

/**
 * Renders one strip of the home feed.
 *
 * Every strip is described by the server, so re-merchandising the shop - a new
 * rail, a different order, a seasonal grid - is a data change rather than a
 * release. This component only knows how each `type` should look.
 */
export function HomeSectionView({
  section,
  handlers,
  cardWidth,
  gridWidth,
  columns,
}: {
  section: HomeSection;
  handlers: SectionHandlers;
  cardWidth: number;
  gridWidth: number;
  columns: number;
}) {
  const { tint } = useTheme();

  switch (section.type) {
    case 'bannerCarousel':
      return <BannerCarousel items={section.items} onPress={handlers.onBanner} />;

    case 'circleRail': {
      const size = ms(62);
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circles}>
          {section.items.map((c) => (
            <View key={c._id} style={{ width: size + ms(12), alignItems: 'center' }}>
              <CategoryCircle category={c} size={size} onPress={() => handlers.onCategory(c)} />
            </View>
          ))}
        </ScrollView>
      );
    }

    case 'categoryGrid': {
      const tileGap = space.sm;
      const cols = 4;
      const w = Math.floor((gridWidth - tileGap * (cols - 1)) / cols);
      return (
        <View style={styles.strip}>
          <Heading title={section.title} subtitle={section.subtitle} />
          <View style={[styles.grid, { gap: tileGap }]}>
            {section.items.map((c) => (
              <CategoryTile key={c._id} category={c} width={w} onPress={() => handlers.onCategory(c)} />
            ))}
          </View>
        </View>
      );
    }

    case 'productRail': {
      const deals = section.style === 'deals';
      return (
        <View
          style={[
            styles.strip,
            deals ? { backgroundImage: gradient.down(colors.dealsFrom, colors.dealsTo) } : null,
            !deals && section.tint ? { backgroundColor: tint(section.tint) } : null,
          ]}
        >
          <Heading
            title={section.title}
            subtitle={section.subtitle}
            art={deals ? 'fire' : undefined}
            onDark={deals}
            right={deals ? <MidnightCountdown /> : undefined}
            actionLabel={section.seeAllSlug ? 'See all' : undefined}
            onAction={section.seeAllSlug ? () => handlers.onSeeAll(section.seeAllSlug!, section.title ?? '') : undefined}
          />
          <FlatList
            horizontal
            data={section.items}
            keyExtractor={(p) => p._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railPad}
            style={styles.railTop}
            renderItem={({ item }) => (
              <View style={[{ width: cardWidth + (deals ? space.md : 0) }, deals && styles.dealCard]}>
                <ProductCard
                  product={item}
                  width={cardWidth}
                  deliveryText={handlers.deliveryText}
                  onPress={() => handlers.onProduct(item)}
                />
              </View>
            )}
          />
        </View>
      );
    }

    case 'productGrid': {
      const gap = space.sm;
      const w = Math.floor((gridWidth - gap * (columns - 1)) / columns);
      const warm = section.style === 'trending';
      return (
        <View style={[styles.strip, warm && { backgroundImage: gradient.down(colors.surfaceTint, colors.surface) }]}>
          <Heading title={section.title} subtitle={section.subtitle} art={warm ? 'sparkles' : undefined} />
          <View style={[styles.grid, { gap, rowGap: space.lg }]}>
            {section.items.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                width={w}
                deliveryText={handlers.deliveryText}
                onPress={() => handlers.onProduct(p)}
              />
            ))}
          </View>
        </View>
      );
    }

    // Customers never see the warehouses behind their orders.
    case 'storeTiles':
      return null;

    default:
      return null;
  }
}

/**
 * The sign-off at the bottom of the feed. Every good shopfront has one - it
 * tells you that you have reached the end, and who you are buying from.
 */
export function FeedFooter() {
  return (
    <View style={styles.footer}>
      <Txt style={styles.footerMark} numberOfLines={1} adjustsFontSizeToFit>
        Bingoor
      </Txt>
      <Txt variant="bodySm" tone="faint">
        Your neighbourhood store, in minutes.
      </Txt>
      <View style={styles.footerLine}>
        <Txt variant="caption" tone="faint">
          Made with
        </Txt>
        <Icon name="heart" size={ms(12)} color={colors.brand} />
        <Txt variant="caption" tone="faint">
          in Sonbhadra
        </Txt>
      </View>
    </View>
  );
}

const styles = themed(({ c }) => ({
  strip: { paddingTop: space.xl, paddingBottom: space.xl, backgroundColor: c.surface },

  heading: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, paddingHorizontal: gutter },
  headingText: { flex: 1 },
  headingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  headingTitle: { flexShrink: 1 },
  headingSub: { marginTop: ms(2) },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(2),
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    borderRadius: radius.pill,
    backgroundColor: c.brandSurface,
  },

  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    backgroundColor: c.priceMark,
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
    borderRadius: radius.xs,
    marginBottom: ms(2),
  },
  clockText: { color: c.onPriceMark, fontVariant: ['tabular-nums'] },

  railTop: { marginTop: space.md },
  railPad: { paddingHorizontal: gutter, gap: space.md },
  dealCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: ms(6),
    paddingBottom: space.sm,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md, paddingHorizontal: gutter },

  circles: { paddingHorizontal: gutter - ms(6), paddingTop: space.lg, paddingBottom: space.md, backgroundColor: c.surface },

  bannerWrap: { paddingTop: space.lg, paddingBottom: space.md, backgroundColor: c.surface },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ms(150),
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
    overflow: 'hidden',
  },
  /* Uploaded artwork: fixed 26:9 frame (same as the website and the admin
     preview), no padding, so the picture runs edge to edge. */
  bannerPhoto: { minHeight: 0, padding: 0, paddingHorizontal: space.lg, backgroundColor: c.surfaceSunken },
  bannerScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.6), rgba(0,0,0,0.15) 70%, rgba(0,0,0,0))',
  },
  bannerText: { flex: 1 },
  bannerSub: { color: 'rgba(255,255,255,0.9)', marginTop: ms(4) },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    alignSelf: 'flex-start',
    marginTop: space.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: ms(12),
    paddingVertical: ms(7),
    borderRadius: radius.pill,
  },
  bannerArtRing: {
    width: ms(108),
    height: ms(108),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerArt: { transform: [{ rotate: '-8deg' }] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: ms(5), marginTop: space.md },
  dot: { width: ms(6), height: ms(6), borderRadius: radius.pill, backgroundColor: c.borderStrong },
  dotOn: { width: ms(18), backgroundColor: c.brand },

  storeTile: { width: ms(128) },
  storeArt: {
    width: '100%',
    height: ms(92),
    borderRadius: radius.md,
    backgroundColor: c.surfaceSunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  storeImage: { width: '100%', height: '100%', backgroundColor: c.surfaceSunken },
  storeState: {
    position: 'absolute',
    top: ms(8),
    right: ms(8),
    width: ms(9),
    height: ms(9),
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: c.surface,
  },
  storeName: { marginTop: space.sm },
  storeMeta: { flexDirection: 'row', alignItems: 'center', gap: ms(3), marginTop: ms(2) },

  footer: { paddingHorizontal: gutter, paddingTop: space.xxxl, paddingBottom: space.xxxl, gap: ms(6) },
  footerMark: { fontSize: ms(52), lineHeight: ms(58), fontWeight: '800', letterSpacing: -1.5, color: c.border },
  footerLine: { flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(4) },
}));
