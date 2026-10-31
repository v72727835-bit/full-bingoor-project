import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

export interface LatLng { latitude: number; longitude: number }

/**
 * A map inside a WebView showing the rider and the customer with a line between
 * them. When the admin has set a Google Maps API key (passed as `googleApiKey`,
 * from /settings/public) the map uses Google Maps; otherwise it falls back to
 * the free OpenStreetMap/Leaflet map.
 */
export function OsmMap({ rider, destination, height = 210, googleApiKey }: { rider?: LatLng | null; destination: LatLng; height?: number; googleApiKey?: string | null }) {
  const html = useMemo(() => {
    const r = rider ? [rider.latitude, rider.longitude] : null;
    const d = [destination.latitude, destination.longitude];

    if (googleApiKey) {
      return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>html,body,#m{height:100%;margin:0}#m{background:#e8eef2}</style></head>
<body><div id="m"></div>
<script>
  var d=${JSON.stringify({ lat: d[0], lng: d[1] })}, r=${r ? JSON.stringify({ lat: r[0], lng: r[1] }) : 'null'};
  function init(){
    var map=new google.maps.Map(document.getElementById('m'),{center:d,zoom:15,disableDefaultUI:false,clickableIcons:false,fullscreenControl:false,mapTypeControl:false,streetViewControl:false});
    new google.maps.Marker({position:d,map:map,title:'Customer'});
    if(r){
      new google.maps.Marker({position:r,map:map,title:'You',icon:{path:google.maps.SymbolPath.CIRCLE,scale:8,fillColor:'${colors.primary}',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}});
      new google.maps.Polyline({path:[r,d],map:map,strokeColor:'${colors.primary}',strokeWeight:4});
      var b=new google.maps.LatLngBounds();b.extend(r);b.extend(d);map.fitBounds(b,40);
    }
  }
  window.gmFail=function(){document.getElementById('m').innerHTML='<div style="padding:12px;font:13px system-ui;color:#666">Map unavailable</div>';};
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleApiKey)}&callback=init" onerror="gmFail()"></script>
</body></html>`;
    }

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
  }, [rider, destination, googleApiKey]);

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
