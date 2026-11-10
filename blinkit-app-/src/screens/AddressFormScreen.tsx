import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import {
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getErrorMessage, getFieldErrors } from '../api/client';
import { AddressInput, createAddress, updateAddress } from '../api/user';
import { useAuth } from '../context/AuthContext';
import type { AppNav, AppRoute } from '../navigation/types';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { DeliveryMap } from '../components/DeliveryMap';
import { deliveryPointParams } from '../store/deliveryPoint';
import { AddressLabel } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { Sheet } from '../ui/Sheet';
import { INDIA_STATES } from '../utils/states';
import { Txt } from '../ui/Text';
import { TextField, TextInputRef } from '../ui/TextField';
import { useToast } from '../ui/Toast';
import { isValidPhone, isValidPincode, normalizePhone } from '../utils/validation';
import { getPhoneLocation, locationMessage, offerLocationFix, problemFromError } from '../utils/location';

const LABELS: { key: AddressLabel; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'work', label: 'Work', icon: 'briefcase-outline' },
  { key: 'other', label: 'Other', icon: 'location-outline' },
];

export function AddressFormScreen() {
  const navigation = useNavigation<AppNav>();
  const { params } = useRoute<AppRoute<'AddressForm'>>();
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const existing = params?.address;
  const editing = !!existing;

  const phoneRef = useRef<TextInputRef>(null);
  const line1Ref = useRef<TextInputRef>(null);
  const line2Ref = useRef<TextInputRef>(null);
  const landmarkRef = useRef<TextInputRef>(null);
  const cityRef = useRef<TextInputRef>(null);
  const stateRef = useRef<TextInputRef>(null);
  const pincodeRef = useRef<TextInputRef>(null);

  const [form, setForm] = useState({
    label: (existing?.label ?? 'home') as AddressLabel,
    name: existing?.name ?? user?.name ?? '',
    phone: existing?.phone ?? user?.phone ?? '',
    line1: existing?.line1 ?? '',
    line2: existing?.line2 ?? '',
    landmark: existing?.landmark ?? '',
    city: existing?.city ?? '',
    state: existing?.state || 'Rajasthan',
    pincode: existing?.pincode ?? '',
    isDefault: existing?.isDefault ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>(existing?.location ?? deliveryPointParams() ?? undefined);
  const locationTurn = useRef(0);
  const [locating, setLocating] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const fieldY = useRef<Record<string, number>>({});
  const onFieldLayout = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    fieldY.current[key] = e.nativeEvent.layout.y;
  };
  const scrollToError = (errs: Record<string, string>) => {
    // Point: on save, take the customer to what needs fixing - up to the
    // "use my current location" button when the pin is missing, otherwise down
    // to the first field in the map form that has an error.
    const order = ['location', 'name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'];
    const first = order.find((k) => errs[k]);
    if (!first) return;
    if (first === 'location') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const y = fieldY.current[first] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - ms(24)), animated: true });
  };

  /** Pins the address to where the phone is now, so the rider can navigate to the door. */
  const locate = async () => {
    setFormError(null);
    setLocating(true);
    const turn = ++locationTurn.current;
    try {
      const point = await getPhoneLocation();
      if (turn !== locationTurn.current) return;
      setConfirmLoad(true);
      setLocation(point);
      setErrors((e) => ({ ...e, location: '' }));
    } catch (err) {
      if (turn === locationTurn.current) {
        const problem = problemFromError(err);
        setFormError(locationMessage(problem));
        offerLocationFix(problem);
      }
    } finally {
      if (turn === locationTurn.current) setLocating(false);
    }
  };

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  /** Reads "lat,lng" off the clipboard - what a shared pin looks like. */
  const pastePin = async () => {
    const text = (await Clipboard.getString()).trim();
    const [lat, lng] = text.split(/[,\s]+/).map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      toast.error('That does not look like a location. Copy it as "lat,lng".');
      return;
    }
    locationTurn.current++;
    setLocating(false);
    setLocation({ lat, lng });
    setErrors((e) => ({ ...e, location: '' }));
    toast.success('Location pasted');
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Enter the name of whoever receives the order';
    if (!isValidPhone(form.phone)) next.phone = 'Enter a valid 10-digit mobile number';
    if (form.line1.trim().length < 1) next.line1 = 'Enter the flat, house or building number';
    if (form.line2.trim().length < 3) next.line2 = 'Enter the street and area / colony';
    if (form.city.trim().length < 2) next.city = 'Enter your city or town';
    if (form.state.trim().length < 2) next.state = 'Enter your state';
    if (!isValidPincode(form.pincode)) next.pincode = 'Pincode must be 6 digits';
    if (!location) next.location = 'Tap "Use my current location" so the rider can find you';
    setErrors(next);
    return next;
  };

  const submit = async () => {
    setFormError(null);
    const errs = validate();
    if (Object.keys(errs).length) {
      scrollToError(errs);
      return;
    }

    const payload: AddressInput = {
      label: form.label,
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      landmark: form.landmark.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      location,
      isDefault: form.isDefault,
    };

    setSaving(true);
    try {
      if (editing && existing) await updateAddress(existing._id, payload);
      else await createAddress(payload);
      await refreshUser();
      toast.success(editing ? 'Address updated' : 'Address saved');
      navigation.goBack();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen background="surface">
      <AppHeader title={editing ? 'Edit address' : 'New address'} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {formError ? <Banner tone="danger" message={formError} style={styles.banner} /> : null}

          <Button
            label={location ? 'Location pinned - tap to update' : 'Use my current location'}
            variant={location ? 'secondary' : 'primary'}
            icon="locate"
            loading={locating}
            onPress={() => void locate()}
            style={styles.locate}
          />
          {errors.location ? (
            <Txt variant="caption" tone="danger" style={styles.locateHint}>
              {errors.location}
            </Txt>
          ) : location ? (
            <Txt variant="caption" tone="muted" style={styles.locateHint}>
              {`Pinned at ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
            </Txt>
          ) : null}

          <DeliveryMap destination={location} confirmOnLoad={confirmLoad} onPick={(pin) => {
            locationTurn.current++;
            setLocating(false);
            setConfirmLoad(false);
            setLocation({ lat: pin.lat, lng: pin.lng });
            setErrors((e) => ({ ...e, location: '' }));
            const a = pin.address;
            if (a) setForm((f) => ({ ...f, line2: a.line2 || f.line2, city: a.city || f.city,
              state: a.state || f.state, pincode: a.pincode || f.pincode }));
          }} />
          <Txt variant="caption" tone="muted">Move the map pin to your entrance, confirm it, then save this address.</Txt>

          {/* Someone else in the house usually has the pin already - sending
              it over on WhatsApp beats walking to the gate to fetch GPS. */}
          <View style={styles.pinRow}>
            <Button
              label="Copy pin"
              variant="ghost"
              size="sm"
              icon="copy-outline"
              disabled={!location}
              onPress={() => {
                if (!location) return;
                Clipboard.setString(`${location.lat},${location.lng}`);
                toast.success('Location copied');
              }}
            />
            <Button
              label="Paste pin"
              variant="ghost"
              size="sm"
              icon="clipboard-outline"
              onPress={() => void pastePin()}
            />
          </View>

          <Txt variant="label" tone="body" style={styles.groupLabel}>
            Save this address as
          </Txt>
          <View style={styles.labelRow}>
            {LABELS.map((option) => {
              const on = form.label === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setForm((f) => ({ ...f, label: option.key }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.labelBtn, on && styles.labelBtnOn]}
                >
                  <Ionicons name={option.icon} size={ms(16)} color={on ? colors.brandInk : colors.inkMuted} />
                  <Txt variant="labelSm" numberOfLines={1} style={[styles.labelBtnText, on && styles.labelBtnTextOn]}>
                    {option.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>

          <View onLayout={onFieldLayout('name')}>
          <TextField
            label="Receiver's name"
            placeholder="Who should we hand the order to?"
            icon="person-outline"
            autoCapitalize="words"
            returnKeyType="next"
            value={form.name}
            onChangeText={set('name')}
            onSubmitEditing={() => phoneRef.current?.focus()}
            error={errors.name}
          />
          </View>

          <View onLayout={onFieldLayout('phone')}>
          <TextField
            label="Mobile number"
            placeholder="9876543210"
            prefix="+91"
            keyboardType="number-pad"
            maxLength={13}
            returnKeyType="next"
            inputRef={phoneRef}
            value={form.phone}
            onChangeText={set('phone')}
            onSubmitEditing={() => line1Ref.current?.focus()}
            error={errors.phone}
            hint="The delivery partner will call this number."
          />
          </View>

          <View onLayout={onFieldLayout('line1')}>
          <TextField
            label="Flat / house / building number"
            placeholder="Flat 12A, Shanti Apartment"
            icon="home-outline"
            autoCapitalize="words"
            returnKeyType="next"
            inputRef={line1Ref}
            value={form.line1}
            onChangeText={set('line1')}
            onSubmitEditing={() => line2Ref.current?.focus()}
            error={errors.line1}
          />
          </View>

          <View onLayout={onFieldLayout('line2')}>
          <TextField
            label="Street, area / colony"
            placeholder="Gandhi Nagar Road, Civil Lines"
            icon="map-outline"
            autoCapitalize="words"
            returnKeyType="next"
            inputRef={line2Ref}
            value={form.line2}
            onChangeText={set('line2')}
            onSubmitEditing={() => landmarkRef.current?.focus()}
            error={errors.line2}
          />
          </View>

          <TextField
            label="Landmark (optional)"
            placeholder="Opposite the water tank"
            icon="navigate-outline"
            autoCapitalize="sentences"
            returnKeyType="next"
            inputRef={landmarkRef}
            value={form.landmark}
            onChangeText={set('landmark')}
            onSubmitEditing={() => cityRef.current?.focus()}
            hint="A landmark helps riders find you faster."
          />

          <View style={styles.pairRow}>
            <TextField
              label="City"
              placeholder="Robertsganj"
              autoCapitalize="words"
              returnKeyType="next"
              inputRef={cityRef}
              value={form.city}
              onChangeText={set('city')}
              onSubmitEditing={() => stateRef.current?.focus()}
              error={errors.city}
              containerStyle={styles.pairItem}
            />
            <View style={styles.pairGap} />
            <View style={styles.pairItem}>
              <Txt variant="label" style={{ marginBottom: space.xs }}>
                State
              </Txt>
              <Pressable
                onPress={() => setStateOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`State, ${form.state}. Tap to change`}
                style={styles.stateBox}
              >
                <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {form.state}
                </Txt>
                <Ionicons name="chevron-down" size={ms(18)} color={colors.inkMuted} />
              </Pressable>
              {errors.state ? (
                <Txt variant="caption" tone="danger">
                  {errors.state}
                </Txt>
              ) : null}
            </View>
          </View>

          <View onLayout={onFieldLayout('pincode')}>
          <TextField
            label="Pincode"
            placeholder="231216"
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            inputRef={pincodeRef}
            value={form.pincode}
            onChangeText={set('pincode')}
            onSubmitEditing={submit}
            error={errors.pincode}
          />
          </View>

          <Pressable
            onPress={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.isDefault }}
            style={styles.checkRow}
          >
            <View style={[styles.checkbox, form.isDefault && styles.checkboxOn]}>
              {form.isDefault ? <Ionicons name="checkmark" size={ms(14)} color={colors.onBrand} /> : null}
            </View>
            <Txt variant="body" style={styles.checkLabel}>
              Use this as my default delivery address
            </Txt>
          </Pressable>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.bar}>
          <View style={styles.barInner}>
            <Button label={editing ? 'Save changes' : 'Save address'} loading={saving} onPress={submit} size="lg" />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
      <Sheet visible={stateOpen} onClose={() => setStateOpen(false)} title="Choose your state">
        {INDIA_STATES.map((st) => (
          <Pressable
            key={st}
            onPress={() => {
              set('state')(st);
              setStateOpen(false);
            }}
            accessibilityRole="button"
            style={styles.stateRow}
          >
            <Txt variant="body" style={{ flex: 1, fontWeight: st === form.state ? '800' : '500' }}>
              {st}
            </Txt>
            {st === form.state ? <Ionicons name="checkmark" size={ms(20)} color={colors.brand} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = themed(({ c, elevation }) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: ms(110) },
  banner: { marginBottom: space.lg },

  groupLabel: { marginBottom: space.sm },
  locate: { marginBottom: space.xs, alignSelf: 'stretch' },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: space.md, marginTop: space.xs, marginBottom: space.md },
  locateHint: { marginBottom: space.sm, textAlign: 'center' },
  labelRow: { flexDirection: 'row', marginBottom: space.xl, gap: space.sm },
  labelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ms(44),
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  labelBtnOn: { borderColor: c.brand, backgroundColor: c.brandSurface },
  labelBtnText: { marginLeft: space.xs, color: c.inkMuted },
  labelBtnTextOn: { color: c.brandInk },

  pairRow: { flexDirection: 'row' },
  pairItem: { flex: 1 },
  pairGap: { width: space.md },
  stateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ms(48),
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    backgroundColor: c.surface,
  },
  stateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },

  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  checkbox: {
    width: ms(22),
    height: ms(22),
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.brand, borderColor: c.brand },
  checkLabel: { flex: 1, marginLeft: space.md },

  bar: {
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    ...elevation.lg,
  },
  barInner: { paddingHorizontal: gutter, paddingVertical: space.md },}));
