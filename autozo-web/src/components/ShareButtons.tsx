'use client';

import React from 'react';
import { useToast } from '../context/ToastContext';
import { Icon } from './Icon';
import s from './ShareButtons.module.css';

/**
 * Share a product or an aisle. WhatsApp first, because that is how a shopper
 * in Robertsganj actually passes a link on; then the social networks, the
 * phone's own share sheet where it exists, and a plain copy as the fallback
 * that always works.
 */
export function ShareButtons({ title, compact = false }: { title: string; compact?: boolean }) {
  const { show } = useToast();

  const link = () => (typeof window === 'undefined' ? '' : window.location.href);
  const text = () => `${title} on Bingoor`;

  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link());
      show('Link copied', 'success');
    } catch {
      show('Could not copy the link', 'error');
    }
  };

  // The share sheet only exists on phones; elsewhere the buttons do the work.
  const native = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title, text: text(), url: link() });
    } catch {
      /* the customer closed the sheet */
    }
  };

  return (
    <div className={`${s.wrap} ${compact ? s.compact : ''}`}>
      {!compact ? <span className={s.label}>Share</span> : null}

      <button
        className={`${s.btn} ${s.wa}`}
        onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${text()} ${link()}`)}`)}
        aria-label="Share on WhatsApp"
      >
        <Icon name="whatsapp" size={17} />
      </button>
      <button
        className={`${s.btn} ${s.fb}`}
        onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link())}`)}
        aria-label="Share on Facebook"
      >
        <Icon name="facebook" size={17} />
      </button>
      <button
        className={`${s.btn} ${s.tw}`}
        onClick={() =>
          open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text())}&url=${encodeURIComponent(link())}`)
        }
        aria-label="Share on X"
      >
        <Icon name="twitter" size={15} />
      </button>
      <button className={s.btn} onClick={copy} aria-label="Copy link">
        <Icon name="copy" size={16} />
      </button>
      <button className={`${s.btn} ${s.more}`} onClick={native} aria-label="More share options">
        <Icon name="share" size={16} />
      </button>
    </div>
  );
}
