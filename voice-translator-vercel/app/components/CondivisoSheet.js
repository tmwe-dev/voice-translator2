'use client';
import { memo, useEffect, useState } from 'react';
import { FONT } from '../lib/constants.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════════════════════
// b.329 — "CONDIVIDI → BARTALK" (piano di Luca): da Instagram, YouTube,
// X, un giornale o qualunque app col tasto Condividi, il contenuto
// arriva QUI. Il gancio nel manifest c'era gia (/?source=share) ma
// nessuno lo consumava: atterrava su una home muta. Ora si apre questo
// foglio: anteprima del contenuto + "Cosa vuoi farne?".
//
// Il recupero dei metadati usa la via gia collaudata del Mondo
// (/api/topics/link): titolo, immagine, descrizione dalla pagina
// pubblica. Se il sito non si lascia leggere, l'esperienza NON fallisce:
// restano titolo/testo condivisi dall'app di origine.
// ═══════════════════════════════════════════════════════════════

function dominioDi(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

function CondivisoSheet({ condiviso, onParlane, onLife, onChiudi, L }) {
  const [meta, setMeta] = useState(null);
  const tt = (k, f) => { const v = L ? L(k) : k; return v && v !== k ? v : f; };

  useEffect(() => {
    if (!condiviso?.url) return;
    let vivo = true;
    fetch(`/api/topics/link?url=${encodeURIComponent(condiviso.url)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (vivo && d) setMeta(d); })
      .catch(() => { /* i metadati sono un di piu: titolo e testo bastano */ });
    return () => { vivo = false; };
  }, [condiviso]);

  if (!condiviso) return null;
  const titolo = meta?.titolo || condiviso.titolo || condiviso.testo?.slice(0, 120) || condiviso.url || '';
  const sintesi = meta?.descrizione || (condiviso.testo && condiviso.testo !== titolo ? condiviso.testo.slice(0, 200) : '') || '';
  const immagine = meta?.immagine || '';
  const fonte = dominioDi(condiviso.url);

  const card = 'rgba(12,15,30,0.97)';
  const bordo = '1px solid rgba(255,255,255,0.12)';
  const accent = '#26D9B0';

  return (
    <div role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onChiudi(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(3,5,12,0.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, background: card, borderRadius: '20px 20px 0 0', border: bordo, borderBottom: 'none', fontFamily: FONT, padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 }}>{tt('sharedWithBartalk', 'Hai condiviso')}{fonte ? ` · ${fonte}` : ''}</span>
          <button onClick={onChiudi} aria-label={tt('close', 'Chiudi')} style={{ width: 30, height: 30, borderRadius: 9, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: bordo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={13} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        {immagine && <img src={immagine} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, marginBottom: 10, display: 'block' }} />}
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.35 }}>{titolo}</div>
        {sintesi && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 5, lineHeight: 1.45 }}>{sintesi}</div>}

        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: '14px 0 8px' }}>{tt('sharedWhatToDo', 'Cosa vuoi farne?')}</div>
        <button onClick={() => onParlane({ titolo, sintesi: sintesi || (fonte ? `da ${fonte}` : ''), url: condiviso.url })}
          style={{ width: '100%', padding: 13, borderRadius: 13, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="mic" size={16} color="#04121c" /> {tt('newsTalkAbout', 'Parlane')}
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {/* b.334 — le altre destinazioni del piano: Spiegamelo (Impara) e la Tavola. */}
          <button onClick={() => onLife?.('impara', titolo)}
            style={{ flex: 1, padding: 11, borderRadius: 12, border: bordo, background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
            {tt('sharedExplain', 'Spiegamelo')}
          </button>
          <button onClick={() => onLife?.('tavolo', titolo)}
            style={{ flex: 1, padding: 11, borderRadius: 12, border: bordo, background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
            {tt('sharedTable', 'Alla Tavola')}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center' }}>
          {tt('sharedTalkHint', 'Parlane apre una stanza già pronta; Spiegamelo la lezione; la Tavola il dibattito dei tuoi Compagni.')}
        </div>
      </div>
    </div>
  );
}

export default memo(CondivisoSheet);
