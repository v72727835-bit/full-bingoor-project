'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNotices } from '../api/catalog';
import { Notice } from '../lib/types';
import { Icon } from './Icon';
import s from './NoticeBell.module.css';

const SEEN_KEY = 'bingoor_notices_seen';

/** The newest announcement this browser has already opened. */
function lastSeen(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function markSeen(at: string) {
  try {
    localStorage.setItem(SEEN_KEY, at);
  } catch {
    /* private mode - the badge simply comes back next visit */
  }
}

/**
 * Announcements the admin broadcasts. Unopened ones show as a red count on
 * the bell; opening the list clears it.
 */
export function NoticeBell() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState('');
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchNotices()
      .then(setNotices)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setSeen(lastSeen());
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = notices.filter((n) => n.createdAt > seen).length;

  const toggle = () => {
    setOpen((v) => !v);
    if (!open && notices[0]) {
      markSeen(notices[0].createdAt);
      setSeen(notices[0].createdAt);
    }
  };

  return (
    <div className={s.wrap} ref={box}>
      <button
        className={s.btn}
        onClick={toggle}
        aria-label={unread ? `${unread} new notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <Icon name="alert" size={18} />
        {unread > 0 ? <span className={`num ${s.count}`}>{unread}</span> : null}
      </button>

      {open ? (
        <div className={s.panel} role="dialog" aria-label="Notifications">
          <div className={s.head}>Notifications</div>
          {notices.length === 0 ? (
            <p className={s.empty}>Nothing new right now.</p>
          ) : (
            <ul className={s.list}>
              {notices.map((n) => (
                <li key={n.id} className={s.item}>
                  <p className={s.msg}>{n.message}</p>
                  <time className={s.when}>{new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
