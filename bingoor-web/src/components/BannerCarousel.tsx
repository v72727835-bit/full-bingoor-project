'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Banner } from '../lib/types';
import { Icon } from './Icon';
import s from './BannerCarousel.module.css';

/**
 * Promo rail. It scrolls by hand and advances on its own every six seconds,
 * pausing while the pointer is over it. With `bleed` it runs edge to edge
 * under the header, with the dots laid over the slide instead of below it.
 *
 * The scroll handling is deliberately defensive. A programmatic smooth scroll
 * on a scroll-snapping container emits a long burst of scroll events, and
 * setting React state on each one can keep the main thread busy indefinitely.
 * So: the dot index is computed at most once per frame, state is only touched
 * when the index actually changes, and events are ignored while our own
 * animation is still running.
 */
export function BannerCarousel({ items: all, bleed = false }: { items: Banner[]; bleed?: boolean }) {
  // An uploaded banner whose image fails to load is dropped, not shown as an empty box.
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const items = all.filter((b) => !broken.has(b.id));
  const dropBroken = useCallback((id: string) => setBroken((cur) => (cur.has(id) ? cur : new Set(cur).add(id))), []);

  const trackRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const settleUntil = useRef(0);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // A load error that fires before hydration never reaches onError, so check once mounted too.
  useEffect(() => {
    trackRef.current?.querySelectorAll<HTMLImageElement>('img[data-banner]').forEach((img) => {
      if (img.complete && img.naturalWidth === 0) dropBroken(img.dataset.banner!);
    });
  }, [dropBroken]);

  const scrollToIndex = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[i] as HTMLElement | undefined;
    if (!card) return;
    // Ignore the scroll events our own animation is about to produce.
    settleUntil.current = Date.now() + 700;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = setInterval(() => {
      setActive((cur) => {
        const next = (cur + 1) % items.length;
        // Side effect runs after the updater returns, never inside it.
        queueMicrotask(() => scrollToIndex(next));
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, items.length, scrollToIndex]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onScroll = () => {
    if (Date.now() < settleUntil.current) return;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const track = trackRef.current;
      if (!track) return;
      const cards = Array.from(track.children) as HTMLElement[];
      const mid = track.scrollLeft + track.clientWidth / 2;
      let closest = 0;
      let best = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft - track.offsetLeft + c.clientWidth / 2 - mid);
        if (d < best) {
          best = d;
          closest = i;
        }
      });
      setActive((cur) => (cur === closest ? cur : closest));
    });
  };

  if (items.length === 0) return null;

  return (
    <section
      className={`${s.wrap} ${bleed ? s.bleed : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className={`rail ${s.track}`} ref={trackRef} onScroll={onScroll}>
        {items.map((b) => (
          <Link
            key={b.id}
            href={b.slug ? `/categories/${b.slug}` : '/categories'}
            className={s.banner}
            data-photo={b.image ? (b.title ? 'text' : 'plain') : undefined}
            aria-label={b.image && !b.title ? b.categoryName || 'Offer' : undefined}
            style={{ ['--from' as string]: b.from, ['--to' as string]: b.to }}
          >
            {/* An uploaded banner fills the slide; its copy, if any, sits on top. */}
            {b.image ? <Image src={b.image} alt="" width={1040} height={360} className="photo-fill" unoptimized data-banner={b.id} onError={() => dropBroken(b.id)} /> : null}
            {b.title ? (
              <span className={s.copy}>
                {b.categoryName ? <span className={s.kicker}>{b.categoryName}</span> : null}
                <span className={s.title}>{b.title}</span>
                {b.subtitle ? <span className={`${s.sub} clamp-2`}>{b.subtitle}</span> : null}
                <span className={s.cta}>
                  {b.cta || 'Shop now'}
                  <Icon name="arrow-right" size={15} />
                </span>
              </span>
            ) : null}
            {b.image ? null : <Image src={b.art} alt="" width={132} height={132} className={s.art} unoptimized />}
          </Link>
        ))}
      </div>

      {items.length > 1 ? (
        <div className={s.dots}>
          {items.map((b, i) => (
            <button
              key={b.id}
              className={s.dot}
              data-on={i === active}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => {
                setActive(i);
                scrollToIndex(i);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
