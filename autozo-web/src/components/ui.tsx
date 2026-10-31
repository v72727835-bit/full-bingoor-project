'use client';

import React from 'react';
import { Icon, IconName } from './Icon';

/* -------------------------------- button --------------------------------- */

type Variant = 'primary' | 'dark' | 'soft' | 'outline' | 'ghost' | 'danger';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  full,
  disabled,
  loading,
  type = 'button',
  onClick,
  icon,
  iconAfter,
  className = '',
}: {
  children?: React.ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  icon?: IconName;
  iconAfter?: IconName;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`btn btn-${size} btn-${variant} ${full ? 'btn-full' : ''} ${className}`}
    >
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children}
      {iconAfter && !loading ? <Icon name={iconAfter} size={size === 'sm' ? 15 : 17} /> : null}
    </button>
  );
}

/* -------------------------------- spinner -------------------------------- */

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="spin"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 9)) }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 12, padding: '80px 0', color: 'var(--ink-3)' }}>
      <span style={{ color: 'var(--brand)' }}>
        <Spinner size={28} />
      </span>
      {label ? <span className="body-sm">{label}</span> : null}
    </div>
  );
}

/* --------------------------------- badge --------------------------------- */

export function Badge({
  children,
  tone = 'brand',
  icon,
}: {
  children: React.ReactNode;
  tone?: 'brand' | 'ok' | 'warn' | 'bad' | 'muted';
  icon?: IconName;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {icon ? <Icon name={icon} size={12} strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}

/* --------------------------------- forms --------------------------------- */

export function Field({
  label,
  children,
  error,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="label">
        {label}
        {required ? <span style={{ color: 'var(--bad)' }}> *</span> : null}
        {hint ? <span style={{ fontWeight: 500, color: 'var(--ink-4)' }}> — {hint}</span> : null}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

// React 19 passes `ref` through as a normal prop, so callers can focus the box.
export function Input(props: React.ComponentProps<'input'>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ''}`} />;
}

/* -------------------------------- feedback ------------------------------- */

export function Alert({
  children,
  tone = 'bad',
  icon,
}: {
  children: React.ReactNode;
  tone?: 'bad' | 'ok' | 'brand';
  icon?: IconName;
}) {
  const fallback: IconName = tone === 'bad' ? 'alert' : tone === 'ok' ? 'check-circle' : 'info';
  return (
    <div className={`alert alert-${tone}`} role={tone === 'bad' ? 'alert' : undefined}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <Icon name={icon ?? fallback} size={16} />
      </span>
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({
  icon = 'package',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '64px 20px' }}>
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--brand-tint)',
          color: 'var(--brand-text)',
          marginBottom: 16,
        }}
      >
        <Icon name={icon} size={28} />
      </span>
      <h2 className="h2" style={{ marginBottom: 6 }}>
        {title}
      </h2>
      {body ? (
        <p className="body-sm" style={{ maxWidth: 360, marginBottom: 20 }}>
          {body}
        </p>
      ) : null}
      {action}
    </div>
  );
}

/* --------------------------------- rating -------------------------------- */

export function Rating({ value, count, size = 13 }: { value?: number; count?: number; size?: number }) {
  if (!value) return null;
  return (
    <span
      className="badge badge-ok num"
      style={{ gap: 3, fontSize: size, padding: '2px 8px' }}
      title={count ? `${value} out of 5 from ${count} ratings` : `${value} out of 5`}
    >
      <Icon name="star-fill" size={size - 1} />
      {value.toFixed(1)}
      {count ? <span style={{ opacity: 0.7, fontWeight: 600 }}>({compact(count)})</span> : null}
    </span>
  );
}

export const compact = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n);

/** Veg / non-veg mark, the square-dot convention Indian packaging uses. */
export function FoodMark({ type, size = 14 }: { type?: 'veg' | 'nonveg'; size?: number }) {
  if (!type) return null;
  const color = type === 'veg' ? 'var(--veg)' : 'var(--nonveg)';
  return (
    <span
      title={type === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        border: `1.5px solid ${color}`,
        borderRadius: 3,
        flexShrink: 0,
      }}
    >
      <span style={{ width: size / 2.6, height: size / 2.6, borderRadius: '50%', background: color }} />
    </span>
  );
}

/* -------------------------------- section -------------------------------- */

export function SectionHead({
  title,
  subtitle,
  href,
  eyebrow,
  previews,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  eyebrow?: string;
  /** Up to three product photos shown as little circles inside the "See all" link. */
  previews?: string[];
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 16 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div> : null}
        <h2 className="h2">{title}</h2>
        {subtitle ? (
          <p className="body-sm" style={{ marginTop: 2 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        {children ?? (href ? <SeeAll href={href} previews={previews} /> : null)}
      </div>
    </div>
  );
}

/**
 * The "See all" link. With `previews` it shows up to three product photos as
 * overlapping circles, like the storefront apps, so the row previews itself.
 */
export function SeeAll({ href, previews, label = 'See all' }: { href: string; previews?: string[]; label?: string }) {
  const peek = (previews ?? []).filter(Boolean).slice(0, 3);
  return (
    <a href={href} className={`see-all-peek${peek.length ? '' : ' btn btn-sm btn-ghost'}`}>
      {peek.length ? (
        <span className="see-all-peek__imgs" aria-hidden="true">
          {peek.map((src, i) => (
            <span key={i} className="see-all-peek__img">
              {/* Plain img keeps these tiny thumbs config-free, as the gallery/video tiles already do. */}
              <img src={src} alt="" loading="lazy" />
            </span>
          ))}
        </span>
      ) : null}
      {label}
      <Icon name="chevron-right" size={15} />
    </a>
  );
}

/* --------------------------------- money --------------------------------- */

export function Price({ price, mrp, size = 15 }: { price: number; mrp?: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span className="num" style={{ fontSize: size, fontWeight: 750, letterSpacing: '-0.02em' }}>
        ₹{price}
      </span>
      {mrp && mrp > price ? (
        <span className="num" style={{ fontSize: size - 3, color: 'var(--ink-4)', textDecoration: 'line-through' }}>
          ₹{mrp}
        </span>
      ) : null}
    </span>
  );
}
