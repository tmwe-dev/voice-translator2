'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// TaxiMap — mappa vettoriale MapLibre GL (OpenFreeMap, senza API key).
//
// - Tema app scuro (deep/ember) → stile "dark" (sfondo scuro, strade chiare)
// - Tema Dawn → stile "positron" (grigio su bianco)
// - Pinch zoom, doppio tap = avvicina, due dita tap = allontana (nativi)
// - Bottoni +/− grandi e "centra" per chi preferisce i tasti
// - Marker destinazione con glow · posizione del tassista live (GPS)
// ═══════════════════════════════════════════════

const STILI = {
  scuro: 'https://tiles.openfreemap.org/styles/dark',
  chiaro: 'https://tiles.openfreemap.org/styles/positron',
};

export default function TaxiMap({ lat, lng, altezza = 340 }) {
  const { theme, S } = useApp();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const [pronta, setPronta] = useState(false);
  const acc = S.colors?.accent1 || '#5b8cff';
  const acc2 = S.colors?.accent2 || '#38e1ff';

  useEffect(() => {
    if (!boxRef.current || !lat || !lng) return;
    let mappa, gps;

    // Import dinamico: MapLibre si carica solo quando serve la mappa
    import('maplibre-gl').then(({ default: maplibregl }) => {
      // CSS di MapLibre (una volta sola)
      if (!document.getElementById('maplibre-css')) {
        const link = document.createElement('link');
        link.id = 'maplibre-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css';
        document.head.appendChild(link);
      }

      mappa = new maplibregl.Map({
        container: boxRef.current,
        style: theme === 'dawn' ? STILI.chiaro : STILI.scuro,
        center: [lng, lat],
        zoom: 14.5,
        attributionControl: { compact: true },
        doubleClickZoom: true,      // doppio tap/click = zoom in
        touchZoomRotate: true,      // pinch
        dragRotate: false,          // niente rotazioni accidentali col drag
      });
      mapRef.current = mappa;

      // ── Marker destinazione: pin con glow ──
      const pin = document.createElement('div');
      pin.style.cssText = `width:22px;height:22px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:linear-gradient(135deg,${acc},${acc2});
        border:2.5px solid #fff;box-shadow:0 0 20px ${acc}, 0 4px 12px rgba(0,0,0,0.4);`;
      new maplibregl.Marker({ element: pin, anchor: 'bottom' })
        .setLngLat([lng, lat]).addTo(mappa);

      // ── Posizione del tassista, aggiornata live ──
      if (navigator.geolocation) {
        const punto = document.createElement('div');
        punto.style.cssText = `width:14px;height:14px;border-radius:50%;background:#3ddc84;
          border:2.5px solid #fff;box-shadow:0 0 14px #3ddc84;`;
        const posMarker = new maplibregl.Marker({ element: punto });
        gps = navigator.geolocation.watchPosition(
          (p) => posMarker.setLngLat([p.coords.longitude, p.coords.latitude]).addTo(mappa),
          () => {}, { enableHighAccuracy: true, maximumAge: 5000 }
        );
      }

      mappa.on('load', () => setPronta(true));
    });

    return () => {
      if (gps && navigator.geolocation) navigator.geolocation.clearWatch(gps);
      if (mappa) mappa.remove();
    };
  }, [lat, lng, theme]); // cambia tema → ricrea con lo stile giusto

  const zoom = (delta) => mapRef.current?.zoomTo(mapRef.current.getZoom() + delta, { duration: 250 });
  const centra = () => mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 600 });

  const btn = {
    width: 42, height: 42, borderRadius: 13, border: '1px solid rgba(160,190,255,0.2)',
    background: 'rgba(5,7,15,0.75)', color: '#eef2ff', fontSize: 20, fontWeight: 800,
    cursor: 'pointer', backdropFilter: 'blur(12px)', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ position: 'relative', height: altezza, borderRadius: 20, overflow: 'hidden',
      border: `1px solid ${S.colors?.cardBorder || 'rgba(160,190,255,0.14)'}` }}>
      <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} />
      {!pronta && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: S.colors?.textMuted, fontSize: 13 }}>
          Carico la mappa…
        </div>
      )}
      {/* Bottoni zoom grandi (per chi non usa i gesti) */}
      <div style={{ position: 'absolute', right: 10, bottom: 12, display: 'flex',
        flexDirection: 'column', gap: 7, zIndex: 5 }}>
        <button style={btn} onClick={() => zoom(1)} aria-label="Avvicina">+</button>
        <button style={btn} onClick={() => zoom(-1)} aria-label="Allontana">−</button>
        <button style={{ ...btn, fontSize: 15 }} onClick={centra} aria-label="Centra sulla destinazione">◎</button>
      </div>
    </div>
  );
}
