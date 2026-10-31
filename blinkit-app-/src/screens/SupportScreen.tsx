import Icon from '@react-native-vector-icons/ionicons/static';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { getErrorMessage } from '../api/client';
import { fetchMyTickets, fetchTicket, replyToTicket, startChat } from '../api/support';
import { useAuth } from '../context/AuthContext';
import { gutter, ms, radius, space, themed, useTheme } from '../theme';
import type { Ticket } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner, EmptyState, FullScreenLoader } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { Pill } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { TextField } from '../ui/TextField';

/**
 * "Chat with customer care".
 *
 * One thread per problem rather than a one-shot form: the customer describes
 * it once, every reply from the team lands in the same place, and nobody has
 * to repeat themselves on the phone.
 */
export function SupportScreen() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setTickets(await fetchMyTickets());
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (openId) {
    return (
      <Thread
        id={openId}
        onClose={() => {
          setOpenId(null);
          void load();
        }}
      />
    );
  }

  if (starting) {
    return (
      <StartForm
        onCancel={() => setStarting(false)}
        onStarted={(t) => {
          setStarting(false);
          setOpenId(t._id);
          void load();
        }}
      />
    );
  }

  if (!tickets) return <FullScreenLoader label="Opening your chats…" />;

  return (
    <Screen>
      <AppHeader title="Chat with customer care" subtitle="We reply within a couple of hours" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {error ? <Banner tone="danger" message={error} style={styles.banner} /> : null}

        <Button label="Start a new chat" icon="chatbubble-ellipses-outline" block onPress={() => setStarting(true)} />

        {tickets.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No chats yet"
            message="Tell us what went wrong with an order and our team will reply right here."
          />
        ) : (
          <View style={styles.list}>
            {tickets.map((t) => (
              <TicketRow key={t._id} ticket={t} onPress={() => setOpenId(t._id)} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function TicketRow({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ticket.query}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.rowIcon}>
        <Icon name="help-circle-outline" size={ms(20)} color={c.brand} />
      </View>
      <View style={styles.rowBody}>
        <Txt variant="label" numberOfLines={2}>
          {ticket.query}
        </Txt>
        <Txt variant="caption" tone="faint" style={styles.rowWhen}>
          {ticket.status === 'open' ? 'Open' : 'Solved'} ·{' '}
          {new Date(ticket.lastMessageAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </Txt>
      </View>
      {ticket.customerUnread > 0 ? <Pill label={String(ticket.customerUnread)} tone="danger" solid /> : null}
      <Icon name="chevron-forward" size={ms(18)} color={c.inkMuted} />
    </Pressable>
  );
}

function StartForm({ onCancel, onStarted }: { onCancel: () => void; onStarted: (t: Ticket) => void }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await startChat(query.trim(), phone.trim());
      setDone(result.message);
      // Let the customer read the confirmation before the thread opens.
      setTimeout(() => onStarted(result.ticket), 1600);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen background="surface">
      <AppHeader title="New chat" showBack={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Banner tone="danger" message={error} style={styles.banner} /> : null}
        {done ? <Banner tone="success" message={done} style={styles.banner} /> : null}

        <TextField
          label="Your query"
          placeholder="Tell us what happened"
          value={query}
          onChangeText={setQuery}
          multiline
          numberOfLines={4}
        />
        <TextField
          label="Your mobile number"
          placeholder="10-digit mobile number"
          icon="call-outline"
          keyboardType="number-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <View style={styles.formActions}>
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
          <Button
            label="Submit"
            loading={busy}
            disabled={query.trim().length < 3 || phone.trim().length < 10 || !!done}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Thread({ id, onClose }: { id: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const log = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const load = useCallback(async () => {
    try {
      setTicket(await fetchTicket(id));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [id]);

  // Replies arrive while the chat is open, so keep looking.
  useEffect(() => {
    void load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [load]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setTicket(await replyToTicket(id, text.trim()));
      setText('');
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!ticket) return <FullScreenLoader label="Opening the chat…" />;

  return (
    <Screen background="surface">
      <AppHeader
        title="Customer care"
        subtitle={ticket.status === 'open' ? 'Open' : 'Solved'}
        showBack
        actions={[{ icon: 'close', label: 'All chats', onPress: onClose }]}
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={log}
          contentContainerStyle={styles.log}
          onContentSizeChange={() => log.current?.scrollToEnd({ animated: true })}
        >
          {error ? <Banner tone="danger" message={error} style={styles.banner} /> : null}
          {ticket.messages.map((m, i) => (
            <View key={i} style={[styles.msg, m.from === 'customer' ? styles.msgMine : styles.msgTheirs]}>
              <Txt variant="bodySm" style={m.from === 'customer' ? styles.bubbleMineText : undefined}>
                {m.text}
              </Txt>
              <Txt variant="caption" tone="faint" style={styles.msgWhen}>
                {m.from === 'customer' ? 'You' : 'Bingoor care'} ·{' '}
                {new Date(m.at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Txt>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextField
            placeholder="Write a message…"
            value={text}
            onChangeText={setText}
            containerStyle={styles.composerField}
          />
          <Button label="Send" loading={busy} disabled={!text.trim()} onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = themed(({ c }) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: space.xxl, gap: space.md },
  banner: { marginBottom: space.sm },
  list: { gap: space.sm, marginTop: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  rowIcon: {
    width: ms(38),
    height: ms(38),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brandSurface,
  },
  rowBody: { flex: 1 },
  rowWhen: { marginTop: ms(2) },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.md },

  log: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.md },
  msg: { maxWidth: '86%', padding: space.md, borderRadius: radius.md },
  msgMine: { alignSelf: 'flex-end', backgroundColor: c.brand },
  msgTheirs: { alignSelf: 'flex-start', backgroundColor: c.surfaceSunken },
  bubbleMineText: { color: c.onBrand },
  msgWhen: { marginTop: ms(4) },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  composerField: { flex: 1 },}));
