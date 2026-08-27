'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import { conRipiego } from '../../lib/ripiego.js';
import Icon from '../Icon.js';
import Sovrapposizione from './Sovrapposizione.js';
import {
  etichettaPallino, raggruppaPerContenuto, segnaLetti, ultimaLettura, unisciAvvisi,
} from '../../lib/campanella.js';

// ═══════════════════════════════════════════════════════════════
// LA CAMPANELLA — il pulsante in alto (b.545).
//
// Ordine di Luca: «dobbiamo avvisare l'utente in alto nelle pagine di
// commenti come instagram o facebook, nella sua stanza potra quindi
// aprire il commento/lista direttamente dal pulsante».
//
// Due cose, e sono quelle che contano:
//   · IN ALTO. Sta in una testata, non galleggia sopra il mondo: e' un
//     quadrato di 44 come tutti i tasti di questa applicazione (b.363
//     aveva tolto di mezzo la vetrina di attrezzi sopra il pianeta,
//     questa non deve rimetterla).
//   · SI APRE DAL PULSANTE. Toccando una riga si va DRITTI al filo di
//     quel contenuto (onApriContenuto) — non a una pagina di avvisi da
//     cui poi ricominciare a cercare. E' la mezza frase «aprire il
//     commento/lista direttamente dal pulsante».
//
// Il conto e il raggruppamento non stanno qui: stanno in lib/campanella.js,
// dove si possono provare. Qui c'e' solo la rete e il disegno.
// ═══════════════════════════════════════════════════════════════

// ogni minuto: piu spesso e' rumore sulla rete di chi sta leggendo,
// meno spesso e' una campanella che si accorge tardi delle cose.
const OGNI = 60000;

// si chiede un po' piu indietro dell'ultima lettura, cosi aprendo la
// campanella l'elenco non e' vuoto: il pallino conta il nuovo, ma la
// lista mostra anche l'ultimo giorno gia visto — come fanno i social.
const UN_PO_INDIETRO = 24 * 3600 * 1000;

export default function Campanella({ C = {}, L, chiaviSeguite, onApriContenuto }) {
  const tt = conRipiego(L);

  const [avvisi, setAvvisi] = useState([]);
  const [aperto, setAperto] = useState(false);
  // il momento dell'ultima apertura: comanda il pallino.
  const [lettiFinoA, setLettiFinoA] = useState(0);
  // istantanea di com'era PRIMA di aprire: serve a segnare quali righe,
  // dentro il pannello aperto, sono quelle nuove. Se si usasse la stessa
  // soglia del pallino, aprendo si spegnerebbero anche i puntini.
  const [sogliaRighe, setSogliaRighe] = useState(0);

  const chiavi = useMemo(() => (
    (Array.isArray(chiaviSeguite) ? chiaviSeguite : [])
      .map((c) => String(c || '').trim()).filter(Boolean).slice(0, 60)
  ), [chiaviSeguite]);
  // le chiavi come stringa: un array nuovo a ogni ridisegno rifarebbe la
  // chiamata all'infinito, il suo testo no.
  const chiaviTesto = chiavi.join(',');

  useEffect(() => { setLettiFinoA(ultimaLettura()); }, []);

  const carica = useCallback(async () => {
    if (!chiaviTesto) return;
    try {
      const da = Math.max(0, ultimaLettura() - UN_PO_INDIETRO);
      const r = await fetch(`/api/mondo/avvisi?chiavi=${encodeURIComponent(chiaviTesto)}&da=${da}`, {
        // stesso tetto d'attesa del resto del Mondo (b.363): senza, con la
        // rete muta la chiamata resta appesa e non arriva mai un esito.
        signal: AbortSignal.timeout(10000),
      });
      const d = r.ok ? await r.json().catch(() => null) : null;
      if (!d) return;
      setAvvisi((prima) => unisciAvvisi(prima, d.avvisi || []));
    } catch (e) {
      // la campanella e' un di piu: se non risponde, si tace e si riprova
      // al giro dopo. Nessun messaggio d'errore sopra la testata.
      if (e?.name !== 'AbortError') console.warn('[b.545] /api/mondo/avvisi:', e?.message || e);
    }
  }, [chiaviTesto]);

  useEffect(() => {
    if (!chiaviTesto) return undefined;
    carica();
    const t = setInterval(carica, OGNI);
    return () => clearInterval(t);
  }, [carica, chiaviTesto]);

  // Esc chiude, come ogni pannello di questa applicazione (PannelloLaterale).
  useEffect(() => {
    if (!aperto) return undefined;
    const suTasto = (e) => { if (e.key === 'Escape') setAperto(false); };
    window.addEventListener('keydown', suTasto);
    return () => window.removeEventListener('keydown', suTasto);
  }, [aperto]);

  const apri = useCallback(() => {
    vibrate(8);
    setSogliaRighe(ultimaLettura());
    // aprire E' aver guardato: il pallino si spegne qui, subito, senza
    // aspettare la rete — la stessa scelta del cuore in gradimento.js.
    setLettiFinoA(segnaLetti(Date.now()));
    setAperto(true);
  }, []);

  const righe = useMemo(() => raggruppaPerContenuto(avvisi), [avvisi]);
  const pallino = etichettaPallino(avvisi, lettiFinoA);

  // b.482 — i colori vengono dal tema, non da tinte scritte a mano.
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`;
  const vetro = C.glassCard || 'rgba(255,255,255,0.05)';
  const testoP = C.textPrimary || '#f0f4ff';
  const muto = C.textMuted || 'rgba(240,244,255,0.55)';
  const accent = C.accent1 || '#6c8cff';
  const rosso = C.accent3 || '#ff5a5f';

  const dettoRiga = (riga) => {
    if (riga.tipo === 'stanza') {
      return riga.quanti > 1
        ? `${riga.quanti} ${tt('alertsNewRooms', 'nuove stanze')}`
        : tt('alertsNewRoom', 'nuova stanza');
    }
    if (riga.tipo === 'reazione') {
      return riga.quanti > 1
        ? `${riga.quanti} ${tt('alertsNewReactions', 'nuove reazioni')}`
        : tt('alertsNewReaction', 'nuova reazione');
    }
    return riga.quanti > 1
      ? `${riga.quanti} ${tt('alertsNewComments', 'nuovi commenti')}`
      : tt('alertsNewComment', 'nuovo commento');
  };

  return (
    <>
      <button onClick={apri} aria-label={tt('alertsTitle', 'Avvisi')} title={tt('alertsTitle', 'Avvisi')}
        style={{
          // 44x44: la misura dei tasti di questa applicazione, quella che
          // un pollice prende senza sbagliare.
          position: 'relative', width: 44, height: 44, flexShrink: 0,
          borderRadius: 12, cursor: 'pointer',
          background: vetro, border: bordo, color: muto,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent', fontFamily: FONT,
        }}>
        {/* b.545 — RIPIEGO: in Icon.js non c'e' (ancora) una campana, e
            quel file lo sta toccando un'altra mano. Appena `bell` esiste,
            qui cambia una parola sola. */}
        <Icon name="bell" size={19} color={pallino ? testoP : muto} />
        {pallino && (
          <span aria-hidden="true"
            style={{
              position: 'absolute', top: 4, right: 3,
              minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9,
              background: rosso, color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: '17px', textAlign: 'center',
              boxShadow: `0 0 0 2px ${C.bg || '#080b16'}`,
            }}>{pallino}</span>
        )}
      </button>

      {aperto && (
        <Sovrapposizione>
          {/* il velo: si tocca fuori e si chiude, come il pannello laterale */}
          <div onClick={() => { vibrate(6); setAperto(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,0.45)' }} />

          <section role="dialog" aria-modal="true" aria-label={tt('alertsTitle', 'Avvisi')}
            style={{
              position: 'fixed', zIndex: 141,
              top: 'calc(env(safe-area-inset-top) + 58px)', right: 12,
              width: 'min(360px, 92vw)', maxHeight: '70dvh',
              display: 'flex', flexDirection: 'column',
              // il vetro della casa: fondo del tema piu una velatura chiara,
              // cosi il pannello si stacca dal mondo senza farlo leggere
              // attraverso (lezione b.363).
              background: C.bg || '#080b16',
              backgroundImage: `linear-gradient(${vetro}, ${vetro})`,
              border: bordo, borderRadius: 16,
              boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
              fontFamily: FONT, overflow: 'hidden',
            }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px 10px 16px', flexShrink: 0, borderBottom: bordo }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: testoP }}>{tt('alertsTitle', 'Avvisi')}</span>
              <button onClick={() => { vibrate(6); setAperto(false); }} aria-label={tt('closeWord', 'Chiudi')}
                style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
                  background: 'transparent', border: 'none', color: muto,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Icon name="x" size={16} color={muto} /></button>
            </header>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8, scrollbarWidth: 'none' }}>
              {righe.length === 0 ? (
                <div style={{ textAlign: 'center', color: muto, padding: '28px 18px', fontSize: 13, lineHeight: 1.5 }}>
                  {tt('alertsEmpty', 'Nessun avviso. Quando qualcuno commenta i contenuti che segui, lo trovi qui.')}
                </div>
              ) : righe.map((riga) => {
                const nuova = riga.quando > sogliaRighe;
                return (
                  <button key={riga.id}
                    onClick={() => { vibrate(8); setAperto(false); onApriContenuto?.(riga.chiave); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      minHeight: 44, padding: '10px 12px', marginBottom: 4, borderRadius: 12,
                      cursor: 'pointer', border: 'none', fontFamily: FONT,
                      // la riga nuova si accende appena, come nei social:
                      // si vede da lontano cosa non ho ancora guardato.
                      background: nuova ? `${accent}1f` : 'transparent',
                      color: testoP,
                    }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                      background: nuova ? rosso : 'transparent',
                    }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: accent }}>
                        {dettoRiga(riga)}
                      </span>
                      <span style={{
                        display: 'block', fontSize: 13, color: testoP, marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{riga.titolo || riga.chiave}</span>
                    </span>
                    <Icon name="chevRight" size={16} color={muto} />
                  </button>
                );
              })}
            </div>
          </section>
        </Sovrapposizione>
      )}
    </>
  );
}
