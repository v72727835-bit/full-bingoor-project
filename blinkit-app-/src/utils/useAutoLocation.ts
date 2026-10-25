import Geolocation from '@react-native-community/geolocation';
import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { deliveryPointParams, setDeliveryPoint } from '../store/deliveryPoint';

/**
 * #16 / #28: when the app opens without a delivery pin (a visitor, or a customer
 * with no pinned address) we ask for the phone's location once, so the catalogue
 * and the delivery time / charges match where they are. Saying no is fine - the
 * app still works and the address form can pin it later.
 */
export function useAutoLocation() {
  const { user } = useAuth();
  const pinned = !!user?.addresses?.some((a) => a.location);

  useEffect(() => {
    if (pinned || deliveryPointParams()) return;
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).catch(() => null);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
      Geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled && !deliveryPointParams()) setDeliveryPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => undefined,
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [pinned]);
}
