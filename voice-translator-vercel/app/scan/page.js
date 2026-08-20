'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// ═══════════════════════════════════════════════════════════════
// b.343 — /scan: LA FOTOCAMERA DEL TELEFONO COLLEGATA AL PC.
// Porting fedele di phone.html del BizCard Scanner (ordine di Luca):
// fotocamera dal vivo a tutto schermo, cornice-guida, scatto con
// anteprima (Rifai/Invia), contatore foto, cambio camera e torcia,
// ponte DIRETTO PeerJS verso il PC con ritenti — e ripiego sul
// deposito via server se il ponte non si apre. Nessun login.
// ═══════════════════════════════════════════════════════════════

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const MAX_LATO = 1600;
const QUALITA = 0.85;

function caricaPeer() {
  return new Promise((res, rej) => {
    if (window.Peer) return res();
    const gia = document.querySelector(`script[src="${PEERJS_URL}"]`);
    const s = gia || document.createElement('script');
    s.addEventListener('load', () => res(), { once: true });
    s.addEventListener('error', () => rej(new Error('peerjs')), { once: true });
    if (!gia) { s.src = PEERJS_URL; s.async = true; document.head.appendChild(s); }
  });
}

function PaginaScan() {
  const params = useSearchParams();
  const sid = (params.get('s') || params.get('sid') || '').toUpperCase();
  const [stato, setStato] = useState('connetto'); // connetto | pronto | ripiego | errore
  const [nota, setNota] = useState('Connessione al computer…');
  const [inviate, setInviate] = useState(0);
  const [anteprima, setAnteprima] = useState(null); // dataUrl in attesa di conferma
  const [invio, setInvio] = useState(false);
  const [flash, setFlash] = useState(false);
  const [torcia, setTorcia] = useState({ possibile: false, accesa: false });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const connRef = useRef(null);
  const peerRef = useRef(null);
  const facingRef = useRef('environment');

  // ── FOTOCAMERA (porting startCamera) ──
  const avviaCamera = useCallback(async () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.srcObject = stream; try { await v.play(); } catch { /* iOS a volte rifiuta il primo play */ } }
      try {
        const caps = stream.getVideoTracks()[0].getCapabilities?.() || {};
        setTorcia((t) => ({ ...t, possibile: !!caps.torch }));
      } catch { /* questo telefono non espone la torcia: il bottone resta nascosto */ }
    } catch (e) {
      setStato('errore');
      setNota(e?.name === 'NotAllowedError'
        ? 'Permesso fotocamera negato: consentilo dalle impostazioni del browser e ricarica.'
        : 'Fotocamera non disponibile: ' + (e?.message || 'errore sconosciuto'));
    }
  }, []);

  // ── PONTE VERSO IL PC (porting connectToDesktop, con ritenti) ──
  useEffect(() => {
    if (!sid) return;
    let vivo = true;
    let ritenti = 0;
    let timer = null;
    const connetti = async () => {
      if (!vivo) return;
      if (ritenti >= 8) { setStato('ripiego'); setNota('Canale diretto non disponibile — le foto arrivano comunque (via server).'); return; }
      setStato('connetto');
      setNota('Connessione al computer…' + (ritenti ? ` (tentativo ${ritenti + 1})` : ''));
      try {
        await caricaPeer();
        try { peerRef.current?.destroy(); } catch { /* il ponte era gia stato chiuso: nulla da fare */ }
        const peer = new window.Peer({
          config: { iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ] },
          debug: 0,
        });
        peerRef.current = peer;
        peer.on('open', () => {
          if (!vivo) return;
          const conn = peer.connect('bartalk-scan-' + sid);
          if (!conn) { ritenti++; timer = setTimeout(connetti, 2000 + ritenti * 1500); return; }
          conn.on('open', () => { if (vivo) { connRef.current = conn; setStato('pronto'); setNota('Connesso al computer — scatta pure'); } });
          conn.on('close', () => { if (vivo) { connRef.current = null; ritenti++; timer = setTimeout(connetti, 3000); } });
          conn.on('error', () => { if (vivo) { ritenti++; timer = setTimeout(connetti, 3000); } });
        });
        peer.on('error', () => { if (vivo) { ritenti++; timer = setTimeout(connetti, Math.min(2000 + ritenti * 1500, 15000)); } });
      } catch { if (vivo) { setStato('ripiego'); setNota('Canale diretto non disponibile — le foto arrivano comunque (via server).'); } }
    };
    connetti();
    avviaCamera();
    return () => {
      vivo = false;
      clearTimeout(timer);
      try { peerRef.current?.destroy(); } catch { /* il ponte era gia stato chiuso: nulla da fare */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [sid, avviaCamera]);

  // ── SCATTO (porting btnCapture: riduzione + anteprima) ──
  const scatta = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.srcObject) return;
    if (navigator.vibrate) navigator.vibrate(50);
    setFlash(true); setTimeout(() => setFlash(false), 350);
    const vw = v.videoWidth || v.clientWidth || 1280;
    const vh = v.videoHeight || v.clientHeight || 720;
    const scala = Math.min(MAX_LATO / vw, 1);
    const c = document.createElement('canvas');
    c.width = Math.round(vw * scala); c.height = Math.round(vh * scala);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    setAnteprima(c.toDataURL('image/jpeg', QUALITA));
  }, []);

  // ── INVIO: ponte diretto se aperto, altrimenti deposito via server ──
  const invia = useCallback(async () => {
    const dataUrl = anteprima;
    if (!dataUrl) return;
    setAnteprima(null); setInvio(true);
    try {
      const conn = connRef.current;
      if (conn && conn.open) {
        conn.send({ type: 'photo', image: dataUrl.split(',')[1], timestamp: 0 });
      } else {
        const r = await fetch('/api/compiti', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ azione: 'scanDeposita', sid: 'dep-' + sid, dato: dataUrl }),
        });
        const d = await r.json().catch(() => null);
        if (!d?.ok) throw new Error('deposito fallito');
      }
      setInviate((n) => n + 1);
    } catch { setNota('Invio non riuscito: controlla la connessione e riprova.'); }
    finally { setInvio(false); }
  }, [anteprima, sid]);

  const giraCamera = useCallback(() => {
    facingRef.current = facingRef.current === 'environment' ? 'user' : 'environment';
    avviaCamera();
  }, [avviaCamera]);

  const commutaTorcia = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const accesa = !torcia.accesa;
    try { await track.applyConstraints({ advanced: [{ torch: accesa }] }); setTorcia((t) => ({ ...t, accesa })); }
    catch { /* la torcia resta com'era */ }
  }, [torcia.accesa]);

  const colDot = stato === 'pronto' ? '#22c55e' : stato === 'errore' ? '#ef4444' : '#f59e0b';

  return (
    <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0b0b18', color: '#f8fafc', fontFamily: FONT, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', textAlign: 'center', background: '#141428', borderBottom: '1px solid #26264a', paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>BarTalk — Scanner</div>
        <div style={{ fontSize: 11, color: '#8a8ab0' }}>Sessione {sid || '—'}</div>
      </div>
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: '#141428', borderBottom: '1px solid #26264a' }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: colDot, flexShrink: 0,
          animation: stato === 'connetto' ? 'vt-p 1s infinite' : 'none' }} />
        <span>{nota}</span>
      </div>

      {!sid && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: '#f87171' }}>
          Codice mancante: inquadra di nuovo il QR dal computer.
        </div>
      )}

      {sid && (
        <>
          <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* la cornice-guida della maschera di acquisizione */}
            <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: '88%', height: '72%', borderRadius: 12, pointerEvents: 'none', transition: 'all .3s',
              border: flash ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.3)',
              boxShadow: flash ? '0 0 40px rgba(34,197,94,0.4)' : 'none' }} />
            {inviate > 0 && (
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '6px 14px', fontSize: 13 }}>
                {inviate} {inviate === 1 ? 'foto inviata' : 'foto inviate'}
              </div>
            )}
            {anteprima && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 20, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
                <img src={anteprima} alt="Anteprima" style={{ maxWidth: '92%', maxHeight: '55vh', borderRadius: 10, objectFit: 'contain' }} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setAnteprima(null)}
                    style={{ padding: '14px 26px', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', background: '#334155', color: '#fff' }}>
                    Rifai
                  </button>
                  <button onClick={invia}
                    style={{ padding: '14px 26px', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', background: '#22c55e', color: '#fff' }}>
                    Invia al computer
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '18px 24px',
            paddingBottom: 'calc(22px + env(safe-area-inset-bottom, 20px))', background: '#141428', borderTop: '1px solid #26264a' }}>
            <button onClick={giraCamera} aria-label="Inverti fotocamera"
              style={{ width: 48, height: 48, borderRadius: 24, border: 'none', background: '#334155', color: '#fff', fontSize: 20, cursor: 'pointer' }}>⟲</button>
            <button onClick={scatta} disabled={invio || stato === 'errore'} aria-label="Scatta"
              style={{ width: 68, height: 68, borderRadius: 34, border: '4px solid #f8fafc', background: 'transparent', cursor: 'pointer',
                position: 'relative', opacity: invio ? 0.5 : 1 }}>
              <span aria-hidden style={{ position: 'absolute', inset: 5, borderRadius: '50%', background: invio ? '#f59e0b' : '#f8fafc' }} />
            </button>
            <button onClick={commutaTorcia} aria-label="Torcia"
              style={{ width: 48, height: 48, borderRadius: 24, border: 'none', background: torcia.accesa ? '#f59e0b' : '#334155',
                color: '#fff', fontSize: 18, cursor: 'pointer', visibility: torcia.possibile ? 'visible' : 'hidden' }}>⚡︎</button>
          </div>
        </>
      )}
      <style>{'@keyframes vt-p{0%,100%{opacity:1}50%{opacity:.3}}'}</style>
    </main>
  );
}

export default function Scan() {
  return <Suspense fallback={null}><PaginaScan /></Suspense>;
}
