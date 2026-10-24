import React from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { IconArrowDown, IconArrowUp } from './icons';

export function Spinner() {
  return <div className="spinner" />;
}

export function CenterSpinner() {
  return (
    <div className="center-screen">
      <Spinner />
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm';
}) {
  return (
    <button className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''}`} {...rest}>
      {children}
    </button>
  );
}

export type Tone = 'success' | 'warn' | 'danger' | 'info' | 'muted' | 'brand';

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Card({
  title,
  action,
  icon,
  children,
  pad = true,
}: {
  title?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
}) {
  return (
    <div className="card">
      {title && (
        <div className="card-head">
          <h3 className="card-title">
            {icon}
            {title}
          </h3>
          {action}
        </div>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
      {hint && <div style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="error-banner">{message}</div>;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 680 } : undefined}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="tabs">
      {options.map((o) => (
        <button key={o.value} className={`tab${o.value === value ? ' active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="tab-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prev
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </div>
  );
}

/* ---------- stat card with delta + sparkline ---------- */

export function Delta({ current, previous, suffix }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) return <span className="delta flat">no change{suffix ? ` ${suffix}` : ''}</span>;
  if (previous === 0) return <span className="delta up">new{suffix ? ` ${suffix}` : ''}</span>;
  const pct = ((current - previous) / previous) * 100;
  const dir = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
  return (
    <span className={`delta ${dir}`}>
      {dir === 'up' && <IconArrowUp />}
      {dir === 'down' && <IconArrowDown />}
      {Math.abs(pct).toFixed(1)}%{suffix ? ` ${suffix}` : ''}
    </span>
  );
}

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const width = 120;
  const height = 36;
  const points = data
    .map((value, index) => {
      const x = data.length <= 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = height - ((value - min) / Math.max(max - min, 1)) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="spark" aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'var(--brand)',
  toneSoft = 'var(--brand-soft)',
  hint,
  delta,
  spark,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: string;
  toneSoft?: string;
  hint?: string;
  delta?: React.ReactNode;
  spark?: number[];
}) {
  return (
    <div className="stat-card" style={{ ['--tone' as string]: tone, ['--tone-soft' as string]: toneSoft }}>
      <div className="stat-top">
        {icon && <div className="stat-icon">{icon}</div>}
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
      </div>
      <div className="stat-foot">
        <div>
          {delta}
          {hint && <div className="stat-hint">{hint}</div>}
        </div>
        {spark && spark.some((n) => n > 0) && <Sparkline data={spark} color={tone} />}
      </div>
    </div>
  );
}

/* ---------- product/shop thumbnail ---------- */

export function Thumb({ src, fallback }: { src?: string; fallback?: string }) {
  if (src) return <img className="thumb" src={src} alt="" />;
  return (
    <div className="thumb thumb-fallback" aria-hidden>
      {fallback ?? '📦'}
    </div>
  );
}

/* ---------- formatting ---------- */

export function money(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** 12,80,000 → ₹12.8L — keeps big KPI numbers from wrapping. */
export function moneyShort(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
