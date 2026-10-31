import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { registerPush } from '../firebase/push';

/** Once the rider is signed in, registers this phone for new-delivery notifications and shows messages that arrive while the app is open. */
export function PushRegistrar() {
  const { user } = useAuth();
  const userId = user?._id;

  useEffect(() => {
    if (!userId) return;
    let stop: () => void = () => undefined;
    let cancelled = false;
    registerPush('rider', (title, body) => Alert.alert(title, body)).then((off) => {
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
