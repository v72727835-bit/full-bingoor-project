import React, { useState } from 'react';
import { View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { notifyWhenBack } from '../api/support';
import { useAuth } from '../context/AuthContext';
import { space, themed } from '../theme';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Feedback';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';
import { TextField } from '../ui/TextField';

/**
 * Out of stock, but the customer still wants it.
 *
 * We take a mobile number and the request lands in the admin's Notifications
 * list, so restocking follows demand we can actually count rather than a
 * guess - and the customer gets a message instead of checking back.
 */
export function NotifyMeSheet({
  visible,
  onClose,
  productId,
  productName,
}: {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      setDone(await notifyWhenBack(productId, phone.trim()));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={done ? 'We will let you know' : `Notify me about ${productName}`}
      footer={
        done ? (
          <Button label="Done" onPress={onClose} style={styles.btn} />
        ) : (
          <Button
            label="Notify me"
            loading={busy}
            disabled={phone.trim().length < 10}
            onPress={submit}
            style={styles.btn}
          />
        )
      }
    >
      {done ? (
        <Banner tone="success" message={done} />
      ) : (
        <View>
          {error ? <Banner tone="danger" message={error} style={styles.banner} /> : null}
          <Txt variant="body" tone="muted" style={styles.intro}>
            We will send you a message the moment this item is back in stock.
          </Txt>
          <TextField
            label="Your mobile number"
            placeholder="10-digit mobile number"
            icon="call-outline"
            keyboardType="number-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>
      )}
    </Sheet>
  );
}

const styles = themed(() => ({
  btn: { marginBottom: space.md },
  banner: { marginBottom: space.md },
  intro: { marginBottom: space.md },}));
