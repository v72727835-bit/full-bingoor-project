'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MediaItem } from '../lib/types';
import { Icon } from './Icon';
import s from '../app/media.module.css';

/**
 * Full-screen viewer for a gallery photo or a video. Arrow keys move between
 * items, Escape closes, and scrolling the page behind it is locked.
 */
export function MediaViewer({
  items,
  index,
  onChange,
  onClose,
}: {
  items: MediaItem[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  // The page content animates in with a transform, which would trap a fixed overlay inside it; draw on <body> instead.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < items.length - 1) onChange(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onChange(index - 1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, onChange, onClose]);

  if (!item || !host) return null;

  return createPortal(
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label={item.title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button className={s.close} onClick={onClose} aria-label="Close">
        <Icon name="x" size={20} />
      </button>
      {index > 0 ? (
        <button className={`${s.nav} ${s.prev}`} onClick={() => onChange(index - 1)} aria-label="Previous">
          <Icon name="chevron-left" size={20} />
        </button>
      ) : null}
      {index < items.length - 1 ? (
        <button className={`${s.nav} ${s.next}`} onClick={() => onChange(index + 1)} aria-label="Next">
          <Icon name="chevron-left" size={20} />
        </button>
      ) : null}

      <div className={s.stage}>
        {item.kind === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.title} className={s.photo} />
        ) : (
          <div className={s.frame}>
            {item.videoType === 'file' ? (
              <video src={item.embedUrl} controls autoPlay playsInline />
            ) : (
              <iframe
                // Keyed so moving to the next video really stops the previous one.
                key={item.id}
                src={`${item.embedUrl}${item.embedUrl?.includes('?') ? '&' : '?'}autoplay=1`}
                title={item.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
          </div>
        )}
        <div className={s.cap}>
          <strong>{item.title}</strong>
          {item.caption ? <span>{item.caption}</span> : null}
        </div>
      </div>
    </div>,
    host,
  );
}
