'use client';

import { useEffect, useState } from 'react';
import { INSTALL_READY, InstallPrompt, installPrompt, isIos, isIosSafari, isStandalone, promptInstall } from '../lib/install';
import { Icon } from './Icon';
import s from './PwaRegister.module.css';

const DISMISS_KEY = 'bingoor_install_dismissed';

/*
 * iOS Safari never fires `beforeinstallprompt`, so an iPhone visitor would
 * otherwise never be told the site can live on the home screen; there it has
 * to be done through the Share sheet. The helpers live in lib/install.ts.
 */

export function PwaRegister() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  // iPhone users in Chrome / Firefox: those browsers cannot add to the home screen.
  const [iosOther, setIosOther] = useState(false);
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
    else if (isIos() && !isStandalone()) setIosOther(true);
    // The event is caught in the page head (lib/install.ts) so no button misses it.
    const sync = () => setPrompt(installPrompt());
    sync();
    window.addEventListener(INSTALL_READY, sync);
    return () => window.removeEventListener(INSTALL_READY, sync);
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
  if (!prompt && iosOther)
    return (
      <div className={s.bar}>
        <span className={s.icon}>
          <Icon name="download" size={19} />
        </span>
        <span className={s.text}>
          <b>Add Bingoor to your home screen</b>
          <span className={s.sub}>
            Open bingoor.com in Safari, tap Share, then choose &ldquo;Add to Home Screen&rdquo;. It then opens like an app.
          </span>
        </span>
        <button className={s.x} onClick={dismiss} aria-label="Dismiss">
          <Icon name="x" size={16} />
        </button>
      </div>
    );

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
        <b>Install Bingoor</b>
        <span className={s.sub}>Add it to your home screen for faster access</span>
      </span>
      <button
        className={s.go}
        onClick={async () => {
          await promptInstall();
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
