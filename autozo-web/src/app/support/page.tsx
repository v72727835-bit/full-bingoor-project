'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyTickets, fetchTicket, sendMessage, startChat } from '../../api/support';
import { RequireAuth } from '../../components/RequireAuth';
import { Crumbs } from '../../components/Crumbs';
import { Icon } from '../../components/Icon';
import { Alert, Button, Field, PageLoader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/client';
import { Ticket } from '../../lib/types';
import s from './support.module.css';

/**
 * "Chat with customer care". A customer describes the problem once; every
 * reply from the team lands in the same thread, so the page is a list of
 * conversations rather than one-shot tickets.
 */
export default function SupportPage() {
  return (
    <RequireAuth>
      <SupportInner />
    </RequireAuth>
  );
}

function SupportInner() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchMyTickets()
      .then((list) => {
        setTickets(list);
        setError('');
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(load, [load]);

  // A failed load used to leave the spinner turning for ever; say what went wrong instead.
  if (!tickets && error)
    return (
      <div className="page" style={{ paddingTop: 24, maxWidth: 560 }}>
        <Alert tone="bad">{error}</Alert>
        <Button icon="repeat" onClick={load}>
          Try again
        </Button>
      </div>
    );

  if (!tickets) return <PageLoader />;

  return (
    <div className="page rise" style={{ paddingTop: 22, maxWidth: 760 }}>
      <Crumbs trail={[{ label: 'Account', href: '/profile' }, { label: 'Chat with customer care' }]} />

      <div className={s.head}>
        <div>
          <h1 className="h1">Chat with customer care</h1>
          <p className="body-sm">Tell us what went wrong and our team will reply here.</p>
        </div>
        {!starting && (
          <Button icon="plus" onClick={() => setStarting(true)}>
            Start chat
          </Button>
        )}
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      {starting ? (
        <StartForm
          onCancel={() => setStarting(false)}
          onStarted={(t) => {
            setStarting(false);
            setOpenId(t.id);
            load();
          }}
        />
      ) : null}

      {openId ? <Thread id={openId} onClose={() => { setOpenId(null); load(); }} /> : null}

      {!starting && !openId ? (
        tickets.length === 0 ? (
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <p className="body-sm">You have not started a chat yet.</p>
          </div>
        ) : (
          <ul className={s.list}>
            {tickets.map((t) => (
              <li key={t.id}>
                <button className={`card card-hover ${s.row}`} onClick={() => setOpenId(t.id)}>
                  <span className={s.rowIcon}>
                    <Icon name="info" size={18} />
                  </span>
                  <span className={s.rowBody}>
                    <span className={`${s.rowTitle} clamp-1`}>{t.query}</span>
                    <span className={s.rowMeta}>
                      {t.status === 'open' ? 'Open' : 'Solved'} ·{' '}
                      {new Date(t.lastMessageAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  {t.customerUnread > 0 ? <span className={`num ${s.badge}`}>{t.customerUnread}</span> : null}
                  <Icon name="chevron-right" size={17} />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function StartForm({ onCancel, onStarted }: { onCancel: () => void; onStarted: (t: Ticket) => void }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const { ticket, message } = await startChat(query.trim(), phone.trim());
      setDone(message);
      // Let the customer read the confirmation before the thread opens.
      setTimeout(() => onStarted(ticket), 1400);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  if (done) return <Alert tone="ok">{done}</Alert>;

  return (
    <form className="card card-pad" onSubmit={submit}>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <Field label="Your query" required>
        <textarea
          className="input"
          rows={4}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tell us what happened"
          required
          minLength={3}
          autoFocus
        />
      </Field>
      <Field label="Your mobile number" required>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          placeholder="10-digit mobile number"
          required
        />
      </Field>
      <div className={s.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={sending}>
          Submit
        </Button>
      </div>
    </form>
  );
}

function Thread({ id, onClose }: { id: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchTicket(id)
      .then(setTicket)
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);

  // Replies arrive while the chat is open, so keep checking.
  useEffect(() => {
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [ticket?.messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      setTicket(await sendMessage(id, text.trim()));
      setText('');
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  if (!ticket && error)
    return (
      <section className="card card-pad">
        <Alert tone="bad">{error}</Alert>
        <Button variant="outline" onClick={onClose}>
          Back to chats
        </Button>
      </section>
    );

  if (!ticket) return <PageLoader />;

  return (
    <section className="card card-pad">
      <div className={s.threadHead}>
        <button className={s.back} onClick={onClose}>
          <Icon name="chevron-left" size={17} />
          All chats
        </button>
        <span className={`badge ${ticket.status === 'open' ? 'badge-brand' : 'badge-ok'}`}>
          {ticket.status === 'open' ? 'Open' : 'Solved'}
        </span>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      <div className={s.log}>
        {ticket.messages.map((m, i) => (
          <div key={i} className={`${s.msg} ${m.from === 'customer' ? s.msgMine : ''}`}>
            <p className={s.bubble}>{m.text}</p>
            <span className={s.when}>
              {m.from === 'customer' ? 'You' : 'Bingoor care'} ·{' '}
              {new Date(m.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form className={s.composer} onSubmit={send}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          aria-label="Message"
        />
        <Button type="submit" loading={sending} disabled={!text.trim()}>
          Send
        </Button>
      </form>
    </section>
  );
}
