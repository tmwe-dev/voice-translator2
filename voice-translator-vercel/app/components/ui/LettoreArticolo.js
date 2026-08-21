'use client';
import { useEffect, useRef, useState } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';

// ═══════════════════════════════════════════════════════════════
// IL LETTORE — l'articolo si legge qui, ma resta LORO.
//
// b.365, ordine di Luca: «permettimi di aprire e leggere comodamente gli
// articoli in una finestra in BarTalk».
//
// E LA DOMANDA GIUSTA CHE HA FATTO: «l'articolo l'utente deve leggerlo
// per copyright dentro il sito, ma allora perche il video o il reel
// possono vederlo dentro BarTalk?»
//
// Non e un capriccio, e una differenza vera: per il VIDEO l'editore
// FABBRICA APPOSTA un lettore da incorporare, coi suoi annunci e i suoi
// contatori — incorporarlo e accettare un invito. Per il TESTO nessuno
// fabbrica niente del genere: copiarne le parole dentro casa nostra
// sarebbe ripubblicarlo, e quello si chiama con un altro nome.
//
// Ma quello che chiede Luca e legittimo, ed e la terza strada: qui NON
// si copia niente. Si apre LA LORO PAGINA in una finestra dentro
// BarTalk — il loro sito, i loro annunci, le loro statistiche, il loro
// indirizzo scritto in alto. Noi mettiamo la cornice, non il contenuto.
//
// E QUANDO IL SITO SI RIFIUTA. Parecchi giornali vietano di essere
// aperti dentro un'altra pagina, ed e un rifiuto che il browser NON ci
// lascia leggere da fuori: non arriva nessun errore, resta solo bianco.
// L'unico modo onesto e aspettare qualche secondo e, se non e successo
// niente, dirlo e offrire il sito vero. Meglio una frase chiara che un
// rettangolo vuoto per sempre.
// ═══════════════════════════════════════════════════════════════

const ATTESA_PRIMA_DI_ARRENDERSI = 3500;

export default function LettoreArticolo({ url, titolo, fonte, C, L, onIndietro }) {
  const [caricata, setCaricata] = useState(false);
  const [rifiutata, setRifiutata] = useState(false);
  const orologio = useRef(null);

  useEffect(() => {
    setCaricata(false); setRifiutata(false);
    if (!url) return;
    orologio.current = setTimeout(() => setRifiutata((r) => r || true), ATTESA_PRIMA_DI_ARRENDERSI);
    return () => clearTimeout(orologio.current);
  }, [url]);

  const dominio = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return fonte || ''; }
  })();

  const bordo = `1px solid ${C.cardBorder}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: C.bg }}>
      {/* LA CORNICE: si vede sempre di chi e la pagina che si sta leggendo. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        borderBottom: bordo, flexShrink: 0, background: C.bg,
      }}>
        <button onClick={() => { vibrate(6); onIndietro?.(); }} aria-label={L('backWord')}
          style={{
            width: 34, height: 34, borderRadius: 11, flexShrink: 0, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', border: bordo,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="back" size={15} color={C.textPrimary} />
        </button>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 13, fontWeight: 700, color: C.textPrimary, fontFamily: FONT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{titolo || dominio}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: C.textMuted, fontFamily: FONT }}>
            {dominio}
          </span>
        </span>

        <a href={url} target="_blank" rel="noreferrer noopener"
          onClick={() => vibrate(6)} aria-label={L('openOutside')}
          style={{
            width: 34, height: 34, borderRadius: 11, flexShrink: 0, textDecoration: 'none',
            background: 'rgba(255,255,255,0.05)', border: bordo,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="link" size={15} color={C.accent} />
        </a>
      </div>

      {/* LA PAGINA LORO */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#fff' }}>
        {url && (
          <iframe
            src={url} title={titolo || dominio}
            onLoad={() => { setCaricata(true); setRifiutata(false); clearTimeout(orologio.current); }}
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
        )}

        {/* Se dopo qualche secondo non e successo niente, si dice invece di
            lasciare un rettangolo bianco che sembra un guasto nostro. */}
        {!caricata && rifiutata && (
          <div style={{
            position: 'absolute', inset: 0, background: C.bg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, padding: 28, textAlign: 'center',
          }}>
            <Icon name="lock" size={26} color={C.textMuted} />
            <div style={{ fontSize: 13, color: C.textMuted, fontFamily: FONT, lineHeight: 1.55, maxWidth: 300 }}>
              {L('siteBlocksReader')}
            </div>
            <a href={url} target="_blank" rel="noreferrer noopener"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                padding: '11px 18px', borderRadius: 13, fontFamily: FONT,
                background: `${C.accent}1E`, border: `1px solid ${C.accent}55`,
                color: C.accent, fontSize: 13, fontWeight: 800,
              }}>
              <Icon name="link" size={14} color={C.accent} />
              {L('openOutside')} · {dominio}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
