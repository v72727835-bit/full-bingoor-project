import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { deleteAddress, fetchAddresses, setDefaultAddress } from '../api/user';
import { fetchNearestWarehouse, NearestWarehouse } from '../api/catalog';
import type { AppNav } from '../navigation/types';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { Address } from '../types';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { EmptyState, FullScreenLoader } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { Pill } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { useToast } from '../ui/Toast';

const LABEL_ICON = { home: 'home-outline', work: 'briefcase-outline', other: 'location-outline' } as const;

export function AddressListScreen() {
  const navigation = useNavigation<AppNav>();
  const toast = useToast();
  const { refreshUser } = useAuth();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // For each saved address: how far its warehouse is and when an order there arrives.
  const [near, setNear] = useState<Record<string, NearestWarehouse>>({});
  useEffect(() => {
    let live = true;
    Promise.all((addresses ?? []).filter((a) => a.location).map(async (a) => {
      try { const n = await fetchNearestWarehouse(a.location!.lat, a.location!.lng); return n ? ([a._id, n] as const) : null; } catch { return null; }
    })).then((rows) => { if (live) setNear(Object.fromEntries(rows.filter((r): r is readonly [string, NearestWarehouse] => !!r))); });
    return () => { live = false; };
  }, [addresses]);

  const load = useCallback(async () => {
    try {
      setAddresses(await fetchAddresses());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setAddresses([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const makeDefault = async (id: string) => {
    setBusyId(id);
    try {
      setAddresses(await setDefaultAddress(id));
      await refreshUser();
      toast.success('Delivery address selected');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (address: Address) =>
    Alert.alert('Delete this address?', `${address.name}, ${address.line1}`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(address._id);
          try {
            setAddresses(await deleteAddress(address._id));
            await refreshUser();
            toast.success('Address deleted');
          } catch (err) {
            toast.error(getErrorMessage(err));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);

  if (addresses === null) {
    return (
      <Screen>
        <AppHeader title="Saved addresses" />
        <FullScreenLoader />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Saved addresses"
        subtitle={addresses.length ? `${addresses.length} of 10 saved` : undefined}
      />

      <FlatList
        data={addresses}
        keyExtractor={(a) => a._id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={error ? 'cloud-offline-outline' : 'location-outline'}
            tone={error ? 'danger' : 'neutral'}
            title={error ? 'Could not load addresses' : 'No saved addresses'}
            message={error ?? 'Add the places you order to most often so checkout takes one tap.'}
            actionLabel={error ? 'Try again' : 'Add an address'}
            onAction={() => (error ? load() : navigation.navigate('AddressForm'))}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.labelChip}>
                <Ionicons name={LABEL_ICON[item.label]} size={ms(14)} color={colors.brand} />
                <Txt variant="labelSm" tone="brand" style={styles.labelText}>
                  {item.label.charAt(0).toUpperCase() + item.label.slice(1)}
                </Txt>
              </View>
              {item.isDefault ? <Pill label="Default" tone="success" /> : null}
              <View style={styles.spacer} />
              <Pressable
                onPress={() => navigation.navigate('AddressForm', { address: item })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Edit address for ${item.name}`}
                style={styles.iconBtn}
              >
                <Ionicons name="create-outline" size={ms(19)} color={colors.inkMuted} />
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                hitSlop={10}
                disabled={busyId === item._id}
                accessibilityRole="button"
                accessibilityLabel={`Delete address for ${item.name}`}
                style={styles.iconBtn}
              >
                <Ionicons name="trash-outline" size={ms(18)} color={colors.danger} />
              </Pressable>
            </View>

            <Txt variant="h4" style={styles.name}>
              {item.name}
            </Txt>
            <Txt variant="body" tone="muted">
              {[item.line1, item.line2, item.landmark].filter(Boolean).join(', ')}
            </Txt>
            <Txt variant="body" tone="muted">
              {item.city}, {item.state} {item.pincode}
            </Txt>
            <Txt variant="caption" tone="faint" style={styles.phone}>
              Phone {item.phone}
            </Txt>
            {near[item._id] ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(4) }}>
                <Ionicons name="storefront-outline" size={ms(14)} color={colors.brandText} />
                <Txt variant="caption" tone="brand">
                  Warehouse {near[item._id].distanceKm} km by road · {near[item._id].deliveryDays === 0 ? '19 minutes' : near[item._id].deliveryText}
                </Txt>
              </View>
            ) : null}

            {!item.isDefault ? (
              <Button
                label="Deliver here"
                variant="ghost"
                size="sm"
                block={false}
                loading={busyId === item._id}
                onPress={() => makeDefault(item._id)}
                style={styles.defaultBtn}
              />
            ) : null}
          </View>
        )}
      />

      <SafeAreaView edges={['bottom']} style={styles.bar}>
        <View style={styles.barInner}>
          <Button
            label={addresses.length >= 10 ? 'Address limit reached' : 'Add a new address'}
            icon="add"
            disabled={addresses.length >= 10}
            onPress={() => navigation.navigate('AddressForm')}
          />
        </View>
      </SafeAreaView>
    </Screen>
  );
}

const styles = themed(({ c, elevation }) => ({
  content: { padding: gutter, paddingBottom: ms(110), flexGrow: 1 },
  card: {
    padding: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, gap: space.sm },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: ms(3),
    borderRadius: radius.xs,
    backgroundColor: c.brandSurface,
  },
  labelText: { marginLeft: ms(3) },
  spacer: { flex: 1 },
  iconBtn: { width: ms(34), height: ms(34), alignItems: 'center', justifyContent: 'center' },
  name: { marginBottom: ms(2) },
  phone: { marginTop: space.sm },
  defaultBtn: { alignSelf: 'flex-start', marginTop: space.sm, paddingHorizontal: 0 },

  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    ...elevation.lg,
  },
  barInner: { paddingHorizontal: gutter, paddingVertical: space.md },}));
