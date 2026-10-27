'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import s from './InstallAppButton.module.css';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

/** iOS can only "Add to Home Screen" from Safari's Share sheet (Apple blocks it in Chrome etc. and blocks any programmatic install). */
function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
function isIosSafari(): boolean {
  if (!isIos()) return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * A permanent "Add to Home Screen" option (point 6). Unlike the one-time banner
 * it is always visible, so an iOS visitor can always find it:
 *  - Android / supported browsers: fires the real install prompt;
 *  - iOS Safari: shows the Share -> "Add to Home Screen" steps;
 *  - iOS other browsers: tells the visitor to open the page in Safari.
 * It hides itself only once the site is already running from the home screen.
 */
export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [iosOther, setIosOther] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIosSafari());
    setIosOther(isIos() && !isIosSafari());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Already installed — nothing to offer.
  if (standalone) return null;

  const click = async () => {
    if (prompt) {
      await prompt.prompt();
      setPrompt(null);
      return;
    }
    // iOS (and as a fallback anywhere the native prompt is not available): show steps.
    setShowHelp(true);
  };

  return (
    <>
      <button type="button" className={s.btn} onClick={click}>
        <Icon name="download" size={16} />
        Add to Home Screen
      </button>

      {showHelp ? (
        <div className={s.overlay} role="dialog" aria-modal="true" onClick={() => setShowHelp(false)}>
          <div className={s.card} onClick={(e) => e.stopPropagation()}>
            <div className={s.head}>
              <span className={s.hIcon}><Icon name="download" size={20} /></span>
              <h3 className={s.title}>Add Bingoor to your home screen</h3>
              <button className={s.x} onClick={() => setShowHelp(false)} aria-label="Close"><Icon name="x" size={18} /></button>
            </div>
            {iosOther ? (
              <p className={s.body}>
                On iPhone/iPad this only works in <b>Safari</b>. Open <b>bingoor.com</b> in Safari, then tap
                <b> Share</b> and choose <b>Add to Home Screen</b>.
              </p>
            ) : ios ? (
              <ol className={s.steps}>
                <li>Tap the <b>Share</b> button at the bottom of Safari.</li>
                <li>Scroll and tap <b>Add to Home Screen</b>.</li>
                <li>Tap <b>Add</b> — Bingoor now opens like an app.</li>
              </ol>
            ) : (
              <p className={s.body}>
                Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>. Bingoor then opens
                like an app.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
