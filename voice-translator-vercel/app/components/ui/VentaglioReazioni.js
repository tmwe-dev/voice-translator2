'use client';
// b.545 — IL VENTAGLIO DELLE FACCINE. Ordine di Luca: «😊 Reazione
// (tienilo premuto: si apre il ventaglio di emoticon come Instagram)».
//
// Il gesto e' quello che la gente ha gia nelle dita da Instagram e da
// WhatsApp: il dito resta giu un attimo e le facce escono in fila. Ma
// tenere premuto e' un gesto che NESSUNO scopre da solo se non gli viene
// detto — percio anche il tocco semplice apre il ventaglio: chi conosce
// la tenuta la usa, chi non la conosce arriva lo stesso alle sei facce.
//
// Il pannello e' la stessa pastiglia di vetro scuro del resto dell'app
// (TendinaVetro, b.535: «verifica che tutti i dropdown dell'applicazione
// siano coerenti»), solo sdraiata in orizzontale — sei emoji in una riga
// sola, che sul telefono deve stare senza andare a capo.
//
// Il conteggio e' di tutti, la scelta e' mia: la logica sta in
// lib/reazioni.js, qui c'e solo il gesto e il vetro.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import { REAZIONI, emojiDi } from '../../lib/reazioni.js';

const TENUTA_MS = 350;   // sotto e' un tocco, sopra e' una tenuta
const VETRO = {
  fondo: 'rgba(10, 14, 26, 0.92)',
  bordo: '1px solid rgba(255,255,255,0.16)',
  ombra: '0 16px 40px rgba(0,0,0,0.5)',
};

export default function VentaglioReazioni({
  valore,      // id della faccia che ho gia messo io, oppure null
  onScegli,    // (id) => void — lo stesso id ripetuto significa «togli»
  C,           // palette (per l'accent); opzionale
  targa,       // aria-label del tasto, gia tradotto da chi ci chiama
}) {
  const [aperto, setAperto] = useState(false);
  const timer = useRef(null);
  const apertoDaTenuta = useRef(false);
  const acc = C?.accent || '#6b8bff';
  const miaEmoji = emojiDi(valore);

  const fermaTimer = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  const chiudi = useCallback(() => { fermaTimer(); setAperto(false); }, [fermaTimer]);

  // Il dito che resta giu: dopo 350ms il ventaglio si apre da solo, con
  // una vibrazione che dice «ci sono» — senza quella il gesto sembra non
  // aver funzionato e il dito si alza troppo presto.
  const suGiu = useCallback(() => {
    fermaTimer();
    apertoDaTenuta.current = false;
    timer.current = setTimeout(() => {
      timer.current = null;
      apertoDaTenuta.current = true;
      vibrate(10);
      setAperto(true);
    }, TENUTA_MS);
  }, [fermaTimer]);

  // Il tocco semplice apre e richiude. Se il ventaglio si e' gia aperto
  // da solo con la tenuta, il click che segue l'alzata del dito non deve
  // richiuderlo subito: sarebbe aperto e chiuso nello stesso gesto.
  const suClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    fermaTimer();
    if (apertoDaTenuta.current) { apertoDaTenuta.current = false; return; }
    vibrate(6);
    setAperto((a) => !a);
  }, [fermaTimer]);

  const scegli = useCallback((e, id) => {
    e.stopPropagation();
    vibrate(8);
    onScegli?.(id);
    setAperto(false);
  }, [onScegli]);

  // Escape chiude, come ogni altro pannello dell'app. Il tocco fuori lo
  // raccoglie il velo qui sotto.
  useEffect(() => {
    if (!aperto) return;
    const suTasto = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setAperto(false); } };
    document.addEventListener('keydown', suTasto, true);
    return () => document.removeEventListener('keydown', suTasto, true);
  }, [aperto]);

  // se il componente sparisce col dito ancora giu, il timer non deve
  // restare acceso a chiamare setState su qualcosa che non c'e piu
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label={targa}
        aria-haspopup="menu"
        aria-expanded={aperto}
        onPointerDown={suGiu}
        onPointerUp={fermaTimer}
        onPointerLeave={fermaTimer}
        onPointerCancel={fermaTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={suClick}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 999,
          background: valore ? `${acc}26` : 'transparent',
          border: valore ? `1px solid ${acc}66` : '1px solid transparent',
          cursor: 'pointer', fontFamily: FONT, fontSize: 19, lineHeight: 1,
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}>
        <span aria-hidden="true">{miaEmoji || '😊'}</span>
      </button>

      {aperto && (
        <>
          {/* il velo trasparente raccoglie il tocco fuori e chiude */}
          <div
            onClick={(e) => { e.stopPropagation(); chiudi(); }}
            style={{ position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' }}
          />
          <div
            role="menu"
            aria-label={targa}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', zIndex: 2000,
              bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 2,
              padding: '5px 7px', borderRadius: 999,
              background: VETRO.fondo, border: VETRO.bordo, boxShadow: VETRO.ombra,
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            }}>
            {REAZIONI.map((r) => {
              const attiva = r.id === valore;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={attiva}
                  aria-label={r.id}
                  onClick={(e) => scegli(e, r.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 38, height: 38, borderRadius: 999, flexShrink: 0,
                    // la faccia che ho gia messo tiene l'alone acceso: e'
                    // l'unico modo di sapere, a ventaglio aperto, cosa ho
                    // gia detto — e che ritoccarla vuol dire disdirla
                    background: attiva ? `${acc}33` : 'transparent',
                    boxShadow: attiva ? `0 0 0 1px ${acc}88, 0 0 14px ${acc}66` : 'none',
                    border: 'none', cursor: 'pointer',
                    fontFamily: FONT, fontSize: 22, lineHeight: 1,
                    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                  }}>
                  <span aria-hidden="true">{r.emoji}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
