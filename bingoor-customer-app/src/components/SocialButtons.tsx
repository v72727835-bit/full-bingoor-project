import React, { useState } from 'react';
import { View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { usePublicSettingsQuery } from '../store/catalogApi';
import { Button } from '../ui/Button';
import { Txt } from '../ui/Text';
import { mobileLoginCode } from '../utils/mobileLogin';
import { googleAccessToken } from '../utils/social';

type Provider = 'google' | 'facebook' | 'instagram';

/**
 * "Continue with Google / Facebook / Instagram" - one place for the sign-in and
 * the create-account screens. A provider the admin has not set up yet says so
 * instead of failing silently.
 */
export function SocialButtons({ onError, onBusy }: { onError: (message: string | null) => void; onBusy?: (busy: boolean) => void }) {
  const { signInSocial, signInCode } = useAuth();
  const { data: publicSettings } = usePublicSettingsQuery();
  const [busy, setBusy] = useState(false);

  const run = async (provider: Provider) => {
    onError(null);
    const ids = publicSettings?.social;
    const appId = provider === 'google' ? ids?.googleClientId : provider === 'facebook' ? ids?.facebookAppId : ids?.instagramAppId;
    if (!appId) {
      onError(`${provider[0].toUpperCase()}${provider.slice(1)} login is not configured yet. Please use your phone or email.`);
      return;
    }
    setBusy(true);
    onBusy?.(true);
    try {
      if (provider === 'google') await signInSocial('google', await googleAccessToken(appId));
      else await signInCode(provider, await mobileLoginCode(provider, appId));
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };

  return (
    <View style={{ gap: 10, marginBottom: 20 }}>
      <Button label="Continue with Google" variant="secondary" disabled={busy} onPress={() => void run('google')} />
      <Button label="Continue with Facebook" variant="secondary" disabled={busy} onPress={() => void run('facebook')} />
      <Button label="Continue with Instagram" variant="secondary" disabled={busy} onPress={() => void run('instagram')} />
      <Txt variant="caption" tone="muted" center>
        Instagram login supports professional (Business or Creator) accounts.
      </Txt>
    </View>
  );
}
