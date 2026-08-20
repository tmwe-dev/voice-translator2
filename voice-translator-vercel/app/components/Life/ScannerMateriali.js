'use client';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FONT } from '../../lib/constants.js';
import { leggiImmagineLocale } from '../../lib/ocrLocale.js';
import { preElabora, fondiRisultati, similiPerFusione, classificaAppunti } from '../../lib/compagni/scanner.js';

// ═══════════════════════════════════════════════════════════════
// b.343 — ACQUISIZIONE MATERIALI, copiata dal BizCard Scanner (Luca):
// «voglio che copi esattamente le funzioni e le repliche adattandole
// alla grafica nostra». Un'AREA SOLA: trascini o selezioni i file, o
// inquadri il QR che collega DIRETTAMENTE la fotocamera del telefono
// (ponte PeerJS, come nel BizCard — con ripiego sul deposito via
// server se il ponte non si apre). La MASCHERA DI ACQUISIZIONE mostra
// fase, avanzamento e i CAMPI RILEVATI in tempo reale, come di la.
// Multiscansione: piu scatti della stessa pagina si FONDONO per voto
// riga-per-riga; pagine diverse si accodano.
// ═══════════════════════════════════════════════════════════════

const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

function caricaPeer() {
  return new Promise((res, rej) => {
    if (typeof window === 'undefined') return rej(new Error('solo browser'));
    if (window.Peer) return res();
    const gia = document.querySelector(`script[src="${PEERJS_URL}"]`);
    const s = gia || document.createElement('script');
    s.addEventListener('load', () => res(), { once: true });
    s.addEventListener('error', () => rej(new Error('peerjs non caricato')), { once: true });
    if (!gia) { s.src = PEERJS_URL; s.async = true; document.head.appendChild(s); }
  });
}

function dataUrlDaFile(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// riduce + PRE-ELABORA (auto-contrasto/nitidezza del BizCard) in un canvas
function preparaImmagine(dataUrl) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1600;
      const scala = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scala);
      c.height = Math.round(img.height * scala);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      try { preElabora(ctx, c.width, c.height); } catch { /* si legge lo stesso */ }
      res(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = rej;
    img.src = dataUrl;
  });
}

function ScannerMateriali({ lingua, userToken, onTesto, onPdf, onFotoPerAI, chiama, testoP, muto, accent, card, bordo }) {
  // coda di scansione e maschera
  const [maschera, setMaschera] = useState(false);
  const [fase, setFase] = useState('');           // riga di stato grande
  const [dettaglio, setDettaglio] = useState('');  // riga piccola
  const [avanza, setAvanza] = useState(0);         // 0..100
  const [campi, setCampi] = useState(null);        // scheda campi in tempo reale
  const [fiducie, setFiducie] = useState([]);
  const [trascina, setTrascina] = useState(false);
  const [nFoto, setNFoto] = useState(0);
  // ponte telefono
  const [sid] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());
  const [ponte, setPonte] = useState('attesa'); // attesa | pronto | connesso | ripiego
  const peerRef = useRef(null);
  const codaRef = useRef([]);      // dataUrl in attesa
  const pagineRef = useRef([]);    // [{testi:[...], fuso:''}] una voce per pagina
  const lavoraRef = useRef(false);
  const fermaRef = useRef(false);
  const vivoRef = useRef(true);

  // ── IL PONTE DIRETTO (porting di setupPeer dal BizCard) ──
  useEffect(() => {
    vivoRef.current = true;
    let ritenta = 0;
    let timer = null;
    const apri = async () => {
      try {
        await caricaPeer();
        if (!vivoRef.current) return;
        const peer = new window.Peer('bartalk-scan-' + sid, {
          config: { iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ] },
          debug: 0,
        });
        peerRef.current = peer;
        peer.on('open', () => { if (vivoRef.current) setPonte('pronto'); });
        peer.on('connection', (conn) => {
          if (!vivoRef.current) return;
          setPonte('connesso');
          conn.on('data', (d) => {
            if (d && d.type === 'photo' && typeof d.image === 'string') {
              try { conn.send({ type: 'ack' }); } catch { /* l'ack e una cortesia: se non parte, la foto e comunque arrivata */ }
              accoda('data:image/jpeg;base64,' + d.image);
            }
          });
          conn.on('close', () => { if (vivoRef.current) setPonte('pronto'); });
        });
        peer.on('error', () => {
          ritenta++;
          if (ritenta >= 3) { if (vivoRef.current) setPonte('ripiego'); return; }
          timer = setTimeout(apri, 2500 * ritenta);
        });
      } catch { if (vivoRef.current) setPonte('ripiego'); }
    };
    apri();
    return () => {
      vivoRef.current = false;
      clearTimeout(timer);
      try { peerRef.current?.destroy(); } catch { /* il ponte era gia stato chiuso: nulla da fare */ }
      peerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  // ── RIPIEGO: se il ponte non si apre, si sondano i depositi (b.342) ──
  useEffect(() => {
    if (ponte !== 'ripiego' && ponte !== 'pronto') return;
    const t = setInterval(async () => {
      try {
        const d = await chiama('scanRitira', { sid: 'dep-' + sid }, userToken);
        if (d?.dato) accoda(d.dato);
      } catch { /* al prossimo giro */ }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ponte, sid, userToken]);

  // ── LA CODA DELLA MULTISCANSIONE ──
  const accoda = useCallback((dataUrl) => {
    codaRef.current.push(dataUrl);
    setNFoto((n) => n + 1);
    lavora();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lavora = useCallback(async () => {
    if (lavoraRef.current) return;
    lavoraRef.current = true;
    fermaRef.current = false;
    setMaschera(true);
    try {
      while (codaRef.current.length > 0 && !fermaRef.current) {
        const grezzo = codaRef.current.shift();
        const totale = nFotoRef.current;
        setFase('Acquisizione…');
        setDettaglio('Preparo l’immagine (contrasto e nitidezza)');
        setAvanza(10);
        const pronto = await preparaImmagine(grezzo);
        if (fermaRef.current) break;

        setFase('Lettura in corso…');
        setDettaglio('OCR sulla pagina — tieni d’occhio i campi qui sotto');
        const { testo, fiducia } = await leggiImmagineLocale(pronto, lingua || 'it', (p) => setAvanza(10 + Math.round(p * 70)));
        if (fermaRef.current) break;

        if (testo && testo.length >= 10) {
          // multiscansione: stessa pagina rifotografata → FUSIONE per voto
          const ultima = pagineRef.current[pagineRef.current.length - 1];
          if (ultima && similiPerFusione(ultima.fuso || ultima.testi[0], testo)) {
            ultima.testi.push(testo);
            ultima.fuso = fondiRisultati(ultima.testi);
            setDettaglio(`Scatto ripetuto riconosciuto — fuso per voto (${ultima.testi.length} letture)`);
          } else {
            pagineRef.current.push({ testi: [testo], fuso: testo });
          }
          setFiducie((f) => [...f, fiducia]);
          onFotoPerAI?.(pronto, fiducia);
        }

        // la scheda dei campi si aggiorna IN TEMPO REALE, come nel BizCard
        const testoTot = pagineRef.current.map((p) => p.fuso).join('\n\n');
        setCampi({ ...classificaAppunti(testoTot), pagine: pagineRef.current.length });
        setAvanza(90);
        setDettaglio(`${pagineRef.current.length} pagin${pagineRef.current.length === 1 ? 'a' : 'e'} — ${totale - codaRef.current.length}/${totale} foto lette`);
      }

      const testoFinale = pagineRef.current.map((p) => p.fuso).join('\n\n');
      if (testoFinale) {
        setFase('Completato');
        const c = classificaAppunti(testoFinale);
        const media = fiducieRef.current.length ? Math.round(fiducieRef.current.reduce((a, b) => a + b, 0) / fiducieRef.current.length) : 0;
        setDettaglio(`${c.righe} righe, ${c.parole} parole — fiducia media ${media}%`);
        setAvanza(100);
        onTesto?.(testoFinale, { titolo: c.titolo, materia: c.materia, fiducia: media, pagine: pagineRef.current.length });
        if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
      } else if (!fermaRef.current) {
        setFase('Nessun testo rilevato');
        setDettaglio('Riprova con piu luce, o piu vicino alla pagina');
      }
    } finally {
      lavoraRef.current = false;
      if (codaRef.current.length > 0 && !fermaRef.current) lavora();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lingua]);

  // specchi in ref per usare i valori dentro il ciclo senza ricreare la coda
  const nFotoRef = useRef(0);
  useEffect(() => { nFotoRef.current = nFoto; }, [nFoto]);
  const fiducieRef = useRef([]);
  useEffect(() => { fiducieRef.current = fiducie; }, [fiducie]);

  // ── FILE: trascinati o selezionati (immagini E pdf, area UNICA) ──
  const daFiles = useCallback(async (files) => {
    for (const f of Array.from(files || [])) {
      if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) { onPdf?.(f); continue; }
      if (!/^image\//.test(f.type)) continue;
      try { accoda(await dataUrlDaFile(f)); } catch { /* file illeggibile: si salta */ }
    }
  }, [accoda, onPdf]);

  const urlScan = typeof window !== 'undefined' ? `${window.location.origin}/scan?s=${sid}` : '';

  return (
    <div>
      {/* ── L'AREA UNICA: trascina/seleziona + QR del telefono ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setTrascina(true); }}
        onDragLeave={() => setTrascina(false)}
        onDrop={(e) => { e.preventDefault(); setTrascina(false); daFiles(e.dataTransfer.files); }}
        style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch', padding: 16, borderRadius: 14,
          border: `2px dashed ${trascina ? accent : (bordo?.split(' ').pop() || 'rgba(255,255,255,0.2)')}`,
          background: trascina ? `${accent}11` : 'rgba(255,255,255,0.03)', transition: 'all .2s' }}>

        <label style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6, cursor: 'pointer', textAlign: 'center', padding: 12, minHeight: 150 }}>
          <div style={{ fontSize: 34 }}>📁</div>
          <div style={{ fontWeight: 800, color: testoP, fontSize: 14 }}>Trascina qui foto o PDF</div>
          <div style={{ fontSize: 12, color: muto }}>oppure clicca per selezionare — piu file insieme</div>
          <input type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }}
            onChange={(e) => { daFiles(e.target.files); e.target.value = ''; }} />
        </label>

        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8 }}>
          {urlScan && (
            <img alt="QR per il telefono" width={128} height={128} style={{ borderRadius: 8, background: '#fff', padding: 4 }}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(urlScan)}`} />
          )}
          <div style={{ fontSize: 12, fontWeight: 800, color: testoP }}>📱 Fotocamera del telefono</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: muto }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0,
              background: ponte === 'connesso' ? '#4ade80' : (ponte === 'ripiego' ? '#f59e0b' : '#f59e0b'),
              animation: ponte === 'connesso' ? 'none' : 'vt-scan-pulse 1s infinite' }} />
            {ponte === 'connesso' ? 'Telefono connesso — scatta pure'
              : ponte === 'pronto' ? 'Inquadra il QR col telefono'
              : ponte === 'ripiego' ? 'Canale lento attivo — le foto arrivano comunque'
              : 'Apro il canale…'}
          </div>
          <div style={{ fontSize: 10, color: muto, letterSpacing: 2 }}>{sid}</div>
        </div>
      </div>

      {/* ── LA MASCHERA DI ACQUISIZIONE (porting dell'overlay BizCard) ── */}
      {maschera && (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: card, border: `1px solid ${accent}55` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1, fontWeight: 800, color: testoP, fontSize: 14 }}>{fase || 'In attesa…'}</div>
            <button onClick={() => { fermaRef.current = true; codaRef.current = []; setMaschera(false); }}
              style={{ background: 'none', border: bordo, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: muto, fontFamily: FONT, fontSize: 12 }}>
              Interrompi
            </button>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${avanza}%`, background: `linear-gradient(90deg, ${accent}, #06b6d4)`, transition: 'width .3s' }} />
          </div>

          {/* La scheda dei CAMPI che si riempie in tempo reale */}
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: bordo }}>
            {[['Titolo', campi?.titolo], ['Materia', campi?.materia], ['Pagine', campi?.pagine], ['Righe', campi?.righe], ['Parole', campi?.parole],
              ['Date trovate', campi?.date?.length ? campi.date.join(' · ') : null], ['Formule', campi?.formule || null], ['Elenchi', campi?.elenchi || null]]
              .map(([nome, val]) => (
                <div key={nome} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.7, fontFamily: FONT }}>
                  <span style={{ color: muto, minWidth: 92 }}>{nome}</span>
                  {val !== null && val !== undefined && val !== '' && val !== 0
                    ? <span style={{ color: testoP, fontWeight: nome === 'Titolo' ? 800 : 500 }}>{String(val)}</span>
                    : <span aria-hidden style={{ flex: '0 0 40%', alignSelf: 'center', height: 9, borderRadius: 5,
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.14), rgba(255,255,255,0.06))',
                        backgroundSize: '200% 100%', animation: 'vt-scan-shimmer 1.2s linear infinite' }} />}
                </div>
              ))}
          </div>
          <div style={{ fontSize: 12, color: muto, marginTop: 8 }}>{dettaglio}</div>
        </div>
      )}

      <style>{'@keyframes vt-scan-pulse{0%,100%{opacity:1}50%{opacity:.3}}@keyframes vt-scan-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
    </div>
  );
}

export default memo(ScannerMateriali);
