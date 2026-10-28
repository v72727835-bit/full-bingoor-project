'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { fetchProduct, submitReview } from '../../../api/catalog';
import { addToWishlist, fetchWishlist, removeFromWishlist } from '../../../api/account';
import { getErrorMessage } from '../../../lib/client';
import { videoSource } from '../../../lib/video';
import { fitClass } from '../../../lib/art';
import { Product } from '../../../lib/types';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { useCatalog } from '../../../context/CatalogContext';
import { useSettings } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';
import { Crumbs } from '../../../components/Crumbs';
import { Icon } from '../../../components/Icon';
import { shortDelivery } from '../../../lib/deliveryText';
import { NotifyMe } from '../../../components/NotifyMe';
import { ProductCard } from '../../../components/ProductCard';
import { QuantityStepper } from '../../../components/QuantityStepper';
import { RichText } from '../../../components/RichText';
import { ShareButtons } from '../../../components/ShareButtons';
import {
  Alert,
  Badge,
  Button,
  FoodMark,
  Rating,
  SectionHead,
  Textarea,
  compact,
} from '../../../components/ui';
import s from './product.module.css';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const settings = useSettings();
  const { name } = useLanguage();
  const { quantityOf, addItem, updateItem } = useCart();
  const { home } = useCatalog();
  const { show } = useToast();

  const [p, setP] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [shot, setShot] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [wished, setWished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    setError('');
    fetchProduct(slug)
      .then((data) => {
        setP(data);
        setShot(0);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [slug]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!user || !p) return;
    fetchWishlist()
      .then((list) => setWished(list.some((w) => w.id === p.id)))
      .catch(() => {});
  }, [user, p]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoom]);

  const needLogin = () => router.push(`/login?next=${encodeURIComponent(`/products/${slug}`)}`);

  if (error)
    return (
      <div className="page" style={{ paddingTop: 24, maxWidth: 560 }}>
        <Alert tone="bad">{error}</Alert>
        <Button variant="outline" onClick={load} icon="repeat">
          Try again
        </Button>
      </div>
    );

  if (!p) return <ProductSkeleton />;

  const qty = quantityOf(p.id);
  const shots = p.images.length > 0 ? p.images : [p.art];
  const video = videoSource(p.video);
  const saving = p.mrp ? p.mrp - p.price : 0;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      show(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleWish = async () => {
    if (!user) return needLogin();
    try {
      if (wished) await removeFromWishlist(p.id);
      else await addToWishlist(p.id);
      setWished(!wished);
      show(wished ? 'Product is removed from wish list' : 'Product is added to wish list', 'success');
    } catch (e) {
      show(getErrorMessage(e), 'error');
    }
  };

  const postReview = async () => {
    if (!user) return needLogin();
    setPosting(true);
    try {
      await submitReview(p.id, stars, comment.trim() || undefined);
      setComment('');
      show('Thank you — your review has been added', 'success');
      load();
    } catch (e) {
      show(getErrorMessage(e), 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="page rise">
      <Crumbs
        trail={[
          ...(p.category?.slug ? [{ label: p.category.name, href: `/categories/${p.category.slug}` }] : []),
          { label: p.name },
        ]}
      />

      <div className={s.top}>
        <div className={s.gallery}>
          {video && playing ? (
            <div className={s.stage} style={{ cursor: 'default', aspectRatio: '16 / 10', background: '#000' }}>
              {video.kind === 'file' ? (
                <video src={video.src} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <iframe
                  src={video.src}
                  title={`${p.name} video`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                />
              )}
            </div>
          ) : (
          <button className={s.stage} onClick={() => setZoom(true)} aria-label="Zoom in on this photo">
            <Image src={shots[shot]} alt={p.name} width={420} height={420} className={fitClass(shots[shot], s.shot)} unoptimized priority />
            {p.discountPercent > 0 ? <span className={`num ${s.off}`}>{p.discountPercent}% OFF</span> : null}
            <span className={s.zoomHint}>
              <Icon name="zoom-in" size={16} />
            </span>
          </button>
          )}
          {shots.length > 1 || video ? (
            <div className={s.thumbs}>
              {shots.map((src, i) => (
                <button
                  key={src}
                  className={s.thumb}
                  data-on={i === shot && !playing}
                  onClick={() => {
                    setShot(i);
                    setPlaying(false);
                  }}
                  aria-label={`View image ${i + 1}`}
                >
                  <Image src={src} alt="" width={112} height={112} className={fitClass(src, s.thumbArt)} unoptimized />
                </button>
              ))}
              {video ? (
                <button className={s.thumb} data-on={playing} onClick={() => setPlaying(true)} aria-label="Watch the product video">
                  {video.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.cover} alt="" width={62} height={62} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                  ) : null}
                  <span className={s.videoBadge}>
                    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                      <circle cx="12" cy="12" r="12" fill="var(--sun)" />
                      <path d="M10 7.5v9l7-4.5Z" fill="var(--sun-ink)" />
                    </svg>
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          {p.brand ? <div className="eyebrow">{p.brand}</div> : null}
          <h1 className={`display ${s.title}`}>{name(p)}</h1>
          {p.nameHi && p.nameHi !== p.name ? <p className="body-sm">{name(p) === p.name ? p.nameHi : p.name}</p> : null}

          <div className={s.facts}>
            <FoodMark type={p.foodType} size={16} />
            {p.unit ? <span className={s.unit}>{p.unit}</span> : null}
            <Rating value={p.rating} count={p.ratingCount} />
            {p.ratingLabel ? <span className={s.ratingLabel}>{p.ratingLabel}</span> : null}
          </div>

          <div className={s.priceBox}>
            <div className={s.priceRow}>
              <span className={`num ${s.now}`}>₹{p.price}</span>
              {p.mrp ? <span className={`num ${s.was}`}>₹{p.mrp}</span> : null}
              {saving > 0 ? <Badge tone="ok">Save ₹{saving}</Badge> : null}
            </div>
            <span className={`body-sm ${s.tax}`}>Inclusive of all taxes</span>
          </div>

          {p.variants && p.variants.length > 0 ? (
            <div className={s.variants}>
              <span className={s.variantsLabel}>Select size</span>
              <div className={s.variantRow}>
                {p.variants.map((v) => {
                  // The saving is the whole reason a bigger pack exists, so the
                  // chip carries it rather than leaving the customer to compare.
                  const off = v.mrp ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
                  // #22: each weight / size gets its own ADD, like Blinkit — the
                  // info still opens that variant's page, the stepper adds it here.
                  const vqty = quantityOf(v.id);
                  return (
                    <div
                      key={v.id}
                      className={s.variant}
                      data-on={v.slug === p.slug}
                      data-out={!v.inStock}
                    >
                      {off > 0 ? <span className={`num ${s.variantOff}`}>{off}% OFF</span> : null}
                      <Link href={`/products/${v.slug}`} className={s.variantInfo}>
                        <span className={s.variantName}>{v.label}</span>
                        <span className={s.variantPrices}>
                          <span className={`num ${s.variantPrice}`}>₹{v.price}</span>
                          {v.mrp ? <span className={`num ${s.variantMrp}`}>₹{v.mrp}</span> : null}
                        </span>
                      </Link>
                      {v.inStock ? (
                        <div className={s.variantAdd}>
                          <QuantityStepper
                            size="sm"
                            quantity={vqty}
                            busy={busy}
                            onAdd={() => act(() => addItem(v.id, 1))}
                            onIncrement={() => act(() => updateItem(v.id, vqty + 1))}
                            onDecrement={() => act(() => updateItem(v.id, vqty - 1))}
                          />
                        </div>
                      ) : (
                        <span className={s.variantOut}>Out of stock</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={s.actions}>
            <QuantityStepper
              quantity={qty}
              busy={busy}
              disabled={!p.inStock}
              onAdd={() => act(() => addItem(p.id, 1))}
              onIncrement={() => act(() => updateItem(p.id, qty + 1))}
              onDecrement={() => act(() => updateItem(p.id, qty - 1))}
            />
            {qty > 0 ? (
              <Link href="/cart" className="btn btn-md btn-dark">
                View cart
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : null}
            <button className={s.wish} data-on={wished} onClick={toggleWish} aria-label="Toggle wishlist">
              <Icon name={wished ? 'heart-fill' : 'heart'} size={19} />
            </button>
          </div>

          {!p.inStock ? <NotifyMe productId={p.id} /> : null}

          <ul className={s.promises}>
            <li>
              <Icon name="shield" size={16} />
              Fulfilled by Bingoor
            </li>
            <li>
              <Icon name="wallet" size={16} />
              {p.codAvailable === false ? 'Online payment only (no cash on delivery)' : p.onlineAvailable === false ? 'Cash on delivery only' : 'COD & online payment available'}
            </li>
            <li>
              <Icon name="truck" size={16} />
              Free delivery
            </li>
            <li>
              <Icon name="bolt" size={16} />
              {p.deliveryDays && p.deliveryDays > 1
                ? `Delivered in ${p.deliveryDays} days`
                : home
                  ? `Delivery time: ${shortDelivery(home)}`
                  : 'Delivered in minutes'}
            </li>
          </ul>

          <div className={s.shareRow}>
            <ShareButtons title={p.name} />
          </div>

          {p.attributes.length > 0 ? (
            <div className={s.attrs}>
              {p.attributes.map((a) => (
                <span key={a} className={s.attr}>
                  {a}
                </span>
              ))}
            </div>
          ) : null}

          {p.description ? (
            <div>
              <h2 className="h3" style={{ marginBottom: 6 }}>
                About this product
              </h2>
              <RichText text={p.description} />
            </div>
          ) : null}
        </div>
      </div>

      {/* #21: reviews are collected here but published on Google, not on the
          site, so the list of other people's reviews is not shown. The star
          rating and the count stay, since those come from the catalogue. */}
      <section className={s.reviews}>
        <SectionHead
          title="Rate this product"
          subtitle={p.ratingCount ? `Rated by ${compact(p.ratingCount)} customers` : 'Tell other shoppers what you thought'}
        />
        <div className={s.revGrid}>
          <aside className={`card card-pad ${s.write}`}>
            <h3 className="h3" style={{ marginBottom: 10 }}>
              Write a review
            </h3>
            <div className={s.starRow} role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setStars(n)}
                  className={s.star}
                  data-on={n <= stars}
                  role="radio"
                  aria-checked={n === stars}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                >
                  <Icon name={n <= stars ? 'star-fill' : 'star'} size={26} />
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was it? Quality, packaging, value…"
              rows={4}
            />
            <div style={{ marginTop: 12 }}>
              <Button full loading={posting} onClick={postReview}>
                {user ? 'Submit review' : 'Sign in to review'}
              </Button>
            </div>
            {settings?.googleReviewUrl ? (
              <a
                href={settings.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-md btn-outline btn-full"
                style={{ marginTop: 10 }}
              >
                Review us on Google
              </a>
            ) : null}
          </aside>
        </div>
      </section>

      {zoom ? (
        <div className={s.lightbox} role="dialog" aria-label={`${p.name} photo`} onClick={() => setZoom(false)}>
          <button className={s.lightClose} aria-label="Close">
            <Icon name="x" size={22} />
          </button>
          <Image
            src={shots[shot]}
            alt={p.name}
            width={1200}
            height={1200}
            className={s.lightArt}
            unoptimized
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {p.related && p.related.length > 0 ? (
        <section className={s.related}>
          <SectionHead title="Similar products" subtitle="You might also like these" />
          <div className="rail">
            {p.related.map((r) => (
              <ProductCard key={r.id} product={r} width={168} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="page" style={{ paddingTop: 28 }}>
      <div className={s.top}>
        <div className={`sk ${s.stage}`} />
        <div>
          <div className="sk" style={{ height: 12, width: 80 }} />
          <div className="sk" style={{ height: 30, width: '80%', marginTop: 12 }} />
          <div className="sk" style={{ height: 14, width: '45%', marginTop: 14 }} />
          <div className="sk" style={{ height: 34, width: 160, marginTop: 24 }} />
          <div className="sk" style={{ height: 44, width: 220, marginTop: 24, borderRadius: 'var(--r-pill)' }} />
          <div className="sk" style={{ height: 120, marginTop: 24, borderRadius: 'var(--r-md)' }} />
        </div>
      </div>
    </div>
  );
}
