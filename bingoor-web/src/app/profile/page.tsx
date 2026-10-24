'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { updateMe } from '../../api/account';
import { fetchUnreadCount } from '../../api/support';
import { changePassword } from '../../api/auth';
import { getErrorMessage } from '../../lib/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { Crumbs } from '../../components/Crumbs';
import { Icon, IconName } from '../../components/Icon';
import { RequireAuth } from '../../components/RequireAuth';
import { Alert, Button, Field, Input } from '../../components/ui';
import s from './profile.module.css';

const SHORTCUTS: { href: string; label: string; body: string; icon: IconName }[] = [
  { href: '/orders', label: 'Your orders', body: 'Track an order or buy it again', icon: 'package' },
  { href: '/addresses', label: 'Your addresses', body: 'Home, work or anywhere else', icon: 'pin' },
  { href: '/wishlist', label: 'Your wishlist', body: 'Items you saved for later', icon: 'heart' },
  { href: '/support', label: 'Chat with customer care', body: 'We reply within a couple of hours', icon: 'chat' },
];

function ProfileInner() {
  const { user, logout, setUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { show } = useToast();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);

  // Replies the team has sent that the customer has not opened yet.
  const [careUnread, setCareUnread] = useState(0);
  useEffect(() => {
    fetchUnreadCount()
      .then(setCareUnread)
      .catch(() => undefined);
  }, []);

  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const u = await updateMe({ name: name.trim(), email: email.trim() || undefined });
      setUser(u);
      try {
        localStorage.setItem('autozo_user', JSON.stringify(u));
      } catch {
        /* private mode — the server copy is still updated */
      }
      show('Your profile has been updated', 'success');
    } catch (err) {
      show(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr('');
    setPwBusy(true);
    try {
      await changePassword(cur, next);
      setCur('');
      setNext('');
      show('Your password has been changed', 'success');
    } catch (err) {
      setPwErr(getErrorMessage(err));
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="page rise">
      <Crumbs trail={[{ label: 'Account' }]} />

      <header className={s.hero}>
        <span className={s.avatar}>{(user?.name ?? 'B').charAt(0).toUpperCase()}</span>
        <div style={{ minWidth: 0 }}>
          <h1 className="h1 clamp-1">{user?.name}</h1>
          <p className="body-sm">
            {user?.phone}
            {user?.email ? ` · ${user.email}` : ''}
          </p>
        </div>
        <button className={s.themeBtn} onClick={toggle}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      <div className={s.cards}>
        {SHORTCUTS.map((item) => (
          <Link key={item.href} href={item.href} className={`card card-hover ${s.shortcut}`}>
            <span className={s.sIcon}>
              <Icon name={item.icon} size={20} />
            </span>
            <span className={s.sText}>
              <span className={s.sLabel}>{item.label}</span>
              <span className={s.sBody}>{item.body}</span>
            </span>
            {item.href === '/support' && careUnread > 0 ? (
              <span className={`num ${s.unread}`}>{careUnread}</span>
            ) : null}
            <span className={s.chev}>
              <Icon name="chevron-right" size={17} />
            </span>
          </Link>
        ))}
      </div>

      <div className={s.forms}>
        <section className="card card-pad">
          <h2 className="h3" style={{ marginBottom: 16 }}>
            Profile details
          </h2>
          <form onSubmit={saveProfile}>
            <Field label="Full name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Email" hint="optional">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone" hint="cannot be changed">
              <Input value={user?.phone ?? ''} disabled />
            </Field>
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </form>
        </section>

        <section className="card card-pad">
          <h2 className="h3" style={{ marginBottom: 16 }}>
            Change password
          </h2>
          {pwErr ? <Alert tone="bad">{pwErr}</Alert> : null}
          <form onSubmit={savePw}>
            <Field label="Current password" required>
              <Input
                type="password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="New password" required hint="at least 6 characters">
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </Field>
            <Button type="submit" variant="outline" loading={pwBusy} icon="lock">
              Update password
            </Button>
          </form>
        </section>
      </div>

      <div className={s.out}>
        <Button
          variant="danger"
          icon="logout"
          onClick={async () => {
            await logout();
            router.replace('/');
          }}
        >
          Logout
        </Button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}
