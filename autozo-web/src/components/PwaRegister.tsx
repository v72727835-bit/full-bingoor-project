'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import s from './PwaRegister.module.css';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'autozo_install_dismissed';

/**
 * iOS Safari never fires `beforeinstallprompt`, so an iPhone visitor would
 * otherwise never be told the site can live on the home screen. There it has
 * to be done by hand through the Share sheet, so we show the instruction
 * instead of a button. iPadOS 13+ reports itself as a Mac, hence the touch
 * check.
 */
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  // Chrome and Firefox on iOS cannot add to the home screen at all.
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** Already launched from the home screen — nothing to offer. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaRegister() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [gone, setGone] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      // When a deploy ships a new worker, hand over immediately and reload
      // once. Without this a visitor can sit on a worker from an older build
      // until every tab is closed.
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });

      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const next = reg.installing;
            next?.addEventListener('statechange', () => {
              if (next.state === 'installed' && navigator.serviceWorker.controller) {
                next.postMessage('skip-waiting');
              }
            });
          });
        })
        .catch(() => {});
    }
    try {
      setGone(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setGone(false);
    }
    if (isIosSafari() && !isStandalone()) setIos(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setGone(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode — it reappears next session, which is acceptable */
    }
  };

  if (gone) return null;

  // iOS: no install button exists, so say where the option lives.
  if (!prompt && ios)
    return (
      <div className={s.bar}>
        <span className={s.icon}>
          <Icon name="download" size={19} />
        </span>
        <span className={s.text}>
          <b>Add Bingoor to your home screen</b>
          <span className={s.sub}>
            Tap Share at the bottom of Safari, then choose &ldquo;Add to Home Screen&rdquo;. It then opens like an app.
          </span>
        </span>
        <button className={s.x} onClick={dismiss} aria-label="Dismiss">
          <Icon name="x" size={16} />
        </button>
      </div>
    );

  if (!prompt) return null;

  return (
    <div className={s.bar}>
      <span className={s.icon}>
        <Icon name="download" size={19} />
      </span>
      <span className={s.text}>
        <b>Install Autozo</b>
        <span className={s.sub}>Add it to your home screen for faster access</span>
      </span>
      <button
        className={s.go}
        onClick={async () => {
          await prompt.prompt();
          setPrompt(null);
        }}
      >
        Install
      </button>
      <button className={s.x} onClick={dismiss} aria-label="Dismiss">
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
