'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
// b.405 — niente piu registrazione a mano: la voce entra nel registro
// dentro `parlaTurno`, che e l'unica strada che passa di li.
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { parlaAmico, parlaTurno, valutaCinqueAssi } from '../../lib/compagni/cliente.js';
import { obiettiviAttivi } from '../../lib/compagni/obiettivi.js';
import { memGet, memSet, sesGet, sesDel } from '../../lib/memoria.js';
import CompagnoLive from './CompagnoLive.js';

// b.231 — la storia della chat ora PERSISTE per Compagno (prima viveva solo
// in memoria e spariva a ogni ricarica o cambio Compagno). Sta sul dispositivo.
const CHIAVE_CHAT = (id) => `vt-chat-${id}`;
function caricaChat(id) {
  if (typeof window === 'undefined' || !id) return [];
  try { const s = memGet(CHIAVE_CHAT(id)); const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a.slice(-100) : []; }
  catch { return []; }
}
function salvaChat(id, messaggi) {
  if (typeof window === 'undefined' || !id) return;
  try { memSet(CHIAVE_CHAT(id), JSON.stringify((messaggi || []).slice(-100))); }
  catch { /* quota/privato: si perde solo la persistenza, non la chat viva */ }
}

// ═══════════════════════════════════════════════════════════════
// AmicoChat — parla con un Compagno. Se ha la memoria accesa (🧠) ti
// ricorda nel tempo. Chat semplice + voce opzionale. (Luca)
// ═══════════════════════════════════════════════════════════════

function AmicoChat({ compagni, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [scelto, setScelto] = useState(null);
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState('');
  const [attende, setAttende] = useState(false);
  const [errore, setErrore] = useState('');
  // b.316 — conversazione VOCALE dal vivo (widget ElevenLabs, personalita
  // del Compagno iniettata all'avvio). Un contenitore, mille personaggi.
  const [dalVivo, setDalVivo] = useState(false);
  // b.335 — I 5 ASSI: quando parli con un Compagno in un'ALTRA lingua, un
  // tasto valuta i tuoi ultimi messaggi su cinque assi SEPARATI.
  const [assi, setAssi] = useState(null);
  const [assiLavoro, setAssiLavoro] = useState(false);
  const valutaAssi = useCallback(async () => {
    if (assiLavoro || !scelto?.lingua) return;
    const turni = messaggi.filter((m) => m.ruolo === 'persona').slice(-8).map((m) => m.testo);
    if (!turni.length) return;
    setAssiLavoro(true);
    try { setAssi(await valutaCinqueAssi({ turni, linguaStudiata: scelto.lingua, lingua, userToken })); }
    catch { /* la valutazione e un di piu */ }
    finally { setAssiLavoro(false); }
  }, [assiLavoro, scelto, messaggi, lingua, userToken]);
  const fondo = useRef(null);
  // b.232 — riferimento sempre aggiornato al Compagno scelto, per evitare che
  // la risposta di A (in arrivo) finisca nella chat di B se si cambia Compagno.
  const sceltoRef = useRef(scelto);
  useEffect(() => { sceltoRef.current = scelto; }, [scelto]);

  useEffect(() => { if (fondo.current) fondo.current.scrollIntoView({ behavior: 'smooth' }); }, [messaggi, attende]);

  // b.231 — salva la conversazione sul dispositivo a ogni cambiamento.
  useEffect(() => { if (scelto) salvaChat(scelto.id, messaggi); }, [messaggi, scelto]);

  // b.232 — cambiando Compagno azzera attesa/errore: prima B restava con il
  // "…" e il tasto invio disabilitato finché la vecchia richiesta di A non finiva.
  useEffect(() => { setAttende(false); setErrore(''); }, [scelto]);

  // b.333 — il COACH dei Compiti: se l'agenda ha lasciato un brief, il campo
  // messaggio arriva GIA scritto (l'utente lo rilegge e invia). Una volta sola.
  useEffect(() => {
    if (!scelto) return;
    try {
      const brief = sesGet('vt-coach-brief');
      if (brief) { setTesto(brief); sesDel('vt-coach-brief'); }
    } catch { /* niente brief in attesa */ }
  }, [scelto]);

  // b.406 · P1.1 — QUELLO CHE SI DICE A VOCE ENTRA NELLA CHAT SCRITTA.
  //
  // Fino a qui la continuita era a senso unico: gli ultimi messaggi
  // scritti entravano nella telefonata, ma la telefonata non tornava
  // indietro. Dopo dieci minuti di conversazione vocale col Compagno, il
  // messaggio successivo si comportava come se non fosse mai avvenuta —
  // e nemmeno la memoria persistente riceveva niente.
  //
  // I turni entrano in coda alla stessa cronologia, quindi vengono
  // salvati sul dispositivo come tutti gli altri e viaggiano al server
  // col messaggio successivo. `dalVivo: true` li marca: servira a
  // mostrarli diversi, e serve a non ricontarli.
  const accogliTurniDalVivo = useCallback((turni) => {
    if (!Array.isArray(turni) || !turni.length) return;
    setMessaggi((m) => {
      // dedup: la stessa battuta consegnata due volte (chiusura + smontaggio)
      // non deve comparire due volte.
      const gia = new Set(m.map((x) => `${x.ruolo}|${String(x.testo || '').trim()}`));
      const nuovi = [];
      for (const t of turni) {
        const testo = String(t?.testo || '').trim();
        if (!testo) continue;
        const chiave = `${t.ruolo}|${testo}`;
        if (gia.has(chiave)) continue;
        gia.add(chiave);
        nuovi.push({ ruolo: t.ruolo === 'persona' ? 'persona' : 'compagno', testo, dalVivo: true });
      }
      return nuovi.length ? [...m, ...nuovi] : m;
    });
  }, []);

  const invia = useCallback(async () => {
    const t = testo.trim();
    if (!t || !scelto || attende) return;
    setErrore('');
    const idAtt = scelto.id;
    const nuovi = [...messaggi, { ruolo: 'persona', testo: t }];
    setMessaggi(nuovi); setTesto(''); setAttende(true);
    try {
      const d = await parlaAmico({ compagnoId: scelto.id, messaggi: nuovi, lingua, userToken, obiettivi: obiettiviAttivi() });
      // b.232 — se nel frattempo si è cambiato Compagno, scarta la risposta.
      if (sceltoRef.current?.id !== idAtt) return;
      // b.337 — la voce del turno resta SUL messaggio: senza, un messaggio si
      // poteva sentire solo all'arrivo e mai piu (riascolto impossibile).
      setMessaggi((m) => [...m, { ruolo: 'compagno', testo: d.risposta, voceId: d.voceId || null, modoVoce: d.modoVoce || null }]);
      // b.238 — la voce riceve anche COME il Compagno voleva dirlo.
      // b.317 — audit D2: la voce parla nella LINGUA del Compagno, se ne ha una.
      // b.363 — anche questa voce passa dal telecomando di Life: prima
      // suonava fuori da ogni comando e i tasti Pausa/Stop non la vedevano.
      // b.405 — registra `parlaTurno`: qui basta dire chi sta parlando.
      if (d.voceId) parlaTurno({ voceId: d.voceId, testo: d.risposta, lingua: scelto.lingua || lingua, userToken, modoVoce: d.modoVoce, chi: scelto?.nome || 'Amico' });
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] nuovi:', e?.message || e);
      if (sceltoRef.current?.id !== idAtt) return;
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { if (sceltoRef.current?.id === idAtt) setAttende(false); }
  }, [testo, scelto, attende, messaggi, lingua, userToken, L]);

  // b.337 — RIASCOLTA: ogni messaggio del Compagno ha l'altoparlante. Per i
  // messaggi vecchi (salvati senza voce) la rotta sceglie da sé una voce
  // adatta alla lingua: meglio una voce plausibile che il silenzio.
  const [sentendo, setSentendo] = useState(-1);
  const riascolta = useCallback(async (i) => {
    const m = messaggi[i];
    if (!m || sentendo >= 0) return;
    setSentendo(i);
    try {
      await parlaTurno({ voceId: m.voceId || null, testo: m.testo, lingua: scelto?.lingua || lingua, userToken, modoVoce: m.modoVoce || null, chi: scelto?.nome || 'Amico' });
    } catch { /* la voce e un di piu: il testo resta leggibile */ }
    finally { setSentendo(-1); }
  }, [messaggi, sentendo, scelto, lingua, userToken]);

  // ── Scelta del Compagno ──
  if (!scelto) {
    return (
      <div>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifePickFriend')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {compagni.map((c) => (
            <button key={c.id} onClick={() => { vibrate(8); setScelto(c); setMessaggi(caricaChat(c.id)); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: card, border: bordo, cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
              <img src={c.avatar} alt="" width={42} height={42} style={{ borderRadius: 10, display: 'block', flexShrink: 0, objectFit: 'cover' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, color: testoP, fontSize: 14 }}>{c.nome} {c.memoria ? '🧠' : ''}</span>
                <span style={{ display: 'block', fontSize: 11, color: muto }}>{c.ruolo}</span>
              </span>
              <span style={{ color: muto }}>›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Conversazione ──
  // b.394 — vh non e dvh: su Safari iPhone vh conta lo schermo con le
  // barre del browser NASCOSTE, quindi questa colonna sfondava il bordo
  // visibile e la riga per scrivere finiva sotto. Il contenitore che la
  // ospita e gia in dvh: stessa unita, stesso comportamento.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70dvh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: bordo, marginBottom: 10 }}>
        <button onClick={() => setScelto(null)} aria-label={L('lifeBack')} style={{ background: card, border: bordo, borderRadius: 10, padding: 7, cursor: 'pointer' }}>
          <Icon name="back" size={16} color={testoP} />
        </button>
        <img src={scelto.avatar} alt={scelto.nome} width={32} height={32} style={{ borderRadius: 8, display: 'block', objectFit: 'cover' }} />
        <span style={{ fontWeight: 700, color: testoP, flex: 1 }}>{scelto.nome} {scelto.memoria ? '🧠' : ''}</span>
        {scelto.lingua && scelto.lingua !== lingua && (
          <button onClick={valutaAssi} disabled={assiLavoro} title="Valuta i tuoi ultimi messaggi su 5 assi"
            style={{ padding: '8px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 800,
              border: `1px solid ${accent}`, background: 'transparent', color: accent, opacity: assiLavoro ? 0.6 : 1 }}>
            {assiLavoro ? '…' : '5 assi'}
          </button>
        )}
        {/* b.316 — parla DAL VIVO col Compagno: voce in tempo reale. */}
        <button onClick={() => { vibrate(8); setDalVivo((v) => !v); }} aria-pressed={dalVivo}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
            background: dalVivo ? `${accent}22` : accent, color: dalVivo ? accent : '#04121c', border: dalVivo ? `1px solid ${accent}` : 'none' }}>
          <Icon name="mic" size={14} color={dalVivo ? accent : '#04121c'} /> {dalVivo ? 'Chiudi' : 'Dal vivo'}
        </button>
      </div>

      {dalVivo && (
        // b.339 — la discussione scritta ENTRA nella sessione dal vivo: gli
        // ultimi scambi (i piu recenti pesano di piu) diventano il {{contesto}}
        // dell'agente, che riprende il filo invece di ripartire da zero.
        <CompagnoLive compagno={scelto} lingua={lingua} onChiudi={() => setDalVivo(false)}
          onFine={accogliTurniDalVivo}
          contesto={messaggi.slice(-14).map((m) =>
            `${m.ruolo === 'persona' ? 'Persona' : (scelto?.nome || 'Tu')}: ${String(m.testo || '').slice(0, 400)}`
          ).join('\n')}
          {...{ testoP, muto, accent, card, bordo }} />
      )}

      {assi && (
        <div style={{ padding: 12, borderRadius: 12, background: card, border: `1px solid ${accent}44`, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: testoP }}>I tuoi 5 assi (mai un numero solo)</span>
            <button onClick={() => setAssi(null)} style={{ background: 'none', border: 'none', color: muto, cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          {[['comprensibilita', 'Comprensibilità'], ['grammatica', 'Grammatica'], ['vocabolario', 'Vocabolario'], ['fluidita', 'Fluidità'], ['contenuto', 'Contenuto']].map(([k, et]) => {
            const a = assi[k] || { voto: 0, consiglio: '' };
            const col = a.voto >= 70 ? accent : a.voto >= 45 ? '#f59e0b' : '#f87171';
            return (
              <div key={k} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: testoP }}>
                  <b>{et}</b><b style={{ color: col }}>{a.voto}</b>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', margin: '3px 0' }}>
                  <div style={{ width: `${a.voto}%`, height: '100%', background: col }} />
                </div>
                {a.consiglio && <div style={{ fontSize: 11, color: muto }}>{a.consiglio}</div>}
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: muto, marginTop: 4 }}>La pronuncia si valuta a voce (lezioni e lettura guidata), non da qui.</div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messaggi.map((m, i) => (
          <div key={i} style={{ alignSelf: m.ruolo === 'persona' ? 'flex-end' : 'flex-start', maxWidth: '82%',
            padding: '9px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, fontFamily: FONT,
            background: m.ruolo === 'persona' ? accent : card, color: m.ruolo === 'persona' ? '#04121c' : testoP,
            border: m.ruolo === 'persona' ? 'none' : bordo }}>
            {/* b.406 — un turno DETTO A VOCE si vede che e stato detto a
                voce. Mescolarlo allo scritto senza segno farebbe leggere a
                Luca una chat che non ha mai scritto. */}
            {m.dalVivo && (
              <span aria-hidden style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6, opacity: 0.6 }}>
                <Icon name="mic" size={11} color={m.ruolo === 'persona' ? '#04121c' : muto} />
              </span>
            )}
            {m.testo}
            {m.ruolo === 'compagno' && (
              <button onClick={() => riascolta(i)} disabled={sentendo >= 0} aria-label={L('listenWord')} title={L('listenWord')}
                style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 8, padding: 2, border: 'none',
                  background: 'transparent', cursor: 'pointer', opacity: sentendo === i ? 1 : 0.55 }}>
                <Icon name="speaker" size={14} color={sentendo === i ? accent : testoP} />
              </button>
            )}
          </div>
        ))}
        {attende && <div style={{ alignSelf: 'flex-start', color: muto, fontSize: 13, padding: '4px 8px' }}>…</div>}
        <div ref={fondo} />
      </div>

      {errore && <div style={{ color: '#f87171', fontSize: 13, padding: '6px 0' }}>{errore}</div>}

      <div style={{ display: 'flex', gap: 8, paddingTop: 10 }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') invia(); }}
          aria-label={L('lifeChatPh')} placeholder={L('lifeChatPh')} style={{ flex: 1, padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 15, fontFamily: FONT }} />
        <button onClick={invia} disabled={attende} aria-label={L('send')} style={{ padding: '0 16px', borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>
          <Icon name="send" size={16} color="#04121c" />
        </button>
      </div>
    </div>
  );
}

export default memo(AmicoChat);
