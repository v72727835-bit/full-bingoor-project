import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { deliveryPointParams, setDeliveryPoint } from '../store/deliveryPoint';
import { getPhoneLocation } from './location';

/**
 * When the app opens without a delivery pin (a visitor, or a customer with no
 * pinned address) the phone's location is read once, so the shops, delivery
 * time and charges match where they are. Saying no is fine: the app still
 * works and an address can be pinned later.
 */
export function useAutoLocation() {
  const { user } = useAuth();
  const pinned = !!user?.addresses?.some((a) => a.location);

  useEffect(() => {
    if (pinned || deliveryPointParams()) return;
    let cancelled = false;
    getPhoneLocation()
      .then((point) => {
        if (!cancelled && !deliveryPointParams()) setDeliveryPoint(point);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pinned]);
}
