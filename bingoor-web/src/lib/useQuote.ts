'use client';

import { useEffect, useState } from 'react';
import { fetchAddresses } from '../api/account';
import { fetchQuote } from '../api/cart';
import { useAuth } from '../context/AuthContext';
import { getDeliveryPoint, POINT_EVENT } from './deliveryPoint';
import { Quote, SlotKey } from './types';

/**
 * The delivery bill for the current basket: handling and delivery fees from
 * the admin's distance bands, to the chosen (or default) address. `refreshKey`
 * should change whenever the cart does.
 */
export function useQuote(slot: SlotKey, refreshKey: unknown, addressId?: string): Quote | null {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pointRevision, setPointRevision] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const onPoint = () => setPointRevision((revision) => revision + 1);
    window.addEventListener(POINT_EVENT, onPoint);
    return () => window.removeEventListener(POINT_EVENT, onPoint);
  }, []);

  useEffect(() => {
    // A visitor's quote comes with their basket (see CartContext), not from here.
    if (!user) {
      setQuote(null);
      return;
    }
    let live = true;
    setQuote(null);
    (async () => {
      try {
        const here = getDeliveryPoint();
        if (addressId) {
          // Checkout quotes the selected address; the active point is only a
          // fallback when that saved address has no map pin.
          const q = await fetchQuote({ addressId, slot, lat: here?.lat, lng: here?.lng });
          if (live) setQuote(q);
          return;
        }

        // On the cart the header/map pin is the selected destination. Sending
        // a default addressId would make the server prefer that old saved pin.
        if (here) {
          const q = await fetchQuote({ slot, lat: here.lat, lng: here.lng });
          if (live) setQuote(q);
          return;
        }

        const list = await fetchAddresses();
        const id = list.find((a) => a.isDefault)?.id ?? list[0]?.id;
        const q = await fetchQuote({ addressId: id, slot });
        if (live) setQuote(q);
      } catch {
        if (live) setQuote(null); // the cart still shows its own totals
      }
    })();
    return () => {
      live = false;
    };
  }, [slot, refreshKey, addressId, user, pointRevision]);

  return quote;
}
