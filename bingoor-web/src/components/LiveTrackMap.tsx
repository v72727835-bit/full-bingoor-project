'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Order } from '../lib/types';
import { kmBetween, LatLng, roadRoute, roughMinutes } from '../lib/route';
import { addBaseLayer } from '../lib/mapBase';
import { useSettings } from '../context/SettingsContext';
import { Icon } from './Icon';
import s from './LiveTrackMap.module.css';

type LMap = import('leaflet').Map;
type LMarker = import('leaflet').Marker;
type LPolyline = import('leaflet').Polyline;

const pinHtml = (emoji: string, cls = '', color = '') =>
  `<div class="lt-pin ${cls}" style="${color ? `--lt-color:${color}` : ''}">${emoji}</div>`;

/**
 * The live map on a customer's order: the shop, their door and the rider on
 * the road between them, with a route line and "arriving in N min". The rider
 * pin glides to each new position instead of jumping. Before the rider has the
 * parcel the map shows the shop and the door; the rider appears once on the way.
 */
export function LiveTrackMap({ order }: { order: Order }) {
  const home = order.address.location;
  const shop = order.shopLocation;
  const rider = order.riderLocation;
  const onTheWay = order.status === 'out_for_delivery';

  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const riderPin = useRef<LMarker | null>(null);
  const line = useRef<LPolyline | null>(null);
  const glide = useRef<number | null>(null);
  const fitted = useRef(false);
  const touched = useRef(false);
  const lastRoutedFrom = useRef<LatLng | null>(null);
  const settings = useSettings();
  const mapsCfgRef = useRef(settings?.maps);
  mapsCfgRef.current = settings?.maps;
  const [ready, setReady] = useState(false);
  const [eta, setEta] = useState<{ minutes: number; km: number } | null>(null);

  // Build the map once.
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (dead || !box.current || mapRef.current) return;
      leaflet.current = L;
      const centre = home ?? shop ?? rider ?? { lat: 25.3, lng: 82.99 };
      const map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([centre.lat, centre.lng], 15);
      await addBaseLayer(L, map, mapsCfgRef.current);
      // Once the customer pans or zooms, stop re-framing the map for them.
      map.on('dragstart zoomstart', () => (touched.current = true));
      if (shop) L.marker([shop.lat, shop.lng], { icon: L.divIcon({ className: '', html: pinHtml('🏬', '', '#0e8a3e'), iconSize: [38, 38], iconAnchor: [19, 19] }), title: 'Pickup' }).addTo(map);
      if (home) L.marker([home.lat, home.lng], { icon: L.divIcon({ className: '', html: pinHtml('🏠', '', '#e0453a'), iconSize: [38, 38], iconAnchor: [19, 19] }), title: 'Your door' }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      dead = true;
      if (glide.current) cancelAnimationFrame(glide.current);
      mapRef.current?.remove();
      mapRef.current = null;
      riderPin.current = null;
      line.current = null;
      fitted.current = false;
    };
    // The pins that never move are drawn once; the rider and the route follow below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the rider pin (gliding) and keep the route and ETA in step with it.
  useEffect(() => {
    const L = leaflet.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    const from: LatLng | undefined = onTheWay && rider ? rider : shop;
    const abort = new AbortController();

    if (onTheWay && rider) {
      if (!riderPin.current) {
        riderPin.current = L.marker([rider.lat, rider.lng], {
          icon: L.divIcon({ className: '', html: pinHtml('🛵', 'lt-rider'), iconSize: [44, 44], iconAnchor: [22, 22] }),
          zIndexOffset: 1000,
          title: 'Rider',
        }).addTo(map);
      } else {
        const pin = riderPin.current;
        const a = pin.getLatLng();
        const t0 = performance.now();
        const ms = 1800;
        if (glide.current) cancelAnimationFrame(glide.current);
        const step = (now: number) => {
          const k = Math.min(1, (now - t0) / ms);
          const e = 1 - (1 - k) * (1 - k);
          pin.setLatLng([a.lat + (rider.lat - a.lat) * e, a.lng + (rider.lng - a.lng) * e]);
          if (k < 1) glide.current = requestAnimationFrame(step);
        };
        glide.current = requestAnimationFrame(step);
      }
    } else if (riderPin.current) {
      riderPin.current.remove();
      riderPin.current = null;
    }

    const draw = (path: [number, number][], dashed: boolean) => {
      if (line.current) line.current.remove();
      line.current = L.polyline(path, { color: '#0e8a3e', weight: 5, opacity: 0.85, dashArray: dashed ? '8 10' : undefined }).addTo(map);
    };

    const frame = () => {
      if (touched.current) return;
      const pts: [number, number][] = [];
      if (home) pts.push([home.lat, home.lng]);
      if (shop) pts.push([shop.lat, shop.lng]);
      if (onTheWay && rider) pts.push([rider.lat, rider.lng]);
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 17, animate: fitted.current });
      fitted.current = true;
    };

    (async () => {
      if (!from || !home) {
        frame();
        return;
      }
      // Ask the road server again only once the rider has moved a fair way.
      const moved = lastRoutedFrom.current ? kmBetween(lastRoutedFrom.current, from) : Infinity;
      if (moved > 0.12 || !line.current) {
        lastRoutedFrom.current = from;
        const r = await roadRoute(from, home, abort.signal);
        if (abort.signal.aborted) return;
        if (r) {
          draw(r.path, false);
          setEta({ minutes: r.minutes, km: r.km });
        } else {
          draw([[from.lat, from.lng], [home.lat, home.lng]], true);
          const km = kmBetween(from, home);
          setEta({ minutes: roughMinutes(km), km });
        }
      }
      frame();
    })();

    return () => abort.abort();
  }, [ready, onTheWay, rider?.lat, rider?.lng, shop?.lat, shop?.lng, home?.lat, home?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const riderName = order.rider?.name ?? 'Your rider';
  const atDoor = onTheWay && rider && home ? kmBetween(rider, home) < 0.1 : false;
  let headline = 'Your order is being prepared';
  let sub = order.shop?.name ? `Packing at ${order.shop.name}` : 'We are packing your items';
  if (onTheWay) {
    if (!rider) {
      headline = `${riderName} is on the way`;
      sub = 'Live location will appear as soon as their phone shares it';
    } else if (atDoor) {
      headline = `${riderName} is at your door`;
      sub = 'Share the delivery code to receive your order';
    } else {
      headline = eta ? `Arriving in ${eta.minutes} min` : `${riderName} is on the way`;
      sub = eta ? `${riderName} is ${eta.km < 1 ? `${Math.round(eta.km * 1000)} m` : `${eta.km.toFixed(1)} km`} away` : 'Getting the route…';
    }
  } else if (order.status === 'ready_for_pickup') {
    headline = 'Ready, finding a rider';
    sub = 'A rider will pick it up in a moment';
  }

  return (
    <section className={`card ${s.card}`} aria-label="Live order map">
      <div className={s.head}>
        <div>
          <span className="eyebrow">{onTheWay ? 'Live tracking' : 'Order status'}</span>
          <div className={s.eta}>{headline}</div>
          <div className={s.sub}>{sub}</div>
        </div>
        {onTheWay && order.rider?.phone ? (
          <a className="btn btn-outline btn-sm" href={`tel:${order.rider.phone}`}>
            <Icon name="phone" size={14} /> Call rider
          </a>
        ) : null}
      </div>
      <div ref={box} className={s.map} />
      <div className={s.foot}>
        {shop ? <span className={s.key}><span className={s.dot} style={{ background: '#0e8a3e' }} /> Pickup</span> : null}
        {home ? <span className={s.key}><span className={s.dot} style={{ background: '#e0453a' }} /> Your door</span> : null}
        {onTheWay && rider ? <span className={s.key}><span className={s.dot} style={{ background: '#ffd23f' }} /> Rider</span> : null}
      </div>
    </section>
  );
}
