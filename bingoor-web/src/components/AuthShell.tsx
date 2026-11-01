'use client';

import React from 'react';
import { Icon, IconName } from './Icon';
import s from './AuthShell.module.css';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'bolt', text: 'Delivered in minutes from shops near you' },
  { icon: 'wallet', text: 'Pay by cash on delivery or online — your choice' },
  { icon: 'repeat', text: 'Reorder anything from your history in one tap' },
];

/** Split layout shared by login and signup so the two feel like one flow. */
export function AuthShell({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className={s.wrap}>
      <aside className={s.pitch}>
        <div className={s.logo}>
          <img src="/logo-mark.png" alt="" width={38} height={38} className={s.mark} />
          <span className={s.word}>Bingoor</span>
        </div>
        <h2 className={s.pitchTitle}>Everyday essentials, at your door in minutes.</h2>
        <ul className={s.points}>
          {POINTS.map((p) => (
            <li key={p.text}>
              <span className={s.pIcon}>
                <Icon name={p.icon} size={16} />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </aside>

      <section className={s.form}>
        <h1 className="h1" style={{ marginBottom: 6 }}>
          {title}
        </h1>
        <p className="body-sm" style={{ marginBottom: 24 }}>
          {lead}
        </p>
        {children}
        <div className={s.footer}>{footer}</div>
      </section>
    </div>
  );
}
