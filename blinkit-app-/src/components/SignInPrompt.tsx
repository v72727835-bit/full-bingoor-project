import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { AppNav } from '../navigation/types';
import { gutter, space, themed } from '../theme';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';

/**
 * What a visitor without an account sees on a page that needs one (orders,
 * account, wish list, addresses, checkout). Everything else stays open (#23).
 */
export function SignInPrompt({ title, message, tab }: { title: string; message: string; tab?: boolean }) {
  const navigation = useNavigation<AppNav>();
  return (
    <View style={styles.root}>
      <AppHeader title={title} showBack={!tab} flat={tab} />
      <EmptyState icon="person-circle-outline" title="Create your account" message={message} actionLabel="Create account" onAction={() => navigation.navigate('Signup')} />
      <View style={styles.more}>
        <Button label="I already have an account" variant="secondary" size="lg" onPress={() => navigation.navigate('Login')} />
      </View>
    </View>
  );
}

/** Renders `children` for a signed-in customer, the sign-in prompt for a visitor. */
export function NeedsAccount({ title, message, tab, children }: { title: string; message: string; tab?: boolean; children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <SignInPrompt title={title} message={message} tab={tab} />;
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.surfaceSunken },
  more: { paddingHorizontal: gutter, paddingBottom: space.huge },
}));
