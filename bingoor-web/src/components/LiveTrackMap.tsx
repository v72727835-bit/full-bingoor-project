'use client';
import React from 'react';
import type { Order } from '../lib/types';
import { GoogleDeliveryMap } from './GoogleDeliveryMap';

export function LiveTrackMap({ order }: { order: Order }) {
  const destination = order.address.location ?? order.shopLocation ?? order.riderLocation;
  return <section className="card card-pad" aria-label="Live order map">
    <h2 className="h3">{order.status === 'out_for_delivery' ? 'Your rider is on the way' : 'Your order is being prepared'}</h2>
    {destination ? <GoogleDeliveryMap destination={destination} pickup={order.shopLocation} rider={order.riderLocation} /> : <p>Waiting for the delivery location.</p>}
    {order.riderLocation?.at ? <p>Last location update: {new Date(order.riderLocation.at).toLocaleTimeString()}</p> : null}
    {order.rider?.phone ? <a href={`tel:${order.rider.phone}`}>Call {order.rider.name || 'rider'}</a> : null}
  </section>;
}
