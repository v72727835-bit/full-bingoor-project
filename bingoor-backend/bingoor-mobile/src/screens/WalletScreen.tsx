import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/AuthLayout';
import { fetchWallet, fetchWalletTxns, requestWithdraw, savePayoutAccount, submitCash } from '../api/rider';
import { getErrorMessage } from '../api/client';
import { PayoutAccount, RiderWallet, WalletTxn } from '../types';
import { colors, radius, shadow } from '../theme';
import { AnimatedNumber, FadeSlide } from '../components/anim';

const money = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const KIND_LABEL: Record<WalletTxn['kind'], string> = { earning: 'Delivery earning', bonus: 'Bonus', adjustment: 'Adjustment', withdrawal: 'Withdrawal', cash_submit: 'Cash submitted' };

export default function WalletScreen() {
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<'withdraw' | 'account' | 'cash' | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [w, t] = await Promise.all([fetchWallet(), fetchWalletTxns(1)]);
      setWallet(w); setTxns(t); setError('');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 42 }} />;

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
        <ErrorBanner message={error} />

        {/* Balance you can withdraw */}
        <FadeSlide>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>WITHDRAWABLE BALANCE</Text>
          <AnimatedNumber value={wallet?.balance ?? 0} format={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`} style={styles.heroValue} />
          <View style={styles.heroRow}>
            <Text style={styles.heroSmall}>Earned {money(wallet?.lifetimeEarned ?? 0)}</Text>
            {wallet?.pendingWithdraw ? <Text style={styles.heroSmall}>· {money(wallet.pendingWithdraw)} on the way</Text> : null}
          </View>
          <View style={styles.heroActions}>
            <Button title="Withdraw" onPress={() => setSheet('withdraw')} style={{ flex: 1 }} />
            <Button title={wallet?.account?.upi || wallet?.account?.bankNumber ? 'Edit account' : 'Add account'} variant="outline" onPress={() => setSheet('account')} style={{ flex: 1 }} />
          </View>
        </View>
        </FadeSlide>

        {/* Cash to submit */}
        <FadeSlide delay={90}>
        <View style={styles.cashCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cashLabel}>Cash to submit to office</Text>
            <Text style={styles.cashValue}>{money(wallet?.codPending ?? 0)}</Text>
            <Text style={styles.muted}>Collected in total {money(wallet?.codCollected ?? 0)}{wallet?.codLimit ? ` · hand in before ${money(wallet.codLimit)}` : ''}</Text>
          </View>
          <Button title="Submit cash" variant="outline" onPress={() => setSheet('cash')} />
        </View>
        </FadeSlide>

        <Text style={styles.sectionTitle}>Passbook</Text>
        {txns.length === 0 ? (
          <View style={styles.empty}><Ionicons name="receipt-outline" size={40} color={colors.primary} /><Text style={styles.muted}>Nothing yet. Deliver orders to start earning.</Text></View>
        ) : txns.map((t, i) => {
          const out = t.kind === 'withdrawal' || t.kind === 'cash_submit';
          return (
            <FadeSlide key={t._id} delay={Math.min(i, 8) * 45}>
            <View style={styles.txn}>
              <View style={[styles.txnIcon, { backgroundColor: out ? colors.dangerSoft : colors.successSoft }]}>
                <Ionicons name={t.kind === 'withdrawal' ? 'arrow-up' : t.kind === 'cash_submit' ? 'cash-outline' : 'arrow-down'} size={16} color={out ? colors.danger : colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnTitle}>{KIND_LABEL[t.kind]}</Text>
                <Text style={styles.muted}>{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{t.note ? ` · ${t.note}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txnAmt, { color: out ? colors.danger : colors.success }]}>{out ? '-' : '+'}{money(t.amount)}</Text>
                {t.status !== 'completed' ? <Text style={[styles.pill, pillTone(t.status)]}>{t.status}</Text> : null}
              </View>
            </View>
            </FadeSlide>
          );
        })}
      </ScrollView>

      {sheet === 'withdraw' && <WithdrawSheet wallet={wallet!} onClose={() => setSheet(null)} onDone={() => { setSheet(null); load(true); }} onNeedAccount={() => setSheet('account')} />}
      {sheet === 'account' && <AccountSheet account={wallet?.account ?? null} onClose={() => setSheet(null)} onDone={() => { setSheet(null); load(true); }} />}
      {sheet === 'cash' && <CashSheet pending={wallet?.codPending ?? 0} onClose={() => setSheet(null)} onDone={() => { setSheet(null); load(true); }} />}
    </>
  );
}

function pillTone(status: string) {
  if (status === 'paid' || status === 'confirmed') return { backgroundColor: colors.successSoft, color: colors.success };
  if (status === 'rejected') return { backgroundColor: colors.dangerSoft, color: colors.danger };
  return { backgroundColor: colors.primarySoft, color: colors.primaryDark };
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{title}</Text>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function WithdrawSheet({ wallet, onClose, onDone, onNeedAccount }: { wallet: RiderWallet; onClose: () => void; onDone: () => void; onNeedAccount: () => void }) {
  const hasUpi = !!wallet.account?.upi;
  const hasBank = !!wallet.account?.bankNumber;
  const [amount, setAmount] = useState(String(Math.floor(wallet.balance)));
  const [method, setMethod] = useState<'upi' | 'bank'>(hasUpi ? 'upi' : 'bank');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!hasUpi && !hasBank) {
    return (
      <Sheet title="Add your account first" onClose={onClose}>
        <Text style={styles.muted}>To withdraw, first add the UPI id or bank account where you want to be paid.</Text>
        <Button title="Add account" onPress={onNeedAccount} style={{ marginTop: 16 }} />
      </Sheet>
    );
  }
  const submit = async () => {
    setError(''); setBusy(true);
    try { await requestWithdraw(Number(amount), method); Alert.alert('Request sent', 'Your withdrawal is pending. The office will pay it to your account.'); onDone(); }
    catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Withdraw earnings" onClose={onClose}>
      <Text style={styles.muted}>Available {money(wallet.balance)} · smallest {money(wallet.minWithdraw)}</Text>
      <ErrorBanner message={error} />
      <Text style={styles.fieldLabel}>Amount (₹)</Text>
      <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.input} placeholder="0" placeholderTextColor="#94A3B8" />
      <Text style={styles.fieldLabel}>Pay to</Text>
      <View style={styles.choices}>
        {hasUpi ? <Choice active={method === 'upi'} label={`UPI · ${wallet.account?.upi}`} onPress={() => setMethod('upi')} /> : null}
        {hasBank ? <Choice active={method === 'bank'} label={`Bank · ${wallet.account?.bankNumber}`} onPress={() => setMethod('bank')} /> : null}
      </View>
      <Button title={busy ? 'Please wait…' : 'Request withdrawal'} onPress={submit} loading={busy} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

function AccountSheet({ account, onClose, onDone }: { account: PayoutAccount | null; onClose: () => void; onDone: () => void }) {
  const [upi, setUpi] = useState(account?.upi ?? '');
  const [holder, setHolder] = useState(account?.bankHolder ?? '');
  const [number, setNumber] = useState(account?.bankNumber ?? '');
  const [ifsc, setIfsc] = useState(account?.bankIfsc ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setError(''); setBusy(true);
    try { await savePayoutAccount({ upi, bankHolder: holder, bankNumber: number, bankIfsc: ifsc }); onDone(); }
    catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Payout account" onClose={onClose}>
      <ErrorBanner message={error} />
      <Text style={styles.fieldLabel}>UPI id</Text>
      <TextInput value={upi} onChangeText={setUpi} autoCapitalize="none" style={styles.input} placeholder="name@bank" placeholderTextColor="#94A3B8" />
      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Or bank account</Text>
      <TextInput value={holder} onChangeText={setHolder} style={styles.input} placeholder="Account holder name" placeholderTextColor="#94A3B8" />
      <TextInput value={number} onChangeText={(v) => setNumber(v.replace(/\D/g, ''))} keyboardType="number-pad" style={[styles.input, { marginTop: 8 }]} placeholder="Account number" placeholderTextColor="#94A3B8" />
      <TextInput value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} autoCapitalize="characters" style={[styles.input, { marginTop: 8 }]} placeholder="IFSC code" placeholderTextColor="#94A3B8" />
      <Button title={busy ? 'Saving…' : 'Save account'} onPress={submit} loading={busy} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

function CashSheet({ pending, onClose, onDone }: { pending: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(Math.round(pending)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setError(''); setBusy(true);
    try { await submitCash(Number(amount) || pending); Alert.alert('Recorded', 'The office will confirm your cash and clear what you owe.'); onDone(); }
    catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Submit cash to office" onClose={onClose}>
      <Text style={styles.muted}>You owe {money(pending)} in collected cash. Record the amount you are handing in; the office confirms it.</Text>
      <ErrorBanner message={error} />
      <Text style={styles.fieldLabel}>Amount (₹)</Text>
      <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.input} placeholder="0" placeholderTextColor="#94A3B8" />
      <Button title={busy ? 'Please wait…' : 'Submit cash'} onPress={submit} loading={busy} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceOn]}>
      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? colors.primary : colors.muted} />
      <Text style={[styles.choiceText, active && { color: colors.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 20, ...shadow },
  heroEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  heroValue: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: 6 },
  heroRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  heroSmall: { color: colors.muted, fontSize: 12.5 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cashCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginTop: 14, ...shadow },
  cashLabel: { color: colors.muted, fontSize: 12.5, fontWeight: '700' },
  cashValue: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 3 },
  muted: { color: colors.muted, fontSize: 12.5, marginTop: 2, lineHeight: 18 },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 22, marginBottom: 10 },
  txn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginBottom: 9, ...shadow },
  txnIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  txnTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  txnAmt: { fontWeight: '800', fontSize: 15 },
  pill: { fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginTop: 3, overflow: 'hidden', textTransform: 'capitalize' },
  empty: { alignItems: 'center', padding: 24 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 30 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 },
  fieldLabel: { color: colors.text, fontWeight: '700', fontSize: 13, marginBottom: 6, marginTop: 6 },
  input: { height: 48, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 16, color: colors.text, backgroundColor: colors.background },
  choices: { gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { color: colors.muted, fontWeight: '700', flex: 1 },
});
