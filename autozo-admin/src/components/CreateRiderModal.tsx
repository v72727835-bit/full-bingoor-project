import React, { useEffect, useState } from 'react';
import { createRider, fetchAllShops, updateUser } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { RiderRow, Shop } from '../types';
import { Button, ErrorBanner, Field, Modal } from './ui';
import WarehouseChecks from './WarehouseChecks';

/** Creates a rider login: the rider signs in to the rider app with this phone number and password. */
export default function CreateRiderModal({ rider, onClose, onDone }: { rider?: RiderRow; onClose: () => void; onDone: () => void }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [f, setF] = useState({ name: rider?.name ?? '', phone: rider?.phone ?? '', email: rider?.email ?? '', password: '', isActive: rider?.isActive ?? true, warehouses: rider?.warehouses?.length ? rider.warehouses.map((w) => w._id) : rider?.warehouse ? [typeof rider.warehouse === 'string' ? rider.warehouse : rider.warehouse._id] : [] as string[] });
  const [longDistance, setLongDistance] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetchAllShops().then(setShops).catch((e) => setError(getErrorMessage(e)));
  }, []);
  const gen = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    setF((cur) => ({ ...cur, password: [...bytes].map((b) => chars[b % chars.length]).join('') + '@7' }));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (f.warehouses.length === 0) {
      setError('Choose at least one warehouse.');
      return;
    }
    setBusy(true);
    try {
      if (rider) await updateUser(rider._id, { ...f, password: f.password || undefined });
      else {
        await createRider({ ...f, longDistance });
        window.alert(`Rider created.\n\nRider app login (phone): ${f.phone}\nPassword: ${f.password}\n\nShare this with the rider now - the password cannot be shown again.`);
      }
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={rider ? 'Edit rider' : 'New rider'} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner message={error} />
        <Field label="Rider name">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </Field>
        <Field label="Phone number (rider app login, 10 digits)">
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="numeric" required />
        </Field>
        <Field label="Email (optional)"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        {rider && <label className="checkbox-row"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />Account active</label>}
        <Field label={rider ? 'New password (leave blank to keep current)' : 'Password (at least 6 characters)'}>
          <div className="row-flex">
            <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required={!rider} minLength={6} maxLength={72} style={{ flex: 1 }} />
            <Button type="button" variant="secondary" onClick={gen}>
              Generate
            </Button>
          </div>
        </Field>
        <Field label="Warehouses (tick one or more)">
          <WarehouseChecks options={shops} value={f.warehouses} onChange={(warehouses) => setF({ ...f, warehouses })} />
        </Field>
        {!rider && (
          <label className="checkbox-row">
            <input type="checkbox" checked={longDistance} onChange={(e) => setLongDistance(e.target.checked)} />
            Special long-distance rider (gets orders beyond 15 km)
          </label>
        )}
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : rider ? 'Save rider' : 'Create rider'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
