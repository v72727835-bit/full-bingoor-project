import React, { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { WEB_URL } from '../config';

type Point = { lat: number; lng: number };
export type PickedPin = Point & { address?: { line2?: string; city?: string; state?: string; pincode?: string } };

/** A hosted map keeps the existing domain-restricted Maps key working in the apps. */
export function DeliveryMap({ destination, pickup, rider, onPick, height = 260 }: {
  destination?: Point; pickup?: Point; rider?: Point; onPick?: (pin: PickedPin) => void; height?: number;
}) {
  const ref = useRef<WebView<object>>(null);
  const initialRider = useRef(rider);
  const uri = useMemo(() => {
    const args = [`mode=${onPick ? 'pick' : 'track'}`];
    for (const [name, value] of Object.entries({ destination, pickup, rider: initialRider.current })) {
      if (value) args.push(`${name}=${encodeURIComponent(JSON.stringify(value))}`);
    }
    return `${WEB_URL}/mobile-map.html?${args.join('&')}`;
  }, [destination?.lat, destination?.lng, pickup?.lat, pickup?.lng, !!onPick]);
  const send = () => ref.current?.injectJavaScript(`window.bingoorMapUpdate?.(${JSON.stringify({ type: 'positions', rider })});true;`);
  useEffect(send, [rider?.lat, rider?.lng]);
  return <WebView<object> ref={ref} source={{ uri }} style={{ height, flex: 0 }} javaScriptEnabled nestedScrollEnabled
    onLoadEnd={send} onMessage={(event) => {
      try {
        if (!event.nativeEvent.url.startsWith(`${WEB_URL}/mobile-map.html`)) return;
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'pin' && Number.isFinite(data.lat) && Number.isFinite(data.lng)
          && Math.abs(data.lat) <= 90 && Math.abs(data.lng) <= 180) onPick?.(data);
      } catch { /* Ignore messages that are not a selected map pin. */ }
    }} />;
}
