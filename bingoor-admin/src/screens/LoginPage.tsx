import React, { useState } from 'react';
import { Navigate } from '../navigation';
import { Button, ErrorBanner, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seller, setSeller] = useState(true);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password, seller);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <aside className="login-brand">
        <img className="logo-mark login-brand-logo" src="/logo-mark.png" alt="Bingoor" width={120} height={120} />
        <div className="login-brand-word">Bingoor</div>
        <div className="login-brand-tag">Quick-commerce control panel</div>
      </aside>
      <form className="login-card" onSubmit={submit}>
        <h1 className="login-title">{seller ? 'Seller login' : 'Admin login'}</h1>
        <div className="login-sub">{seller ? 'Sign in with the warehouse login Bingoor gave you to manage products, orders and riders.' : 'Sign in to manage products, orders, riders and offers.'}</div>
        <ErrorBanner message={error} />
        <Field label="Email or phone">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="admin@bingoor.com"
            autoFocus
            required
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>
        <Button type="submit" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="login-or"><span>OR</span></div>
        <button type="button" className="login-switch" onClick={() => { setSeller((v) => !v); setError(''); }}>
          {seller ? 'Admin login' : 'Seller login'}
        </button>
      </form>
    </div>
  );
}
