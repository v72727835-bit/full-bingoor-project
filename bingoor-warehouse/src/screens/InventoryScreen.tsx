import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Text, TextInput, View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { sellerProducts, updateProduct } from '../api/seller';
import { colors } from '../theme';
import { Product } from '../types';
import { Btn, Card, Center, Chips, Empty, ErrorText, H, Pill, row } from '../ui';

const TABS = [['low', 'Low stock'], ['out', 'Out of stock'], ['live', 'In stock'], ['', 'All']] as const;

/** Quick stock keeping: change a number and press Save, or mark an item out of stock. */
export default function InventoryScreen() {
  const [rows, setRows] = useState<Product[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [status, setStatus] = useState<string>('low');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (p: number) => {
    try {
      const r = await sellerProducts({ page: p, limit: 20, status: status || undefined });
      setRows((prev) => (p === 1 || !prev ? r.items : [...prev, ...r.items]));
      setMore(r.meta?.hasNext ?? false);
      setPage(p);
      if (p === 1) setDraft({});
      setError('');
    } catch (e) { setError(getErrorMessage(e)); }
  }, [status]);
  useEffect(() => { setRows(null); load(1); }, [load]);

  const save = async (p: Product, stock: number) => {
    setBusy(p._id); setError('');
    try { await updateProduct(p._id, { stock }); await load(1); } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(''); }
  };

  return (
    <View style={{ flex: 1 }}>
      <H title="Inventory" sub="Keep stock right. Five or fewer counts as low." center />
      <View style={{ height: 52 }}><Chips value={status} options={TABS} onChange={setStatus} /></View>
      <ErrorText message={error} />
      {!rows ? <Center /> : rows.length === 0 ? <Empty text="Nothing here." /> : (
        <FlatList
          data={rows} keyExtractor={(p) => p._id} contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          onEndReached={() => { if (more) load(page + 1); }} onEndReachedThreshold={0.4}
          renderItem={({ item: p }) => {
            const value = draft[p._id] ?? String(p.stock);
            const changed = value !== String(p.stock);
            return (
              <Card>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {p.images?.[0] ? <Image source={{ uri: p.images[0] }} style={{ width: 48, height: 48, borderRadius: 8 }} /> : <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#F1F5F9' }} />}
                  <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }} numberOfLines={2}>{p.name}</Text><Text style={{ color: colors.muted, fontSize: 12.5 }}>{p.unit}</Text></View>
                  {p.stock <= 0 ? <Pill text="Out" tone="danger" /> : p.stock <= 5 ? <Pill text="Low" tone="warn" /> : null}
                </View>
                <View style={[row, { marginTop: 10, gap: 8 }]}>
                  <TextInput value={value} onChangeText={(t) => setDraft({ ...draft, [p._id]: t.replace(/\D/g, '') })} keyboardType="numeric" style={{ width: 90, height: 40, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.card }} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn small title="Save" disabled={!changed || busy === p._id} onPress={() => save(p, Math.max(0, Math.floor(Number(value) || 0)))} />
                    {p.stock > 0 ? <Btn small tone="danger" title="Mark out" disabled={busy === p._id} onPress={() => save(p, 0)} /> : null}
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
