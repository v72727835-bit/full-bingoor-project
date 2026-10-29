'use client';

import { useEffect, useState } from 'react';
import { fetchAddresses } from '../api/account';
import { fetchQuote } from '../api/cart';
import { useAuth } from '../context/AuthContext';
import { getDeliveryPoint } from './deliveryPoint';
import { Quote, SlotKey } from './types';

/**
 * The delivery bill for the current basket: handling and delivery fees from
 * the admin's distance bands, to the chosen (or default) address. `refreshKey`
 * should change whenever the cart does.
 */
export function useQuote(slot: SlotKey, refreshKey: unknown, addressId?: string): Quote | null {
  const [quote, setQuote] = useState<Quote | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // A visitor's quote comes with their basket (see CartContext), not from here.
    if (!user) {
      setQuote(null);
      return;
    }
    let live = true;
    (async () => {
      try {
        let id = addressId;
        if (!id) {
          const list = await fetchAddresses();
          id = list.find((a) => a.isDefault)?.id ?? list[0]?.id;
        }
        // The current location stands in when the address has no map pin (points 16 / 28).
        const here = getDeliveryPoint();
        const q = await fetchQuote({ addressId: id, slot, lat: here?.lat, lng: here?.lng });
        if (live) setQuote(q);
      } catch {
        if (live) setQuote(null); // the cart still shows its own totals
      }
    })();
    return () => {
      live = false;
    };
  }, [slot, refreshKey, addressId, user]);

  return quote;
}
