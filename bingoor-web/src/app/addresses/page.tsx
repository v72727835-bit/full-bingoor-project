'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AddressInput,
  addAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
} from '../../api/account';
import { getErrorMessage } from '../../lib/client';
import { Address } from '../../lib/types';
import { useToast } from '../../context/ToastContext';
import { AddressForm } from '../../components/AddressForm';
import { Crumbs } from '../../components/Crumbs';
import { Icon, IconName } from '../../components/Icon';
import { RequireAuth } from '../../components/RequireAuth';
import { Badge, Button, EmptyState } from '../../components/ui';
import s from './addresses.module.css';

const LABEL_ICON: Record<Address['label'], IconName> = { home: 'home', work: 'store', other: 'pin' };

function AddressesInner() {
  const { show } = useToast();
  const [list, setList] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);

  const load = useCallback(() => {
    fetchAddresses()
      .then(setList)
      .catch((e) => {
        show(getErrorMessage(e), 'error');
        setList([]);
      });
  }, [show]);

  useEffect(load, [load]);

  const save = async (body: AddressInput) => {
    if (editing && editing !== 'new') await updateAddress(editing.id, body);
    else await addAddress(body);
    setEditing(null);
    load();
    show('Address saved', 'success');
  };

  const run = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      load();
      show(msg, 'success');
    } catch (e) {
      show(getErrorMessage(e), 'error');
    }
  };

  return (
    <div className="page rise" style={{ maxWidth: 820 }}>
      <Crumbs trail={[{ label: 'Account', href: '/profile' }, { label: 'Addresses' }]} />

      <div className="page-head">
        <div>
          <h1 className="h1">Your addresses</h1>
          <p className="body-sm">Where we deliver your orders</p>
        </div>
        {!editing ? (
          <Button icon="plus" onClick={() => setEditing('new')}>
            Add address
          </Button>
        ) : null}
      </div>

      {editing ? (
        <section className="card card-pad">
          <h2 className="h3" style={{ marginBottom: 18 }}>
            {editing === 'new' ? 'Add a new address' : 'Edit address'}
          </h2>
          <AddressForm
            initial={editing === 'new' ? undefined : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </section>
      ) : !list ? (
        <div className="stack" style={{ gap: 12 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="sk" style={{ height: 136, borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="pin"
          title="No addresses yet"
          body="Add an address so we know where to deliver."
          action={<Button onClick={() => setEditing('new')}>Add address</Button>}
        />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {list.map((a) => (
            <article key={a.id} className={`card ${s.addr}`}>
              <div className={s.aTop}>
                <span className={s.aIcon}>
                  <Icon name={LABEL_ICON[a.label]} size={17} />
                </span>
                <span className={s.cap}>{a.label}</span>
                {a.isDefault ? <Badge>Default</Badge> : null}
              </div>
              <p className={s.aWho}>
                {a.name} · {a.phone}
              </p>
              <p className={s.aText}>
                {[a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
              </p>
              <div className={s.aActs}>
                <Button size="sm" variant="outline" icon="edit" onClick={() => setEditing(a)}>
                  Edit
                </Button>
                {!a.isDefault ? (
                  <Button
                    size="sm"
                    variant="soft"
                    icon="check"
                    onClick={() => run(() => setDefaultAddress(a.id), 'Default address updated')}
                  >
                    Make default
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  icon="trash"
                  onClick={() => run(() => deleteAddress(a.id), 'Address removed')}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddressesPage() {
  return (
    <RequireAuth>
      <AddressesInner />
    </RequireAuth>
  );
}
