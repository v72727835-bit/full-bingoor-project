import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';
import { api } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { AuthStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/** Bingoor has no OTP service: a rider's password is reset by their warehouse or by Bingoor support. */
export default function ForgotPasswordScreen({ navigation }: Props) {
  const [phone, setPhone] = useState<string | null>(null);
  useEffect(() => {
    api.get('/settings/public')
      .then((r) => setPhone(String(r.data?.data?.supportPhone ?? '').trim() || null))
      .catch(() => setPhone(null));
  }, []);

  return <AuthLayout title="Forgot password?" subtitle="Ask your warehouse manager to set a new password for you, or call Bingoor support.">
    <Text style={{ color: colors.muted, marginBottom: 12, lineHeight: 20 }}>Your warehouse can change your password from its Riders page in the Bingoor Warehouse app.</Text>
    {phone ? <Button title={`Call support · ${phone}`} onPress={() => void Linking.openURL(`tel:${phone}`)} style={{ marginTop: 4 }} /> : null}
    <Button title="Back to sign in" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
  </AuthLayout>;
}
