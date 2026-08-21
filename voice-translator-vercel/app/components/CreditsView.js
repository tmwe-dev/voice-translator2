'use client';
import { useState, useEffect, useCallback } from 'react';
import { FONT } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
import { PACCHETTI, oreIncluse, MOLTIPLICATORE_PREMIUM } from '../wallet/tariffe.js';
import { memGet } from '../lib/memoria.js';

// ═══════════════════════════════════════════════
// CreditsView — LA pagina commerciale, allineata al wallet.
//
// Un solo listino in tutta l'app (app/wallet/tariffe.js):
//   Start €4,99 · Viaggio €11,99 · Mondo €24,99 — paghi una volta,
//   i minuti sono tuoi. Niente abbonamenti, niente "crediti" astratti.
//
// ── b.138 · la pagina dove si paga era solo in italiano ──
//
// "MINUTI DISPONIBILI", "HAI UN CODICE?", "Crea regalo", "Codice non
// valido": tutto cablato. E la pagina che decide se una persona spende
// o se ne va, e uno spagnolo o un giapponese la trovava in una lingua
// che non capisce, pur avendo scelto la sua nell'impostazione. Adesso
// ogni testo viene da L(); le scritte in maiuscolo restano maiuscole
// via CSS (textTransform), perche in cinese e in thai una maiuscola
// scritta a mano nel testo non esiste.
// ═══════════════════════════════════════════════

const COLORI = { verde: '#3ddc84', giallo: '#ffc44d', rosso: '#ff5470' };

export default function CreditsView({ userAccount }) {
  const { L, S, setView } = useApp();
  const tc = S.colors || {};
  const [dati, setDati] = useState(null);
  const [codice, setCodice] = useState('');
  const [esito, setEsito] = useState('');
  const [esitoOk, setEsitoOk] = useState(false);
  const [caricando, setCaricando] = useState(false);
  const [minutiRegalo, setMinutiRegalo] = useState(30);
  const [esitoRegalo, setEsitoRegalo] = useState('');
  const [regaloFatto, setRegaloFatto] = useState(null);

  const conToken = useCallback((extra = {}) => {
    const token = typeof window !== 'undefined' ? memGet('vt-token') : null;
    return { ...extra, ...(token && { Authorization: `Bearer ${token}` }) };
  }, []);

  const carica = useCallback(async () => {
    try {
      const r = await fetch('/api/wallet/saldo', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */, headers: conToken() });
      // b.363 — prima la lettura non era protetta: una risposta non-JSON
      // faceva saltare l'aggiornamento del credito senza lasciare traccia.
      if (r.ok) { const d = await r.json().catch(() => null); if (d) setDati(d); }
    } catch { /* senza rete non si puo avvisare: si riprova al prossimo collegamento */ }
  }, [conToken]);

  useEffect(() => { carica(); }, [carica]);

  async function compra(pacchettoId) {
    setCaricando(true); setEsito(''); setEsitoOk(false);
    try {
      const r = await fetch('/api/wallet/ricarica', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: conToken({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ pacchetto: pacchettoId }),
      });
      const d = await r.json().catch(() => ({}));
      // b.232 — prima nessun controllo su r.ok: se il server rispondeva 401
      // (sloggato) o errore, `url` era undefined e non succedeva NULLA. Ora
      // mostra un messaggio invece del click muto.
      if (!r.ok || !d.url) { setEsito(d.error || L('genericError')); setEsitoOk(false); return; }
      window.location.href = d.url;
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/wallet/ricarica:', e?.message || e);
      setEsito(L('genericError')); setEsitoOk(false); }
    finally { setCaricando(false); }
  }

  // Un solo campo per due cose: i codici che iniziano con GIFT- sono
  // regali di un altro utente, gli altri sono voucher promozionali.
  async function usaCodice() {
    setEsito('...'); setEsitoOk(false);
    const pulito = codice.trim().toUpperCase();
    const eRegalo = pulito.startsWith('GIFT-');
    // b.232 — prima senza try/catch: offline o errore di rete lasciava il
    // messaggio bloccato su "..." con una promise non gestita.
    try {
      const r = await fetch(eRegalo ? '/api/wallet/regalo' : '/api/wallet/voucher', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: conToken({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(eRegalo ? { azione: 'riscatta', codice: pulito } : { codice: pulito }),
      });
      const d = await r.json().catch(() => ({}));
      setEsito(d.ok ? `${L('doneExcl')} ${d.testo}` : (d.motivo || L('invalidCode')));
      setEsitoOk(!!d.ok);
      if (d.ok) { setCodice(''); carica(); }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/wallet/regalo:', e?.message || e);
      setEsito(L('genericError')); setEsitoOk(false); }
  }

  // ── Regalare minuti a qualcuno ──
  async function creaRegalo() {
    const minuti = Math.floor(Number(minutiRegalo));
    if (!minuti) return;
    setEsitoRegalo('...');
    try {
      const r = await fetch('/api/wallet/regalo', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: conToken({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ azione: 'invia', minuti }),
      });
      // b.363 — prima la lettura non era protetta: con una risposta rotta il
      // regalo restava sui puntini di sospensione all'infinito.
      const d = await r.json().catch(() => null);
      if (!d) { setEsitoRegalo(L('genericError')); return; }
      if (!d.ok) { setEsitoRegalo(d.motivo || L('notSucceeded')); return; }
      setRegaloFatto(d);
      setEsitoRegalo('');
      carica();
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/wallet/regalo:', e?.message || e);
      setEsitoRegalo(L('noConnection'));
    }
  }

  function condividiRegalo() {
    if (!regaloFatto) return;
    const testo = `${L('inviteGiftPrefix')} ${regaloFatto.testo} ${L('giftShareBody')} ${regaloFatto.link || regaloFatto.codice}`;
    if (navigator.share) navigator.share({ text: testo }).catch(() => {});
    else navigator.clipboard?.writeText(testo).then(() => setEsitoRegalo(L('linkCopied')), () => {});
  }

  const colore = COLORI[dati?.colore] || COLORI.verde;
  const card = {
    background: tc.cardBg, border: `1px solid ${tc.cardBorder}`,
    borderRadius: 18, padding: '16px 16px',
  };

  return (
    <main style={S.page} aria-label={L('creditAndTopups')}>
      <div style={{ ...S.scrollCenter, gap: 14, paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 16px' }}>
            {/* b.206 — pulsante indietro uniforme: glifo ‹ come le altre pagine */}
            <button onClick={() => setView('settings')} aria-label={L('backWord')} style={{
              width: 38, height: 38, borderRadius: 12, border: `1px solid ${tc.cardBorder}`,
              background: tc.cardBg, color: tc.textPrimary, cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{'‹'}</button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: tc.textPrimary, fontFamily: FONT, margin: 0 }}>
              {L('yourCreditTitle')}
            </h1>
          </div>

          {!userAccount && (
            <div style={{ ...card, marginBottom: 14, fontSize: 13, color: tc.textSecondary, fontFamily: FONT }}>
              {L('signInToSeeCredit')}
            </div>
          )}

          {/* Saldo */}
          {dati && (
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT, textTransform: 'uppercase' }}>{L('creditMinutesAvailable')}</div>
              <div style={{ fontSize: 34, fontWeight: 850, color: colore, fontFamily: FONT }}>{dati.testo}</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, color: tc.textSecondary, fontFamily: FONT }}>
                <span>{L('todayWord')}: <b>{dati.oggi}</b></span>
                <span>{L('thisMonth')}: <b>{dati.mese}</b></span>
              </div>
            </div>
          )}

          {/* Come funziona — una riga, chiara */}
          <div style={{ fontSize: 12, color: tc.textMuted, fontFamily: FONT, lineHeight: 1.5, marginBottom: 14 }}>
            {L('creditRuleA')} {MOLTIPLICATORE_PREMIUM}{'×'}.
            {L('creditRuleB')}
          </div>

          {/* Pacchetti — L'UNICO listino */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT, marginBottom: 8, textTransform: 'uppercase' }}>{L('landingRecharge')}</div>
          {PACCHETTI.map(p => {
            const ore = oreIncluse(p);
            return (
              <button key={p.id} disabled={caricando} onClick={() => compra(p.id)} style={{
                display: 'flex', alignItems: 'center', width: '100%', gap: 12, cursor: 'pointer',
                padding: '15px 16px', marginBottom: 8, borderRadius: 16, fontFamily: FONT,
                background: p.consigliato ? `linear-gradient(145deg, ${tc.accent1 || '#5b8cff'}18, ${tc.accent2 || '#38e1ff'}10)` : tc.cardBg,
                border: p.consigliato ? `1.5px solid ${tc.accent1 || '#5b8cff'}55` : `1px solid ${tc.cardBorder}`,
                color: tc.textPrimary, textAlign: 'left', opacity: caricando ? 0.6 : 1,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    {p.nome} {'·'} {ore.standard}
                    {p.consigliato && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                      padding: '3px 8px', borderRadius: 999, color: '#fff',
                      background: `linear-gradient(90deg, ${tc.accent1 || '#5b8cff'}, ${tc.accent2 || '#38e1ff'})`, textTransform: 'uppercase' }}>{L('recommended')}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: tc.textMuted, marginTop: 2 }}>
                    {L('withPremiumVoice')} {ore.premium}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 850, color: tc.accent2 || '#38e1ff' }}>
                  {'€'}{String(p.euro).replace('.', ',')}
                </div>
              </button>
            );
          })}

          {/* Voucher o regalo ricevuto — un campo solo */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT, margin: '14px 0 8px', textTransform: 'uppercase' }}>{L('creditHaveCode')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={codice} onChange={(e) => setCodice(e.target.value.toUpperCase())} placeholder={L('voucherOrGift')}
              style={{ flex: 1, padding: '12px 14px', borderRadius: 13, fontFamily: FONT, fontSize: 14, textTransform: 'uppercase',
                background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.textPrimary }} />
            <button onClick={usaCodice} disabled={!codice} style={{
              padding: '12px 18px', borderRadius: 13, border: 'none', cursor: 'pointer', fontFamily: FONT,
              fontSize: 14, fontWeight: 800, color: '#000',
              background: tc.btnGradient || 'linear-gradient(90deg,#5b8cff,#38e1ff)',
            }}>{L('useWord')}</button>
          </div>
          {/* b.138 — il colore si decideva con esito.startsWith('Fatto'): tolto
              l'italiano dal messaggio, quel confronto non avrebbe piu trovato
              nulla e ogni esito sarebbe diventato rosso, anche quello buono.
              Ora l'esito porta con se il proprio segno. */}
          {esito && <div style={{ fontSize: 12, marginTop: 6, fontFamily: FONT, color: esitoOk ? COLORI.verde : COLORI.rosso }}>{esito}</div>}

          {/* Regala minuti a qualcuno */}
          {userAccount && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT, margin: '18px 0 8px', textTransform: 'uppercase' }}>{L('creditGiftMinutes')}</div>
              {!regaloFatto ? (
                <div style={card}>
                  <div style={{ fontSize: 12.5, color: tc.textSecondary, fontFamily: FONT, lineHeight: 1.5, marginBottom: 10 }}>
                    {L('giftRule')}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" min={1} max={600} value={minutiRegalo}
                      onChange={(e) => setMinutiRegalo(e.target.value)}
                      style={{ width: 92, padding: '12px 14px', borderRadius: 13, fontFamily: FONT, fontSize: 14,
                        background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.textPrimary }} />
                    <span style={{ fontSize: 13, color: tc.textMuted, fontFamily: FONT, flex: 1 }}>{L('minutesWord')}</span>
                    <button onClick={creaRegalo} style={{
                      padding: '12px 18px', borderRadius: 13, border: `1px solid ${tc.cardBorder}`, cursor: 'pointer',
                      fontFamily: FONT, fontSize: 14, fontWeight: 800, color: tc.textPrimary, background: 'transparent',
                    }}>{L('createGift')}</button>
                  </div>
                  {esitoRegalo && <div style={{ fontSize: 12, marginTop: 8, fontFamily: FONT, color: COLORI.rosso }}>{esitoRegalo}</div>}
                </div>
              ) : (
                <div style={card}>
                  <div style={{ fontSize: 12, color: tc.textMuted, fontFamily: FONT, textTransform: 'uppercase' }}>{L('giftReady')} {'·'} {regaloFatto.testo}</div>
                  <div style={{ fontSize: 20, fontWeight: 850, color: tc.accent2 || '#38e1ff', fontFamily: FONT, letterSpacing: 1, margin: '4px 0 10px' }}>
                    {regaloFatto.codice}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={condividiRegalo} style={{
                      flex: 1, padding: '12px 16px', borderRadius: 13, border: 'none', cursor: 'pointer',
                      fontFamily: FONT, fontSize: 14, fontWeight: 800, color: '#000',
                      background: tc.btnGradient || 'linear-gradient(90deg,#5b8cff,#38e1ff)',
                    }}>{L('sendGift')}</button>
                    <button onClick={() => { setRegaloFatto(null); setEsitoRegalo(''); }} style={{
                      padding: '12px 16px', borderRadius: 13, border: `1px solid ${tc.cardBorder}`, cursor: 'pointer',
                      fontFamily: FONT, fontSize: 14, fontWeight: 700, color: tc.textSecondary, background: 'transparent',
                    }}>{L('closeWord')}</button>
                  </div>
                  {esitoRegalo && <div style={{ fontSize: 12, marginTop: 8, fontFamily: FONT, color: COLORI.verde }}>{esitoRegalo}</div>}
                </div>
              )}
            </>
          )}

          {/* Storico */}
          {dati?.storico?.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: tc.textMuted, fontFamily: FONT, margin: '16px 0 6px', textTransform: 'uppercase' }}>{L('creditYourTopups')}</div>
              <div style={card}>
                {dati.storico.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 2px',
                    fontSize: 12.5, fontFamily: FONT,
                    borderBottom: i < dati.storico.length - 1 ? `1px solid ${tc.cardBorder}` : 'none' }}>
                    <span style={{ color: tc.textMuted, minWidth: 74 }}>{r.quando}</span>
                    <span style={{ flex: 1, color: tc.textSecondary }}>
                      {r.tipo === 'acquisto' ? L('landingRecharge') : r.tipo === 'benvenuto' ? L('histWelcome') : r.tipo === 'omaggio' ? L('histFree') : r.tipo === 'regalo_in' ? L('histGift') : 'Voucher'}
                    </span>
                    <span style={{ fontWeight: 800, color: COLORI.verde }}>{r.testo}</span>
                    {r.euro && <span style={{ color: tc.textMuted }}>{r.euro}</span>}
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </main>
  );
}
