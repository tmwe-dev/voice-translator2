'use client';
// ═══════════════════════════════════════════════════════════════
// LE STANZE — finalmente una casa loro.
//
// b.537, dal ragionamento con Luca («riguardiamo insieme la logica una
// per una. stanze per prima»). Tre difetti di logica, tre decisioni sue:
//
//  1. LE STANZE NON AVEVANO UNA CASA. Vivevano come tab dentro «Il mondo
//     ora», mentre il tasto «Chat» della barra portava alla CRONOLOGIA —
//     cioe all'archivio delle conversazioni finite. Il tasto che sembrava
//     portare alle conversazioni vive portava a quelle morte, e le vive
//     stavano al secondo tocco dentro una sezione che si chiama «mondo».
//     Decisione: «Chat» porta DIRITTO qui. Il Mondo resta il giornale.
//
//  2. LA CARD DICEVA TUTTO TRANNE CIO CHE CONTA. Lingua, modalita, eta,
//     host, numero: sette informazioni, e nessuna era il motivo per cui
//     si entra in una stanza. Decisione: in grande DI COSA SI PARLA
//     ADESSO (l'ultimo messaggio, tradotto se la traduzione c'e gia —
//     vedi /api/mondo), e tutto il resto sotto, piccolo, di servizio.
//
//  3. NON ESISTEVA «LE MIE STANZE». Uscivi e la conversazione spariva.
//     Decisione: le tue in cima, sempre, con un tocco per rientrare
//     (lib/mieStanze.js: memoria del telefono, un giorno di vita).
//
// La ricerca sta FUORI, in alto: regola di Luca, «si cerca dove si
// guarda, non dietro una porta che nessuno apre per cercare».
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FONT, vibrate, getLang } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
import { getStyles } from '../lib/styles.js';
import Icon from './Icon.js';
import { mieStanze, dimenticaStanza } from '../lib/mieStanze.js';
import { quando, viva, stileEtichetta, PUNTO } from '../lib/schedaMondo.js';

// La lingua di chi guarda, applicata all'argomento vivo: se il messaggio
// porta gia la traduzione fatta in stanza, si legge quella; altrimenti
// l'originale, senza inventare nulla e senza spendere una chiamata.
export function argomentoNellaMiaLingua(ultimo, mia) {
  if (!ultimo || !ultimo.testo) return '';
  const radice = String(mia || '').split('-')[0];
  const tr = ultimo.traduzioni;
  if (tr && typeof tr === 'object') {
    for (const chiave of Object.keys(tr)) {
      if (String(chiave).split('-')[0] === radice) {
        const v = String(tr[chiave] || '').trim();
        if (v) return v;
      }
    }
  }
  return ultimo.testo;
}

export default function StanzeView({ onJoinRoom, onCreateRoom }) {
  const { L, setView, theme, prefs } = useApp();
  const S = getStyles(theme);
  const col = S.colors || {};
  const C = {
    bg: col.bg || '#05070f', card: col.card || 'rgba(255,255,255,0.04)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.10)',
    textPrimary: col.textPrimary || '#eef2ff',
    textSecondary: col.textSecondary || 'rgba(238,242,255,0.72)',
    textMuted: col.textMuted || 'rgba(238,242,255,0.55)',
    accent: col.accent1 || '#5b8cff', purple: col.accent2 || '#38e1ff',
    red: col.red || '#ff5470',
  };
  const bordo = `1px solid ${C.cardBorder}`;
  const miaLingua = prefs?.lang || 'it';

  const [stanze, setStanze] = useState(null);   // null = mai caricate
  const [errore, setErrore] = useState(false);
  const [cerca, setCerca] = useState('');
  const [mie, setMie] = useState([]);

  useEffect(() => { setMie(mieStanze()); }, []);

  const carica = useCallback(async () => {
    setErrore(false);
    try {
      const r = await fetch('/api/mondo', { signal: AbortSignal.timeout(10000) });
      if (!r.ok) { setErrore(true); return; }
      const d = await r.json().catch(() => null);
      if (!d) { setErrore(true); return; }
      setStanze((d.rooms || []).map((x) => ({ ...x, roomId: x.roomId || x.id, membri: x.memberCount ?? x.members ?? 0 })));
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.537] /api/mondo:', e?.message || e);
      setErrore(true);
    }
  }, []);
  useEffect(() => { carica(); }, [carica]);

  // Le tue stanze mostrano il loro stato VERO: se nel frattempo si sono
  // chiuse lo si dice, invece di far bussare a una porta che non c'e piu.
  const mieVive = useMemo(() => {
    const perId = new Map((stanze || []).map((s) => [String(s.roomId).toUpperCase(), s]));
    return mie.map((v) => ({ ...v, viva: perId.get(v.roomId) || null }));
  }, [mie, stanze]);

  const filtrate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const mieId = new Set(mie.map((v) => v.roomId));
    const base = (stanze || []).filter((s) => !mieId.has(String(s.roomId).toUpperCase()));
    if (!q) return base;
    return base.filter((s) => {
      const argomento = argomentoNellaMiaLingua(s.ultimo, miaLingua);
      return `${s.nome || ''} ${s.host || ''} ${argomento}`.toLowerCase().includes(q);
    });
  }, [stanze, cerca, mie, miaLingua]);

  const entra = (roomId) => { vibrate(10); onJoinRoom?.(roomId); };

  const Titolo = ({ testo, conto }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 8px',
      fontSize: 11, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.72)', fontFamily: FONT,
    }}>
      {testo}
      {conto != null && <span style={{ color: C.accent }}>{conto}</span>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg }}>
      {/* ═══ testata: il nome della sezione, e le due porte per entrare ═══ */}
      <div style={{ flexShrink: 0, padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 20, fontWeight: 600, color: C.textPrimary, fontFamily: FONT }}>
            {L('navChat')}
          </div>
          {/* l'archivio non sparisce: cambia posto. Era LUI il padrone del
              tasto «Chat»; adesso e una porta laterale, dove deve stare. */}
          <button onClick={() => { vibrate(8); setView('history'); }}
            aria-label={L('optSavedTitle')} title={L('optSavedTitle')}
            style={{ width: 40, height: 40, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              background: 'transparent', border: bordo, color: C.textSecondary,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="history" size={16} color={C.textSecondary} />
          </button>
          <button onClick={() => { vibrate(8); setView('join'); }}
            aria-label={L('optCodeTitle')} title={L('optCodeTitle')}
            style={{ width: 40, height: 40, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              background: 'transparent', border: bordo, color: C.textSecondary,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="doorOpen" size={16} color={C.textSecondary} />
          </button>
        </div>

        {/* la ricerca sta FUORI, in alto: regola di Luca */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={cerca} onChange={(e) => setCerca(e.target.value)}
            placeholder={L('searchRooms')} aria-label={L('searchRooms')}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 14, background: col.input || 'rgba(255,255,255,0.05)',
              border: bordo, outline: 'none', color: C.textPrimary, fontSize: 14, fontFamily: FONT }} />
          <button onClick={() => { vibrate(10); onCreateRoom?.(); }}
            aria-label={L('createBarTalk')} title={L('createBarTalk')}
            style={{ minWidth: 48, minHeight: 44, borderRadius: 14, cursor: 'pointer', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
            <Icon name="plus" size={18} color="#fff" />
          </button>
        </div>
      </div>

      {/* ═══ l'elenco ═══ */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none',
        padding: '0 16px calc(106px + env(safe-area-inset-bottom))' }}>

        {/* ── LE TUE: la continuita che non c'era ── */}
        {mieVive.length > 0 && (
          <>
            <Titolo testo={L('yourRoomsWord')} conto={mieVive.length} />
            {mieVive.map((v) => (
              <div key={v.roomId} style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                padding: 12, borderRadius: 14, background: C.card,
                border: `1px solid ${v.viva ? `${C.accent}44` : C.cardBorder}`,
              }}>
                <button onClick={() => entra(v.roomId)} disabled={!v.viva}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                    padding: 0, cursor: v.viva ? 'pointer' : 'default', fontFamily: FONT,
                    opacity: v.viva ? 1 : 0.55, WebkitTapHighlightColor: 'transparent' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.viva?.nome || v.nome || v.roomId}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.62)', marginTop: 3 }}>
                    {v.viva
                      ? `${viva(v.viva.membri, 4) ? '' : ''}${v.viva.membri || 0} ${L('inside')} ${PUNTO} ${L('tapToReenter')}`
                      : L('roomClosedNow')}
                  </div>
                </button>
                <button onClick={() => { vibrate(6); setMie(dimenticaStanza(v.roomId)); }}
                  aria-label={L('removeWord')} title={L('removeWord')}
                  style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                    background: 'rgba(0,0,0,0.22)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="x" size={11} color="#fff" />
                </button>
              </div>
            ))}
          </>
        )}

        {/* ── APERTE ADESSO ── */}
        <Titolo testo={L('openNowWord')} conto={stanze ? filtrate.length : null} />

        {errore && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 13, color: C.red, marginBottom: 12, fontFamily: FONT }}>{L('loadRoomsFailed')}</div>
            <button onClick={carica} style={{ padding: '10px 18px', minHeight: 44, borderRadius: 12,
              border: bordo, background: 'transparent', color: C.textPrimary, cursor: 'pointer', fontFamily: FONT }}>
              {L('retryWord')}
            </button>
          </div>
        )}

        {!errore && stanze && filtrate.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT, marginBottom: 6 }}>
              {cerca.trim() ? L('noRoomsFilters') : L('noRoomsYet')}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', fontFamily: FONT,
              lineHeight: 1.6, maxWidth: 280, margin: '0 auto 18px' }}>
              {L('createPublicRoomDesc')}
            </div>
            <button onClick={() => { vibrate(10); onCreateRoom?.(); }}
              style={{ padding: '12px 22px', minHeight: 44, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, color: '#fff',
                fontSize: 13.5, fontWeight: 600, fontFamily: FONT }}>
              {L('createBarTalk')}
            </button>
          </div>
        )}

        {/* LA CARD NUOVA: in grande di cosa si parla, il resto di servizio */}
        {!errore && filtrate.map((s) => {
          const argomento = argomentoNellaMiaLingua(s.ultimo, miaLingua);
          const eti = stileEtichetta(C);
          const eta = quando(s.ultimo?.quando || s.createdAt, L);
          const bandiera = getLang(s.hostLang || s.lang)?.flag || '';
          return (
            <button key={s.roomId} onClick={() => entra(s.roomId)}
              style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8,
                padding: 14, borderRadius: 14, background: C.card, border: bordo,
                cursor: 'pointer', fontFamily: FONT, WebkitTapHighlightColor: 'transparent' }}>
              {/* 1. DI COSA SI PARLA — il motivo per cui si entra */}
              <div style={{
                fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: C.textPrimary,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {argomento || s.nome || s.roomId}
              </div>
              {/* la stanza appena aperta non ha ancora parole: si dice */}
              {!argomento && (
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.62)', marginTop: 4 }}>
                  {L('roomNoWordsYet')}
                </div>
              )}
              {/* 2. DI SERVIZIO: dove, chi, quanti, da quanto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {argomento && s.nome && (
                  <>
                    <span style={{ ...eti, color: 'rgba(255,255,255,0.72)' }}>{s.nome}</span>
                    <span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span>
                  </>
                )}
                {bandiera && <span style={{ fontSize: 12, lineHeight: 1 }}>{bandiera}</span>}
                <span style={{ ...eti, color: 'rgba(255,255,255,0.62)' }}>{s.host}</span>
                <span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span>
                <span style={{ ...eti, color: viva(s.membri, 4) ? C.accent : 'rgba(255,255,255,0.62)' }}>
                  {s.membri || 0} {L('inside')}
                </span>
                {eta && <><span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span>
                  <span style={{ ...eti, color: 'rgba(255,255,255,0.62)' }}>{eta}</span></>}
                {s.suApprovazione && (
                  <span style={{ ...eti, color: '#f0b429', background: '#f0b42918', borderRadius: 5, padding: '1px 6px' }}>
                    {L('onApproval')}
                  </span>
                )}
                {s.hot && (
                  <span style={{ ...eti, color: C.red, background: `${C.red}1F`, borderRadius: 5, padding: '1px 6px' }}>
                    {L('freeFight')}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
