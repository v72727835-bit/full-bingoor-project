import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, ScrollView, Switch, Text, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { getErrorMessage } from '../api/client';
import { changePassword, createRider, requestWithdraw, saveWalletAccount, sellerCategories, sellerCustomers, sellerRiders, sellerShops, sellerWallet, updateShop, uploadImages, walletTxns, SellerTxnRow, SellerWallet } from '../api/seller';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { Category, Customer, Shop, WhRider } from '../types';
import { Btn, Card, Center, Chips, Empty, ErrorText, H, Input, Pill, SearchBar, money, row, when } from '../ui';

/* ---------------- Riders ---------------- */
export function RidersScreen() {
  const { me } = useAuth();
  const warehouses = me?.user.sellerWarehouses ?? [];
  const [rows, setRows] = useState<WhRider[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', password: '' });
  const [picked, setPicked] = useState<string[]>(warehouses.length === 1 ? [warehouses[0]._id] : []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { sellerRiders().then(setRows).catch((e) => setError(getErrorMessage(e))); }, []);
  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, [load]);

  const add = async () => {
    setError('');
    if (f.name.trim().length < 2 || f.phone.trim().length < 10 || f.password.length < 6) return setError('Enter the rider name, a 10-digit phone number and a password of at least 6 characters.');
    if (warehouses.length > 1 && picked.length === 0) return setError('Choose at least one warehouse for this rider.');
    setBusy(true);
    try {
      await createRider({ name: f.name.trim(), phone: f.phone.trim(), password: f.password, warehouses: picked.length ? picked : undefined });
      setF({ name: '', phone: '', password: '' }); setAdding(false); load();
      Alert.alert('Rider added', 'They can sign in to the Bingoor Rider app with this phone number and password.');
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <ScrollView>
      <View style={[row, { paddingRight: 16 }]}><H title="Riders" sub="Your delivery riders." /><Btn small title={adding ? 'Cancel' : '+ Add rider'} tone={adding ? 'outline' : 'primary'} onPress={() => setAdding(!adding)} /></View>
      <View style={{ padding: 16, paddingTop: 8 }}>
        <ErrorText message={error} />
        {adding ? (
          <Card>
            <Input label="Rider name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
            <Input label="Phone number (their login)" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
            <Input label="Password" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} />
            {warehouses.length > 1 ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Warehouses (choose one or more)</Text>
                {warehouses.map((w) => (
                  <View key={w._id} style={[row, { paddingVertical: 4 }]}>
                    <Text style={{ flex: 1 }}>{w.name}</Text>
                    <Switch value={picked.includes(w._id)} onValueChange={(on) => setPicked((cur) => (on ? [...cur, w._id] : cur.filter((x) => x !== w._id)))} />
                  </View>
                ))}
              </View>
            ) : null}
            <Btn title={busy ? 'Please wait…' : 'Add rider'} onPress={add} disabled={busy} />
          </Card>
        ) : null}
        {!rows ? <Center /> : rows.length === 0 ? <Empty text="No riders yet." /> : rows.map((r) => (
          <Card key={r._id}>
            <View style={row}>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '800' }}>{r.name}</Text><Text style={{ color: colors.muted }}>{r.phone}</Text></View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {!r.isActive ? <Pill text="Blocked" tone="danger" /> : r.paused ? <Pill text="Paused" tone="danger" /> : r.busy ? <Pill text="On a delivery" tone="brand" /> : r.online ? <Pill text="Free" tone="success" /> : <Pill text="Offline" tone="muted" />}
              </View>
            </View>
            {r.lastSeenAt ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Last seen {when(r.lastSeenAt)}</Text> : null}
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

/* ---------------- Customers ---------------- */
export function CustomersScreen() {
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async (p: number) => {
    try {
      const r = await sellerCustomers({ page: p, limit: 20, q: query || undefined });
      setRows((prev) => (p === 1 || !prev ? r.items : [...prev, ...r.items]));
      setMore(r.meta?.hasNext ?? false); setPage(p); setError('');
    } catch (e) { setError(getErrorMessage(e)); }
  }, [query]);
  useEffect(() => { setRows(null); load(1); }, [load]);
  return (
    <View style={{ flex: 1 }}>
      <H title="Customers" sub="People who ordered from your warehouse." center />
      <SearchBar value={q} onChangeText={setQ} onSubmit={() => setQuery(q.trim())} placeholder="Search name or phone" />
      <ErrorText message={error} />
      {!rows ? <Center /> : rows.length === 0 ? <Empty text="No customers yet." /> : (
        <FlatList data={rows} keyExtractor={(c) => c._id} contentContainerStyle={{ padding: 16, paddingTop: 4 }} onEndReached={() => { if (more) load(page + 1); }} onEndReachedThreshold={0.4}
          renderItem={({ item: c }) => (
            <Card>
              <View style={row}><View style={{ flex: 1 }}><Text style={{ fontWeight: '800' }}>{c.name}</Text><Text style={{ color: colors.muted }}>{c.phone}</Text></View>
                <View style={{ alignItems: 'flex-end' }}><Text style={{ fontWeight: '800' }}>{money(c.spent)}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{c.orders} order{c.orders === 1 ? '' : 's'} · last {when(c.last)}</Text></View></View>
            </Card>
          )} />
      )}
    </View>
  );
}

/* ---------------- Categories ---------------- */
export function CategoriesScreen() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { sellerCategories().then(setCats).catch((e) => setError(getErrorMessage(e))); }, []);
  if (!cats) return error ? <Center><ErrorText message={error} /></Center> : <Center />;
  const kids = (id: string | null) => cats.filter((c) => c.parent === id);
  return (
    <ScrollView>
      <H title="Categories" sub="The shelves your products go under. Pick a last-level category when adding a product." center />
      <View style={{ padding: 16, paddingTop: 8 }}>
        {kids(null).map((a) => (
          <Card key={a._id}>
            <Text style={{ fontWeight: '800', fontSize: 15 }}>{a.name}</Text>
            {kids(a._id).map((b) => (
              <View key={b._id} style={{ marginTop: 6, marginLeft: 8 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{b.name}</Text>
                <Text style={{ color: colors.muted, marginLeft: 8 }}>{kids(b._id).map((c) => c.name).join(' · ') || '—'}</Text>
              </View>
            ))}
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

/* ---------------- Store settings ---------------- */
export function StoreScreen() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { sellerShops().then(setShops).catch((e) => setError(getErrorMessage(e))); }, []);
  if (!shops) return error ? <Center><ErrorText message={error} /></Center> : <Center />;
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <H title="Store settings" sub="Open or close the store, delivery fee, minimum order and radius." center />
      <View style={{ padding: 16, paddingTop: 8 }}>{shops.map((s) => <ShopCard key={s._id} shop={s} />)}</View>
    </ScrollView>
  );
}
function ShopCard({ shop }: { shop: Shop }) {
  const [isOpen, setIsOpen] = useState(shop.isOpen);
  const [f, setF] = useState({
    name: shop.name, description: shop.description ?? '', phone: shop.phone ?? '', line1: shop.address?.line1 ?? '', city: shop.address?.city ?? '', state: shop.address?.state ?? '', pincode: shop.address?.pincode ?? '',
    deliveryRadiusKm: String(shop.deliveryRadiusKm), minOrderAmount: String(shop.minOrderAmount), deliveryFee: String(shop.deliveryFee),
    gstin: shop.gstin ?? '',
  });
  const [logo, setLogo] = useState<string>(shop.logo ?? '');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const pickLogo = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (res.didCancel || !res.assets?.length) return;
    const a = res.assets[0];
    setBusy(true); setError('');
    try { const [url] = await uploadImages([{ uri: a.uri ?? '', name: a.fileName ?? `logo-${Date.now()}.jpg`, type: a.type ?? 'image/jpeg' }]); setLogo(url); }
    catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };
  const toggle = async (v: boolean) => {
    setError('');
    try { await updateShop(shop._id, { isOpen: v }); setIsOpen(v); } catch (e) { setError(getErrorMessage(e)); }
  };
  const save = async () => {
    setError(''); setMsg(''); setBusy(true);
    try {
      await updateShop(shop._id, {
        name: f.name.trim(), description: f.description.trim(), phone: f.phone.trim(), address: { line1: f.line1, city: f.city, state: f.state, pincode: f.pincode },
        deliveryRadiusKm: Number(f.deliveryRadiusKm) || 0, minOrderAmount: Number(f.minOrderAmount) || 0, deliveryFee: Number(f.deliveryFee) || 0,
        gstin: f.gstin.trim().toUpperCase(), logo: logo || '',
      });
      setMsg('Saved.');
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card>
      <View style={row}>
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', fontSize: 16 }}>{shop.name}</Text><Pill text={isOpen ? 'Open' : 'Closed'} tone={isOpen ? 'success' : 'danger'} /></View>
        <Switch value={isOpen} onValueChange={toggle} trackColor={{ true: colors.primary }} />
      </View>
      <View style={{ height: 12 }} />
      <ErrorText message={error} />
      {msg ? <Text style={{ color: colors.success, marginBottom: 8, fontWeight: '600' }}>{msg}</Text> : null}
      <Input label="Store name" value={f.name} onChangeText={(v) => set('name', v)} />
      <Input label="Contact phone" value={f.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
      <Input label="About this warehouse" value={f.description} onChangeText={(v) => set('description', v)} multiline />
      <Input label="Address" value={f.line1} onChangeText={(v) => set('line1', v)} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="City" value={f.city} onChangeText={(v) => set('city', v)} /></View>
        <View style={{ flex: 1 }}><Input label="PIN code" value={f.pincode} onChangeText={(v) => set('pincode', v)} keyboardType="numeric" /></View>
      </View>
      <Input label="State" value={f.state} onChangeText={(v) => set('state', v)} />
      <Input label="Delivery radius (km)" value={f.deliveryRadiusKm} onChangeText={(v) => set('deliveryRadiusKm', v)} keyboardType="decimal-pad" />
      <Input label="Minimum order ₹" value={f.minOrderAmount} onChangeText={(v) => set('minOrderAmount', v)} keyboardType="numeric" />
      <Input label="Delivery fee ₹" value={f.deliveryFee} onChangeText={(v) => set('deliveryFee', v)} keyboardType="numeric" />
      <View style={[row, { marginVertical: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 52, height: 52, borderRadius: 12 }} /> : <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.border }} />}
          <Text style={{ color: colors.muted, flex: 1 }}>Store logo {logo ? '· added ✓' : '(shown on your bills)'}</Text>
        </View>
        <Btn small tone="outline" title={logo ? 'Change' : 'Add logo'} onPress={pickLogo} disabled={busy} />
      </View>
      <Input label="GSTIN (printed on your bills)" value={f.gstin} onChangeText={(v) => set('gstin', v.toUpperCase().slice(0, 15))} placeholder="09ABCDE1234F1Z5" />
      <Btn title={busy ? 'Saving…' : 'Save store settings'} onPress={save} disabled={busy} />
    </Card>
  );
}

/* ---------------- Earnings ---------------- */
export function EarningsScreen() {
  const [w, setW] = useState<SellerWallet | null>(null);
  const [rows, setRows] = useState<SellerTxnRow[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [acct, setAcct] = useState({ upi: '', bankHolder: '', bankNumber: '', bankIfsc: '' });

  const load = useCallback(() => {
    sellerWallet().then((d) => {
      setW(d);
      setAcct({ upi: d.account?.upi ?? '', bankHolder: d.account?.bankHolder ?? '', bankNumber: d.account?.bankNumber ?? '', bankIfsc: d.account?.bankIfsc ?? '' });
      setError('');
    }).catch((e) => setError(getErrorMessage(e)));
    walletTxns({ page: 1, limit: 30 }).then(({ items }) => setRows(items)).catch(() => undefined);
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveAcct = async () => {
    setBusy('acct'); setMsg(''); setError('');
    try { await saveWalletAccount({ upi: acct.upi || undefined, bankHolder: acct.bankHolder || undefined, bankNumber: acct.bankNumber || undefined, bankIfsc: acct.bankIfsc || undefined }); setMsg('Payout account saved.'); load(); }
    catch (e) { setError(getErrorMessage(e)); } finally { setBusy(''); }
  };
  const withdraw = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError('Enter an amount to withdraw.');
    setBusy('wd'); setMsg(''); setError('');
    try { await requestWithdraw(amt, method); setMsg('Withdrawal requested. The Bingoor team will verify and pay it.'); setAmount(''); load(); }
    catch (e) { setError(getErrorMessage(e)); } finally { setBusy(''); }
  };

  if (!w) return error ? <Center><ErrorText message={error} /></Center> : <Center />;
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <H title="Earnings" sub={`Your item sales minus the ${w.commissionPct}% platform commission. Withdraw to your UPI/bank; the Bingoor team verifies and pays.`} center />
      <View style={{ padding: 16, paddingTop: 8, gap: 12 }}>
        <ErrorText message={error} />
        {msg ? <Text style={{ color: colors.primary, fontWeight: '700' }}>{msg}</Text> : null}

        <Card>
          <View style={[row, { justifyContent: 'space-between' }]}><Text style={{ color: colors.muted }}>Balance to withdraw</Text><Text style={{ fontWeight: '800', fontSize: 18 }}>{money(w.balance)}</Text></View>
          <View style={[row, { justifyContent: 'space-between', marginTop: 6 }]}><Text style={{ color: colors.muted }}>Net earned (all time)</Text><Text style={{ fontWeight: '700' }}>{money(w.netEarned)}</Text></View>
          <View style={[row, { justifyContent: 'space-between', marginTop: 6 }]}><Text style={{ color: colors.muted }}>Gross sales</Text><Text style={{ fontWeight: '700' }}>{money(w.grossSales)}</Text></View>
          <View style={[row, { justifyContent: 'space-between', marginTop: 6 }]}><Text style={{ color: colors.muted }}>Commission kept</Text><Text style={{ fontWeight: '700' }}>{money(w.commissionTotal)}</Text></View>
          <View style={[row, { justifyContent: 'space-between', marginTop: 6 }]}><Text style={{ color: colors.muted }}>Waiting / paid out</Text><Text style={{ fontWeight: '700' }}>{money(w.pendingWithdraw)} / {money(w.paidOut)}</Text></View>
        </Card>

        <Card>
          <Text style={{ fontWeight: '800', marginBottom: 8 }}>Withdraw (min {money(w.minWithdraw)})</Text>
          <Input label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="numeric" />
          <View style={[row, { gap: 8, marginVertical: 8 }]}>
            <Btn small title={`UPI${acct.upi ? ' ✓' : ''}`} tone={method === 'upi' ? 'primary' : 'outline'} onPress={() => setMethod('upi')} />
            <Btn small title={`Bank${acct.bankNumber ? ' ✓' : ''}`} tone={method === 'bank' ? 'primary' : 'outline'} onPress={() => setMethod('bank')} />
          </View>
          <Btn title={busy === 'wd' ? 'Requesting…' : 'Request withdrawal'} disabled={busy === 'wd' || w.balance < w.minWithdraw} onPress={withdraw} />
        </Card>

        <Card>
          <Text style={{ fontWeight: '800', marginBottom: 8 }}>Payout account</Text>
          <Input label="UPI id (name@bank)" value={acct.upi} onChangeText={(v) => setAcct({ ...acct, upi: v })} />
          <Input label="Account holder name" value={acct.bankHolder} onChangeText={(v) => setAcct({ ...acct, bankHolder: v })} />
          <Input label="Account number" value={acct.bankNumber} onChangeText={(v) => setAcct({ ...acct, bankNumber: v })} keyboardType="numeric" />
          <Input label="IFSC" value={acct.bankIfsc} onChangeText={(v) => setAcct({ ...acct, bankIfsc: v.toUpperCase() })} />
          <Btn title={busy === 'acct' ? 'Saving…' : 'Save account'} tone="outline" disabled={busy === 'acct'} onPress={saveAcct} />
        </Card>

        <Text style={{ fontWeight: '800', marginTop: 4 }}>Passbook</Text>
        {rows.length === 0 ? <Empty text="No entries yet. Earnings appear here when your orders are delivered." /> : rows.map((t) => (
          <Card key={t._id}>
            <View style={[row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontWeight: '700' }}>{t.kind === 'withdrawal' ? 'Withdrawal' : t.kind === 'adjustment' ? 'Adjustment' : 'Sale earning'}</Text>
              <Text style={{ fontWeight: '800' }}>{t.kind === 'withdrawal' ? '-' : '+'}{money(t.amount)}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
              {t.note || ''}{t.kind === 'earning' && t.gross != null ? ` · sold ${money(t.gross)}, commission ${money(t.commission ?? 0)}` : ''} · {t.status}
            </Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

/* ---------------- Account ---------------- */
export function AccountScreen() {
  const { me, signOut } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError(''); setMsg('');
    if (next.length < 6) return setError('The new password must be at least 6 characters.');
    setBusy(true);
    try { await changePassword(cur, next); setMsg('Password changed.'); setCur(''); setNext(''); } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };
  const u = me?.user;
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <H title="My account" center />
      <View style={{ padding: 16, paddingTop: 8 }}>
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{u?.name}</Text>
          <Text style={{ color: colors.muted }}>Phone (your login): {u?.phone}</Text>
          {u?.email ? <Text style={{ color: colors.muted }}>Email: {u.email}</Text> : null}
          {u?.sellerId ? <Text style={{ color: colors.muted }}>Seller ID: {u.sellerId}</Text> : null}
          <Text style={{ color: colors.muted }}>Warehouses: {(u?.sellerWarehouses ?? []).map((w) => w.name).join(', ') || '—'}</Text>
        </Card>
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 10 }}>Change password</Text>
          <ErrorText message={error} />
          {msg ? <Text style={{ color: colors.success, marginBottom: 8, fontWeight: '600' }}>{msg}</Text> : null}
          <Input label="Current password" value={cur} onChangeText={setCur} secure />
          <Input label="New password" value={next} onChangeText={setNext} secure />
          <Btn title={busy ? 'Please wait…' : 'Change password'} onPress={submit} disabled={busy} />
        </Card>
        <Btn tone="danger" title="Log out" onPress={() => Alert.alert('Log out?', undefined, [{ text: 'No' }, { text: 'Log out', style: 'destructive', onPress: signOut }])} />
      </View>
    </ScrollView>
  );
}
