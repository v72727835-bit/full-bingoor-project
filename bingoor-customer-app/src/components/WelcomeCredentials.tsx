import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useState } from 'react';
import { Clipboard, Modal, Pressable, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, ms, radius, space, themed } from '../theme';
import { Button } from '../ui/Button';
import { Txt } from '../ui/Text';

/**
 * Shown once, right after sign-up: the mobile number and password the customer
 * just made, with a Copy button, so they are not lost the moment the form closes.
 */
export function WelcomeCredentials() {
  const { welcome, dismissWelcome } = useAuth();
  const [copied, setCopied] = useState(false);
  if (!welcome) return null;

  const close = () => {
    setCopied(false);
    dismissWelcome();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={ms(34)} color={colors.success} />
          </View>
          <Txt variant="h2" center>
            Account Created!
          </Txt>
          <Txt variant="body" tone="muted" center style={styles.lead}>
            Save your login details for future access
          </Txt>

          <View style={styles.creds}>
            <View style={styles.row}>
              <Txt variant="body" tone="muted">
                Mobile
              </Txt>
              <Txt variant="label">{welcome.phone}</Txt>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Txt variant="body" tone="muted">
                Password
              </Txt>
              <Txt variant="label">{welcome.password}</Txt>
            </View>
          </View>

          <Button
            label={copied ? 'Copied — keep it safe' : 'Copy Credentials'}
            onPress={() => {
              Clipboard.setString(`Mobile: ${welcome.phone}\nPassword: ${welcome.password}`);
              setCopied(true);
            }}
            size="lg"
          />
          <Pressable onPress={close} accessibilityRole="button" style={styles.continue}>
            <Txt variant="label" tone="muted">
              Continue to App
            </Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(({ c }) => ({
  backdrop: { flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: ms(380), backgroundColor: c.surface, borderRadius: radius.xl, padding: space.xl },
  tick: {
    alignSelf: 'center',
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    backgroundColor: c.successSurface ?? c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  lead: { marginTop: space.xs, marginBottom: space.lg },
  creds: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  divider: { height: 1, backgroundColor: c.border },
  continue: { alignItems: 'center', paddingTop: space.lg },
}));
