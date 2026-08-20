'use client';
import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// ═══════════════════════════════════════════════════════════════
// b.342 — /scan: IL TELEFONO COME SCANNER (Compiti, Luca).
// Dal PC si mostra un QR con questo indirizzo (+sid usa-e-getta); il
// telefono lo inquadra, arriva qui, scatta la foto della pagina e la
// deposita. Il PC la ritira da solo e la legge in locale, gratis.
// Nessun login richiesto sul telefono: il sid e il lasciapassare, vive
// pochi minuti e si consuma al primo ritiro.
// ═══════════════════════════════════════════════════════════════

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function riduci(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        const scala = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scala); c.height = Math.round(img.height * scala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = rej;
      img.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function PaginaScan() {
  const sid = useSearchParams().get('sid') || '';
  const [stato, setStato] = useState('pronto'); // pronto | invio | fatto | errore
  const [contati, setContati] = useState(0);

  const manda = useCallback(async (file) => {
    if (!file || !sid) return;
    setStato('invio');
    try {
      const dato = await riduci(file);
      const r = await fetch('/api/compiti', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: 'scanDeposita', sid, dato }),
      });
      const d = await r.json().catch(() => null);
      if (d?.ok) { setStato('fatto'); setContati((n) => n + 1); }
      else setStato('errore');
    } catch { setStato('errore'); }
  }, [sid]);

  return (
    <main style={{ minHeight: '100vh', background: '#0b0b18', color: '#e8e8f2', fontFamily: FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>📖</div>
      <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>BarTalk — Scanner</h1>
      {!sid && <p style={{ color: '#f87171', fontSize: 14 }}>Codice mancante: inquadra di nuovo il QR dal computer.</p>}
      {sid && (
        <>
          <p style={{ color: '#a8a8c0', fontSize: 14, maxWidth: 340, lineHeight: 1.5 }}>
            {stato === 'fatto'
              ? `Pagina inviata al computer${contati > 1 ? ` (${contati})` : ''} — puoi fotografarne un'altra o chiudere.`
              : 'Fotografa la pagina degli appunti: arriva da sola sul computer, che la legge gratis.'}
          </p>
          {stato === 'errore' && <p style={{ color: '#f87171', fontSize: 13 }}>Invio non riuscito. Controlla la connessione e riprova.</p>}
          <label style={{ marginTop: 16, padding: '14px 26px', borderRadius: 14, background: stato === 'invio' ? '#334' : 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
            color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
            {stato === 'invio' ? 'Invio…' : (stato === 'fatto' ? 'Fotografa un’altra pagina' : 'Fotografa la pagina')}
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={stato === 'invio'}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) manda(f); }} />
          </label>
        </>
      )}
    </main>
  );
}

export default function Scan() {
  return <Suspense fallback={null}><PaginaScan /></Suspense>;
}
