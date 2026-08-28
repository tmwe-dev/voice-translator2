'use client';
// ═══════════════════════════════════════════════════════════════
// I GURU IN STANZA — Archimede, Albert, Pitagora, Newton…
//
// b.549, collaudo di Luca: «non vedo alcun comando né icona dei guru da
// invitare alla chat (archimede albert pitagora newton etc)».
// Aveva ragione: i Compagni vivevano SOLO dentro Vita — Tavolo, Podcast,
// Amico — e in una stanza fra persone non c'era nessuna porta per
// chiamarli. Eppure e' li che servono di piu: quando la conversazione ha
// bisogno di un fatto, di una traduzione di contesto, o di qualcuno che
// apra il discorso in una stanza ancora vuota.
//
// Questo e' il pannello che li presenta e li chiama. Non "aggiunge un
// membro" alla stanza (il posto e' delle persone): fa parlare il guru
// nella conversazione, con la sua voce e la sua vocazione.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { COMPAGNI_PREDEFINITI } from '../../lib/compagni/catalogo.js';

export default function InvitaGuru({ aperto, onChiudi, onInvita, C, L, inCorso = false }) {
  const [scelto, setScelto] = useState(null);
  if (!aperto || typeof document === 'undefined') return null;

  const bordo = `1px solid ${C?.cardBorder || 'rgba(255,255,255,0.12)'}`;
  const accent = C?.accent || '#5b8cff';

  return createPortal(
    <>
      <div onClick={onChiudi} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,0.55)' }} />
      <div role="dialog" aria-label={L('inviteGuruTitle')} style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 141,
        maxHeight: '78dvh', overflowY: 'auto',
        background: 'rgba(10,14,26,0.97)', backdropFilter: 'blur(20px)',
        borderTop: bordo, borderRadius: '20px 20px 0 0',
        padding: '16px 16px calc(20px + env(safe-area-inset-bottom))', fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 500, color: '#fff' }}>{L('inviteGuruTitle')}</div>
          <button onClick={onChiudi} aria-label={L('closeWord')}
            style={{ width: 38, height: 38, borderRadius: 10, cursor: 'pointer', border: bordo,
              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={14} color="rgba(255,255,255,0.7)" />
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', marginBottom: 14 }}>
          {L('inviteGuruDesc')}
        </div>

        {/* le facce: si sceglie con l'occhio, non leggendo un elenco */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
          {COMPAGNI_PREDEFINITI.map((c) => {
            const attivo = scelto === c.id;
            return (
              <button key={c.id} onClick={() => { vibrate(6); setScelto(attivo ? null : c.id); }}
                aria-pressed={attivo}
                style={{
                  padding: '12px 8px', borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
                  background: attivo ? `${accent}1e` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${attivo ? `${accent}66` : (C?.cardBorder || 'rgba(255,255,255,0.10)')}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {c.avatar
                  // eslint-disable-next-line @next/next/no-img-element -- ritratto locale del Compagno
                  ? <img src={c.avatar} alt="" width={46} height={46}
                      style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }} />
                  : <span style={{ width: 46, height: 46, borderRadius: '50%', background: `${accent}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: accent }}>
                      {c.nome.slice(0, 1)}
                    </span>}
                <span style={{ fontSize: 12, fontWeight: 500, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{c.nome}</span>
                <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.58)', textAlign: 'center', lineHeight: 1.25 }}>{c.ruolo}</span>
              </button>
            );
          })}
        </div>

        <button onClick={() => { if (scelto) { vibrate(10); onInvita?.(scelto); } }}
          disabled={!scelto || inCorso}
          style={{
            width: '100%', minHeight: 48, marginTop: 16, borderRadius: 14, border: 'none',
            cursor: scelto && !inCorso ? 'pointer' : 'default', opacity: scelto && !inCorso ? 1 : 0.5,
            background: `linear-gradient(135deg, ${accent}, ${C?.purple || '#38e1ff'})`,
            color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: FONT,
          }}>
          {inCorso ? L('inviteGuruWorking') : L('inviteGuruDo')}
        </button>
      </div>
    </>,
    document.body,
  );
}
