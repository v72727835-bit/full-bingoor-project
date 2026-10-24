import React, { useEffect, useState } from 'react';
import { fetchTicket, fetchTickets, replyTicket, setTicketStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Modal, Pagination, Tabs, timeAgo } from '../components/ui';
import { PageMeta, Ticket } from '../types';

const customerOf = (t: Ticket) => (typeof t.user === 'string' ? null : t.user);

/**
 * "Chat with customer care": every query a customer sent, and the replies.
 *
 * Each reply raises the unread badge on the customer's menu, so the thread is
 * the whole conversation rather than a one-shot ticket.
 */
export default function SupportPage() {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { unread?: number }) | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchTickets({ page, limit: 20, status: tab })
      .then(({ items, meta }) => {
        setTickets(items);
        setMeta(meta);
        setError('');
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  // Chats arrive while the page is open, so refresh on a timer as well.
  useEffect(() => {
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Chat with customer care</h1>
          <div className="page-subtitle">Customer queries and your replies. Refreshes every 20 seconds.</div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        options={[
          { value: 'open', label: 'Open', count: meta?.unread },
          { value: 'closed', label: 'Closed' },
        ]}
      />

      <ErrorBanner message={error} />

      {loading && !tickets.length ? (
        <CenterSpinner />
      ) : tickets.length === 0 ? (
        <div className="card">
          <div className="empty-state">No {tab} chats.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Query</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const user = customerOf(t);
                  return (
                    <tr key={t._id}>
                      <td className="cell-name">
                        {user?.name ?? '—'}
                        {t.adminUnread > 0 && (
                          <>
                            {' '}
                            <Badge tone="brand">{t.adminUnread} new</Badge>
                          </>
                        )}
                      </td>
                      <td className="cell-muted">{t.phone}</td>
                      <td className="cell-muted" style={{ maxWidth: 360 }}>
                        {t.query}
                      </td>
                      <td className="cell-muted">{timeAgo(t.lastMessageAt)}</td>
                      <td>
                        <Button size="sm" variant="secondary" onClick={() => setOpenId(t._id)}>
                          Open chat
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && <Pagination page={page} totalPages={meta.totalPages} onChange={setPage} />}

      {openId && (
        <ChatModal
          id={openId}
          onClose={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ChatModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    fetchTicket(id)
      .then(setTicket)
      .catch((err) => setError(getErrorMessage(err)));
  };
  useEffect(load, [id]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      setTicket(await replyTicket(id, text.trim()));
      setText('');
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const close = async (status: 'open' | 'closed') => {
    try {
      setTicket(await setTicketStatus(id, status));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const user = ticket && customerOf(ticket);

  return (
    <Modal title={user?.name ? `Chat with ${user.name}` : 'Customer chat'} onClose={onClose} wide>
      <div className="cell-muted" style={{ marginBottom: 10 }}>
        {ticket?.phone}
      </div>

      <ErrorBanner message={error} />

      {!ticket ? (
        <CenterSpinner />
      ) : (
        <>
          <div className="chat-log">
            {ticket.messages.map((m, i) => (
              <div key={i} className={`chat-msg${m.from === 'admin' ? ' chat-msg-admin' : ''}`}>
                <div className="chat-bubble">{m.text}</div>
                <div className="chat-time">
                  {m.from === 'admin' ? 'You' : user?.name ?? 'Customer'} · {timeAgo(m.at)}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={send} className="row-flex" style={{ marginTop: 12 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" style={{ flex: 1 }} autoFocus />
            <Button type="submit" disabled={sending || !text.trim()}>
              {sending ? 'Sending…' : 'Reply'}
            </Button>
          </form>

          <div className="modal-actions">
            <Button variant="secondary" onClick={() => close(ticket.status === 'open' ? 'closed' : 'open')}>
              {ticket.status === 'open' ? 'Mark as solved' : 'Reopen chat'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
