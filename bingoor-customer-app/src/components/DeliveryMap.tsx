import React, { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { WEB_URL } from '../config';

type Point = { lat: number; lng: number };
export type PickedPin = Point & {
  address?: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string; formatted?: string };
};

const same = (a?: Point, b?: Point) => !!a && !!b && Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

/**
 * A hosted map keeps the existing domain-restricted Maps key working in the apps.
 *
 * Pick mode (onPick set) loads the page once: when `destination` changes from
 * outside (the "use my current location" button), the pin is moved inside the
 * page instead of reloading it, and the page answers with the pin and its
 * address. One finger moves the map: the WebView keeps the touch, so the screen
 * around it does not scroll instead.
 */
export function DeliveryMap({ destination, pickup, rider, onPick, focusKey = 0, height = 300 }: {
  destination?: Point; pickup?: Point; rider?: Point; onPick?: (pin: PickedPin) => void;
  /** Bump it to move the pin to `destination` and read its address again, even if the point is unchanged. */
  focusKey?: number; height?: number;
}) {
  const ref = useRef<WebView<object>>(null);
  const initialRider = useRef(rider);
  const picking = !!onPick;
  const start = useRef(destination);
  const lastPin = useRef<Point | undefined>(destination);
  const loaded = useRef(false);
  const mapDestination = picking ? start.current : destination;

  const uri = useMemo(() => {
    const args = [`mode=${picking ? 'pick' : 'track'}`];
    for (const [name, value] of Object.entries({ destination: mapDestination, pickup, rider: initialRider.current })) {
      if (value) args.push(`${name}=${encodeURIComponent(JSON.stringify(value))}`);
    }
    return `${WEB_URL}/mobile-map.html?${args.join('&')}`;
  }, [mapDestination?.lat, mapDestination?.lng, pickup?.lat, pickup?.lng, picking]);

  const inject = (data: object) => ref.current?.injectJavaScript(`window.bingoorMapUpdate?.(${JSON.stringify(data)});true;`);
  const sendRider = () => inject({ type: 'positions', rider });
  useEffect(sendRider, [rider?.lat, rider?.lng]);

  // A new point from outside the map (GPS, a pasted pin): move the pin there.
  const focused = useRef(0);
  const moveTo = () => {
    if (!picking || !destination) return;
    if (same(destination, lastPin.current) && focused.current === focusKey) return;
    focused.current = focusKey;
    lastPin.current = destination;
    inject({ type: 'moveTo', lat: destination.lat, lng: destination.lng });
  };
  useEffect(() => {
    if (loaded.current) moveTo();
    // moveTo reads the latest props; it runs when the point or focusKey changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.lat, destination?.lng, focusKey]);

  return (
    <WebView<object>
      ref={ref}
      source={{ uri }}
      style={{ height, flex: 0 }}
      javaScriptEnabled
      nestedScrollEnabled
      onLoadEnd={() => {
        loaded.current = true;
        sendRider();
        moveTo();
      }}
      onMessage={(event) => {
        try {
          // The WebView only ever loads our own map page, so the message is
          // trusted by content, not by the event url - on some Android WebViews
          // that url is empty for an injected postMessage, which silently
          // dropped every pin and left the address fields blank.
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'pin' && Number.isFinite(data.lat) && Number.isFinite(data.lng)
            && Math.abs(data.lat) <= 90 && Math.abs(data.lng) <= 180) {
            lastPin.current = { lat: data.lat, lng: data.lng };
            onPick?.(data);
          }
        } catch { /* Ignore messages that are not a selected map pin. */ }
      }}
    />
  );
}
