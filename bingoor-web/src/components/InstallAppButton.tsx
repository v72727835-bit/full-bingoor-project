'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { isIos, isIosSafari, isStandalone, promptInstall } from '../lib/install';
import { Icon } from './Icon';
import s from './InstallAppButton.module.css';

/**
 * A permanent "Add to Home Screen" button (point 6). One tap opens the
 * browser's own install dialog - no instructions - on Android and desktop
 * Chrome / Edge / Samsung Internet. Apple allows no website to do that on an
 * iPhone, so there (and only there) a one-line pointer to Safari's Share
 * button is shown. Hidden once the site already runs from the home screen.
 */
export function InstallAppButton() {
  const { show } = useToast();
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosHint, setIosHint] = useState<'' | 'safari' | 'other'>('');

  useEffect(() => setStandalone(isStandalone()), []);

  // Already installed — nothing to offer.
  if (standalone) return null;

  const click = async () => {
    if (isIos()) {
      setIosHint(isIosSafari() ? 'safari' : 'other');
      return;
    }
    setBusy(true);
    try {
      const result = await promptInstall();
      if (result === 'accepted') show('Bingoor is being added to your home screen', 'success');
      else if (result === 'unavailable')
        show('Bingoor is already on your home screen, or this browser cannot add it. Open bingoor.com in Chrome to add it.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={s.btn} onClick={click} disabled={busy}>
        <Icon name="download" size={16} />
        {busy ? 'Opening…' : 'Add to Home Screen'}
      </button>

      {iosHint ? (
        <div className={s.overlay} role="dialog" aria-modal="true" onClick={() => setIosHint('')}>
          <div className={s.card} onClick={(e) => e.stopPropagation()}>
            <div className={s.head}>
              <span className={s.hIcon}><Icon name="download" size={20} /></span>
              <h3 className={s.title}>Add Bingoor to your home screen</h3>
              <button className={s.x} onClick={() => setIosHint('')} aria-label="Close"><Icon name="x" size={18} /></button>
            </div>
            <p className={s.body}>
              {iosHint === 'other' ? (
                <>
                  iPhone allows this only in <b>Safari</b>: open <b>bingoor.com</b> in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.
                </>
              ) : (
                <>
                  Tap <b>Share</b> below, then <b>Add to Home Screen</b>.
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
