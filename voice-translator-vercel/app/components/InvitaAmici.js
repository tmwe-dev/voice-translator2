'use client';
// ═══════════════════════════════════════════════════════════════
// InvitaAmici — il passo "porta i tuoi amici" (b.153, task #12)
//
// CONFERMATO da Luca il 14/8, con un vincolo di legge preso sul serio:
// la rubrica NON si carica mai sui server (i numeri altrui sono dati
// di terzi che non hanno acconsentito — GDPR). Quindi:
//
//   · dove esiste il Contact Picker (Chrome/Android) si apre la
//     rubrica DEL TELEFONO, l'utente spunta chi vuole, e i numeri
//     restano sul dispositivo: servono solo a comporre il link
//     WhatsApp, uno per amico;
//   · dovunque, il bottone di condivisione generica (navigator.share
//     o copia negli appunti).
//
// Chi entra col link diventa contatto reciproco appena vi parlate
// (meccanismo esistente, b.133/134): da li chat e notifiche vivono
// dentro BarTalk. WhatsApp fa solo il postino del primo invito.
//
// Si mostra UNA volta, alla fine del tutorial. Un rito, non un pedaggio.
// ═══════════════════════════════════════════════════════════════

import { memo, useState, useCallback, useEffect } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';

export const INVITO_AMICI_VISTO = 'vt-invito-amici-visto';

function pickerDisponibile() {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'select' in (navigator.contacts || {});
}

function InvitaAmici({ aperta, onClose }) {
  const { L, S, prefs } = useApp();
  const [scelti, setScelti] = useState([]);
  const C = S.colors || {};
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.07)'}`;

  const linkApp = typeof window !== 'undefined' ? window.location.origin : 'https://voice-translator2.vercel.app';
  const messaggio = useCallback(() =>
    L('invitaMessaggio').replace('{x}', prefs.name || 'BarTalk').replace('{y}', linkApp),
  [L, prefs.name, linkApp]);

  const scegliDaRubrica = useCallback(async () => {
    vibrate(10);
    try {
      const contatti = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      // I numeri restano QUI, nello stato del componente sul telefono.
      setScelti(contatti
        .map(c => ({ nome: (c.name?.[0] || '').trim(), tel: (c.tel?.[0] || '').replace(/[^\d+]/g, '') }))
        .filter(c => c.tel));
    } catch { /* picker annullato: nessun dramma */ }
  }, []);

  const condividi = useCallback(async () => {
    vibrate(10);
    try {
      if (navigator.share) await navigator.share({ text: messaggio() });
      else await navigator.clipboard.writeText(messaggio());
    } catch { /* l'utente ha chiuso il foglio di condivisione: scelta sua */ }
  }, [messaggio]);

  // ── b.248 — IL DIALOGO NON AVEVA NESSUNA VIA D'USCITA STANDARD ──
  // Il collaudo dal vivo lo ha trovato APERTO sopra la home, e non
  // riusciva a chiuderlo: Escape non era ascoltato da nessuno, il tocco
  // sullo sfondo scuro non faceva niente (a differenza degli altri modali
  // del progetto: il popup invito di JoinView e ChatActionsPanel si
  // chiudono entrambi toccando il velo, con stopPropagation sulla carta),
  // e l'unico bottone che chiudeva era "Più tardi" (invitaDopo) — testo
  // localizzato SENZA aria-label, quindi invisibile a qualsiasi ricerca
  // di chiudi/annulla/× e a chi usa un lettore di schermo. Qui si aggiunge
  // l'ascolto di Escape; sotto, la chiusura dal velo e l'aria-label.
  useEffect(() => {
    if (!aperta) return;
    const suTasto = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', suTasto);
    return () => window.removeEventListener('keydown', suTasto);
  }, [aperta, onClose]);

  if (!aperta) return null;

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(3,5,12,0.78)', fontFamily: FONT,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 420, maxHeight: '82dvh', overflowY: 'auto',
        background: C.bg || '#070a14', borderRadius: 22, border: bordo, padding: '22px 20px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
            background: `linear-gradient(135deg, ${C.accent1 || '#5b8cff'}, ${C.accent2 || '#8b6aff'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="user" size={24} color="#fff" />
          </div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: C.textPrimary, letterSpacing: -0.4 }}>
            {L('invitaTitolo')}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: C.textSecondary }}>
            {L('invitaTesto')}
          </p>
        </div>

        {/* Gli amici scelti: un bottone WhatsApp a testa */}
        {scelti.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {scelti.map((c, i) => (
              <a key={i}
                href={`https://wa.me/${c.tel.replace('+', '')}?text=${encodeURIComponent(messaggio())}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => vibrate(8)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', marginBottom: 6, borderRadius: 12,
                  background: `${C.accent1 || '#5b8cff'}0E`, border: bordo,
                  color: C.textPrimary, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}>
                <Icon name="send" size={14} color={C.accent1 || '#5b8cff'} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {L('invitaInvia').replace('{x}', c.nome || c.tel)}
                </span>
              </a>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {pickerDisponibile() && (
            <button onClick={scegliDaRubrica} style={{
              padding: '12px 0', borderRadius: 13, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent1 || '#5b8cff'}, ${C.accent2 || '#8b6aff'})`,
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT,
            }}>
              {L('invitaScegli')}
            </button>
          )}
          <button onClick={condividi} style={{
            padding: '12px 0', borderRadius: 13, cursor: 'pointer',
            background: pickerDisponibile() ? 'transparent' : `linear-gradient(135deg, ${C.accent1 || '#5b8cff'}, ${C.accent2 || '#8b6aff'})`,
            border: pickerDisponibile() ? bordo : 'none',
            color: pickerDisponibile() ? C.textSecondary : '#fff',
            fontSize: 14, fontWeight: 600, fontFamily: FONT,
          }}>
            {L('invitaCondividi')}
          </button>
          <button onClick={() => { vibrate(6); onClose(); }} aria-label={L('close')} style={{
            padding: '10px 0', borderRadius: 13, cursor: 'pointer',
            background: 'none', border: 'none', color: C.textMuted,
            fontSize: 13, fontFamily: FONT,
          }}>
            {L('invitaDopo')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(InvitaAmici);
