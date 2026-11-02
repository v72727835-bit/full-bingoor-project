import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

export interface LatLng { latitude: number; longitude: number }

/**
 * A free OpenStreetMap map, drawn with Leaflet inside a WebView — the same
 * maps the Bingoor website uses, so there is no Google Maps key to manage.
 * Shows the rider and the customer with a line between them.
 */
export function OsmMap({ rider, destination, height = 210 }: { rider?: LatLng | null; destination: LatLng; height?: number }) {
  const html = useMemo(() => {
    const r = rider ? [rider.latitude, rider.longitude] : null;
    const d = [destination.latitude, destination.longitude];
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#m{height:100%;margin:0}#m{background:#e8eef2}</style></head>
<body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var d=${JSON.stringify(d)}, r=${JSON.stringify(r)};
  var map=L.map('m',{zoomControl:true,attributionControl:false}).setView(d,15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var home=L.divIcon({html:'<div style="background:#DC2626;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',className:'',iconSize:[20,20],iconAnchor:[10,20]});
  L.marker(d,{icon:home}).addTo(map).bindPopup('Customer');
  if(r){
    var bike=L.divIcon({html:'<div style="background:${colors.primary};width:26px;height:26px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px">\\uD83D\\uDEB2</div>',className:'',iconSize:[26,26],iconAnchor:[13,13]});
    L.marker(r,{icon:bike}).addTo(map).bindPopup('You');
    L.polyline([r,d],{color:'${colors.primary}',weight:4,dashArray:'8,6'}).addTo(map);
    map.fitBounds([r,d],{padding:[40,40]});
  }
</script></body></html>`;
  }, [rider, destination]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        source={{ html }}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.card },
  web: { flex: 1, backgroundColor: '#e8eef2' },
});
