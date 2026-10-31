"use client";

import React, { useEffect, useState } from 'react';
import { sellerChangePassword, sellerShops, sellerUpdateShop, WarehouseShop } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Field } from '../components/ui';
import type { Me } from './SellerApp';

/** The store itself: open or closed, delivery fee, minimum order, delivery radius, contact and address. */
export function StoreView() {
  const [shops, setShops] = useState<WarehouseShop[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    sellerShops().then(setShops).catch((e) => setError(getErrorMessage(e)));
  }, []);
  if (!shops) return error ? <ErrorBanner message={error} /> : <CenterSpinner />;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Store settings</h1>
          <div className="page-subtitle">Open or close your warehouse, set delivery rules and keep your contact details right.</div>
        </div>
      </div>
      {shops.map((s) => <ShopCard key={s._id} shop={s} />)}
    </>
  );
}

function ShopCard({ shop }: { shop: WarehouseShop }) {
  const [f, setF] = useState({
    name: shop.name, description: shop.description ?? '', phone: shop.phone ?? '',
    line1: shop.address?.line1 ?? '', city: shop.address?.city ?? '', state: shop.address?.state ?? '', pincode: shop.address?.pincode ?? '',
    deliveryRadiusKm: String(shop.deliveryRadiusKm), minOrderAmount: String(shop.minOrderAmount), deliveryFee: String(shop.deliveryFee), gstin: shop.gstin ?? '',
  });
  const [isOpen, setIsOpen] = useState(shop.isOpen);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((cur) => ({ ...cur, [k]: v }));

  const toggle = async () => {
    setError('');
    try {
      await sellerUpdateShop(shop._id, { isOpen: !isOpen });
      setIsOpen(!isOpen);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await sellerUpdateShop(shop._id, {
        name: f.name, description: f.description, phone: f.phone,
        address: { line1: f.line1, city: f.city, state: f.state, pincode: f.pincode },
        deliveryRadiusKm: Number(f.deliveryRadiusKm) || 0, minOrderAmount: Number(f.minOrderAmount) || 0, deliveryFee: Number(f.deliveryFee) || 0, gstin: f.gstin.trim().toUpperCase(),
      });
      setMsg('Saved.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card card-pad" onSubmit={save} style={{ marginBottom: 16 }}>
      <div className="row-flex" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 className="card-title" style={{ margin: 0 }}>{shop.name} {isOpen ? <Badge tone="success">Open</Badge> : <Badge tone="danger">Closed</Badge>}</h2>
        <Button type="button" variant={isOpen ? 'secondary' : 'primary'} onClick={toggle}>{isOpen ? 'Close the store' : 'Open the store'}</Button>
      </div>
      <ErrorBanner message={error} />
      {msg && <div className="badge badge-success" style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="field-row">
        <Field label="Warehouse name"><input value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} /></Field>
        <Field label="Contact phone"><input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
      </div>
      <Field label="About this warehouse"><textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={500} /></Field>
      <Field label="Address"><input value={f.line1} onChange={(e) => set('line1', e.target.value)} /></Field>
      <div className="field-row">
        <Field label="City"><input value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="State"><input value={f.state} onChange={(e) => set('state', e.target.value)} /></Field>
        <Field label="PIN code"><input value={f.pincode} onChange={(e) => set('pincode', e.target.value)} maxLength={10} /></Field>
      </div>
      <div className="field-row">
        <Field label="Delivery radius (km)"><input type="number" min={0} step="0.5" value={f.deliveryRadiusKm} onChange={(e) => set('deliveryRadiusKm', e.target.value)} /></Field>
        <Field label="Minimum order ₹"><input type="number" min={0} value={f.minOrderAmount} onChange={(e) => set('minOrderAmount', e.target.value)} /></Field>
        <Field label="Delivery fee ₹"><input type="number" min={0} value={f.deliveryFee} onChange={(e) => set('deliveryFee', e.target.value)} /></Field>
        <Field label="GSTIN (printed on your bills)"><input value={f.gstin} maxLength={15} onChange={(e) => set('gstin', e.target.value.toUpperCase())} placeholder="09ABCDE1234F1Z5" /></Field>
      </div>
      <div className="modal-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button></div>
    </form>
  );
}

/** Who is signed in, and changing the password. */
export function AccountView({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (next !== again) return setError('The two new passwords do not match.');
    setBusy(true);
    try {
      await sellerChangePassword(cur, next);
      setMsg('Password changed. Use the new one next time you sign in.');
      setCur(''); setNext(''); setAgain('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My account</h1>
          <div className="page-subtitle">Your sign-in details.</div>
        </div>
        <Button variant="secondary" onClick={onLogout}>Log out</Button>
      </div>
      <div className="grid grid-2">
        <div className="card card-pad">
          <h2 className="card-title">Profile</h2>
          <div><b>{me.user.name}</b></div>
          <div className="cell-muted">Phone (your login): {me.user.phone}</div>
          {me.user.email && <div className="cell-muted">Email: {me.user.email}</div>}
          <div className="cell-muted">Warehouses: {(me.user.sellerWarehouses ?? []).map((w) => w.name).join(', ') || '-'}</div>
        </div>
        <form className="card card-pad" onSubmit={save}>
          <h2 className="card-title">Change password</h2>
          <ErrorBanner message={error} />
          {msg && <div className="badge badge-success" style={{ marginBottom: 10 }}>{msg}</div>}
          <Field label="Current password"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></Field>
          <Field label="New password (at least 6 characters)"><input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required /></Field>
          <Field label="New password again"><input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={6} required /></Field>
          <div className="modal-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</Button></div>
        </form>
      </div>
    </>
  );
}
