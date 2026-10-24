import React, { useEffect, useState } from 'react';
import { changeMyPassword, fetchMe, updateMe } from '../api/admin';
import { getErrorMessage, tokens } from '../api/client';
import { API_URL } from '../config';
import { IconCheck, IconSettings, IconShield } from '../components/icons';
import { Badge, Button, Card, ErrorBanner, Field, formatDate } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useStats } from '../context/StatsContext';
import { AdminUser } from '../types';

export default function SettingsPage() {
  const { user } = useAuth();
  const { stats, lastUpdated } = useStats();
  const [me, setMe] = useState<(AdminUser & { lastLoginAt?: string; createdAt?: string }) | null>(null);

  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((u) => {
        setMe(u);
        setProfile({ name: u.name ?? '', email: u.email ?? '', phone: u.phone ?? '' });
      })
      .catch((err) => setProfileErr(getErrorMessage(err)));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileErr('');
    setProfileMsg('');
    try {
      const updated = await updateMe(profile);
      setMe((m) => (m ? { ...m, ...updated } : m));
      tokens.save(tokens.access ?? '', tokens.refresh ?? '', { ...(tokens.user as object), ...updated });
      setProfileMsg('Profile saved. Refresh to see the new name in the corner.');
    } catch (err) {
      setProfileErr(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr('');
    setPwMsg('');
    if (pw.next.length < 8) return setPwErr('New password must be at least 8 characters.');
    if (pw.next !== pw.confirm) return setPwErr('The two new passwords do not match.');
    setSavingPw(true);
    try {
      const res = await changeMyPassword(pw.current, pw.next);
      tokens.save(res.accessToken, res.refreshToken, tokens.user ?? undefined);
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg('Password changed. Other devices have been signed out.');
    } catch (err) {
      setPwErr(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-subtitle">Manage your administrator account and review this panel's connection details.</div>
        </div>
      </div>

      <div className="grid grid-2">
        <Card title="Your profile" icon={<IconSettings size={16} />}>
          <form onSubmit={saveProfile}>
            <ErrorBanner message={profileErr} />
            {profileMsg && (
              <div className="error-banner" style={{ background: 'var(--ok-soft)', borderColor: 'rgba(46,212,122,.3)', color: '#9ff0c4' }}>
                {profileMsg}
              </div>
            )}
            <Field label="Name">
              <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
            </Field>
            <div className="field-row">
              <Field label="Email">
                <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save profile'}
              </Button>
              <Badge tone="danger">{(me?.role ?? user?.role ?? 'admin').toUpperCase()}</Badge>
            </div>
            {me?.lastLoginAt && (
              <div className="cell-muted" style={{ marginTop: 12 }}>
                Last login {formatDate(me.lastLoginAt)}
                {me.createdAt ? ` · account created ${formatDate(me.createdAt)}` : ''}
              </div>
            )}
          </form>
        </Card>

        <Card title="Password" icon={<IconShield size={16} />}>
          <form onSubmit={savePassword}>
            <ErrorBanner message={pwErr} />
            {pwMsg && (
              <div className="error-banner" style={{ background: 'var(--ok-soft)', borderColor: 'rgba(46,212,122,.3)', color: '#9ff0c4' }}>
                {pwMsg}
              </div>
            )}
            <Field label="Current password">
              <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
            </Field>
            <div className="field-row">
              <Field label="New password">
                <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
              </Field>
              <Field label="Confirm new password">
                <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
              </Field>
            </div>
            <Button type="submit" disabled={savingPw}>
              {savingPw ? 'Updating…' : 'Change password'}
            </Button>
            <div className="cell-muted" style={{ marginTop: 12 }}>
              Changing it signs out every other device using this account.
            </div>
          </form>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Connection" icon={<IconCheck size={16} />}>
          <InfoRow label="API endpoint" value={API_URL} />
          <InfoRow label="Panel version" value="Bingoor Admin v2 · future-ready build" />
          <InfoRow label="Data refreshed" value={lastUpdated ? formatDate(lastUpdated.toISOString()) : '—'} />
          <InfoRow label="Auto refresh" value="Every 60 seconds, plus whenever you return to this tab" />
        </Card>

        <Card title="Platform summary" icon={<IconSettings size={16} />}>
          <InfoRow label="Products" value={stats ? `${stats.products.active} active of ${stats.products.total}` : '—'} />
          <InfoRow label="Categories" value={stats ? String(stats.categories) : '—'} />
          <InfoRow label="Shops" value={stats ? String(stats.shops) : '—'} />
          <InfoRow
            label="Accounts"
            value={
              stats
                ? Object.entries(stats.usersByRole ?? {})
                    .map(([r, c]) => `${c.total} ${r}`)
                    .join(' · ')
                : '—'
            }
          />
          <InfoRow label="Orders" value={stats ? `${stats.orders.total} all-time` : '—'} />
        </Card>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="cell-muted">{label}</span>
      <span style={{ textAlign: 'right', wordBreak: 'break-all', fontWeight: 600, fontSize: 13 }}>{value}</span>
    </div>
  );
}
