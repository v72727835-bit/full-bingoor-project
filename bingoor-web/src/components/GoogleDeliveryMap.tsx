'use client';

import React, { useEffect, useMemo, useRef } from 'react';

type Point = { lat: number; lng: number };

/** Every delivery view uses the same Google-only map as the native apps. */
export function GoogleDeliveryMap({ destination, pickup, rider, height = 300 }: {
  destination: Point; pickup?: Point; rider?: Point; height?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const initialRider = useRef(rider);
  const src = useMemo(() => {
    const args = new URLSearchParams({ destination: JSON.stringify(destination) });
    if (pickup) args.set('pickup', JSON.stringify(pickup));
    if (initialRider.current) args.set('rider', JSON.stringify(initialRider.current));
    return `/mobile-map.html?${args}`;
  }, [destination.lat, destination.lng, pickup?.lat, pickup?.lng]);
  const update = () => frame.current?.contentWindow?.postMessage({ type: 'positions', rider }, window.location.origin);
  useEffect(update, [rider?.lat, rider?.lng]);
  return <iframe ref={frame} title="Google delivery map" src={src} onLoad={update}
    style={{ width: '100%', height, border: 0, borderRadius: 12 }} />;
}
