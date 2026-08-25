'use client';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext.js';
import { PACCHETTI, oreIncluse } from '../wallet/tariffe.js';
import { subscribeTick } from '../lib/ticker.js';
import { memDel, memGet, memSet } from '../lib/memoria.js';

// ═══════════════════════════════════════════════
// BatteryPill — la pila del credito, in alto, cliccabile.
// Verde > 50% · Giallo 15-50% · Rosso < 15%
// Click → popup: saldo, uso oggi/mese, ricarica Stripe, voucher.
// ═══════════════════════════════════════════════

/** Slot: mostra la pila solo se conosciamo l'utente loggato. */
export function BatteryPillSlot({ verticale = false }) {
  const { auth } = useApp();
  const utente = auth?.userAccount?.email || null;
  if (!utente) return null;
  return <BatteryPill utente={utente} verticale={verticale} />;
}

export default function BatteryPill({ utente, verticale = false }) {
  // ── b.138 · la pila del credito parlava italiano a tutti ──
  //
  // E il comando piu visto dell'app — sta in cima a ogni schermata — e
  // dentro c'era tutta la pagina del credito scritta a mano: "OGGI",
  // "QUESTO MESE", "HAI UN VOUCHER?", "Codice non valido". Chi aveva
  // l'interfaccia in un'altra lingua toccava la batteria e trovava
  // l'italiano.
  const { L, S } = useApp();
  const tc = S.colors || {};
  // I tre colori dello stato vengono dal tema: scritti a mano restavano
  // quelli del tema scuro anche sul chiaro, dove il verde e il rosso sono
  // altri due colori.
  const COLORI = { verde: tc.statusOk, giallo: tc.statusWarning, rosso: tc.statusError };
  const [dati, setDati] = useState(null);      // { testo, colore, percento, oggi, mese }
  const [aperto, setAperto] = useState(false);
  const [codice, setCodice] = useState('');
  const [esito, setEsito] = useState('');
  const [esitoOk, setEsitoOk] = useState(false);

  // Il wallet riconosce l'utente dalla SESSIONE (Bearer), mai da un parametro
  const conToken = useCallback((extra = {}) => {
    const token = memGet('vt-token');
    return { ...extra, ...(token && { Authorization: `Bearer ${token}` }) };
  }, []);

  // Carica il saldo ora e poi ogni 60s (si ferma se l'app è in background)
  const carica = useCallback(async () => {
    if (!utente) return;
    try {
      const r = await fetch('/api/wallet/saldo', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */, headers: conToken() });
      // b.363 — prima la lettura non era protetta: una risposta non-JSON
      // faceva saltare l'aggiornamento del saldo senza lasciare traccia.
      if (r.ok) { const d = await r.json().catch(() => null); if (d) setDati(d); }
    } catch { /* offline: teniamo l'ultimo dato */ }
  }, [utente, conToken]);

  useEffect(() => subscribeTick(60000, carica, { immediate: true }), [carica]);

  // Credito esaurito durante una conversazione → aggiorna e apri il popup ricarica
  useEffect(() => {
    const suEsaurito = () => { carica(); setAperto(true); };
    window.addEventListener('wallet:esaurito', suEsaurito);
    return () => window.removeEventListener('wallet:esaurito', suEsaurito);
  }, [carica]);

  // Primo accesso: chiedi il bonus benvenuto (il server lo da' UNA volta sola)
  // e riscatta l'eventuale voucher inserito nella schermata di benvenuto.
  useEffect(() => {
    if (!utente) return;
    (async () => {
      try {
        // Bonus benvenuto — una richiesta per dispositivo, il DB fa da guardiano
        if (!memGet('vt-benvenuto-chiesto')) {
          const token = memGet('vt-token');
          if (token) {
            const r = await fetch('/api/wallet/benvenuto', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
              method: 'POST', headers: { Authorization: `Bearer ${token}` },
            });
            const d = await r.json().catch(() => ({}));
            if (d.ok) {
              memSet('vt-benvenuto-chiesto', '1');
              if (d.nuovo) { setEsito(L('welcomeGiftMsg').replace('{x}', d.testo)); setEsitoOk(true); setAperto(true); }
            }
          }
        }
        // Codice lasciato in attesa: dall'onboarding (voucher) o da un
        // link di regalo (?regalo=GIFT-...). Il prefisso dice dove va.
        const pendente = memGet('vt-voucher-pendente');
        if (pendente) {
          memDel('vt-voucher-pendente');
          const eRegalo = pendente.startsWith('GIFT-');
          const r = await fetch(eRegalo ? '/api/wallet/regalo' : '/api/wallet/voucher', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
            method: 'POST', headers: conToken({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(eRegalo ? { azione: 'riscatta', codice: pendente } : { codice: pendente }),
          });
          const d = await r.json().catch(() => ({}));
          setEsito(d.ok ? `${L('doneExcl')} ${d.testo}` : (d.motivo || L('invalidCode')));
          setEsitoOk(!!d.ok);
          setAperto(true);
        }
        carica();
      } catch { /* rete assente: riproveremo al prossimo avvio */ }
    })();
  }, [utente, carica]);

  if (!utente || !dati) return null;
  const colore = COLORI[dati.colore] || COLORI.verde;
  // b.457 — il fulmine e sempre giallo: e un simbolo, non un indicatore.
  const ORO = tc.goldAccent;

  // Ricarica: chiedi il link a Stripe e vai
  async function ricarica(pacchettoId) {
    const r = await fetch('/api/wallet/ricarica', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
      method: 'POST', headers: conToken({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ pacchetto: pacchettoId }),
    });
    // b.363 — se il server risponde con una pagina d'errore (il 429 del
    // guardiano e in HTML), leggere JSON esplodeva e il tasto restava muto
    // per sempre: nessun link, nessun messaggio, nessuna spiegazione.
    const { url } = await r.json().catch(() => ({}));
    if (url) window.location.href = url;
    else { setEsito(L('networkError')); setEsitoOk(false); }
  }

  // Voucher: manda il codice, mostra l'esito
  async function usaVoucher() {
    setEsito('...'); setEsitoOk(false);
    const r = await fetch('/api/wallet/voucher', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
      method: 'POST', headers: conToken({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ codice }),
    });
    const d = await r.json().catch(() => ({}));
    setEsito(d.ok ? `${L('doneExcl')} ${d.testo}` : (d.motivo || (r.ok ? L('invalidCode') : L('networkError'))));
    setEsitoOk(!!d.ok);
    if (d.ok) { setCodice(''); carica(); }
  }

  // b.359 — il popup del credito, condiviso dai due aspetti (pila
  // orizzontale in header, pila verticale accanto alla linguetta).
  const popup = aperto ? (
        <div onClick={() => setAperto(false)} style={{
          position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={L('yourCreditTitle')} style={{
            width: '100%', maxWidth: 360, borderRadius: 22, padding: '20px 18px',
            background: tc.popupBg, border: `1px solid ${tc.cardBorder}`,
            color: tc.textPrimary, backdropFilter: 'blur(20px)',
          }}>
            {/* b.364 — quando si e sotto zero questa riga cambia PAROLA,
                restando la stessa riga: stesso posto, stessa altezza,
                niente che scivola in basso. E la frase e quella giusta —
                gliel'abbiamo anticipato noi, non ha sbagliato niente. */}
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>
              {dati.inRosso ? L('creditCovered') : L('yourCreditTitle')}
            </div>
            <div style={{ fontSize: 30, fontWeight: 600, color: colore }}>{dati.testo}</div>

            <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
              <div style={{ flex: 1, padding: '9px 11px', borderRadius: 14, background: tc.cardBg, border: `1px solid ${tc.cardBorder}` }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: tc.textMuted, textTransform: 'uppercase' }}>{L('todayWord')}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{dati.oggi}</div>
              </div>
              <div style={{ flex: 1, padding: '9px 11px', borderRadius: 14, background: tc.cardBg, border: `1px solid ${tc.cardBorder}` }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: tc.textMuted, textTransform: 'uppercase' }}>{L('thisMonth')}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{dati.mese}</div>
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: tc.textMuted, margin: '10px 0 6px', textTransform: 'uppercase' }}>{L('landingRecharge')}</div>
            {PACCHETTI.map(p => {
              const ore = oreIncluse(p);
              return (
                <button key={p.id} onClick={() => ricarica(p.id)} style={{
                  display: 'flex', alignItems: 'center', width: '100%', gap: 10, cursor: 'pointer',
                  padding: '10px 12px', minHeight: 44, marginBottom: 6, borderRadius: 14, fontFamily: 'inherit',
                  background: tc.cardBg, border: `1px solid ${p.consigliato ? tc.accent1 : tc.cardBorder}`,
                  color: tc.textPrimary,
                }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.nome} · {ore.standard}</div>
                    <div style={{ fontSize: 10.5, color: tc.textMuted }}>{L('withPremiumVoice')} {ore.premium}{p.consigliato ? ` · ${L('recommended')}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: tc.accent2 }}>€{p.euro}</div>
                </button>
              );
            })}

            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: tc.textMuted, margin: '12px 0 6px', textTransform: 'uppercase' }}>{L('creditHaveCode')}</div>
            <div style={{ display: 'flex', gap: 7 }}>
              <input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder={L('codeWord')}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 12, fontFamily: 'inherit', fontSize: 13,
                  background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.textPrimary }} />
              <button onClick={usaVoucher} disabled={!codice} style={{
                padding: '10px 16px', minHeight: 44, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, color: '#000',
                background: tc.btnGradient,
              }}>{L('useWord')}</button>
            </div>
            {/* verde per le buone notizie, rosso solo per i veri errori.
                b.138 — prima il colore si decideva con /^(Fatto|Benvenuto)/:
                una espressione regolare sull'italiano, che con l'interfaccia
                in un'altra lingua avrebbe dipinto di rosso anche gli esiti
                buoni. Ora l'esito porta con se il proprio segno. */}
            {esito && <div style={{ fontSize: 12, marginTop: 6,
              color: esitoOk ? COLORI.verde : COLORI.rosso }}>{esito}</div>}

            {/* ── Storico ricariche ── */}
            {dati.storico?.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: tc.textMuted, margin: '12px 0 6px', textTransform: 'uppercase' }}>{L('creditYourTopups')}</div>
                <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                  {dati.storico.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px',
                      fontSize: 11.5, borderBottom: `1px solid ${tc.cardBorder}` }}>
                      <span style={{ color: tc.textMuted, minWidth: 68 }}>{r.quando}</span>
                      <span style={{ flex: 1, color: tc.textSecondary, textTransform: 'capitalize' }}>
                        {r.tipo === 'acquisto' ? L('landingRecharge') : r.tipo === 'benvenuto' ? L('histWelcome') : r.tipo === 'omaggio' ? L('histFree') : r.tipo === 'regalo_in' ? L('histGift') : 'Voucher'}
                      </span>
                      <span style={{ fontWeight: 600, color: COLORI.verde }}>{r.testo}</span>
                      {r.euro && <span style={{ color: tc.textMuted }}>{r.euro}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={() => setAperto(false)} style={{
              width: '100%', marginTop: 14, padding: 11, minHeight: 44, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, background: 'transparent',
              border: `1px solid ${tc.cardBorder}`, color: tc.textSecondary,
            }}>{L('closeWord')}</button>
          </div>
        </div>
  ) : null;

  // b.359 — LA PILA VERTICALE (collaudo di Luca: «la pila elettrica mettila
  // verticale sopra la linguetta a sinistra»): la stessa pila, ruotata in
  // piedi col polo in su e la percentuale sotto. Il riempimento sale dal
  // basso, come una batteria vera.
  // b.363 — la pila si e rimpicciolita di un terzo e vive nell'angolo in
  // ALTO A DESTRA (terza volta che Luca lo chiede): non e piu appoggiata
  // sopra la linguetta, che nel frattempo e scesa in fondo.
  if (verticale) {
    return (
      <>
        <button onClick={() => setAperto(true)} aria-label={`${L('creditRow')}: ${dati.testo}`} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer',
          background: 'none', border: 'none', padding: 0, minWidth: 44, minHeight: 44, fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}>
          {/* b.457, ordine di Luca: «la batteria e quella vecchia, cambia
              l'icona con un fulmine giallo». Via il disegno della pila —
              polo, corpo e riempimento — e al suo posto il FULMINE, che dice
              «energia» senza somigliare alla batteria del telefono: quella
              e a due centimetri di distanza, sulla barra di sistema, e due
              batterie vicine si confondono.
              Il fulmine e sempre GIALLO, non segue piu il colore del
              credito: e un simbolo, e un simbolo che cambia colore smette
              di essere riconoscibile. Quanto credito resta lo dice il numero
              qui sotto, che il colore ce l'ha ancora. */}
          <svg width="20" height="26" viewBox="0 0 24 24" fill={ORO} stroke="none" aria-hidden>
            <path d="M13 2L4.5 13.2h5.6L10.4 22l9-11.6h-5.7z" />
          </svg>
          <span style={{ fontSize: 8, fontWeight: 600, color: colore, lineHeight: 1.05, textAlign: 'center' }}>{dati.testo}</span>
        </button>
        {aperto && popup}
      </>
    );
  }

  return (
    <>
      {/* ── La pila in header ── */}
      <button onClick={() => setAperto(true)} aria-label={`${L('creditRow')}: ${dati.testo}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        background: tc.cardBg, border: `1px solid ${tc.cardBorder}`,
        borderRadius: 999, padding: '5px 11px', fontFamily: 'inherit',
      }}>
        {/* corpo pila */}
        <span style={{ position: 'relative', width: 24, height: 12, borderRadius: 3,
          border: `1.5px solid ${colore}`, display: 'inline-block' }}>
          <span style={{ position: 'absolute', left: 1.5, top: 1.5, bottom: 1.5,
            width: `${Math.max(6, dati.percento)}%`, maxWidth: 'calc(100% - 3px)',
            background: colore, borderRadius: 1.5 }} />
          {/* polo della pila */}
          <span style={{ position: 'absolute', right: -4.5, top: 3, width: 3, height: 6,
            background: colore, borderRadius: 1 }} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: tc.textPrimary }}>{dati.testo}</span>
      </button>

      {/* ── Popup ── */}
      {popup}
    </>
  );
}
