'use client';

import React, { useEffect, useState } from 'react';
import { fetchVideos } from '../../api/catalog';
import { Crumbs } from '../../components/Crumbs';
import { Icon } from '../../components/Icon';
import { MediaViewer } from '../../components/MediaViewer';
import { Alert, Button, EmptyState, PageLoader } from '../../components/ui';
import { getErrorMessage } from '../../lib/client';
import { MediaItem } from '../../lib/types';
import s from '../media.module.css';

export default function VideosPage() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const load = () => {
    setError('');
    fetchVideos().then(setItems).catch((e) => setError(getErrorMessage(e)));
  };
  useEffect(load, []);

  if (!items && error)
    return (
      <div className="page" style={{ paddingTop: 24, maxWidth: 560 }}>
        <Alert tone="bad">{error}</Alert>
        <Button icon="repeat" onClick={load}>Try again</Button>
      </div>
    );
  if (!items) return <PageLoader label="Loading videos…" />;

  return (
    <div className={`page rise ${s.wrap}`}>
      <Crumbs trail={[{ label: 'Videos' }]} />
      <h1 className="h1" style={{ marginTop: 10 }}>Videos</h1>
      <p className="body-sm">Watch how Bingoor brings your groceries in minutes.</p>

      {items.length === 0 ? (
        <div className={s.empty}>
          <EmptyState icon="play" title="Videos coming soon" body="We are adding videos. Please check back shortly." />
        </div>
      ) : (
        <div className={s.grid}>
          {items.map((m, i) => (
            <button key={m.id} className={s.card} onClick={() => setOpen(i)} aria-label={`Play ${m.title}`}>
              <span className={s.thumb}>
                {m.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnail} alt="" loading="lazy" />
                ) : null}
                <span className={s.play}>
                  <span className={s.playBtn}>
                    <Icon name="play" size={22} />
                  </span>
                </span>
              </span>
              <span className={s.info}>
                <span className={s.title}>{m.title}</span>
                {m.caption ? <span className={s.caption} style={{ display: 'block' }}>{m.caption}</span> : null}
              </span>
            </button>
          ))}
        </div>
      )}

      {open !== null ? <MediaViewer items={items} index={open} onChange={setOpen} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
