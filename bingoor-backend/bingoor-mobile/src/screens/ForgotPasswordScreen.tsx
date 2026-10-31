import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { getErrorMessage } from '../api/client';
import { resetPasswordRequest } from '../api/auth';
import { OtpModal } from '../components/OtpModal';
import { AuthLayout, ErrorBanner } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { AuthStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState(false);

  const tenDigits = () => phone.replace(/\D/g, '').slice(-10);

  const submit = () => {
    setError(null);
    if (!/^[6-9]\d{9}$/.test(tenDigits())) return setError('Enter a valid 10-digit mobile number.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setOtp(true);
  };

  return <AuthLayout title="Forgot password?" subtitle="Enter your rider mobile number, choose a new password and confirm it with an OTP.">
    {error ? <ErrorBanner message={error} /> : null}
    <TextField label="Rider mobile number" icon="call-outline" placeholder="9876543210" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
    <TextField label="New password" icon="lock-closed-outline" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secure />
    <TextField label="Confirm new password" icon="lock-closed-outline" placeholder="Repeat the password" value={confirm} onChangeText={setConfirm} secure />
    <Button title="Send OTP" onPress={submit} style={{ marginTop: 4 }} />
    <Button title="Back to sign in" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
    {otp ? (
      <OtpModal
        phone={tenDigits()}
        onClose={() => setOtp(false)}
        onVerified={async (token) => {
          try {
            await resetPasswordRequest(tenDigits(), password, token);
            setOtp(false);
            Alert.alert('Password changed', 'You can sign in now.');
            navigation.goBack();
          } catch (err) { setOtp(false); setError(getErrorMessage(err)); }
        }}
      />
    ) : null}
  </AuthLayout>;
}
