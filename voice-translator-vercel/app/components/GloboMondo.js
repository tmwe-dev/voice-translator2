'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { postoADestra, MARGINE, COLONNA_DESTRA } from '../lib/righello.js';

// ═══════════════════════════════════════════════════════════════
// IL GLOBO DEL MONDO — il file approvato resta il renderer.
//
// b.580: stelle, Terra, rotazione, zoom, voli e tre cieli NON vengono
// riscritti. Cambia soltanto il significato dei puntini passati al file:
// LIVE = eventi, SEGUO = eventi seguiti, COMMUNITY = stanze/discussioni.
// ═══════════════════════════════════════════════════════════════

const ORIGINE = typeof window !== 'undefined' ? window.location.origin : '*';

const STATI = [
  { id: 'notte', icona: 'luna', nome: 'Notte' },
  { id: 'giorno', icona: 'sole', nome: 'Giorno' },
  { id: 'ibrido', icona: 'mezzaluna', nome: 'Ibrido' },
];

function IconaCielo({ tipo, size = 26, color = '#dfe6f2' }) {
  if (tipo === 'sole') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.2" fill={color} stroke="none" />
        {[0,45,90,135,180,225,270,315].map((a) => {
          const r = a * Math.PI / 180;
          return <line key={a} x1={12 + Math.cos(r) * 7} y1={12 + Math.sin(r) * 7} x2={12 + Math.cos(r) * 9.5} y2={12 + Math.sin(r) * 9.5} />;
        })}
      </svg>
    );
  }
  if (tipo === 'mezzaluna') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke={color} strokeWidth="2" />
        <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill={color} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  );
}

export default function GloboMondo({ sfondo = false, titolo = 'Il mondo ora', etichettaCielo = 'Cielo del pianeta', paese = null, rotte = null, traffico = null, onPaeseScelto = null, focusEsterno = null }) {
  const ref = useRef(null);
  // Giorno resta il default: il pianeta deve essere riconoscibile appena
  // si entra. Notte e Ibrido restano identici e a un tocco.
  const [stato, setStato] = useState(1);
  const [menuCielo, setMenuCielo] = useState(false);
  const [radar, setRadar] = useState({ layer: 'live', live: {}, following: {} });

  // Il radar comunica con questo involucro, non con mondo-globo.html.
  // In questo modo il file 3D non viene contaminato da logica editoriale.
  useEffect(() => {
    const cambia = (ev) => {
      const d = ev?.detail || {};
      const layer = ['live', 'following', 'community'].includes(d.layer) ? d.layer : 'live';
      setRadar({ layer, live: d.live || {}, following: d.following || {} });
    };
    window.addEventListener('bartalk:mondo-layer', cambia);
    return () => window.removeEventListener('bartalk:mondo-layer', cambia);
  }, []);

  const trafficoEffettivo = useMemo(() => {
    if (radar.layer === 'community') return traffico || {};
    if (radar.layer === 'following') return radar.following || {};
    return radar.live || {};
  }, [radar, traffico]);

  // b.587 — il focus Live e TEMPORANEO e deve vincere sul Paese scelto.
  // Prima l'ordine era `paese || focusEsterno`: siccome all'ingresso viene
  // gia selezionato il proprio Paese, un breaking dagli USA o dal Giappone
  // chiedeva il volo ma il renderer continuava a ricevere IT. Quando il
  // cartello finisce focusEsterno torna null e il pianeta rientra sul
  // Paese scelto: nessuna preferenza viene persa.
  useEffect(() => {
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    const manda = () => {
      try { finestra.postMessage({ tipo: 'bartalk:paese', code: focusEsterno || paese || null }, ORIGINE); }
      catch { /* iframe in caricamento: il messaggio verra ripetuto a globo-pronto */ }
    };
    manda();
    const suPronto = (ev) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.source !== ref.current?.contentWindow) return;
      if (ev?.data?.tipo === 'bartalk:globo-pronto') manda();
    };
    window.addEventListener('message', suPronto);
    return () => window.removeEventListener('message', suPronto);
  }, [paese, focusEsterno]);

  // I voli restano esattamente quelli esistenti: sono parte della scena
  // approvata e della Community, non vengono rimossi cambiando layer.
  useEffect(() => {
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    const manda = () => {
      try { finestra.postMessage({ tipo: 'bartalk:rotte', coppie: rotte || [] }, ORIGINE); }
      catch { /* iframe in caricamento: il messaggio verra ripetuto a globo-pronto */ }
    };
    manda();
    const suPronto = (ev) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.source !== ref.current?.contentWindow) return;
      if (ev?.data?.tipo === 'bartalk:globo-pronto') manda();
    };
    window.addEventListener('message', suPronto);
    return () => window.removeEventListener('message', suPronto);
  }, [rotte]);

  // Una sola grammatica visiva dei puntini; e' il layer a decidere quali
  // valori inviare. Il renderer interno, i colori e le animazioni restano.
  useEffect(() => {
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    const manda = () => {
      try { finestra.postMessage({ tipo: 'bartalk:traffico', perPaese: trafficoEffettivo }, ORIGINE); }
      catch { /* iframe in caricamento: il messaggio verra ripetuto a globo-pronto */ }
    };
    manda();
    const suPronto = (ev) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.source !== ref.current?.contentWindow) return;
      if (ev?.data?.tipo === 'bartalk:globo-pronto') manda();
    };
    window.addEventListener('message', suPronto);
    return () => window.removeEventListener('message', suPronto);
  }, [trafficoEffettivo]);

  const CIELI = ['navigator', 'wueform', 'ibrido'];

  useEffect(() => {
    const suMessaggio = (ev) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.source !== ref.current?.contentWindow) return;
      const d = ev?.data;
      if (!d || d.tipo !== 'bartalk:paese-scelto') return;
      onPaeseScelto?.(d.code ? String(d.code).toUpperCase() : null);
    };
    window.addEventListener('message', suMessaggio);
    return () => window.removeEventListener('message', suMessaggio);
  }, [onPaeseScelto]);

  const scegliCielo = (indice) => {
    const finestra = ref.current?.contentWindow;
    if (!finestra) return;
    try { finestra.postMessage({ tipo: 'bartalk:cielo', variante: CIELI[indice] }, ORIGINE); }
    catch { return; }
    setStato(indice);
    setMenuCielo(false);
  };

  const contenitore = sfondo
    ? { position: 'absolute', inset: 0, zIndex: 0, background: '#05070f', overflow: 'hidden' }
    : { width: '100%', height: '58vh', borderRadius: 18, overflow: 'hidden', position: 'relative', flexShrink: 0, background: '#05070f' };

  return (
    <>
      <div style={contenitore}>
        <iframe
          ref={ref}
          src={sfondo ? '/mondo-globo.html?solo=1' : '/mondo-globo.html'}
          title={titolo}
          allow="accelerometer; gyroscope"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>

      <button onClick={() => setMenuCielo((v) => !v)} aria-label={etichettaCielo}
        aria-haspopup="listbox" aria-expanded={menuCielo}
        style={{
          ...postoADestra(1), zIndex: 80,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}>
        <IconaCielo tipo={STATI[stato].icona} size={26} />
      </button>

      {menuCielo && (
        <>
          <div onClick={() => setMenuCielo(false)} style={{ position: 'fixed', inset: 0, zIndex: 79, background: 'transparent' }} />
          <div role="listbox" aria-label={etichettaCielo}
            style={{
              position: 'fixed', zIndex: 81,
              right: MARGINE + COLONNA_DESTRA.passo, top: `calc(${COLONNA_DESTRA.primo} + 40px)`,
              minWidth: 152, padding: 4,
              background: 'rgba(11,15,28,0.96)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
              boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            }}>
            {STATI.map((v, i) => (
              <button key={v.id} role="option" aria-selected={i === stato} onClick={() => scegliCielo(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: i === stato ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: i === stato ? '#eaf0ff' : 'rgba(214,226,245,0.85)',
                  fontSize: 13, fontWeight: 500,
                  textAlign: 'left', WebkitTapHighlightColor: 'transparent',
                }}>
                <IconaCielo tipo={v.icona} size={17} color={i === stato ? '#eaf0ff' : 'rgba(214,226,245,0.8)'} />
                <span style={{ flex: 1 }}>{v.nome}</span>
                {i === stato && <span style={{ fontSize: 12 }}>&#10003;</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}