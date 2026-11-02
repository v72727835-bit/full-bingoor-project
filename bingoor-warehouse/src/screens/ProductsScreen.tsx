import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { getErrorMessage } from '../api/client';
import { createProduct, deleteProduct, sellerCategories, sellerProducts, updateProduct, uploadImages, uploadVideo } from '../api/seller';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { Category, Product } from '../types';
import { Btn, Card, Center, Chips, Empty, ErrorText, H, Input, Pill, SearchBar, money, row } from '../ui';

const TABS = [['', 'All'], ['live', 'Live'], ['off', 'Off shelf'], ['low', 'Low stock'], ['out', 'Out of stock']] as const;
const name = (v: { name: string } | string) => (typeof v === 'object' ? v.name : '');
const idOf = (v: { _id: string } | string) => (typeof v === 'object' ? v._id : v);

export default function ProductsScreen() {
  const [rows, setRows] = useState<Product[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Product | 'new' | null>(null);

  const load = useCallback(async (p: number) => {
    try {
      const r = await sellerProducts({ page: p, limit: 20, status: status || undefined, q: query || undefined });
      setRows((prev) => (p === 1 || !prev ? r.items : [...prev, ...r.items]));
      setMore(r.meta?.hasNext ?? false);
      setPage(p);
      setError('');
    } catch (e) { setError(getErrorMessage(e)); }
  }, [status, query]);
  useEffect(() => { setRows(null); load(1); }, [load]);

  const toggle = async (p: Product) => {
    try { await updateProduct(p._id, { isActive: !p.isActive }); load(1); } catch (e) { setError(getErrorMessage(e)); }
  };
  const remove = (p: Product) => Alert.alert('Delete this product?', p.name, [{ text: 'No' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteProduct(p._id); load(1); } catch (e) { setError(getErrorMessage(e)); } } }]);

  return (
    <View style={{ flex: 1 }}>
      <View style={[row, { paddingRight: 16 }]}><H title="Products" sub="Your catalogue." /><Btn small title="+ Add" onPress={() => setEdit('new')} /></View>
      <SearchBar value={q} onChangeText={setQ} onSubmit={() => setQuery(q.trim())} placeholder="Search products" />
      <View style={{ height: 52 }}><Chips value={status} options={TABS} onChange={setStatus} /></View>
      <ErrorText message={error} />
      {!rows ? <Center /> : rows.length === 0 ? <Empty text="No products here." /> : (
        <FlatList
          data={rows} keyExtractor={(p) => p._id} contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          onEndReached={() => { if (more) load(page + 1); }} onEndReachedThreshold={0.4}
          renderItem={({ item: p }) => (
            <Card>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {p.images?.[0] ? <Image source={{ uri: p.images[0] }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: '#F1F5F9' }} /> : <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: '#F1F5F9' }} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15 }} numberOfLines={2}>{p.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5 }}>{p.unit} · {name(p.category)}</Text>
                  <Text style={{ marginTop: 2 }}><Text style={{ fontWeight: '800' }}>{money(p.price)}</Text>{p.mrp > p.price ? <Text style={{ color: colors.muted, textDecorationLine: 'line-through' }}>  {money(p.mrp)}</Text> : null}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Pill text={p.isActive ? 'Live' : 'Off'} tone={p.isActive ? 'success' : 'muted'} />
                  <Pill text={p.stock <= 0 ? 'Out' : `${p.stock} in stock`} tone={p.stock <= 0 ? 'danger' : p.stock <= 5 ? 'warn' : 'muted'} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Btn small tone="outline" title="Edit" onPress={() => setEdit(p)} />
                <Btn small tone="outline" title={p.isActive ? 'Take off shelf' : 'Put live'} onPress={() => toggle(p)} />
                <Btn small tone="danger" title="Delete" onPress={() => remove(p)} />
              </View>
            </Card>
          )}
        />
      )}
      {edit ? <ProductForm product={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(1); }} /> : null}
    </View>
  );
}

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const { me } = useAuth();
  const warehouses = me?.user.sellerWarehouses ?? [];
  const [f, setF] = useState({
    name: product?.name ?? '', nameHi: product?.nameHi ?? '', brand: product?.brand ?? '', description: product?.description ?? '',
    unit: product?.unit ?? '1 pc', price: product ? String(product.price) : '', mrp: product ? String(product.mrp) : '', stock: product ? String(product.stock) : '0',
    attributes: (product?.attributes ?? []).join(', '), tags: (product?.tags ?? []).join(', '), variantGroup: product?.variantGroup ?? '', variantLabel: product?.variantLabel ?? '',
    hsn: product?.hsn ?? '',
  });
  const [gstRate, setGstRate] = useState<string>(product?.gstRate === undefined || product?.gstRate === null ? '' : String(product.gstRate));
  const [paymentMode, setPaymentMode] = useState<'both' | 'cod' | 'online'>(product?.paymentMode ?? 'both');
  const [foodType, setFoodType] = useState<'' | 'veg' | 'nonveg'>(product?.foodType ?? '');
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [video, setVideo] = useState<string>(product?.video ?? '');
  const [category, setCategory] = useState<string>(product ? idOf(product.category) : '');
  const [warehouse, setWarehouse] = useState<string>(warehouses.length === 1 ? warehouses[0]._id : '');
  const [cats, setCats] = useState<Category[]>([]);
  const [pickCat, setPickCat] = useState(false);
  const [catQ, setCatQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => { sellerCategories().then(setCats).catch(() => undefined); }, []);
  const leaves = cats.filter((c) => c.level === 3);
  const byId = new Map(cats.map((c) => [c._id, c]));
  const path = (c: Category) => [c.parent ? byId.get(c.parent)?.parent && byId.get(byId.get(c.parent)!.parent!)?.name : '', c.parent ? byId.get(c.parent)?.name : '', c.name].filter(Boolean).join(' › ');
  const catName = category ? (byId.get(category) ? path(byId.get(category)!) : name(product?.category ?? '')) : 'Choose a category';

  const addImages = async () => {
    // Resized on the phone so each photo fits the 200 KB limit and uploads fast on mobile data.
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: Math.max(1, 10 - images.length), quality: 0.7, maxWidth: 1080, maxHeight: 1080 });
    if (res.didCancel || !res.assets?.length) return;
    setBusy(true); setError('');
    try {
      const urls = await uploadImages(res.assets.map((a, i) => ({ uri: a.uri ?? '', name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`, type: a.type ?? 'image/jpeg' })));
      setImages((p) => [...p, ...urls].slice(0, 10));
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };

  const addVideo = async () => {
    const res = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1 });
    if (res.didCancel || !res.assets?.length) return;
    const a = res.assets[0];
    setBusy(true); setError('');
    try {
      const url = await uploadVideo({ uri: a.uri ?? '', name: a.fileName ?? `video-${Date.now()}.mp4`, type: a.type ?? 'video/mp4' });
      setVideo(url);
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };

  const save = async () => {
    setError('');
    if (f.name.trim().length < 2) return setError('Enter the product name.');
    if (!category) return setError('Choose the category.');
    if (!f.price || Number.isNaN(Number(f.price))) return setError('Enter the selling price.');
    if (!product && warehouses.length > 1 && !warehouse) return setError('Choose the warehouse this product is stocked in.');
    const price = Number(f.price);
    const body: Record<string, unknown> = {
      category, name: f.name.trim(), nameHi: f.nameHi.trim(), brand: f.brand.trim(), description: f.description.trim(), images,
      price, mrp: Number(f.mrp) || price, unit: f.unit.trim() || '1 pc', stock: Math.max(0, Math.floor(Number(f.stock) || 0)),
      foodType, attributes: list(f.attributes), tags: list(f.tags), variantGroup: f.variantGroup.trim(), variantLabel: f.variantLabel.trim(),
      hsn: f.hsn.trim(), gstRate: gstRate === '' ? null : Number(gstRate), paymentMode, video: video || '',
    };
    setBusy(true);
    try {
      if (product) await updateProduct(product._id, body);
      else {
        if (warehouse) body.warehouse = warehouse;
        if (!body.variantGroup) delete body.variantGroup;
        if (!body.variantLabel) delete body.variantLabel;
        if (!body.nameHi) delete body.nameHi;
        await createProduct(body);
      }
      onSaved();
    } catch (e) { setError(getErrorMessage(e)); setBusy(false); }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[row, { padding: 16, backgroundColor: colors.card }]}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>{product ? 'Edit product' : 'Add product'}</Text>
          <Pressable onPress={onClose} hitSlop={10}><Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <ErrorText message={error} />
          <Input label="Product name *" value={f.name} onChangeText={(v) => set('name', v)} />
          <Input label="Name in Hindi" value={f.nameHi} onChangeText={(v) => set('nameHi', v)} />
          <Input label="Brand" value={f.brand} onChangeText={(v) => set('brand', v)} />
          <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 5 }}>Category *</Text>
          <Pressable onPress={() => setPickCat(true)} style={{ height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 12, marginBottom: 12 }}>
            <Text style={{ color: category ? colors.text : '#94A3B8' }} numberOfLines={1}>{catName}</Text>
          </Pressable>
          {!product && warehouses.length > 1 ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '600' }}>Warehouse *</Text>
              <Chips value={warehouse} options={warehouses.map((w) => [w._id, w.name] as const)} onChange={setWarehouse} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Price ₹ *" value={f.price} onChangeText={(v) => set('price', v)} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Input label="MRP ₹" value={f.mrp} onChangeText={(v) => set('mrp', v)} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Unit (e.g. 500 g)" value={f.unit} onChangeText={(v) => set('unit', v)} /></View>
            <View style={{ flex: 1 }}><Input label="Stock" value={f.stock} onChangeText={(v) => set('stock', v)} keyboardType="numeric" /></View>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600' }}>How can customers pay?</Text>
          <Chips value={paymentMode} options={[['both', 'COD + Online'], ['cod', 'COD only'], ['online', 'Online only']] as const} onChange={setPaymentMode} />
          <Input label="HSN code (for the GST bill)" value={f.hsn} onChangeText={(v) => set('hsn', v.replace(/\D/g, '').slice(0, 8))} keyboardType="numeric" placeholder="e.g. 1101" />
          <Text style={{ fontSize: 13, fontWeight: '600' }}>GST rate (already in the price)</Text>
          <Chips value={gstRate} options={[['', 'Default'], ['0', '0%'], ['5', '5%'], ['12', '12%'], ['18', '18%'], ['28', '28%']] as const} onChange={setGstRate} />
          <Text style={{ fontSize: 13, fontWeight: '600' }}>Food type</Text>
          <Chips value={foodType} options={[['', 'Not food'], ['veg', 'Veg'], ['nonveg', 'Non-veg']] as const} onChange={setFoodType} />
          <Input label="Description" value={f.description} onChangeText={(v) => set('description', v)} multiline />
          <Input label="Highlights (comma separated)" value={f.attributes} onChangeText={(v) => set('attributes', v)} />
          <Input label="Search tags (comma separated)" value={f.tags} onChangeText={(v) => set('tags', v)} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Variant group" value={f.variantGroup} onChangeText={(v) => set('variantGroup', v)} placeholder="e.g. Aashirvaad Atta" /></View>
            <View style={{ flex: 1 }}><Input label="Variant label" value={f.variantLabel} onChangeText={(v) => set('variantLabel', v)} placeholder="e.g. 5 kg" /></View>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Photos ({images.length}/10)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {images.map((u) => (
              <Pressable key={u} onPress={() => setImages((p) => p.filter((x) => x !== u))} style={{ marginRight: 8 }}>
                <Image source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 10 }} />
                <Text style={{ fontSize: 11, color: colors.danger, textAlign: 'center' }}>Remove</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Btn tone="outline" title="Add photos" onPress={addImages} disabled={busy || images.length >= 10} />
          <View style={{ height: 14 }} />
          <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Product video {video ? '· added ✓' : '(optional)'}</Text>
          <View style={[row, { gap: 8 }]}>
            <View style={{ flex: 1 }}><Btn tone="outline" title={video ? 'Replace video' : 'Add a video'} onPress={addVideo} disabled={busy} /></View>
            {video ? <View style={{ flex: 1 }}><Btn tone="danger" title="Remove video" onPress={() => setVideo('')} disabled={busy} /></View> : null}
          </View>
          <View style={{ height: 14 }} />
          <Btn title={busy ? 'Please wait…' : product ? 'Save changes' : 'Add product'} onPress={save} disabled={busy} />
          <View style={{ height: 40 }} />
        </ScrollView>
        {pickCat ? (
          <Modal animationType="slide" onRequestClose={() => setPickCat(false)}>
            <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 12 }}>
              <SearchBar value={catQ} onChangeText={setCatQ} onSubmit={() => undefined} placeholder="Search categories" />
              <FlatList
                data={leaves.filter((c) => path(c).toLowerCase().includes(catQ.trim().toLowerCase()))} keyExtractor={(c) => c._id}
                ListEmptyComponent={<Empty text="No categories found." />}
                renderItem={({ item: c }) => (
                  <Pressable onPress={() => { setCategory(c._id); setPickCat(false); }} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: c._id === category ? colors.primarySoft : colors.card }}>
                    <Text>{path(c)}</Text>
                  </Pressable>
                )}
              />
              <View style={{ padding: 12 }}><Btn tone="outline" title="Cancel" onPress={() => setPickCat(false)} /></View>
            </View>
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
}
