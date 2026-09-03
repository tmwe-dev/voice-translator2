'use client';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FONT } from '../../lib/constants.js';
import { zittisci, suInterruzione } from '../../lib/voce.js';
import Icon from '../Icon.js';
import { chiediPermessoVoce } from '../../lib/microfonoMaster.js';   // b.602, b.619
import { createLogger } from '../../lib/logger.js';
const log = createLogger('CompagnoLive');   // b.604 — niente console.* sparsi: tutto dal logger

// ═══════════════════════════════════════════════════════════════
// b.316 — COMPAGNO DAL VIVO (Luca): la chiacchierata 1-a-1 in Amico
// diventa una CONVERSAZIONE VOCALE in tempo reale — parli e lui parla,
// lo interrompi come al telefono. Architettura "ibrido chirurgico":
// UN solo agente conversazionale ElevenLabs per tutta la sezione, e la
// PERSONALITÀ del Compagno scelto viene iniettata all'avvio della
// sessione (variabili dinamiche). Un contenitore, mille personaggi.
//
// b.340 (Luca) — VIA IL WIDGET. Il popup preconfezionato portava stelline
// di voto, ID di conversazione e marchio altrui. Ora la linea vocale è la
// STESSA (libreria ufficiale @elevenlabs/client, stessa infrastruttura)
// ma l'interfaccia è nostra: stato, trascrizione dal vivo, microfono e
// chiusura, tutto nella grafica dell'app. Niente popup, niente voto.
//
// b.406 — BATCH A dell'audit, la parte che vale in OGNI CASO.
//
// La domanda grossa — se il cervello del dal-vivo debba restare BarTalk
// (ElevenLabs solo voce) o possa restare ElevenLabs dietro una sessione
// firmata dal nostro server — e una decisione di prodotto e non e stata
// presa qui: P0.1 resta aperto, e con lui il passaggio dal portafoglio.
// Ma cinque difetti di questo file NON dipendono da quella scelta, e
// nessuno di essi migliora aspettando:
//
//   P1.1  cio che si diceva a voce non tornava mai nella chat scritta
//   P1.2  un guasto del fornitore si travestiva da «conversazione chiusa»
//   P1.3  il tasto Muto poteva mentire: si accendeva sul comando, non
//         sulla conferma. Su un microfono, mentire e grave.
//   P1.4  Riprova non chiudeva la sessione precedente
//   P1.5  personalita e contesto entravano nel prompt come istruzioni
//
// E due che vengono da b.405 e valgono anche qui: si apre un microfono,
// quindi prima si fa silenzio; e lo Stop del telecomando deve poter
// chiudere anche questa linea.
// ═══════════════════════════════════════════════════════════════

// b.407 — L'IDENTIFICATIVO DELL'AGENTE NON STA PIU QUI, e nemmeno la
// personalita del Compagno. Via B, decisa da Luca il 23/08/2026 e scritta
// in docs/PIANO-LIFE-COMPAGNI.md §5-ter: l'agente conversazionale resta
// (funziona, e non si tocca cio che funziona), ma la SESSIONE la apre il
// nostro server — che sa chi sei, risolve il Compagno dal nostro
// database, guarda il credito e tiene il conto.
//
// Quello che prima stava in questo file — l'id dell'agente, il nome, il
// ruolo, la personalita, la voce, la ripulitura del testo — era tutto
// scrivibile da chi apriva gli strumenti del browser. Ora di qui parte
// un id e un gettone, e torna un indirizzo firmato. Niente altro.

/**
 * b.406 · P1.2 — CHE COSA E' SUCCESSO DAVVERO ALLA LINEA.
 *
 * Prima ogni chiusura diventava «chiuso» e solo il dettaglio, in fondo,
 * lasciava intuire un guasto. Chi restava senza rete leggeva
 * «Conversazione chiusa», come se avesse riagganciato lui.
 *
 * Non si indovina il perche dal fornitore: si parte da un fatto che
 * conosciamo con certezza — L'ABBIAMO CHIESTA NOI questa chiusura? — e
 * si aggiunge solo cio che il fornitore dichiara.
 */
function classificaChiusura(d, volutaDaNoi) {
  if (volutaDaNoi) return 'chiusa_da_te';
  if (d?.reason === 'error') {
    // `navigator.onLine` dice poco quando e vero, ma quando e FALSO e
    // certo: il telefono sa di non avere rete.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'caduta_rete';
    return 'guasto_fornitore';
  }
  // Chiusa senza che l'avessimo chiesta: e caduta. Perche, non lo sappiamo,
  // e dirlo e piu onesto che chiamarla una conclusione.
  return 'caduta';
}

// b.484 — LE PAROLE DI QUESTA SCHEDA ERANO IN ITALIANO PER TUTTI. Sono
// gli avvisi di quando la linea vocale non parte — rete caduta, credito
// finito, microfono negato — cioe proprio i momenti in cui chi legge ha
// bisogno di capire, e li trovava una lingua che non e la sua.
// Il traduttore arriva come PROP da chi monta la scheda: dentro non si
// aggiunge nessun aggancio nuovo, perche qui sotto c'e la telefonata e
// non si tocca. Cambia solo cio che si legge.
//
// b.550 — E ADESSO L'ITALIANO E' USCITO DAL CODICE DAVVERO. Ordine di
// Luca: «trovale tutte e sostituiscile con L('chiave')». A b.484 le
// quattordici frasi erano state incatenate a una chiave, ma con il testo
// italiano ancora scritto qui accanto come ripiego (`tt(chiave,
// italiano)`): il file continuava a essere l'unico posto dell'app dove
// una frase visibile stava in italiano dentro il sorgente, e chiunque
// leggesse quelle righe poteva credere che l'italiano fosse la verita e
// la traduzione un di piu.
// Le quattordici chiavi esistono e sono tradotte in tutti e trentotto i
// pacchetti (lo difende `compagno-live-b406`), quindi il ripiego non
// difendeva piu niente: proteggeva solo se stesso. Ora si chiama L() e
// basta. Se un giorno una chiave sparisse dai pacchetti si leggerebbe il
// suo nome — brutto, ma onesto, e visibile subito; l'italiano di scorta
// invece nascondeva il buco a tutti tranne che agli italiani.
function CompagnoLive({ compagno, lingua, userToken, contesto, onChiudi, onFine, testoP, muto, accent, card, bordo, L = (chiave) => chiave }) {
  // collego | vivo | chiusa_da_te | caduta | caduta_rete | guasto_fornitore
  // | microfono_negato | avvio_fallito | credito_finito | non_configurato
  const [stato, setStato] = useState('collego');
  const statoRef = useRef('collego');   // b.613 — letto dalle richiamate del fornitore, che non vedono lo stato aggiornato
  useEffect(() => { statoRef.current = stato; }, [stato]);
  const [modo, setModo] = useState('listening'); // listening | speaking
  const [micSpento, setMicSpento] = useState(false);
  // P1.3 — si sa se il comando del microfono ESISTE davvero prima di
  // mostrarlo. Un tasto che non comanda niente e peggio di un tasto assente.
  const [muteDisponibile, setMuteDisponibile] = useState(false);
  const [righe, setRighe] = useState([]); // trascrizione dal vivo [{chi, testo}]
  const [dettaglio, setDettaglio] = useState(''); // b.341 — l'errore VERO, mostrato
  const convRef = useRef(null);
  const vivoRef = useRef(true);
  const fondoRef = useRef(null);
  // P1.4 — ogni apertura ha un numero. Le richiamate di una sessione
  // vecchia che arrivano in ritardo (e arrivano: una chiusura non e
  // istantanea) portano il numero vecchio e vengono ignorate. Senza
  // questo, un Riprova poteva far scrivere alla linea morta sopra quella
  // nuova — o peggio, lasciarne due aperte insieme, ognuna col suo costo.
  const generazioneRef = useRef(0);
  const chiusuraVolutaRef = useRef(false);
  // P1.1 — la trascrizione COMPLETA, che e un'altra cosa da quella che si
  // vede: a schermo se ne tengono le ultime ventiquattro righe per non far
  // crescere la colonna all'infinito, ma cio che torna nella chat non puo
  // essere un troncone.
  const turniRef = useRef([]);
  const consegnatoRef = useRef(false);

  // b.407 — la sessione aperta dal server: serve per chiudere il conto.
  const sessioneIdRef = useRef(null);
  // b.418 — IL BATTITO. Mentre si parla, il telefono si fa sentire ogni
  // minuto: il server conferma il tratto consumato e ne apre un altro.
  // Senza, una telefonata lunga scavallava la vita della riserva (dieci
  // minuti) e finiva per non essere pagata affatto.
  const battitoRef = useRef(null);
  const fermaBattito = useCallback(() => {
    if (battitoRef.current) { clearInterval(battitoRef.current); battitoRef.current = null; }
  }, []);
  // il contesto scritto piu recente, letto quando serve: se lo si chiudesse
  // dentro `apriLinea`, un Riprova ripartirebbe con quello di dieci minuti fa.
  const contestoRef = useRef('');
  contestoRef.current = String(contesto || '').slice(0, 4000);

  // b.407 — CHIUDE IL CONTO. La durata la calcola il server dall'ora di
  // apertura: un numero che paga l'utente non puo dipendere da chi paga.
  // `keepalive` perche questa chiamata deve partire anche mentre la
  // pagina si sta chiudendo — se non parte, la riserva resta bloccata
  // fino al cron delle riserve scadute e quella telefonata risulta gratis.
  const chiudiConto = useCallback(() => {
    fermaBattito();
    const id = sessioneIdRef.current;
    if (!id) return;
    sessioneIdRef.current = null;
    try {
      fetch('/api/compagni/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // b.609 — i turni viaggiano con la chiusura: il server ne estrae i
        // ricordi (se il Compagno ha la memoria accesa).
        body: JSON.stringify({ azione: 'chiudi', userToken, sessioneId: id,
          turni: turniRef.current.slice(-40).map((t) => ({ ruolo: t.ruolo, testo: String(t.testo || '').slice(0, 600) })) }),
        keepalive: true,
      }).catch(() => { /* il conto lo chiudera il cron delle riserve scadute */ });
    } catch { /* nemmeno la partenza della chiamata e riuscita: il conto lo chiudera il cron delle riserve scadute */ }
  }, [userToken, fermaBattito]);

  // ═══ b.613 — UNA LINEA CADUTA NON DEVE CONTINUARE A PAGARE. ═══
  // Trovato dal vivo (collaudo 03/09, registro wallet alla mano): la
  // telefonata con Aisha e' stata RIFIUTATA dal fornitore un secondo dopo
  // l'apertura (voce non consentita, vedi b.612), la scheda diceva
  // «Guasto della linea vocale» — e intanto il battito continuava:
  // ogni due minuti un tratto nuovo, cinque tratti CONFERMATI da 540
  // secondi di credito (45 minuti) per una telefonata mai avvenuta,
  // finche' non si e' premuto Chiudi. Il conto si chiude sul tempo
  // trascorso dall'apertura, e il tempo passava. Da qui in poi ogni
  // esito finale che NON e' «vivo» ferma il battito e chiude il conto
  // subito: si paga il tempo davvero passato (pochi secondi), non
  // l'attesa davanti a una scheda d'errore. Riprova apre un conto nuovo
  // (P1.4), quindi chiudere qui non gli toglie niente.
  const chiudiPerGuasto = useCallback(() => {
    fermaBattito();
    chiudiConto();
  }, [fermaBattito, chiudiConto]);

  // P1.1 — i turni parlati diventano messaggi della chat scritta. Prima
  // la continuita era a senso unico: lo scritto entrava nel dal-vivo, il
  // dal-vivo non tornava indietro. Dopo dieci minuti al telefono col
  // Compagno, la chat dopo si comportava come se non fosse successo nulla.
  const consegnaTurni = useCallback(() => {
    if (consegnatoRef.current) return;
    consegnatoRef.current = true;
    const turni = turniRef.current;
    if (turni.length && onFine) { try { onFine(turni); } catch { /* la consegna e un di piu: non deve impedire la chiusura */ } }
  }, [onFine]);

  // b.341 — l'apertura e una funzione richiamabile (tasto Riprova), non piu
  // sepolta nell'effetto; e l'errore vero viene mostrato, non un indovinello:
  // prima QUALSIASI guasto diceva "controlla il microfono" anche a chi il
  // permesso l'aveva gia dato.
  const apriLinea = useCallback(async () => {
    // P1.4 — PRIMA di tutto: la vecchia sessione se ne va. Nessun Riprova
    // deve poter lasciare viva quella di prima.
    const mia = ++generazioneRef.current;
    const vecchia = convRef.current;
    convRef.current = null;
    if (vecchia) {
      chiusuraVolutaRef.current = true;
      try { await vecchia.endSession?.(); } catch { /* era gia caduta: nulla da chiudere */ }
      // b.407 — e si paga quella, prima di aprirne un'altra: due riserve
      // vive insieme sarebbero credito bloccato due volte.
      chiudiConto();
    }
    const mioTurno = () => vivoRef.current && mia === generazioneRef.current;
    if (!mioTurno()) return;

    // P1.1 (retry) — QUELLO CHE SI E' DETTO NELLA SESSIONE CADUTA NON SI
    // BUTTA. Prima Riprova apriva una linea nuova sotto una trascrizione
    // vecchia rimasta a schermo: continuita finta, perche il Compagno di
    // quella conversazione non sapeva niente. Ora i turni della sessione
    // precedente vengono consegnati alla chat E rimessi nel contesto della
    // nuova, cosi la telefonata riprende da dove e caduta.
    //
    // Non si aspetta che il contesto torni indietro dal genitore: sarebbe
    // un giro asincrono con una richiamata gia in volo. Si compone qui, da
    // cio che abbiamo in mano.
    const dettiPrima = turniRef.current
      .map((t) => `${t.ruolo === 'persona' ? 'Persona' : (compagno?.nome || 'Tu')}: ${t.testo}`)
      .join('\n');
    consegnaTurni();
    turniRef.current = [];
    consegnatoRef.current = false;
    setRighe([]);
    const contestoDaMandare = [contestoRef.current, dettiPrima].filter(Boolean).join('\n').slice(-4000);

    chiusuraVolutaRef.current = false;
    setStato('collego'); setDettaglio(''); setMuteDisponibile(false); setMicSpento(false);
    try {
      // b.406 — SI STA PER APRIRE UN MICROFONO. Stessa regola della
      // Pronuncia (b.405): prima si fa silenzio, e si aspetta che sia
      // vero. Se una lezione o un podcast stanno parlando, quella voce
      // finisce dritta dentro la telefonata.
      await zittisci();
      // Prima il microfono, da solo: cosi un guasto di PERMESSO e distinto
      // da un guasto di COLLEGAMENTO, e il messaggio dice quello giusto.
      try {
        // b.602 — la prova di permesso passa dal microfono unico: se il
        // master e' gia aperto (chiamata in corso) non si riapre l'hardware.
        // b.619 — e se non lo e', si chiede SOLO il permesso senza accendere
        // e spegnere l'hardware a 48 kHz: la libreria del fornitore lo vuole
        // a 16 e se lo apre da se (vedi microfonoMaster.chiediPermessoVoce).
        await chiediPermessoVoce();
      } catch (e) {
        if (mioTurno()) { setStato('microfono_negato'); setDettaglio(`${L('liveMicUnavailable')} (${e?.name || ''}) ${L('liveMicCheckPermission')}`); }
        return;
      }
      if (!mioTurno()) return;

      // b.407 — LA PORTA. Di qua parte un id e un gettone; il server
      // decide chi e il Compagno, se puoi permettertelo, e restituisce un
      // indirizzo firmato che vale pochi minuti.
      const risposta = await fetch('/api/compagni/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azione: 'apri',
          userToken,
          compagnoId: compagno?.id || '',
          lingua,
          contesto: contestoDaMandare,
        }),
      });
      const permesso = await risposta.json().catch(() => null);
      if (!mioTurno()) return;
      if (!risposta.ok || !permesso?.signedUrl) {
        // Ogni rifiuto ha il suo nome: il credito finito non e un guasto
        // della linea, e una configurazione mancante non e colpa tua.
        const motivo = permesso?.motivo || '';
        setDettaglio(String(permesso?.error || L('liveCantOpen')));
        setStato(
          risposta.status === 402 ? 'credito_finito'
          : risposta.status === 401 ? 'avvio_fallito'
          : motivo === 'agente-non-configurato' || motivo === 'chiave-mancante' ? 'non_configurato'
          : 'guasto_fornitore',
        );
        return;
      }
      sessioneIdRef.current = permesso.sessioneId || null;

      // b.418 — DA QUI IN POI SI PAGA A TRATTI. Ogni battito il server
      // guarda quanto e stato parlato: se il tratto sta per finire lo
      // conferma e ne apre un altro. Se il credito e finito lo dice, e la
      // telefonata si chiude con calma invece di continuare gratis.
      fermaBattito();
      const ogniQuanto = Math.max(15, Number(permesso.battitoSecondi) || 60) * 1000;
      battitoRef.current = setInterval(async () => {
        const id = sessioneIdRef.current;
        if (!id || !mioTurno()) { fermaBattito(); return; }
        let esito = null;
        try {
          const b = await fetch('/api/compagni/live/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ azione: 'rinnova', userToken, sessioneId: id }),
          });
          esito = { ok: b.ok, corpo: await b.json().catch(() => null) };
        } catch {
          // Un battito perso non chiude niente: la rete va e viene, e il
          // tratto in corso e gia pagato. Si riprova al prossimo.
          return;
        }
        if (esito.ok || !mioTurno()) return;
        const motivo = esito.corpo?.motivo || '';
        if (motivo !== 'credito-finito' && motivo !== 'sessione-chiusa') return;
        // Il server ha gia chiuso il conto: qui non si richiude, si
        // riaggancia. Chiamare `chiudiConto` addebiterebbe due volte.
        fermaBattito();
        sessioneIdRef.current = null;
        chiusuraVolutaRef.current = true;
        try { await convRef.current?.endSession?.(); } catch { /* la linea era gia caduta */ }
        convRef.current = null;
        if (!mioTurno()) return;
        setDettaglio(String(esito.corpo?.error || ''));
        setStato('credito_finito');
        consegnaTurni();
      }, ogniQuanto);

      const { Conversation } = await import('@elevenlabs/client');

      // ═══════════════════════════════════════════════════════════════
      // b.431 — «Override for field 'voice_id' is not allowed by config».
      //
      // Trovato da Luca provandolo: si preme «Dal vivo» e la linea muore
      // sul nascere con quel messaggio in rosso. Non e un guasto nostro e
      // non e un guasto suo: e un PERMESSO spento dall'altra parte.
      // Ogni Compagno ha la sua voce, e noi la chiediamo all'apertura; ma
      // l'agente del fornitore accetta di farsi cambiare la voce solo se
      // qualcuno gliel'ha consentito nelle sue impostazioni. Se non gliel'ha
      // consentito, rifiuta — e finora rifiutava TUTTA la telefonata.
      //
      // Una voce diversa da quella giusta e un difetto. Nessuna telefonata
      // e un difetto molto peggiore. Quindi: si chiede la voce del
      // Compagno; se viene rifiutata SOLO per quello, si riprova subito
      // senza chiederla, e la telefonata si fa con la voce predefinita.
      // Chi guarda lo vede scritto: non gli si fa credere che sia la voce
      // del suo Compagno.
      //
      // Perche resti un rimedio e non diventi la regola: si registra, e la
      // riga qui sotto dice a chi legge dove si accende il permesso.
      // (elevenlabs.io → l'agente → Security → Overrides → voice_id)
      // ═══════════════════════════════════════════════════════════════
      const rifiutoDellaVoce = (m) => /override.*voice_id|voice_id.*not allowed/i.test(String(m || ''));
      let vocePropriaRifiutata = false;

      // b.609 — IL RESPIRO (da Ermes, v.010906): con il trasporto websocket
      // la voce dell'agente viaggia in blocchi gia' decisi e, quando lo
      // interrompi, aspetta che il blocco finisca — «non mi ascolta, non si
      // ferma». Con WebRTC il flusso e' continuo e l'interruzione e'
      // immediata, eco cancellata dal browser compresa. Se WebRTC non parte
      // si torna al websocket invece di non partire.
      const opzioniLinea = (conVoce) => ({
        // niente piu `agentId`: l'indirizzo e gia firmato dal nostro server
        signedUrl: permesso.signedUrl,
        // Le variabili le costruisce il server dal Compagno vero: il
        // browser non decide piu chi e il personaggio ne come parla.
        dynamicVariables: permesso.variabili,
        ...(conVoce && permesso.voceId ? { overrides: { tts: { voiceId: permesso.voceId } } } : {}),
        onConnect: () => { if (mioTurno()) setStato('vivo'); },
        onDisconnect: (d) => {
          if (!mioTurno()) return;
          // b.612 — TROVATO DAL VIVO (collaudo 03/09, Chrome di Luca): il
          // rifiuto della voce NON arrivava da onError ne' come eccezione
          // di startSession (i due casi che b.431 copriva): la sessione si
          // apriva, e un attimo dopo il fornitore la CHIUDEVA con
          // `reason: 'error'` e il messaggio «Override for field 'voice_id'
          // is not allowed by config». Questo ramo la classificava come
          // guasto del fornitore e la telefonata moriva li', con il tasto
          // Riprova che ripeteva lo stesso giro. Ora il rifiuto della voce
          // si riconosce ANCHE qui, e si riapre senza voce, una volta.
          if (conVoce && rifiutoDellaVoce(d?.message) && !riaperturaSenzaVoceRef.current) {
            riaperturaSenzaVoceRef.current = true;
            log.warn('[b.612] il fornitore ha chiuso per la voce: si riapre con la sua');
            riapriSenzaVoce();
            return;
          }
          const esito = classificaChiusura(d, chiusuraVolutaRef.current);
          setStato((s) => (s.startsWith('microfono') || s === 'avvio_fallito' ? s : esito));
          if (d?.message) setDettaglio(String(d.message));
          // b.613 — la linea e' caduta (o chiusa): il conto si chiude ORA.
          if (esito !== 'chiusa_da_te') chiudiPerGuasto();
        },
        onError: (messaggio) => {
          log.warn('[CompagnoLive] errore di linea:', messaggio);
          if (!mioTurno()) return;
          // b.431 — se e SOLO la voce a non essere consentita, non e un
          // guasto: e un permesso. Lo gestisce chi ha aperto la linea,
          // qui non si butta giu niente.
          if (rifiutoDellaVoce(messaggio)) { vocePropriaRifiutata = true; return; }
          // A linea gia aperta un errore puo essere passeggero: si mostra
          // senza buttare giu la chiamata. Prima dell'apertura, e fatale.
          setDettaglio(String(messaggio || ''));
          setStato((s) => (s === 'vivo' ? s : 'guasto_fornitore'));
          if (statoRef.current !== 'vivo') chiudiPerGuasto();   // b.613 — mai aperta: non si paga l'attesa
        },
        onModeChange: ({ mode }) => { if (mioTurno()) setModo(mode); },
        onMessage: ({ message, source }) => {
          if (!mioTurno() || !message) return;
          const testo = String(message);
          const ruolo = source === 'user' ? 'persona' : 'compagno';
          const ultimo = turniRef.current[turniRef.current.length - 1];
          // la stessa battuta puo arrivare due volte: non si conta due volte
          if (ultimo && ultimo.ruolo === ruolo && ultimo.testo === testo) return;
          turniRef.current = [...turniRef.current, { ruolo, testo }];
          setRighe((r) => [...r.slice(-24), { chi: source === 'user' ? 'tu' : 'lui', testo }]);
        },
      });
      const riaperturaSenzaVoceRef = { current: false };
      const riapriSenzaVoce = async () => {
        try {
          const nuova = await apriLinea(false);
          if (!mioTurno()) { nuova?.endSession?.().catch?.(() => {}); return; }
          convRef.current = nuova;
          setMuteDisponibile(typeof nuova?.setMicMuted === 'function');
          setDettaglio(L('liveVoiceNotAllowed'));
        } catch (e) {
          log.warn('[b.612] riapertura senza voce fallita:', e?.message || e);
          if (mioTurno()) { setStato('guasto_fornitore'); setDettaglio(String(e?.message || e || '')); chiudiPerGuasto(); }   // b.613
        }
      };
      const apriLinea = async (conVoce) => {
        const opz = opzioniLinea(conVoce);
        try {
          return await Conversation.startSession({ ...opz, connectionType: 'webrtc' });
        } catch (e) {
          // b.431 — il rifiuto della VOCE non e' un guasto di trasporto: lo
          // gestisce chi ha chiamato apriLinea, qui non si riprova.
          if (rifiutoDellaVoce(e?.message || e)) throw e;
          log.warn('[CompagnoLive] WebRTC non disponibile, passo al websocket:', e?.message || e);
          return Conversation.startSession({ ...opz, connectionType: 'websocket' });
        }
      };

      let conv;
      try {
        conv = await apriLinea(true);
      } catch (e) {
        // Il rifiuto puo arrivare anche come eccezione, non solo come avviso.
        if (!rifiutoDellaVoce(e?.message)) throw e;
        vocePropriaRifiutata = true;
        conv = null;
      }
      if (!mioTurno()) { conv?.endSession?.().catch?.(() => {}); return; }
      if (!conv || vocePropriaRifiutata) {
        // Si riapre senza chiedere la voce: meglio la voce predefinita che
        // nessuna telefonata. E si dice, invece di lasciarlo credere.
        log.warn('[b.431] il fornitore non consente di cambiare voce: si prosegue con la sua');
        try { await conv?.endSession?.(); } catch { /* la linea era gia caduta da se: non c'e niente da chiudere */ }
        conv = await apriLinea(false);
        if (!mioTurno()) { conv?.endSession?.().catch?.(() => {}); return; }
        // Le parole di questa schermata sono scritte qui da sempre (vedi
        // gli stati poco piu sotto): questa riga segue la stessa strada,
        // per non lasciarne una a meta fra due modi diversi.
        setDettaglio(L('liveVoiceNotAllowed'));
      }
      if (!conv) { setStato('guasto_fornitore'); chiudiPerGuasto(); return; }   // b.613
      convRef.current = conv;
      // P1.3 — il comando del microfono si mostra SOLO se la libreria lo
      // espone davvero. Prima, quando non c'era, si scriveva una proprieta
      // a caso sull'oggetto e si accendeva lo stesso la scritta «Muto»:
      // l'utente leggeva che nessuno lo sentiva mentre il microfono era
      // ancora aperto. Su un microfono questo non e un difetto grafico.
      setMuteDisponibile(typeof conv.setMicMuted === 'function');
    } catch (e) {
      log.warn('[CompagnoLive] apertura fallita:', e);
      if (mioTurno()) { setStato('avvio_fallito'); setDettaglio(String(e?.message || e || L('errorTitle'))); chiudiPerGuasto(); }   // b.613
    }
  }, [compagno, lingua, userToken, consegnaTurni, chiudiConto, fermaBattito, chiudiPerGuasto, L]);

  useEffect(() => {
    vivoRef.current = true;
    apriLinea();
    return () => {
      vivoRef.current = false;
      fermaBattito();
      generazioneRef.current += 1;   // le richiamate in ritardo non hanno piu voce in capitolo
      chiusuraVolutaRef.current = true;
      convRef.current?.endSession?.().catch?.(() => {});
      convRef.current = null;
      // b.407 — anche uscendo di lato il conto si chiude: se no la riserva
      // resta bloccata e la telefonata finisce per non essere pagata.
      chiudiContoRef.current?.();
      // P1.1 — anche uscendo di lato (cambio scheda, chiusura della chat)
      // cio che si e detto a voce non si butta via.
      consegnaTurni();
    };
    // La sessione si apre UNA volta al montaggio: il contesto e la personalita
    // sono congelati all'avvio, come per una telefonata appena composta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fondoRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [righe]);

  const commutaMic = useCallback(() => {
    const c = convRef.current;
    // P1.3 — nessuna scorciatoia: se il comando non c'e, non si finge.
    if (!c || typeof c.setMicMuted !== 'function') return;
    const nuovo = !micSpento;
    try {
      c.setMicMuted(nuovo);
      setMicSpento(nuovo);   // la scritta cambia DOPO che il comando e passato
    } catch (e) {
      // il microfono e rimasto com'era, e va detto: la scritta non cambia.
      log.warn('[CompagnoLive] il microfono non ha ubbidito:', e);
      setDettaglio(L('liveMicNoResponse'));
    }
  }, [micSpento, L]);

  const chiudi = useCallback(() => {
    generazioneRef.current += 1;
    chiusuraVolutaRef.current = true;
    convRef.current?.endSession?.().catch?.(() => {});
    convRef.current = null;
    // P1.2 — lo stato lo scrive CHI SA: qui sappiamo con certezza che la
    // chiusura l'hai chiesta tu. Aspettare la richiamata del fornitore
    // sarebbe aspettare un'informazione che abbiamo gia — e che dopo il
    // giro di generazione verrebbe giustamente ignorata.
    if (vivoRef.current) setStato('chiusa_da_te');
    chiudiConto();
    consegnaTurni();
    onChiudi?.();
  }, [onChiudi, consegnaTurni, chiudiConto]);

  // b.406 — lo Stop del telecomando di Life chiude anche la telefonata.
  // Il telecomando promette di fermare «tutto cio che parla»: una linea
  // vocale aperta che sopravvive a quel gesto rende falsa la promessa —
  // e continua a costare.
  const chiudiContoRef = useRef(chiudiConto);
  useEffect(() => { chiudiContoRef.current = chiudiConto; }, [chiudiConto]);
  const chiudiRef = useRef(chiudi);
  useEffect(() => { chiudiRef.current = chiudi; }, [chiudi]);
  useEffect(() => suInterruzione(() => chiudiRef.current?.()), []);

  const inErrore = stato === 'guasto_fornitore' || stato === 'caduta_rete'
    || stato === 'microfono_negato' || stato === 'avvio_fallito'
    || stato === 'credito_finito' || stato === 'non_configurato';
  const finita = inErrore || stato === 'chiusa_da_te' || stato === 'caduta';
  // riprovare una configurazione mancante non la fa comparire: il tasto
  // che non puo funzionare non si mostra.
  const riprovabile = finita && stato !== 'non_configurato';

  // P1.2 — ogni finale ha il suo nome. Il dettaglio tecnico resta sotto,
  // per chi lo vuole, ma la prima riga dice cosa e successo.
  const statoTesto =
    stato === 'collego' ? L('liveDialling')
    : stato === 'microfono_negato' ? (dettaglio || L('liveMicUnavailable'))
    : stato === 'caduta_rete' ? L('liveNetDown')
    : stato === 'guasto_fornitore' ? L('liveProviderDown')
    : stato === 'credito_finito' ? L('liveNoCredit')
    : stato === 'non_configurato' ? L('liveNotConfigured')
    : stato === 'avvio_fallito' ? (dettaglio || L('liveCantOpenChatOk'))
    : stato === 'caduta' ? L('liveDropped')
    : stato === 'chiusa_da_te' ? L('liveClosed')
    : micSpento ? L('liveMicOff')
    : modo === 'speaking' ? `${compagno?.nome || L('liveCompanionWord')} ${L('liveSpeakingSuffix')}`
    : L('liveListening');

  return (
    <div style={{ padding: 14, borderRadius: 14, background: card, border: `1px solid ${accent}55`, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {compagno?.avatar && <img src={compagno.avatar} alt="" width={38} height={38} style={{ borderRadius: 10, objectFit: 'cover' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: testoP, fontSize: 14 }}>{compagno?.nome}</div>
          <div style={{ fontSize: 11, color: inErrore ? '#f87171' : muto }}>
            {stato === 'vivo' && (
              <span aria-hidden style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, marginRight: 5,
                background: modo === 'speaking' ? accent : '#4ade80',
                animation: 'vt-pulse 1.2s ease-in-out infinite' }} />
            )}
            {statoTesto}
          </div>
          {/* il motivo tecnico sta sotto, in piccolo: serve a chi indaga,
              non a chi sta parlando. */}
          {inErrore && dettaglio && stato !== 'microfono_negato' && stato !== 'avvio_fallito'
            && stato !== 'credito_finito' && stato !== 'non_configurato' && (
            <div style={{ fontSize: 10, color: muto, marginTop: 2, wordBreak: 'break-word' }}>{dettaglio}</div>
          )}
        </div>
        {riprovabile && (
          <button onClick={apriLinea} aria-label={L('retryWord')}
            style={{ background: accent, border: 'none', borderRadius: 8, minHeight: 44, padding: '6px 12px',
              cursor: 'pointer', color: '#04121c', fontFamily: FONT, fontSize: 13, fontWeight: 500 }}>
            {L('retryWord')}
          </button>
        )}
        {stato === 'vivo' && muteDisponibile && (
          <button onClick={commutaMic} aria-pressed={micSpento}
            aria-label={micSpento ? L('liveMicTurnOn') : L('liveMicTurnOff')}
            style={{ background: micSpento ? '#f8717122' : 'none', border: bordo, borderRadius: 8, minHeight: 44, padding: '6px 10px',
              cursor: 'pointer', color: micSpento ? '#f87171' : testoP, fontFamily: FONT, fontSize: 13 }}>
            {micSpento ? L('mutedWord') : L('micWord')}
          </button>
        )}
        <button onClick={chiudi} aria-label={L('closeWord')}
          style={{ background: 'none', border: bordo, borderRadius: 8, minHeight: 44, padding: '6px 10px', cursor: 'pointer', color: testoP, fontFamily: FONT, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={14} /></button>
      </div>

      {righe.length > 0 && (
        <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6, borderTop: bordo }}>
          {righe.map((r, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.4, color: r.chi === 'tu' ? muto : testoP, fontFamily: FONT }}>
              <span style={{ fontWeight: 500 }}>{r.chi === 'tu' ? L('youWord') : compagno?.nome || L('liveHim')}: </span>{r.testo}
            </div>
          ))}
          <div ref={fondoRef} />
        </div>
      )}

      <style>{'@keyframes vt-pulse{0%,100%{opacity:.4}50%{opacity:1}}'}</style>
    </div>
  );
}

export default memo(CompagnoLive);
