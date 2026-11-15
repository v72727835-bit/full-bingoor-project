import React, { useEffect, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEB_URL } from '../config';

type Point = { lat: number; lng: number };
export type PickedPin = Point & { address?: { line2?: string; city?: string; state?: string; pincode?: string } };

/**
 * A hosted Google map, inside the app. With `nav` set it becomes a live route
 * from the rider to that stop (the warehouse or the customer) and follows the
 * rider as they move - the turn route opens here, not in an external browser.
 */
export function DeliveryMap({ destination, pickup, rider, onPick, nav, height = 260, style }: {
  destination?: Point; pickup?: Point; rider?: Point; onPick?: (pin: PickedPin) => void;
  nav?: 'customer' | 'warehouse'; height?: number; style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<WebView<object>>(null);
  const initialRider = useRef(rider);
  const uri = useMemo(() => {
    const args = [`mode=${onPick ? 'pick' : 'track'}`];
    if (nav) args.push(`nav=${nav}`);
    for (const [name, value] of Object.entries({ destination, pickup, rider: initialRider.current })) {
      if (value) args.push(`${name}=${encodeURIComponent(JSON.stringify(value))}`);
    }
    return `${WEB_URL}/mobile-map.html?${args.join('&')}`;
  }, [destination?.lat, destination?.lng, pickup?.lat, pickup?.lng, !!onPick, nav]);
  const send = () => ref.current?.injectJavaScript(`window.bingoorMapUpdate?.(${JSON.stringify({ type: 'positions', rider })});true;`);
  useEffect(send, [rider?.lat, rider?.lng]);
  return <WebView<object> ref={ref} source={{ uri }} style={[{ height, flex: 0 }, style]} javaScriptEnabled nestedScrollEnabled
    onLoadEnd={send} onMessage={(event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'pin' && Number.isFinite(data.lat) && Number.isFinite(data.lng)
          && Math.abs(data.lat) <= 90 && Math.abs(data.lng) <= 180) onPick?.(data);
      } catch { /* Ignore messages that are not a selected map pin. */ }
    }} />;
}
