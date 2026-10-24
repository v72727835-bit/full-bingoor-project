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
export function DeliverySlots({ compact }: { compact?: boolean }) {
  const { slots, slot, setSlot } = useSlot();
  const { t } = useLanguage();

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
