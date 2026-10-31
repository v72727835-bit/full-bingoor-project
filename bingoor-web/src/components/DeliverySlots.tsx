'use client';

import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSlot } from '../context/SlotContext';
import { Icon } from './Icon';
import s from './DeliverySlots.module.css';

const ORDINAL = ['1st', '2nd', '3rd'];

/**
 * The delivery-time picker: up to three choices with 1st / 2nd / 3rd printed
 * beneath. The row is a flex grid, so when the admin hides a time the others
 * share the width and nothing looks broken.
 */
export function DeliverySlots({ compact, laterOnly }: { compact?: boolean; laterOnly?: boolean }) {
  const { slots, slot, setSlot } = useSlot();
  const { t } = useLanguage();

  // Point 18 (cart): the 1st time is the one in the header, so it is not
  // repeated. Only the other times are offered, as an optional change; tapping
  // the chosen one again goes back to the standard (header) time.
  if (laterOnly) {
    const later = slots.slice(1);
    if (!later.length) return null;
    return (
      <div className={s.later}>
        <span className={s.laterLabel}>Want it at another time?</span>
        {later.map((x) => (
          <button
            key={x.key}
            type="button"
            className={s.laterChip}
            aria-pressed={slot === x.key}
            data-on={slot === x.key}
            onClick={() => setSlot(slot === x.key ? slots[0].key : x.key)}
          >
            <Icon name={x.key === 'twoHour' ? 'clock' : 'truck'} size={14} />
            {x.label}
            {slot === x.key ? <Icon name="x" size={12} /> : null}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`${s.wrap} ${compact ? s.compact : ''}`} role="radiogroup" aria-label={t('chooseSlot')}>
      {slots.map((x, i) => (
        <button
          key={x.key}
          type="button"
          role="radio"
          aria-checked={slot === x.key}
          className={s.item}
          data-on={slot === x.key}
          onClick={() => {
            setSlot(x.key);
            // A short tick on phones that support it, like the delivery-time button on the app.
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
          }}
        >
          <span className={s.top}>
            <Icon name={x.key === 'instant' ? 'bolt' : x.key === 'twoHour' ? 'clock' : 'truck'} size={16} />
            {x.label}
          </span>
          <span className={s.num}>{ORDINAL[i]}</span>
        </button>
      ))}
    </div>
  );
}
