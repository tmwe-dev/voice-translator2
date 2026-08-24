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

// b.452, ordine di Luca: «le mappe col menu in basso fanno cagare.
// Mantieni solo una mappa chiara ed elimina la scelta di mappe diverse».
//
// Via i dieci stili e il tasto che li apriva. Ne resta UNO, chiaro, sempre
// quello: Liberty di OpenFreeMap — le strade si distinguono, che su una
// mappa che serve a portare qualcuno da qualche parte e l'unica cosa che
// conta. Chiaro anche di notte: una mappa che cambia da sola sotto gli
// occhi e un'altra cosa da imparare, e non serviva a nessuno.
const MAPPA = 'https://tiles.openfreemap.org/styles/liberty';

// ── INIZIO b.88 — la mappa serve in due misure ──
// Oltre al riquadro grande del tassista serve una MINIATURA quadrata
// dentro la barra destinazione. Due proprietà nuove, entrambe con il
// valore di prima come predefinito: la pagina del tassista non cambia.
//   comandi     = mostra i tasti +/−/centra (inutili in miniatura)
//   interattiva = si può trascinare e zoomare
// `altezza` accetta anche '100%' per riempire il contenitore.
// ── FINE b.88 ──
export default function TaxiMap({ lat, lng, altezza = 340, comandi = true, interattiva = true, raggio = 20, }) {
  // b.446 — lo stile scelto a mano vince su quello del tema, e resta finche
  // si sta sulla mappa. Parte da `stile` se chi monta la mappa ne impone uno.
  // b.447 — LO SCHERMO INTERO. Collaudo di Luca: «perche non vedo a tutto
  // schermo la mappa e non ci sono i tasti?». Perche non l'avevo scritto:
  // era solo nel template. E i tasti non c'erano perche qui la mappa e
  // montata in MINIATURA (comandi spenti) — quindi il tasto per ingrandire
  // deve esserci ANCHE in miniatura, se no da li non si esce.
  const [pieno, setPieno] = useState(false);
  const { L, S } = useApp();
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
        style: MAPPA,
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

      mappa.on('load', () => {
        setPronta(true);
        // b.449, collaudo di Luca: «togli quel toast dalla cartina, non
        // serve». L'attribuzione era GIA in modo compatto, ma MapLibre la
        // apre da sola al primo disegno e resta li: quella striscia bianca
        // e proprio lei, aperta.
        // NON si puo togliere del tutto: i dati sono OpenStreetMap, e la
        // loro licenza (ODbL) impone di citarli — non e una decorazione, e
        // una condizione d'uso. Ma si puo tenere CHIUSA: resta la «i», che
        // toccata la riapre. L'obbligo e rispettato, la striscia sparisce.
        try {
          boxRef.current?.querySelectorAll('.maplibregl-ctrl-attrib')
            .forEach((n) => n.classList.remove('maplibregl-compact-show'));
        } catch { /* la mappa e stata smontata prima di finire di caricare */ }
      });
      // b.252 — vedi setPronta(false) a inizio effetto: senza, cambiando
      // destinazione restava il riquadro vuoto invece di "carico la mappa".
    });

    return () => {
      if (gps && navigator.geolocation) navigator.geolocation.clearWatch(gps);
      if (mappa) mappa.remove();
    };
  }, [lat, lng]); // la mappa non dipende piu dal tema: e sempre la stessa

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
        <div style={{ position: 'absolute', right: 10, display: 'flex',
          bottom: pieno ? 'calc(16px + env(safe-area-inset-bottom))' : 12,
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
        onClick={() => setPieno((v) => !v)}
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

    </div>
  );
}
