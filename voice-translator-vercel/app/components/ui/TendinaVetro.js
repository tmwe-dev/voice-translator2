'use client';
// b.535 — LA TENDINA DI VETRO. Ordine di Luca: «il dropdown/tendina stile
// windows non rispetta lo stile e il design dell'applicazione!!! verifica
// che tutti i dropdown dell'applicazione siano coerenti».
// Le <select> native aprivano il menu DEL SISTEMA (bianco, spigoloso,
// diverso su ogni piattaforma): quindici tendine, quindici facce, nessuna
// dell'applicazione. Questa e' UNA tendina sola per tutta l'app: il
// bottone eredita lo stile del campo in cui vive (cosi' ogni pagina resta
// com'era), il PANNELLO e' sempre lo stesso vetro scuro del template.
// Il pannello passa da un portal su <body>: dentro il Ribalta (facce
// ruotate con transform) position:fixed si rompe, e un pannello absolute
// resterebbe tagliato dagli overflow — fuori da tutto, sopra tutto.
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';

const VETRO = {
  fondo: 'rgba(10, 14, 26, 0.96)',
  bordo: '1px solid rgba(255,255,255,0.14)',
  ombra: '0 18px 44px rgba(0,0,0,0.55)',
  testo: '#eef2ff',
  muto: 'rgba(238,242,255,0.55)',
};

export default function TendinaVetro({
  valore,            // id dell'opzione scelta
  opzioni,           // [{ id, label, icona? }] — icona: emoji o nodo
  onScegli,          // (id) => void
  targa,             // aria-label del bottone
  C,                 // palette (per l'accent); opzionale
  accento,           // accent esplicito, vince su C.accent
  stile,             // stile del BOTTONE: eredita il campo del contesto
  soloIcona = false, // il bottone mostra solo l'icona (lettore articolo)
  centrato = false,  // etichetta centrata nel bottone (QuickInvite)
  disabilitato = false,
}) {
  const [aperta, setAperta] = useState(false);
  const [posto, setPosto] = useState(null); // { top, left, width, dalBasso }
  const bottoneRef = useRef(null);
  const pannelloRef = useRef(null);
  const [fuoco, setFuoco] = useState(-1);
  const acc = accento || C?.accent || '#6b8bff';
  const scelta = opzioni.find((o) => String(o.id) === String(valore));

  const apri = useCallback(() => {
    const r = bottoneRef.current?.getBoundingClientRect();
    if (!r) return;
    const vh = window.innerHeight;
    const larghezza = Math.min(Math.max(r.width, 210), 320);
    const sotto = vh - r.bottom;
    const dalBasso = sotto < 220 && r.top > sotto; // poco posto sotto: si apre sopra
    let left = r.left;
    if (left + larghezza > window.innerWidth - 8) left = window.innerWidth - larghezza - 8;
    if (left < 8) left = 8;
    setPosto({
      left,
      width: larghezza,
      top: dalBasso ? null : Math.min(r.bottom + 6, vh - 60),
      bottom: dalBasso ? vh - r.top + 6 : null,
      altezzaMax: Math.min(340, (dalBasso ? r.top : sotto) - 16),
    });
    setFuoco(opzioni.findIndex((o) => String(o.id) === String(valore)));
    setAperta(true);
  }, [opzioni, valore]);

  const chiudi = useCallback(() => { setAperta(false); setPosto(null); }, []);

  const scegli = useCallback((id) => { vibrate(6); onScegli?.(id); chiudi(); }, [onScegli, chiudi]);

  // Escape chiude; la finestra che cambia misura chiude (il pannello e'
  // ancorato al rettangolo del bottone: se il mondo si muove, si richiude).
  useEffect(() => {
    if (!aperta) return;
    const suTasto = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); chiudi(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setFuoco((f) => Math.min(f + 1, opzioni.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setFuoco((f) => Math.max(f - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); const o = opzioni[fuoco]; if (o) scegli(o.id); }
    };
    const suMisura = () => chiudi();
    document.addEventListener('keydown', suTasto, true);
    window.addEventListener('resize', suMisura);
    return () => { document.removeEventListener('keydown', suTasto, true); window.removeEventListener('resize', suMisura); };
  }, [aperta, opzioni, fuoco, scegli, chiudi]);

  // la riga a fuoco resta in vista mentre si naviga con le frecce
  useEffect(() => {
    if (!aperta || fuoco < 0) return;
    pannelloRef.current?.querySelector(`[data-indice="${fuoco}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [aperta, fuoco]);

  return (
    <>
      <button
        ref={bottoneRef}
        type="button"
        disabled={disabilitato}
        onClick={() => { if (disabilitato) return; vibrate(6); (aperta ? chiudi : apri)(); }}
        aria-label={targa}
        aria-haspopup="listbox"
        aria-expanded={aperta}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          justifyContent: centrato ? 'center' : 'space-between',
          cursor: disabilitato ? 'default' : 'pointer', fontFamily: FONT,
          textAlign: 'left', WebkitTapHighlightColor: 'transparent',
          opacity: disabilitato ? 0.55 : 1,
          ...stile,
        }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          {scelta?.icona != null && <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{scelta.icona}</span>}
          {!soloIcona && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scelta?.label ?? ''}
            </span>
          )}
        </span>
        <span aria-hidden="true" style={{ flexShrink: 0, display: 'inline-flex', transform: aperta ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <Icon name="chevDown" size={12} color={VETRO.muto} />
        </span>
      </button>

      {aperta && posto && typeof document !== 'undefined' && createPortal(
        <>
          {/* il velo trasparente raccoglie il tocco fuori e chiude */}
          <div onClick={chiudi} style={{ position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' }} />
          <div
            ref={pannelloRef}
            role="listbox"
            aria-label={targa}
            style={{
              position: 'fixed', zIndex: 2000,
              left: posto.left, width: posto.width,
              ...(posto.top != null ? { top: posto.top } : { bottom: posto.bottom }),
              maxHeight: Math.max(posto.altezzaMax, 160), overflowY: 'auto',
              background: VETRO.fondo, border: VETRO.bordo, borderRadius: 14,
              boxShadow: VETRO.ombra, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              padding: 5, overscrollBehavior: 'contain',
            }}>
            {opzioni.map((o, i) => {
              const attiva = String(o.id) === String(valore);
              return (
                <div key={String(o.id) || `op-${i}`}
                  role="option"
                  aria-selected={attiva}
                  data-indice={i}
                  onClick={() => scegli(o.id)}
                  onMouseEnter={() => setFuoco(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    minHeight: 42, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
                    fontFamily: FONT, fontSize: 14, lineHeight: 1.25,
                    color: attiva ? '#fff' : VETRO.testo,
                    background: attiva ? `${acc}2e` : (i === fuoco ? 'rgba(255,255,255,0.07)' : 'transparent'),
                  }}>
                  {o.icona != null && <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{o.icona}</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {attiva && <span aria-hidden="true" style={{ color: acc, fontWeight: 500, flexShrink: 0 }}>{'✓'}</span>}
                </div>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
