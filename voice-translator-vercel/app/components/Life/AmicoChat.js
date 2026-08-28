'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
// b.405 — niente piu registrazione a mano: la voce entra nel registro
// dentro `parlaTurno`, che e l'unica strada che passa di li.
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { parlaAmico, parlaTurno, valutaCinqueAssi } from '../../lib/compagni/cliente.js';
import { obiettiviAttivi } from '../../lib/compagni/obiettivi.js';
import { sesGet, sesDel } from '../../lib/memoria.js';
import { leggi as leggiScaffale, scrivi as scriviScaffale } from '../../lib/scaffale.js';
import CompagnoLive from './CompagnoLive.js';
// b.432 — IL MICROFONO CHE MANCAVA (collaudo di Luca: «pagina amico life
// manca il microfono»). Qui dentro l'unico era quello di «Dal vivo», che
// apre una telefonata: dettare nel campo non si poteva.
// La dettatura NON e scritta qui: sta in un posto solo, perche la stessa
// cosa era gia scritta a mano in tre punti diversi e ognuno si portava
// dietro i suoi difetti.
import { ascolta as ascoltaVoce, dettaturaDisponibile } from '../../lib/dettatura.js';
// b.482 — IL MICROFONO E' QUELLO DI CASA. Qui era disegnato a mano (un
// quadrato con un rosso scritto dentro il file) mentre in Home, in «Parla
// ora» e nella stanza e' sempre lo stesso cerchio con l'alone. Chi impara
// un microfono deve riconoscerlo ovunque: la veste arriva da un posto
// solo, il comportamento al tocco non cambia di una virgola.
import { vesteMicrofono } from '../ui/Microfono.js';

// b.231 — la storia della chat ora PERSISTE per Compagno (prima viveva solo
// in memoria e spariva a ogni ricarica o cambio Compagno). Sta sul dispositivo.
//
// b.410 (P0.7) — E ADESSO STA SU UNO SCAFFALE CON IL TUO NOME. La chiave
// era `vt-chat-<compagno>`, senza dentro chi sei: sullo stesso telefono
// bastava uscire, entrare con un altro account e riaprire lo stesso
// Compagno per leggere la conversazione di prima. Una chat con l'Amico
// non e una preferenza: e la cosa piu personale che c'e in Life.
const NOME_CHAT = (id) => `chat:${id}`;
function caricaChat(id) {
  if (typeof window === 'undefined' || !id) return [];
  try { const s = leggiScaffale(NOME_CHAT(id)); const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a.slice(-100) : []; }
  catch { return []; }
}
function salvaChat(id, messaggi) {
  if (typeof window === 'undefined' || !id) return;
  try { scriviScaffale(NOME_CHAT(id), JSON.stringify((messaggi || []).slice(-100))); }
  catch { /* quota/privato: si perde solo la persistenza, non la chat viva */ }
}

// ═══════════════════════════════════════════════════════════════
// AmicoChat — parla con un Compagno. Se ha la memoria accesa (il segno
// del tempo accanto al nome) ti ricorda. Chat semplice + voce. (Luca)
// ═══════════════════════════════════════════════════════════════

function AmicoChat({ compagni, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [scelto, setScelto] = useState(null);
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState('');
  const [detto, setDetto] = useState(false);   // b.432 — microfono aperto
  const ascoltoRef = useRef(null);
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

  // b.432 — un tocco apre il microfono, il secondo lo chiude e lascia nel
  // campo quello che hai detto. NON invia da solo: qui la frase la
  // rileggi prima di mandarla, perche parli con qualcuno che ti
  // rispondera — non e una traduzione da consegnare al volo.
  const detta = useCallback(() => {
    if (ascoltoRef.current) {
      ascoltoRef.current.ferma();
      ascoltoRef.current = null;
      setDetto(false);
      return;
    }
    const sessione = ascoltaVoce({
      lingua: lingua || 'it',
      inizio: testo,
      suTesto: (t) => setTesto(t),
      suFine: (t) => { ascoltoRef.current = null; setDetto(false); if (t) setTesto(t); },
    });
    if (!sessione) return;
    ascoltoRef.current = sessione;
    setDetto(true);
    vibrate(8);
  }, [lingua, testo]);

  // Uscendo dalla schermata il microfono si chiude: lasciarlo aperto
  // vorrebbe dire tenere acceso l'ascolto di una pagina che non c'e piu.
  useEffect(() => () => { ascoltoRef.current?.ferma(); ascoltoRef.current = null; }, []);

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
      if (d.voceId) parlaTurno({ voceId: d.voceId, testo: d.risposta, lingua: scelto.lingua || lingua, userToken, modoVoce: d.modoVoce, chi: scelto?.nome || L('lifeFriendTab') });
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
      await parlaTurno({ voceId: m.voceId || null, testo: m.testo, lingua: scelto?.lingua || lingua, userToken, modoVoce: m.modoVoce || null, chi: scelto?.nome || L('lifeFriendTab') });
    } catch { /* la voce e un di piu: il testo resta leggibile */ }
    finally { setSentendo(-1); }
  }, [messaggi, sentendo, scelto, lingua, userToken, L]);

  // ── Scelta del Compagno ──
  if (!scelto) {
    return (
      <div>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifePickFriend')}</div>
        {/* b.482 — i fianchi delle righe vanno a 20 come tutto il resto;
            il segno della memoria e la freccetta di fine riga erano due
            caratteri scritti a mano (un'emoji e un apice), che cambiano
            forma da un telefono all'altro: ora sono icone del sistema. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {compagni.map((c) => (
            <button key={c.id} onClick={() => { vibrate(8); setScelto(c); setMessaggi(caricaChat(c.id)); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 12, background: card, border: bordo, cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
              <img src={c.avatar} alt="" width={42} height={42} style={{ borderRadius: 10, display: 'block', flexShrink: 0, objectFit: 'cover' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500, color: testoP, fontSize: 14 }}>
                  {c.nome}
                  {c.memoria && (
                    <span title={L('lifeMemoryOn')} style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6 }}>
                      <Icon name="history" size={13} color={muto} />
                    </span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: muto }}>{c.ruolo}</span>
              </span>
              <Icon name="chevRight" size={16} color={muto} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // b.482 — la veste del microfono arriva dal file comune: qui si dice
  // solo quanto grande (54, la misura della riga in basso) e se sta
  // registrando. Colori del tema, non scritti a mano in questa pagina.
  const mic = vesteMicrofono({ misura: 54, acceso: detto, C: { accent1: accent, textPrimary: testoP } });

  // ── Conversazione ──
  // b.394 — vh non e dvh: su Safari iPhone vh conta lo schermo con le
  // barre del browser NASCOSTE, quindi questa colonna sfondava il bordo
  // visibile e la riga per scrivere finiva sotto. Il contenitore che la
  // ospita e gia in dvh: stessa unita, stesso comportamento.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70dvh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: bordo, marginBottom: 10 }}>
        {/* b.482 — il tasto per tornare indietro e' il piu premuto che ci
            sia e stava dentro trenta punti scarsi: portato ai 44 di casa,
            con l'icona della stessa misura di prima. */}
        <button onClick={() => setScelto(null)} aria-label={L('lifeBack')}
          style={{ background: card, border: bordo, borderRadius: 10, padding: 7, cursor: 'pointer',
            width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={16} color={testoP} />
        </button>
        <img src={scelto.avatar} alt={scelto.nome} width={32} height={32} style={{ borderRadius: 8, display: 'block', objectFit: 'cover' }} />
        <span style={{ fontWeight: 500, color: testoP, flex: 1 }}>
          {scelto.nome}
          {scelto.memoria && (
            <span title={L('lifeMemoryOn')} style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6 }}>
              <Icon name="history" size={13} color={muto} />
            </span>
          )}
        </span>
        {scelto.lingua && scelto.lingua !== lingua && (
          <button onClick={valutaAssi} disabled={assiLavoro} title={L('lifeAxesTip')}
            style={{ padding: '8px 10px', minHeight: 44, borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 500,
              border: `1px solid ${accent}`, background: 'transparent', color: accent, opacity: assiLavoro ? 0.6 : 1 }}>
            {assiLavoro ? '…' : L('lifeAxesBtn')}
          </button>
        )}
        {/* b.316 — parla DAL VIVO col Compagno: voce in tempo reale. */}
        {/* b.482 — toccato solo l'aspetto (misura del bersaglio e parole dal
            pacchetto lingua): cosa fa il tasto resta esattamente com'era. */}
        <button onClick={() => { vibrate(8); setDalVivo((v) => !v); }} aria-pressed={dalVivo}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', minHeight: 44, borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 500,
            background: dalVivo ? `${accent}22` : accent, color: dalVivo ? accent : '#04121c', border: dalVivo ? `1px solid ${accent}` : 'none' }}>
          <Icon name="mic" size={14} color={dalVivo ? accent : '#04121c'} /> {dalVivo ? L('closeWord') : L('lifeLiveBtn')}
        </button>
      </div>

      {dalVivo && (
        // b.339 — la discussione scritta ENTRA nella sessione dal vivo: gli
        // ultimi scambi (i piu recenti pesano di piu) diventano il {{contesto}}
        // dell'agente, che riprende il filo invece di ripartire da zero.
        // b.407 — il gettone serve: la linea non parte piu dal browser, la
        // apre il nostro server dopo aver guardato chi sei e quanto credito hai.
        // b.484 — il traduttore va passato: la scheda del dal vivo non ha
        // nessun aggancio al contesto, e non gliene diamo uno.
        <CompagnoLive L={L} compagno={scelto} lingua={lingua} userToken={userToken}
          onChiudi={() => setDalVivo(false)}
          onFine={accogliTurniDalVivo}
          contesto={messaggi.slice(-14).map((m) =>
            `${m.ruolo === 'persona' ? 'Persona' : (scelto?.nome || 'Tu')}: ${String(m.testo || '').slice(0, 400)}`
          ).join('\n')}
          {...{ testoP, muto, accent, card, bordo }} />
      )}

      {/* b.482 — i fianchi a 20; il tasto per chiudere era la crocetta
          scritta a mano, senza nemmeno un nome per chi non vede: ora e'
          l'icona del sistema, con il suo bersaglio da 44. E i nomi dei
          cinque assi arrivano dal pacchetto lingua, non dal codice. */}
      {assi && (
        <div style={{ padding: '12px 20px', borderRadius: 12, background: card, border: `1px solid ${accent}44`, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: testoP }}>{L('lifeAxesTitle')}</span>
            <button onClick={() => setAssi(null)} aria-label={L('closeWord')} title={L('closeWord')}
              style={{ background: 'none', border: 'none', color: muto, cursor: 'pointer',
                width: 44, height: 44, flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={16} color={muto} />
            </button>
          </div>
          {[['comprensibilita', L('lifeAxisClarity')], ['grammatica', L('lifeAxisGrammar')], ['vocabolario', L('lifeAxisVocabulary')], ['fluidita', L('lifeAxisFluency')], ['contenuto', L('lifeAxisContent')]].map(([k, et]) => {
            const a = assi[k] || { voto: 0, consiglio: '' };
            const col = a.voto >= 70 ? accent : a.voto >= 45 ? '#f59e0b' : '#f87171';
            return (
              <div key={k} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: testoP }}>
                  <span style={{ fontWeight: 500 }}>{et}</span><span style={{ fontWeight: 500, color: col }}>{a.voto}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', margin: '3px 0' }}>
                  <div style={{ width: `${a.voto}%`, height: '100%', background: col }} />
                </div>
                {a.consiglio && <div style={{ fontSize: 11, color: muto }}>{a.consiglio}</div>}
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: muto, marginTop: 4 }}>{L('lifeAxesPronNote')}</div>
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
              // b.482 — l'altoparlante per riascoltare era alto quanto la
              // sua icona: il dito lo mancava. Ora tiene i 44 minimi senza
              // che l'icona cambi misura.
              <button onClick={() => riascolta(i)} disabled={sentendo >= 0} aria-label={L('listenWord')} title={L('listenWord')}
                style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginLeft: 8, padding: 2, minHeight: 44, border: 'none',
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

      {/* b.432 — LA RIGA IN BASSO, con le misure del kit (template/
          layout-completo.html): campo alto 54 e testo 16 — sotto i sedici
          il telefono ingrandisce da solo la pagina quando ci si scrive
          dentro — e i due tasti quadri 54 per 54, che un dito prende.
          Prima erano dodici di riempimento e quindici di testo. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingTop: 10 }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') invia(); }}
          aria-label={L('lifeChatPh')} placeholder={L('lifeChatPh')}
          style={{ flex: 1, minWidth: 0, height: 54, padding: '0 14px', borderRadius: 16,
            border: detto ? `2px solid ${mic.accento}` : bordo, background: card, color: testoP,
            fontSize: 16, fontFamily: FONT, outline: 'none' }} />
        {dettaturaDisponibile() && (
          <button onClick={detta} aria-pressed={detto} aria-label={L('dictateWord')} title={L('dictateWord')}
            style={{ ...mic.cerchio, flexShrink: 0 }}>
            <Icon name="mic" size={mic.icona} color={mic.coloreIcona} />
          </button>
        )}
        <button onClick={invia} disabled={attende || !testo.trim()} aria-label={L('send')}
          style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0, padding: 0, border: 'none',
            background: accent, opacity: (attende || !testo.trim()) ? 0.4 : 1,
            cursor: (attende || !testo.trim()) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={20} color="#04121c" />
        </button>
      </div>
    </div>
  );
}

export default memo(AmicoChat);
