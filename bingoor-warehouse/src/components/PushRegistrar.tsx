import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { registerPush } from '../firebase/push';

/** Once the warehouse is signed in, registers this phone for new-order notifications and shows messages that arrive while the app is open. */
export function PushRegistrar() {
  const { me } = useAuth();
  const userId = me?.user._id;

  useEffect(() => {
    if (!userId) return;
    let stop: () => void = () => undefined;
    let cancelled = false;
    registerPush('warehouse', (title, body) => Alert.alert(title, body)).then((off) => {
      if (cancelled) off();
      else stop = off;
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId]);

  return null;
}
