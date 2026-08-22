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

// ── INIZIO b.88 — la mappa serve in due misure ──
// Oltre al riquadro grande del tassista serve una MINIATURA quadrata
// dentro la barra destinazione. Due proprietà nuove, entrambe con il
// valore di prima come predefinito: la pagina del tassista non cambia.
//   comandi     = mostra i tasti +/−/centra (inutili in miniatura)
//   interattiva = si può trascinare e zoomare
// `altezza` accetta anche '100%' per riempire il contenitore.
// ── FINE b.88 ──
export default function TaxiMap({ lat, lng, altezza = 340, comandi = true, interattiva = true, raggio = 20 }) {
  const { L, theme, S } = useApp();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const [pronta, setPronta] = useState(false);
  const acc = S.colors?.accent1 || '#5b8cff';
  const acc2 = S.colors?.accent2 || '#38e1ff';

  useEffect(() => {
    if (!boxRef.current || !lat || !lng) return;
    let mappa, gps;

    // Import dinamico: MapLibre si carica solo quando serve la mappa
    // ── INIZIO b.179 — LA MAPPA NON SI VEDEVA PIU ──
    // maplibre-gl e passato a v6: e un pacchetto SOLO-ESM, e il suo build
    // NON esporta piu un `default`. Il vecchio `({ default: maplibregl })`
    // dava quindi `maplibregl === undefined`, e `new maplibregl.Map(...)`
    // esplodeva: la mappa non veniva disegnata (ne dal tassista ne altrove).
    // Ora si prende il namespace: `Map`/`Marker` sono export nominati.
    // `mod.default ?? mod` regge anche eventuali versioni vecchie col default.
    // b.252 — la mappa che si sta per ricreare NON e ancora pronta.
    // Cambiando destinazione (o tema) l'effetto rigira: senza questo, il
    // flag restava `true` dal caricamento precedente e per tutto il tempo
    // del nuovo si vedeva un riquadro VUOTO invece di "carico la mappa".
    setPronta(false);
    import('maplibre-gl').then((mod) => {
      const maplibregl = mod.default ?? mod;
      // b.394 — LA MAPPA ERA UN RIQUADRO VUOTO, IN TUTTA L'APPLICAZIONE.
      // Non erano ne la rete, ne una chiave, ne il protocollo: le
      // piastrelle rispondono. MapLibre 6 tiene il suo lavoratore in un
      // file a parte e ne ricava l'indirizzo da import.meta.url. Il
      // confezionatore pero sostituisce import.meta.url con un percorso
      // del disco (file://...), il controllo "comincia per http?" fallisce
      // e quel calcolo torna una stringa VUOTA. Con l'indirizzo vuoto il
      // lavoratore viene aperto sulla PAGINA STESSA, che e HTML: non
      // parte, e senza lavoratore nessuna piastrella viene mai decodificata.
      // Verificato leggendo il pacchetto servito dal server.
      // Glielo diciamo noi, dalla nostra stessa origine (la politica di
      // sicurezza consente i lavoratori solo da qui).
      maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    // ── FINE b.179 ──
      // CSS di MapLibre (una volta sola)
      if (!document.getElementById('maplibre-css')) {
        const link = document.createElement('link');
        link.id = 'maplibre-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/maplibre-gl@6/dist/maplibre-gl.css'; // b.179 — era @4, disallineato col JS v6
        document.head.appendChild(link);
      }

      mappa = new maplibregl.Map({
        container: boxRef.current,
        style: theme === 'dawn' ? STILI.chiaro : STILI.scuro,
        center: [lng, lat],
        zoom: 14.5,
        attributionControl: { compact: true },
        // ── INIZIO b.88 — in miniatura la mappa è un'immagine, non un attrezzo ──
        interactive: interattiva,
        doubleClickZoom: interattiva,  // doppio tap/click = zoom in
        touchZoomRotate: interattiva,  // pinch
        dragRotate: false,             // niente rotazioni accidentali col drag
        // ── FINE b.88 ──
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
      // b.252 — vedi setPronta(false) a inizio effetto: senza, cambiando
      // destinazione restava il riquadro vuoto invece di "carico la mappa".
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
    <div style={{ position: 'relative', height: altezza, width: '100%', borderRadius: raggio, overflow: 'hidden',
      border: `1px solid ${S.colors?.cardBorder || 'rgba(160,190,255,0.14)'}` }}>
      <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} />
      {!pronta && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: S.colors?.textMuted, fontSize: 13 }}>
          {comandi ? L('loadingMap') : ''}
        </div>
      )}
      {/* Bottoni zoom grandi (per chi non usa i gesti) — non in miniatura */}
      {comandi && (
        <div style={{ position: 'absolute', right: 10, bottom: 12, display: 'flex',
          flexDirection: 'column', gap: 7, zIndex: 5 }}>
          <button style={btn} onClick={() => zoom(1)} aria-label={L('zoomIn')}>+</button>
          <button style={btn} onClick={() => zoom(-1)} aria-label={L('zoomOut')}>−</button>
          <button style={{ ...btn, fontSize: 15 }} onClick={centra} aria-label={L('centerOnDest')}>◎</button>
        </div>
      )}
    </div>
  );
}
