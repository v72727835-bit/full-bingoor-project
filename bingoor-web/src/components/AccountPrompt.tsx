'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import s from './AccountPrompt.module.css';

/** Fired by anything a visitor can only do with an account (e.g. the wishlist heart). */
export const ASK_ACCOUNT_EVENT = 'bingoor:ask-account';

export function askForAccount(text = 'Create a free account to save products to your wishlist.') {
  window.dispatchEvent(new CustomEvent(ASK_ACCOUNT_EVENT, { detail: { text } }));
}

/**
 * Instead of an error, a visitor who taps something that needs an account
 * gets a small sheet with "Create account" / "Sign in" (mobile and desktop).
 * After signing up they come back to the page they were on.
 */
export function AccountPrompt() {
  const [text, setText] = useState<string | null>(null);
  const pathname = usePathname() || '/';

  useEffect(() => {
    const open = (e: Event) => setText((e as CustomEvent<{ text?: string }>).detail?.text || 'Create a free account to continue.');
    window.addEventListener(ASK_ACCOUNT_EVENT, open);
    return () => window.removeEventListener(ASK_ACCOUNT_EVENT, open);
  }, []);
  useEffect(() => setText(null), [pathname]);

  if (!text) return null;
  const next = encodeURIComponent(pathname);
  return createPortal(
    <div className={s.back} role="dialog" aria-modal="true" aria-labelledby="ask-account" onClick={() => setText(null)}>
      <div className={s.card} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={s.x} onClick={() => setText(null)} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
        <span className={s.icon}>
          <Icon name="heart" size={20} />
        </span>
        <h2 id="ask-account" className={s.title}>
          Create your account
        </h2>
        <p className={s.text}>{text}</p>
        <Link href={`/signup?next=${next}`} className="btn btn-lg btn-primary btn-full" onClick={() => setText(null)}>
          Create account
        </Link>
        <Link href={`/login?next=${next}`} className="btn btn-lg btn-outline btn-full" style={{ marginTop: 10 }} onClick={() => setText(null)}>
          I already have an account
        </Link>
      </div>
    </div>,
    document.body,
  );
}
