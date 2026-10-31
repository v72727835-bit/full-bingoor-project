'use client';

import React from 'react';
import { Icon } from './Icon';
import s from './QuantityStepper.module.css';

/**
 * The ADD control, which becomes a stepper once something is in the cart.
 * Both states occupy the same box so a card never reflows on the first tap.
 */
export function QuantityStepper({
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
  disabled,
  size = 'md',
  busy,
}: {
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  busy?: boolean;
}) {
  const sz = size === 'sm' ? s.sm : '';

  if (quantity <= 0) {
    return (
      <button
        className={`${s.add} ${sz}`}
        onClick={onAdd}
        disabled={disabled}
        aria-label={disabled ? 'Out of stock' : 'Add to cart'}
      >
        ADD
      </button>
    );
  }

  return (
    <div className={`${s.step} ${sz}`} data-busy={busy ? 'true' : 'false'}>
      <button onClick={onDecrement} aria-label="Reduce quantity" disabled={busy}>
        <Icon name="minus" size={15} strokeWidth={2.4} />
      </button>
      <span className={`num ${s.qty}`} aria-live="polite">
        {quantity}
      </span>
      <button onClick={onIncrement} aria-label="Increase quantity" disabled={busy || quantity >= 20}>
        <Icon name="plus" size={15} strokeWidth={2.4} />
      </button>
    </div>
  );
}
