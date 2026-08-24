'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext.js';
import { apriPannelloPieno, chiudiPannelloPieno } from '../lib/pannelloPieno.js';

// ═══════════════════════════════════════════════
// TaxiMap — mappa vettoriale MapLibre GL (OpenFreeMap, senza API key).
//
// - Tema app scuro (deep/ember) → stile "dark" (sfondo scuro, strade chiare)
// - Tema Dawn → stile "positron" (grigio su bianco)
// - Pinch zoom, doppio tap = avvicina, due dita tap = allontana (nativi)
// - Bottoni +/− grandi e "centra" per chi preferisce i tasti
// - Marker destinazione con glow · posizione del tassista live (GPS)
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// b.446 — GLI STILI DELLA MAPPA. Erano due; ordine di Luca: «puoi montare
// in chiaro il grigio e lo stradale», e «perche non puoi usare il
// satellite del telefono?».
//
// Ognuno di questi indirizzi e stato PROVATO davvero: risponde 200, e uno
// style JSON valido per MapLibre, ha CORS aperto e non chiede chiavi.
//
// IL SATELLITE. Quello del telefono (Apple/Google) non si puo prendere: le
// loro immagini non sono esposte a una pagina web senza il loro SDK e la
// loro chiave, e i termini lo vietano. Ma il satellite si puo avere lo
// stesso, da Esri: le immagini si scaricano senza chiave (provato: 200,
// JPEG, CORS aperto) e qui sotto c'e lo style JSON scritto a mano che le
// monta. Attribuzione obbligatoria, ed e nel campo `attribution`.
// ═══════════════════════════════════════════════════════════════
const SATELLITE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
};

export const STILI_MAPPA = [
  { id: 'dark',      chiave: 'mapStyleNight', tinta: 'scuro',  url: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'fiord',     chiave: 'mapStyleSlate', tinta: 'scuro',  url: 'https://tiles.openfreemap.org/styles/fiord' },
  { id: 'eclipse',   chiave: 'mapStyleEclipse', tinta: 'scuro',  url: 'https://tiles.versatiles.org/assets/styles/eclipse/style.json' },
  { id: 'positron',  chiave: 'mapStyleLight', tinta: 'chiaro', url: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'graybeard', chiave: 'mapStyleGray', tinta: 'chiaro', url: 'https://tiles.versatiles.org/assets/styles/graybeard/style.json' },
  { id: 'liberty',   chiave: 'mapStyleStreets', tinta: 'chiaro', url: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'bright',    chiave: 'mapStyleBright', tinta: 'chiaro', url: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'neutrino',  chiave: 'mapStyleEssential', tinta: 'chiaro', url: 'https://tiles.versatiles.org/assets/styles/neutrino/style.json' },
  { id: 'colorful',  chiave: 'mapStyleColorful', tinta: 'colorato', url: 'https://tiles.versatiles.org/assets/styles/colorful/style.json' },
  { id: 'satellite', chiave: 'mapStyleSatellite', tinta: 'scuro',  stile: SATELLITE },
];

const STILI = {
  scuro: 'https://tiles.openfreemap.org/styles/dark',
  chiaro: 'https://tiles.openfreemap.org/styles/positron',
};

/** Lo stile da usare: quello scelto a mano, se no quello del tema. */
function stileDa(scelto, temaChiaro) {
  const v = STILI_MAPPA.find((x) => x.id === scelto);
  if (v) return v.stile || v.url;
  return temaChiaro ? STILI.chiaro : STILI.scuro;
}

// ── INIZIO b.88 — la mappa serve in due misure ──
// Oltre al riquadro grande del tassista serve una MINIATURA quadrata
// dentro la barra destinazione. Due proprietà nuove, entrambe con il
// valore di prima come predefinito: la pagina del tassista non cambia.
//   comandi     = mostra i tasti +/−/centra (inutili in miniatura)
//   interattiva = si può trascinare e zoomare
// `altezza` accetta anche '100%' per riempire il contenitore.
// ── FINE b.88 ──
export default function TaxiMap({ lat, lng, altezza = 340, comandi = true, interattiva = true, raggio = 20, stile = null }) {
  // b.446 — lo stile scelto a mano vince su quello del tema, e resta finche
  // si sta sulla mappa. Parte da `stile` se chi monta la mappa ne impone uno.
  const [stileScelto, setStileScelto] = useState(stile);
  const [scegliStile, setScegliStile] = useState(false);
  // b.447 — LO SCHERMO INTERO. Collaudo di Luca: «perche non vedo a tutto
  // schermo la mappa e non ci sono i tasti?». Perche non l'avevo scritto:
  // era solo nel template. E i tasti non c'erano perche qui la mappa e
  // montata in MINIATURA (comandi spenti) — quindi il tasto per ingrandire
  // deve esserci ANCHE in miniatura, se no da li non si esce.
  const [pieno, setPieno] = useState(false);
  const { L, theme, S } = useApp();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const [pronta, setPronta] = useState(false);
  const acc = S.colors?.accent1 || '#5b8cff';
  const acc2 = S.colors?.accent2 || '#38e1ff';
  const oro = S.colors?.goldAccent || '#ffc44d';

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
        style: stileDa(stileScelto, theme === 'dawn'),
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
  }, [lat, lng, theme, stileScelto]); // cambia tema o stile → ricrea con quello giusto

  // Cambiando misura il contenitore cambia, ma il NODO resta lo stesso:
  // MapLibre non se ne accorge da solo e va avvisato. Se invece si
  // spostasse il nodo nell'albero si perderebbe il contesto WebGL e
  // tornerebbe il velo «carico la mappa».
  useEffect(() => {
    if (!mapRef.current) return undefined;
    const id = setTimeout(() => { try { mapRef.current?.resize(); } catch { /* la mappa e stata smontata nel frattempo */ } }, 60);
    return () => clearTimeout(id);
  }, [pieno]);

  // A schermo intero: Esc chiude, e il tasto indietro di Android chiude la
  // mappa invece di buttare fuori dalla schermata — che in mezzo a una
  // corsa sarebbe il danno peggiore.
  useEffect(() => {
    if (!pieno) return undefined;
    const suTasto = (e) => { if (e.key === 'Escape') setPieno(false); };
    const suIndietro = () => setPieno(false);
    window.addEventListener('keydown', suTasto);
    window.addEventListener('popstate', suIndietro);
    try { window.history.pushState({ mappaPiena: true }, ''); } catch { /* cronologia non disponibile: resta Esc */ }
    return () => {
      window.removeEventListener('keydown', suTasto);
      window.removeEventListener('popstate', suIndietro);
    };
  }, [pieno]);

  // b.447 — dichiarare il pannello pieno, se no il banner «installa
  // l'applicazione» si piazza sopra la mappa (difetto gia visto in b.255).
  useEffect(() => {
    if (!pieno) return undefined;
    apriPannelloPieno();
    return () => chiudiPannelloPieno();
  }, [pieno]);

  const zoom = (delta) => mapRef.current?.zoomTo(mapRef.current.getZoom() + delta, { duration: 250 });
  const centra = () => mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 600 });

  const btn = {
    width: 42, height: 42, borderRadius: 13, border: '1px solid rgba(160,190,255,0.2)',
    background: 'rgba(5,7,15,0.75)', color: '#eef2ff', fontSize: 20, fontWeight: 800,
    cursor: 'pointer', backdropFilter: 'blur(12px)', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={pieno
      // b.447 — A SCHERMO INTERO e lo STESSO elemento che cambia misura:
      // non viene spostato nell'albero, quindi la mappa non si ricarica.
      ? { position: 'fixed', inset: 0, zIndex: 9998, borderRadius: 0, overflow: 'hidden',
          background: S.colors?.bg || '#05070f' }
      : { position: 'relative', height: altezza, width: '100%', borderRadius: raggio, overflow: 'hidden',
          border: `1px solid ${S.colors?.cardBorder || 'rgba(160,190,255,0.14)'}` }}>
      <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} />
      {!pronta && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: S.colors?.textMuted, fontSize: 13 }}>
          {comandi ? L('loadingMap') : ''}
        </div>
      )}
      {/* Bottoni zoom grandi (per chi non usa i gesti) — non in miniatura */}
      {(comandi || pieno) && (
        <div style={{ position: 'absolute', right: 10, bottom: 12, display: 'flex',
          flexDirection: 'column', gap: 7, zIndex: 5 }}>
          <button style={btn} onClick={() => zoom(1)} aria-label={L('zoomIn')}>+</button>
          <button style={btn} onClick={() => zoom(-1)} aria-label={L('zoomOut')}>−</button>
          <button style={{ ...btn, fontSize: 15 }} onClick={centra} aria-label={L('centerOnDest')}>◎</button>
        </div>
      )}

      {/* b.447 — IL TASTO PER INGRANDIRE, e per chiudere. C'e SEMPRE, anche
          quando la mappa e una miniatura senza comandi: se no da una
          miniatura non si potrebbe mai arrivare allo schermo intero, ed e
          esattamente il motivo per cui Luca non li trovava. A schermo
          intero diventa una x NELLO STESSO POSTO: sostituisce, non si
          aggiunge. Sta sotto la zona sicura, se no sull'iPhone finisce
          dietro l'orologio. */}
      <button
        onClick={() => { setPieno((v) => !v); setScegliStile(false); }}
        aria-pressed={pieno}
        aria-label={pieno ? L('close') : L('mapFullScreen')}
        title={pieno ? L('close') : L('mapFullScreen')}
        style={{ ...btn, position: 'absolute', right: 10, zIndex: 6,
          top: pieno ? 'max(12px, env(safe-area-inset-top))' : 10,
          borderColor: pieno ? oro : 'rgba(160,190,255,0.2)',
          color: pieno ? oro : '#eef2ff' }}>
        {pieno ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        )}
      </button>

      {/* b.446 — IL TASTO DEGLI STILI, e la scelta NASCOSTA dietro di lui.
          Non una fila di dieci bottoni sempre a schermo: la mappa e la cosa
          da guardare, i comandi no. Sta in alto a destra, lontano dai +/−. */}
      {(comandi || pieno) && (
        <button
          onClick={() => setScegliStile((v) => !v)}
          aria-expanded={scegliStile}
          aria-label={L('mapStyle')}
          style={{ ...btn, position: 'absolute', right: 10, top: pieno ? 'calc(max(12px, env(safe-area-inset-top)) + 52px)' : 62, zIndex: 6,
            borderColor: scegliStile ? oro : 'rgba(160,190,255,0.2)',
            color: scegliStile ? oro : '#eef2ff' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </button>
      )}

      {(comandi || pieno) && scegliStile && (
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 7,
          background: 'rgba(8,12,24,0.93)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${S.colors?.cardBorder || 'rgba(160,190,255,0.14)'}`,
          borderRadius: 18, padding: '9px 8px 10px' }}>
          <div aria-hidden style={{ width: 38, height: 4, borderRadius: 999, margin: '0 auto 9px',
            background: S.colors?.cardBorder || 'rgba(160,190,255,0.2)' }} />
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {STILI_MAPPA.map((v) => {
              const acceso = stileScelto === v.id;
              return (
                <button key={v.id}
                  onClick={() => { setStileScelto(v.id); setScegliStile(false); }}
                  style={{ flexShrink: 0, minHeight: 44, padding: '0 14px', borderRadius: 12,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, whiteSpace: 'nowrap',
                    border: `1px solid ${acceso ? oro : (S.colors?.cardBorder || 'rgba(160,190,255,0.14)')}`,
                    background: acceso ? 'rgba(255,196,77,0.14)' : 'rgba(255,255,255,0.05)',
                    color: acceso ? oro : (S.colors?.textSecondary || '#eef2ff') }}>
                  {L(v.chiave)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
