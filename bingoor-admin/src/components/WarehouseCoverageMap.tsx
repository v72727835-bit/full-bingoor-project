'use client';

import { useEffect, useRef, useState } from 'react';
import type { Circle, CircleMarker, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBaseLayer } from '../lib/mapBase';

/** The saved warehouse point and its current delivery radius, in kilometres. */
export default function WarehouseCoverageMap({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const container = useRef<HTMLDivElement>(null);
  const layers = useRef<{ map: LeafletMap; circle: Circle; marker: CircleMarker } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current).setView([0, 0], 2);
      void addBaseLayer(L, map);
      const circle = L.circle([0, 0], { radius: 0, color: '#16924a', fillOpacity: 0.15 }).addTo(map);
      const marker = L.circleMarker([0, 0], { radius: 6, color: '#fff', weight: 2, fillColor: '#16924a', fillOpacity: 1 }).addTo(map);
      layers.current = { map, circle, marker };
      setReady(true);
    }).catch(() => { if (!cancelled) setError('Map could not load. You can still save the radius.'); });
    return () => { cancelled = true; layers.current?.map.remove(); layers.current = null; };
  }, []);

  const valid = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180 && Number.isFinite(radiusKm) && radiusKm >= 1;
  useEffect(() => {
    if (!ready || !valid || !layers.current) return;
    const { map, circle, marker } = layers.current;
    const point: [number, number] = [lat, lng];
    marker.setLatLng(point);
    circle.setLatLng(point).setRadius(radiusKm * 1000);
    map.invalidateSize();
    if (radiusKm >= 20000) map.fitWorld();
    else map.fitBounds(circle.getBounds(), { padding: [20, 20], maxZoom: 15, animate: false });
  }, [ready, valid, lat, lng, radiusKm]);

  return <div style={{ margin: '12px 0' }}>
    <div ref={container} aria-label="Warehouse delivery coverage map" style={{ height: 280, borderRadius: 12, zIndex: 0 }} />
    <p className="cell-muted" aria-live="polite">{error || (valid ? `Center dot: warehouse · Green circle: ${radiusKm} km delivery radius` : 'Enter a valid location and a delivery radius of at least 1 km.')}</p>
  </div>;
}
