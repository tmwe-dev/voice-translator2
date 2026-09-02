'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext.js';
import { memDel, memSet } from '../lib/memoria.js';
import { LANGS, getLang, FONT, vibrate, metaScelta } from '../lib/constants.js';
import { t as tLingua, preloadLang } from '../lib/i18n.js';
import Icon from './Icon.js';
import { vesteMicrofono } from './ui/Microfono.js';
import { IconCar } from './Icons.js';
// b.424 — LA STESSA IDENTICA LISTA DELLA HOME (ordine di Luca: «crea una
// lista come quella della home, esattamente identica»). Non se ne scrive
// una seconda: si usa quella. Era una fila di pillole fatta da me, ed era
// un'altra cosa in un altro posto per fare lo stesso mestiere.
import CarouselLingue from './CarouselLingue.js';
// b.430 — L'INDIRIZZO E LA MAPPA (collaudo di Luca: «non vedo il tasto per
// mostrare la mappa o inserire un indirizzo»). Non c'erano: stavano solo
// in TaxiTalk. Qui sono gli STESSI pezzi, copiati da li e non riscritti —
// la ricerca su OpenStreetMap, la mappina di conferma, il QR che apre la
// mappa sul telefono di chi hai davanti.
import TaxiMap from './TaxiMap.js';
import { buildMapsUrl } from '../lib/mapsLink.js';
import { ascolta as ascoltaDettatura, dettaturaDisponibile } from '../lib/dettatura.js';   // b.603
import { procuraVoce } from '../lib/audio/voceTradotta.js';   // b.603
import { parlaColSistema } from '../lib/voceSistema.js'; // b.417
import { immagineQR } from '../lib/codiceQR.js';
import { createLogger } from '../lib/logger.js';
const log = createLogger('PrimaProva');   // b.604 — niente console.* sparsi: tutto dal logger

// ═══════════════════════════════════════════════════════════════
// b.355→b.356 — "PARLA ORA", il traduttore subito.
//
// Collaudi di Luca, in ordine: «l'utente scrive o DETTA nel campo e
// traduce direttamente con voce e testo» · «va rinominato e chiuso
// dietro una icona Parla ora» · «aperto nasconde le altre parti e
// occupa la pagina» · «piu grande il testo» · «i messaggi si
// susseguono, non scompaiono».
//
// - scrivi o detti: appena ti fermi la frase si traduce da sola,
//   entra nel REGISTRO (testone) e viene detta a voce;
// - il campo si svuota da solo: la frase dopo si accoda sotto;
// - il tasto FACCIA A FACCIA gira il registro di 180 gradi: io
//   scrivo, la persona davanti a me legge dal suo lato e ascolta.
// ═══════════════════════════════════════════════════════════════

const FATTA = 'vt-prima-prova-fatta';

// ═══════════════════════════════════════════════════════════════
// b.429 — CHI STA A PAGINA PIENA NON VUOLE NIENTE SOPRA.
//
// Collaudo di Luca: «hai nascosto dietro alla pila batteria il selettore
// dell'inversione testo». Vero: la pila e fissa nell'angolo in alto a
// destra sopra tutto, e da quando questa schermata e una pagina intera i
// suoi comandi le finiscono sotto.
//
// La pila NON si sposta: Luca l'ha chiesta li tre volte, e spostarla
// significherebbe rompere ogni altra schermata per aggiustarne una. Le
// pagine piene infatti la nascondono gia — stanza, diretta, taxi, lobby:
// sono elencate a mano in page.js. Questa non poteva entrare in
// quell'elenco perche non e una vista, e un pannello dentro la home.
// Quindi lo dice lei quando c'e: un interruttore solo, senza React,
// perche a leggerlo e page.js che sta piu in alto di tutto.
// ═══════════════════════════════════════════════════════════════
let aperta = false;
const spettatori = new Set();
function annuncia() {
  spettatori.forEach((fn) => { try { fn(aperta); } catch { /* uno spettatore rotto non ferma gli altri */ } });
}
/** Vero mentre «Parla ora» occupa lo schermo. */
export function primaProvaAperta() { return aperta; }
/** Si iscrive all'apertura e alla chiusura; la funzione restituita disiscrive. */
export function ascoltaPrimaProva(fn) {
  spettatori.add(fn);
  fn(aperta);
  return () => spettatori.delete(fn);
}

export function riapriPrimaProva() {
  try { memDel(FATTA); } catch { /* niente memoria: pazienza */ }
}

// Le mete rapide in cima; tutte le altre scorrono nella stessa fila.
// b.363 — CODICI VERI, non fantasmi: 'en-US' e 'pt-BR' NON esistono in LANGS
// (li' l'inglese e 'en' e il portoghese 'pt'; 'en-US'/'pt-BR' sono i codici
// della VOCE, non della lingua). Con quelli, la meta iniziale diventava un
// codice inesistente: getLang ripiegava sull'italiano e il traduttore
// rispondeva IN ITALIANO con voce italiana, in silenzio.
const RAPIDE = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ar', 'ru', 'pt'];

// b.462 — metaScelta e salita in lib/constants.js: la leggono anche la
// Home e chi prepara gli inviti, e una funzione condivisa non puo abitare
// dentro una schermata.

export default function PrimaProva({ onChiudi }) {
  const { L, S, prefs, savePrefs, setView } = useApp();
  const C = S?.colors || {};

  const miaLingua = prefs?.lang || 'it';
  // b.457 — LA META E' UNA PREFERENZA, non piu uno stato chiuso qui dentro.
  // Era la radice di un difetto che Luca ha incontrato tre volte: la lingua
  // di ARRIVO viveva solo dentro questa schermata, quindi la Home non aveva
  // una coppia vera da mostrare e ogni tentativo di disegnarla finiva col
  // ripetere due volte la stessa bandiera. Adesso sta nelle preferenze:
  // una sola verita, letta da tutti, e sopravvive alla chiusura.
  const meta = metaScelta(prefs);
  const setMeta = useCallback((codice) => {
    savePrefs?.({ ...prefs, meta: codice });
  }, [prefs, savePrefs]);
  const [testo, setTesto] = useState('');
  // b.356 — i messaggi SI SUSSEGUONO, non scompaiono (collaudo di Luca):
  // ogni frase tradotta resta nel registro, la nuova si accoda sotto.
  const [storia, setStoria] = useState([]);
  const [stato, setStato] = useState('quieto'); // quieto | traduco | parlo | errore | muto (b.417: la traduzione c'e, la voce no)
  // b.536, ordine di Luca: «permetti di selezionare le frasi. su selezione
  // evidenzia la frase e in fondo aggiungi una icona play che ripete il
  // testo con la voce». Null = nessuna scelta: il play legge l'ultima, come
  // ha sempre fatto. Toccando una frase la si sceglie; toccandola di nuovo
  // si torna all'ultima.
  const [sceltaIdx, setSceltaIdx] = useState(null);
  const [capovolto, setCapovolto] = useState(false); // FACCIA A FACCIA
  const [detto, setDetto] = useState(false);         // microfono acceso
  // b.445 — IL TURNO DELL'OSPITE. Chi hai davanti tiene premuto, parla nella
  // SUA lingua, e la frase arriva tradotta nella MIA. Prima si poteva solo
  // parlare noi: l'altro doveva rispondere a gesti.
  const [ospiteParla, setOspiteParla] = useState(false);
  const recOspiteRef = useRef(null);
  const testoOspiteRef = useRef('');
  // b.422 — LA PAGINA HA UNA COSA SOLA A SCHERMO (disegno approvato da Luca,
  // template/parla-ora.html, strada A). Chi apre trova un microfono e due
  // bandiere. Le lingue si aprono quando servono, e prendono SEMPRE lo
  // stesso posto — non spingono giu niente.
  // b.423 — VIA L'ICONA TASTIERA (collaudo di Luca: «l'icona tastiera non
  // serve, eliminala e lascia sempre un campo di testo disponibile per
  // scrivere»). Un comando che apre una cosa che poteva star li da sola e
  // un tocco chiesto per niente.
  const [scegliLingua, setScegliLingua] = useState(false); // la fila delle lingue e a schermo
  // b.430 — la destinazione: campo, mappa e QR. Prende il posto della
  // lettura come le lingue, e come le lingue non spinge giu niente.
  const [scegliDove, setScegliDove] = useState(false);
  const [dove, setDove] = useState('');            // quello che si scrive
  const [meta2, setMeta2] = useState(null);        // il posto scelto {lat, lon, displayName}
  const [risultati, setRisultati] = useState([]);
  const [cercando, setCercando] = useState(false);
  const [erroreDove, setErroreDove] = useState('');
  const [mioPunto, setMioPunto] = useState(null);
  const recRef = useRef(null);
  const dettoRef = useRef(false); // per decidere la voce senza rilegare gli effetti
  const timerRef = useRef(null);
  const numeroRef = useRef(0);
  const testoRef = useRef(''); // specchio del campo, per decidere senza rincorrere lo stato
  const giaChiestaRef = useRef(''); // l'ultima frase gia chiesta: non si chiede due volte
  const audioRef = useRef(null);
  const registroRef = useRef(null);

  // b.429 — finche questa pagina e a schermo, chi galleggia sopra si toglie.
  useEffect(() => {
    aperta = true; annuncia();
    return () => { aperta = false; annuncia(); };
  }, []);

  const mete = [...RAPIDE.map((c) => LANGS.find((l) => l.code === c)).filter(Boolean),
    ...LANGS.filter((l) => !RAPIDE.includes(l.code) && l.code !== miaLingua)];

  // ── LA VOCE (sempre col testo esplicito: cosi non insegue lo stato) ──
  //
  // b.356 — la traduzione la legge una voce ElevenLabs NATIVA della lingua
  // d'arrivo (collaudo di Luca): la rotta sceglie da se la voce madrelingua.
  //
  // b.417 — TRE COSE ERANO SBAGLIATE QUI, e si vedevano solo quando il
  // fornitore aveva una giornata storta. In produzione oggi:
  // «Edge TTS: sintesi riuscita ma audio vuoto», 32 volte su 5 persone.
  //
  //  1. «ok» non vuol dire «c'e un suono». Una risposta puo tornare 200 e
  //     portare zero byte: si costruiva un Audio vuoto, partiva `onerror`, e
  //     lo stato tornava «quieto» come se avesse parlato. La Diretta questo
  //     controllo lo fa da sempre (`blob.size > 0`); qui mancava.
  //  2. IL RIPIEGO PROMESSO NON ESISTEVA. Il commento diceva «si ripiega
  //     sulla voce di sistema: meglio una voce che nessuna voce», ma il
  //     codice ripiegava su /api/tts-edge, che e un altro SERVER — se il
  //     fornitore tace tacciono tutti e due. Ora l'ultimo gradino e la voce
  //     del telefono, che non dipende dalla nostra rete ne dal nostro
  //     credito. Non si usa /api/tts (OpenAI, il ripiego della Diretta)
  //     perche quella rotta passa dal portafoglio e senza gettone risponde
  //     401: farla spendere a chi sta solo provando l'app sarebbe una
  //     decisione di prodotto, non una riparazione.
  //  3. QUANDO NON PARLA, LO DICE. Prima restava muta in silenzio, e questa
  //     e la PRIMA cosa che tocca chi apre l'app: la traduzione compare nel
  //     registro e la voce non arriva mai, senza una parola.
  // b.445 — la voce accetta la LINGUA in cui leggere. Serviva perche adesso
  // le frasi viaggiano nei due sensi: quelle mie vanno lette nella lingua
  // dell'ospite, quelle dell'ospite nella mia. Senza il parametro, la
  // risposta all'ospite sarebbe stata letta con la voce sbagliata.
  const parla = useCallback(async (daLeggere, linguaVoce) => {
    const t = String(daLeggere || '').trim();
    if (!t) return;
    setStato('parlo');
    const codice = linguaVoce || meta;
    const tgt = getLang(codice);
    const lingua = tgt?.speech || codice;

    // b.603 — il ciclo (scadenza b.363, «200 con zero byte» = niente da
    // suonare, 204 b.552) sta in lib/audio/voceTradotta.js; qui l'ordine:
    // la premium prima, Edge di ripiego, poi la voce del telefono.
    const suono = await procuraVoce([
      { rotta: '/api/tts-elevenlabs', corpo: { text: t, langCode: lingua } },
      { rotta: '/api/tts-edge', corpo: { text: t, langCode: lingua } },
    ]);

    if (!suono) {
      // Nessun server ha una voce: parla il telefono. `parlaColSistema`
      // torna true solo se la voce E' PARTITA davvero (b.262), non se la
      // funzione e stata chiamata — altrimenti si tornerebbe a fingere.
      let partita = false;
      try { partita = await parlaColSistema(t, lingua); } catch { /* nemmeno la voce del telefono: lo dice lo stato qui sotto */ }
      setStato(partita ? 'quieto' : 'muto');
      return;
    }

    const url = URL.createObjectURL(suono);
    try { audioRef.current?.pause(); } catch { /* la voce precedente era gia ferma: niente da interrompere */ }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { URL.revokeObjectURL(url); setStato('quieto'); };
    // b.417 — se la riproduzione fallisce QUI, il suono c'era ma il telefono
    // non lo ha suonato (audio bloccato, formato rifiutato): si ritenta con
    // la voce di sistema invece di tornare zitti.
    const ripiega = async () => {
      URL.revokeObjectURL(url);
      let partita = false;
      try { partita = await parlaColSistema(t, lingua); } catch { /* niente voce di sistema su questo telefono */ }
      setStato(partita ? 'quieto' : 'muto');
    };
    audio.onerror = ripiega;
    audio.play().catch(ripiega);
  }, [meta]);

  // ── LA TRADUZIONE: la frase finita entra nel registro, con la voce ──
  const traduci = useCallback(async (daDire) => {
    const t = daDire.trim();
    if (!t) return;
    // b.357 — NIENTE DOPPIONI (collaudo di Luca: «raddoppia la lettura della
    // traduzione»). Alla fine della dettatura la frase partiva subito, ma il
    // timer della scrittura era ancora armato e la faceva ripartire: due
    // traduzioni identiche, due righe nel registro e la voce che leggeva due
    // volte. La stessa frase, verso la stessa lingua, si chiede UNA volta.
    // b.428 — E LA FIRMA SI SLACCIA SEMPRE, QUALUNQUE COSA SUCCEDA.
    // Collaudo di Luca: «la traduzione non e partita con il primo
    // messaggio». Il difetto non era il primo messaggio: era che bastava
    // UN singhiozzo — rete lenta, funzione fredda, un 429 — e la firma
    // restava armata su quella frase. Da quel momento riprovare la STESSA
    // frase non produceva piu niente: ne una chiamata, ne un errore, ne un
    // segno. Chi ci riprovava pensava che l'app fosse morta, e aveva
    // ragione a pensarlo.
    // Adesso la firma vale solo finche la richiesta e in volo: appena si
    // esce senza una traduzione, si slaccia.
    // b.465 — STESSA LINGUA: non si traduce, si mostra e si legge.
    // Ordine di Luca: «il sistema deve funzionare anche tra due lingue
    // uguali senza traduzione». Mandare la frase al traduttore per farsela
    // restituire uguale costa credito, aggiunge attesa, e il controllo di
    // qualita la respingerebbe come «non tradotta» — comparirebbe un errore
    // dove non c'e nessun errore.
    if (String(meta).split('-')[0] === String(miaLingua).split('-')[0]) {
      const mioN = ++numeroRef.current;
      setStoria((prima) => [...prima, { n: mioN, detto: t, resa: t }].sort((a, b) => a.n - b.n));
      if (testoRef.current.trim() === t) setTesto('');
      setStato('quieto');
      try { memSet(FATTA, '1'); } catch { /* niente memoria: pazienza */ }
      if (!dettoRef.current) parla(t, meta);
      return;
    }
    const impronta = `${meta}|${t}`;
    if (giaChiestaRef.current === impronta) return;
    giaChiestaRef.current = impronta;
    const slaccia = () => { if (giaChiestaRef.current === impronta) giaChiestaRef.current = ''; };
    const mio = ++numeroRef.current;
    setStato('traduco');
    try {
      const r = await fetch('/api/translate', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: t, sourceLang: miaLingua, targetLang: meta,
          sourceLangName: getLang(miaLingua)?.name || miaLingua,
          targetLangName: getLang(meta)?.name || meta,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!d?.translated) { slaccia(); if (mio === numeroRef.current) setStato('errore'); return; }
      // b.357 — QUANDO LA TRADUZIONE NON C'E, NON SI FINGE. Se il controllo
      // di qualita del server la respinge, la risposta torna col testo
      // ORIGINALE dentro: finiva nel registro come se fosse tradotto (nello
      // schermo di Luca comparivano frasi italiane sotto la bandiera tedesca)
      // e la voce le leggeva pure. Meglio dirlo e lasciar riprovare.
      if (d.validationFailed) {
        slaccia(); // riprovare la stessa frase deve essere possibile
        if (mio === numeroRef.current) setStato('errore');
        return;
      }
      // Se l'utente sta ANCORA ALLUNGANDO la stessa frase, questa resa e
      // parziale: si butta, arrivera quella piena. Se invece ha gia
      // iniziato la frase dopo, questa resta valida e si accoda comunque:
      // i messaggi si susseguono, non scompaiono (collaudo di Luca).
      const attuale = testoRef.current.trim();
      const staAllungando = attuale !== t && attuale.startsWith(t);
      // b.428 — anche qui si slaccia: questa resa si butta perche ne
      // arrivera una piu completa, ma se quella non arrivasse mai la
      // frase resterebbe impossibile da chiedere di nuovo.
      if (staAllungando) { slaccia(); if (mio === numeroRef.current) setStato('quieto'); return; }
      // in ordine di partenza, anche se le risposte arrivano scomposte
      setStoria((prima) => [...prima, { n: mio, detto: t, resa: d.translated }].sort((a, b) => a.n - b.n));
      // b.363 — la firma anti-doppione si azzera a risposta ACQUISITA: senza
      // questo, ripetere la stessa frase ("si", "ok", "grazie") non produceva
      // piu nulla — ne riga ne voce — e nessun segnale. Il doppione di b.357
      // resta comunque bloccato: timer e fine-dettatura scattano PRIMA che la
      // risposta arrivi, quindi trovano la firma ancora armata.
      slaccia();
      if (attuale === t) setTesto('');
      if (mio === numeroRef.current) setStato('quieto');
      try { memSet(FATTA, '1'); } catch { /* niente memoria: pazienza */ }
      // La voce parte da sola — ma NON mentre il microfono e aperto,
      // altrimenti il telefono detta a se stesso la propria traduzione.
      if (!dettoRef.current) parla(d.translated);
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') log.warn('[b.363] /api/translate:', e?.message || e);
      slaccia();   // b.428 — dopo un guasto si DEVE poter riprovare
      if (mio === numeroRef.current) setStato('errore'); }
  }, [miaLingua, meta, parla]);

  // b.445 — il pacchetto della lingua dell'ospite si carica appena la si
  // sceglie: senza, la scritta del suo tasto uscirebbe in inglese al primo
  // disegno e cambierebbe sotto gli occhi un attimo dopo.
  useEffect(() => { try { preloadLang(String(meta).split('-')[0]); } catch { /* il pacchetto arrivera al prossimo disegno */ } }, [meta]);

  // b.457 — qui c'era l'effetto di b.456 che spostava la meta quando
  // finiva sulla lingua gia parlata. Non serve piu: adesso lo decide
  // metaScelta, che e la sola porta da cui la meta esce — quindi la regola
  // vale sempre, non solo quando un effetto fa in tempo a scattare.
  useEffect(() => { testoRef.current = testo; }, [testo]);

  // Appena smetti di scrivere, la frase parte da sola.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!testo.trim()) return;
    timerRef.current = setTimeout(() => traduci(testo), 900);
    return () => clearTimeout(timerRef.current);
  }, [testo, traduci]);

  // l'ultima frase del registro sempre in vista
  useEffect(() => {
    const el = registroRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [storia, stato]);

  // ═══════════════════════════════════════════════════════════════
  // b.445 — IL SENSO CONTRARIO: parla l'ospite.
  //
  // Ordine di Luca: «deve funzionare all'opposto, cioe deve poter parlare e
  // cosi tradurre e mostrare nel container nella mia lingua, con colore
  // diverso».
  //
  // E' una via SEPARATA da quella mia, non un interruttore su quella che
  // c'era: la frase dell'ospite non deve finire nel campo di scrittura (che
  // e mio) ne cancellarlo mentre sto scrivendo. Percio ha il suo
  // riconoscimento, il suo accumulatore e la sua chiamata.
  // ═══════════════════════════════════════════════════════════════
  const traduciOspite = useCallback(async (grezzo) => {
    const t = String(grezzo || '').trim();
    if (!t) return;
    // b.465 — stessa lingua anche qui: l'ospite parla la mia, si mostra e basta
    if (String(meta).split('-')[0] === String(miaLingua).split('-')[0]) {
      const mioN = ++numeroRef.current;
      setStoria((prima) => [...prima, { n: mioN, detto: t, resa: t, inverso: true }].sort((a, b) => a.n - b.n));
      setStato('quieto');
      parla(t, miaLingua);
      return;
    }
    setStato('traduco');
    const mio = ++numeroRef.current;
    try {
      const r = await fetch('/api/translate', { signal: AbortSignal.timeout(30000),
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: t, sourceLang: meta, targetLang: miaLingua,
          sourceLangName: getLang(meta)?.name || meta,
          targetLangName: getLang(miaLingua)?.name || miaLingua,
        }),
      });
      const d = await r.json().catch(() => null);
      // stessa regola della via mia: se non c'e traduzione non si finge
      if (!d?.translated || d.validationFailed) {
        if (mio === numeroRef.current) setStato('errore');
        return;
      }
      setStoria((prima) => [...prima, { n: mio, detto: t, resa: d.translated, inverso: true }]
        .sort((a, b) => a.n - b.n));
      if (mio === numeroRef.current) setStato('quieto');
      // la risposta e nella MIA lingua: si legge con la MIA voce
      parla(d.translated, miaLingua);
    } catch (e) {
      if (e?.name !== 'AbortError') log.warn('[b.445] /api/translate ospite:', e?.message || e);
      if (mio === numeroRef.current) setStato('errore');
    }
  }, [meta, miaLingua, parla]);

  // Si tiene premuto: si apre parlando, si chiude lasciando. E' il gesto
  // piu chiaro per chi non ha mai visto l'app — e chi hai davanti non l'ha
  // mai vista.
  const ospiteGiu = useCallback(() => {
    if (ospiteParla) return;
    // b.603 — terza copia di SpeechRecognition → lib/dettatura.js (b.432).
    // L'ospite non vede scrivere: si usa solo il definitivo, a fine ascolto.
    const d = ascoltaDettatura({
      lingua: meta,
      suFine: (raccolto) => {
        setOspiteParla(false);
        recOspiteRef.current = null;
        if (raccolto) traduciOspite(raccolto);
      },
    });
    if (!d) { setOspiteParla(false); return; }
    recOspiteRef.current = d;
    setOspiteParla(true);
    vibrate(8);
  }, [ospiteParla, meta, traduciOspite]);

  const ospiteSu = useCallback(() => {
    if (!ospiteParla) return;
    try { recOspiteRef.current?.ferma(); }
    catch { /* il riconoscimento era gia fermo: fermarlo due volte non e un guasto */ }
  }, [ospiteParla]);

  // ── LA DETTATURA (trascrizione dal vivo, stessa via di b.352) ──
  const detta = useCallback(() => {
    if (detto) {
      try { recRef.current?.ferma(); } catch { /* il riconoscimento era gia fermo: fermarlo due volte non e un guasto */ }
      setDetto(false); dettoRef.current = false;
      // b.428, ordine di Luca: «se clicco sul microfono registro, quando lo
      // clicco di nuovo deve inviare il messaggio e leggerlo». Finora a
      // mandarlo era `onend`, cioe un avviso del BROWSER — e su alcuni
      // telefoni quell'avviso arriva tardi, o non arriva. Il secondo tocco
      // non e un suggerimento: e un ordine, e deve valere subito.
      // Chiamarlo da tutti e due i posti non fa danni: la stessa frase
      // verso la stessa lingua si chiede una volta sola (la firma sopra),
      // e chi arriva secondo trova la porta gia chiusa.
      clearTimeout(timerRef.current);
      setTesto((attuale) => { if (attuale.trim()) traduci(attuale); return attuale; });
      return;
    }
    // b.603 — quarta copia di SpeechRecognition → lib/dettatura.js (b.432).
    const d = ascoltaDettatura({
      lingua: miaLingua,
      inizio: testo,
      suTesto: (t) => setTesto(t),
      suFine: () => {
        setDetto(false); dettoRef.current = false;
        recRef.current = null;
        // il microfono si e chiuso: l'ultima frase parte SUBITO, con la voce.
        // E si disarma il timer della scrittura, altrimenti la stessa frase
        // ripartirebbe una seconda volta (b.357).
        clearTimeout(timerRef.current);
        setTesto((attuale) => { if (attuale.trim()) traduci(attuale); return attuale; });
      },
    });
    if (!d) { setDetto(false); dettoRef.current = false; return; }
    recRef.current = d;
    setDetto(true); dettoRef.current = true;
    vibrate(8);
  }, [detto, testo, miaLingua, traduci]);

  useEffect(() => () => {
    try { recRef.current?.ferma(); } catch { /* il riconoscimento era gia fermo: fermarlo due volte non e un guasto */ }
    try { recOspiteRef.current?.ferma(); } catch { /* b.445 — anche quello dell'ospite */ }
    try { audioRef.current?.pause(); } catch { /* la voce era gia ferma: fermarla due volte non e un guasto */ }
    clearTimeout(timerRef.current);
  }, []);

  // ═══ b.430 — LA DESTINAZIONE, copiata da TaxiTalk riga per riga ═══
  // Dove sei: serve solo a far salire in cima i posti vicini. Se il
  // telefono non la da, la ricerca funziona lo stesso.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setMioPunto({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {}, { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const cercaIndirizzo = useCallback(async (q) => {
    if (!q || q.trim().length < 2) return;
    setCercando(true); setErroreDove(''); setRisultati([]);
    try {
      const enc = encodeURIComponent(q.trim());
      const vicino = mioPunto
        ? `&viewbox=${mioPunto.lon - 0.5},${mioPunto.lat + 0.5},${mioPunto.lon + 0.5},${mioPunto.lat - 0.5}`
        : '';
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${enc}${vicino}&format=json&limit=5&addressdetails=1`,
        { signal: AbortSignal.timeout(10000), headers: { 'Accept-Language': meta || 'en' } }
      );
      if (!res.ok) throw new Error('geocoding');
      const dati = await res.json().catch(() => null);
      if (!dati) { setErroreDove(L('searchError')); setCercando(false); return; }
      if (dati.length === 0) setErroreDove(L('placeNotFound'));
      else if (dati.length === 1) {
        setMeta2({ lat: parseFloat(dati[0].lat), lon: parseFloat(dati[0].lon), displayName: dati[0].display_name });
      } else {
        setRisultati(dati.map((p) => ({ lat: parseFloat(p.lat), lon: parseFloat(p.lon), displayName: p.display_name })));
      }
    } catch (e) {
      if (e?.name !== 'AbortError') log.warn('[b.430] nominatim:', e?.message || e);
      setErroreDove(L('searchError'));
    }
    setCercando(false);
  }, [mioPunto, meta, L]);

  // b.248 — cambiare il testo dopo aver scelto invalida la scelta: campo,
  // mappa e QR non possono dire due cose diverse.
  const cambiaDove = useCallback((v) => { setDove(v); setMeta2(null); }, []);
  const scegliPosto = useCallback((r) => {
    vibrate(12); setMeta2(r); setRisultati([]);
    setDove(r.displayName.split(',').slice(0, 3).join(', '));
  }, []);

  const indirizzoMappa = meta2 ? buildMapsUrl({ lat: meta2.lat, lng: meta2.lon, normalizedAddress: meta2.displayName }, 'google') : '';
  // b.483 — IL CODICE LO DISEGNIAMO NOI, non piu un server di terzi.
  // Prima l'indirizzo dove stai andando usciva dal telefono e finiva
  // dentro una richiesta a un'azienda che non conosciamo; e se quel
  // server era lento o irraggiungibile dalla rete di quel taxi, il
  // codice non compariva affatto. La libreria era gia in casa.
  const [qrSrc, setQrSrc] = useState('');
  useEffect(() => {
    let vivo = true;
    if (!indirizzoMappa) { setQrSrc(''); return undefined; }
    immagineQR(indirizzoMappa, 240, 8).then((dato) => { if (vivo) setQrSrc(dato); });
    return () => { vivo = false; };
  }, [indirizzoMappa]);
  const condividiMappa = useCallback(async () => {
    if (!indirizzoMappa) return; vibrate(12);
    if (navigator.share) { try { await navigator.share({ text: meta2?.displayName || '', url: indirizzoMappa }); } catch { /* l'utente ha annullato la condivisione: nessuna azione necessaria */ } }
    else { try { await navigator.clipboard.writeText(indirizzoMappa); } catch { /* il browser non concede gli appunti in questo contesto: l'indirizzo resta comunque a schermo */ } }
  }, [indirizzoMappa, meta2]);

  const micDisponibile = dettaturaDisponibile();   // b.603
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.1)'}`;
  const ultimaResa = storia.length ? storia[storia.length - 1].resa : '';

  // ═══════════════════════════════════════════════════════════════
  // b.422/b.423 — LA MISURA DEL TESTO, E CHI LA DECIDE.
  //
  // Ordine di Luca: «il carattere che stiamo usando per mostrare al driver
  // il messaggio va ridotto leggermente, verifica se puoi aggiungere un
  // tasto per aumentare o ridurre il carattere e permetti di salvare
  // l'impostazione nelle preferenze dell'utente».
  //
  // Poi, guardando lo schermo: «la dimensione della seconda immagine
  // secondo me e ottimale per lingue occidentali, e una via di mezzo
  // invece per medio oriente e asia».
  //
  // Quindi la misura ha TRE pezzi, e ognuno risponde a una cosa diversa:
  //  1. una base, scesa da 34-58 a 30-52 come chiesto;
  //  2. uno SCONTO PER ALFABETO: un ideogramma cinese o giapponese porta
  //     dentro un carattere solo quanto una sillaba intera, e alla stessa
  //     misura in punti pesa molto di piu; l'arabo e l'ebraico stanno in
  //     mezzo — compatti in larghezza ma con segni sopra e sotto che
  //     vogliono aria. Un numero solo per tutti e due, come ha detto lui:
  //     una via di mezzo, non la misura piena e non quella piccola.
  //  3. due tastini che spostano di un passo, e il passo si SALVA nelle
  //     preferenze: si decide una volta, non a ogni corsa.
  // ═══════════════════════════════════════════════════════════════
  const PASSO_MIN = -2, PASSO_MAX = 3;
  const passo = Math.max(PASSO_MIN, Math.min(PASSO_MAX, Number(prefs?.testoGrande) || 0));

  // Le lingue che scrivono piu denso di quelle occidentali. Non e un
  // giudizio sulla lingua: e quanto inchiostro sta in un carattere.
  const ALFABETI_DENSI = ['zh', 'zh-TW', 'ja', 'ko', 'th', 'hi', 'bn', 'ta', 'ar', 'he'];
  const denso = ALFABETI_DENSI.includes(String(meta)) || ALFABETI_DENSI.includes(String(meta).split('-')[0]);
  const fattore = (1 + passo * 0.14) * (denso ? 0.88 : 1);

  const cambiaMisura = (delta) => {
    const nuovo = Math.max(PASSO_MIN, Math.min(PASSO_MAX, passo + delta));
    if (nuovo === passo) return;
    vibrate(6);
    savePrefs?.({ ...prefs, testoGrande: nuovo });
  };
  const misuraTestone = capovolto
    ? `clamp(${Math.round(30 * fattore)}px, ${(7.2 * fattore).toFixed(1)}vw, ${Math.round(52 * fattore)}px)`
    : `${Math.round(26 * fattore)}px`;
  const misuraVecchie = capovolto ? `${Math.round(20 * fattore)}px` : `${Math.round(15 * fattore)}px`;

  const vuoto = storia.length === 0 && stato !== 'traduco';

  // ── I TASTI SI TOCCANO CON UN DITO, NON CON UNO STUZZICADENTI ──
  // b.423, collaudo di Luca: «i tasti devono essere piu grandi perche in un
  // telefono le dita fanno fatica». Erano 34. Quarantaquattro e la misura
  // sotto la quale un dito comincia a sbagliare bersaglio.
  const TASTO = 44;
  const tondino = (attivo) => ({
    width: TASTO, height: TASTO, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
    border: attivo ? `1.5px solid ${C.accent || '#5b8cff'}` : bordo,
    background: attivo ? `${C.accent || '#5b8cff'}22` : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT, padding: 0,
  });

  // ── LA TARGHETTA DELLE LINGUE: da dove parti, dove vai. In un colpo. ──
  const targhettaLingue = (
    <button onClick={() => { vibrate(6); setScegliLingua((v) => !v); }}
      aria-expanded={scegliLingua}
      aria-label={`${getLang(miaLingua)?.name || miaLingua} → ${getLang(meta)?.name || meta}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: TASTO,
        borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 500,
        border: scegliLingua ? `1.5px solid ${C.accent || '#5b8cff'}` : bordo,
        background: scegliLingua ? `${C.accent || '#5b8cff'}22` : 'rgba(255,255,255,0.04)',
        color: C.textPrimary }}>
      {/* Se una lingua non ha bandiera si scrive il suo codice: mettere
          un'emoji di ripiego e vietato in questa interfaccia (le icone
          sono mono, e una prova di guardia lo controlla). */}
      <span>{getLang(miaLingua)?.flag || String(miaLingua).toUpperCase()}</span>
      <span style={{ color: C.textMuted, fontSize: 13 }}>{'→'}</span>
      <span>{getLang(meta)?.flag || String(meta).toUpperCase()}</span>
    </button>
  );

  // ── LA SCELTA DELLA LINGUA: prende il posto della lettura, non la spinge ──
  // b.424 — e la STESSA lista della home, lo stesso componente, con le
  // stesse frecce, lo stesso trascinamento col dito e lo stesso elenco
  // completo con la ricerca dietro il tastino a righine. Cambia solo cosa
  // sceglie: qui la lingua di ARRIVO, sulla home quella che parli tu.
  // La voce in fondo all'elenco porta alle impostazioni, esattamente come
  // sulla home: e la stessa riga, non una copia che fa finta.
  const bloccoLingue = (
    <div key="lingue" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex',
      flexDirection: 'column', justifyContent: 'center', padding: '4px 0' }}>
      <CarouselLingue
        selezionata={meta}
        // il carosello consegna la LINGUA intera, non il suo codice: cosi
        // fa anche sulla home. Prenderla per un codice significherebbe
        // mettere un oggetto dove va una sigla, e la meta diventerebbe
        // una lingua che non esiste — in silenzio.
        onScegli={(lingua) => { setMeta(lingua.code); setScegliLingua(false); }}
        onLinguaMenu={() => { vibrate(); setView?.('settings'); }}
        C={C} L={L} />
    </div>
  );

  // ── DOVE VAI: campo, mappa, QR. Copiato da TaxiTalk, stessa resa. ──
  // Prende il posto della lettura come le lingue: una cosa per volta,
  // sempre nello stesso posto. Il QR e la cosa piu utile di tutte —
  // chi hai davanti lo inquadra e gli si apre la SUA mappa, nella sua
  // lingua, senza installare niente.
  const bloccoDove = (
    <div key="dove" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none',
      display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={dove} onChange={(e) => cambiaDove(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && dove.trim()) cercaIndirizzo(dove); }}
          placeholder={L('searchAddress')} aria-label={L('searchAddress')}
          style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', border: bordo,
            borderRadius: 16, padding: '15px 14px', color: C.textPrimary, fontSize: 16,
            fontFamily: FONT, outline: 'none' }} />
        <button onClick={() => dove.trim() && cercaIndirizzo(dove)} disabled={!dove.trim() || cercando}
          aria-label={L('search')}
          style={{ height: 54, padding: '0 18px', borderRadius: 16, flexShrink: 0, cursor: dove.trim() ? 'pointer' : 'default',
            border: dove.trim() ? `1px solid rgba(91,140,255,0.34)` : bordo,
            background: dove.trim() ? 'rgba(91,140,255,0.13)' : 'rgba(255,255,255,0.05)',
            color: dove.trim() ? (C.accent || '#5b8cff') : C.textMuted,
            fontFamily: FONT, fontSize: 14, fontWeight: 500, opacity: dove.trim() ? 1 : 0.5 }}>
          {cercando ? '…' : L('search')}
        </button>
      </div>

      {risultati.length > 0 && (
        <div style={{ border: bordo, borderRadius: 14, overflow: 'hidden' }}>
          {risultati.map((r, i) => (
            <button key={i} onClick={() => scegliPosto(r)}
              style={{ width: '100%', textAlign: 'left', padding: '13px 14px', background: 'none',
                border: 'none', borderBottom: i < risultati.length - 1 ? bordo : 'none',
                color: C.textPrimary, fontSize: 13.5, fontFamily: FONT, cursor: 'pointer', lineHeight: 1.4 }}>
              <b>{r.displayName.split(',').slice(0, 2).join(',')}</b>
              <div style={{ fontSize: 11.5, color: C.textMuted }}>{r.displayName.split(',').slice(2, 5).join(',')}</div>
            </button>
          ))}
        </div>
      )}
      {erroreDove && <div style={{ fontSize: 12.5, color: '#ff5470', fontFamily: FONT }}>{erroreDove}</div>}

      {meta2 && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TaxiMap lat={meta2.lat} lng={meta2.lon} altezza={160} raggio={16} comandi={false} />
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
              {meta2.displayName.split(',').slice(0, 3).join(',')}
            </div>
          </div>
          <div style={{ width: 138, flexShrink: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: bordo,
            borderRadius: 16, padding: '12px 10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- il codice
                e disegnato qui dentro e vive gia nell'indirizzo: non c'e
                niente da scaricare, quindi niente da ottimizzare */}
            <img src={qrSrc} alt="" width={108} height={108}
              style={{ borderRadius: 10, background: '#fff', padding: 6, display: 'block' }} />
            <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 1.35, fontFamily: FONT }}>
              {L('taxiScanOpensMap')}
            </div>
            <button onClick={condividiMappa}
              style={{ fontSize: 12, fontWeight: 500, color: C.accent || '#5b8cff', background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 6 }}>
              {L('taxiShareLink')}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // L'AREA DI LETTURA — ed e l'UNICA cosa che si ribalta.
  //
  // b.423, collaudo di Luca: «mantieni il campo di testo in basso e
  // ribalta solo il testo da leggere». Prima si giravano di posto i due
  // blocchi interi; adesso la riga per scrivere resta dov'e, dritta e
  // usabile, e a girare di centottanta gradi e soltanto cio che l'altro
  // deve leggere. Cosi si continua a scrivere mentre lui legge, senza
  // chiudere e riaprire niente.
  //
  // E il testo sta IN MEZZO, non schiacciato in fondo: due distanziatori
  // che si mangiano lo spazio libero lo centrano quando ce n'e, e si
  // ritirano da soli quando il testo e lungo — cosi si puo comunque
  // scorrere. Con `justify-content: center` la parte che esce sopra
  // diventerebbe irraggiungibile (era gia successo, vedi b.357).
  // ═══════════════════════════════════════════════════════════════
  const bloccoLettura = (
    <div key="letto" ref={registroRef} style={{
      flex: '1 1 auto', minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none',
      display: 'flex', flexDirection: 'column', gap: 14,
      padding: capovolto ? '10px 14px' : '4px 2px',
      transform: capovolto ? 'rotate(180deg)' : 'none',
    }}>
      <div aria-hidden style={{ marginTop: 'auto' }} />

      {/* b.445 — VIA il segnaposto «Qui la traduzione, testo e voce»
          (ordine di Luca: «non serve»). Aveva ragione: una frase che spiega
          cosa comparira e il segno che il disegno non si spiega da solo, ed
          e la regola 03 del prontuario. Adesso il vuoto resta vuoto, e a
          dire cosa fare c'e il tasto dell'ospite qui sopra. */}

      {storia.map((riga, i) => {
        const scelta = sceltaIdx === i;
        return (
        <div key={i}
          role="button"
          tabIndex={0}
          aria-pressed={scelta}
          onClick={() => { vibrate(6); setSceltaIdx(scelta ? null : i); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSceltaIdx(scelta ? null : i); } }}
          style={{
          // b.356 — «piu grande il testo»: l'ultima frase e un testone,
          // le precedenti restano leggibili ma si fanno da parte.
          // b.422 — la misura ora la decide chi guarda, e resta decisa.
          fontSize: i === storia.length - 1 ? misuraTestone : misuraVecchie,
          fontWeight: 500, lineHeight: 1.25,
          // b.445 — le frasi dell'OSPITE in un colore diverso (ordine di
          // Luca). Non e decorazione: senza, chi legge non sa piu chi ha
          // detto cosa, e in una conversazione a due sensi e l'unica
          // informazione che conta davvero.
          color: riga.inverso
            ? (i === storia.length - 1 ? (C.accent2 || '#38e1ff') : `${C.accent2 || '#38e1ff'}88`)
            : (i === storia.length - 1 ? C.textPrimary : C.textMuted),
          textAlign: capovolto ? 'center' : 'left',
          fontFamily: FONT, overflowWrap: 'anywhere',
          // b.536 — la frase scelta si vede: un velo di accento e una
          // barra sul fianco. Niente riquadro pieno, che spezzerebbe la
          // colonna di lettura; e il colore di chi ha parlato resta.
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          borderRadius: 10,
          padding: scelta ? '6px 10px' : '0',
          margin: scelta ? '-6px -10px' : 0,
          background: scelta ? `${C.accent || '#5b8cff'}1f` : 'transparent',
          boxShadow: scelta ? `inset 3px 0 0 ${C.accent || '#5b8cff'}` : 'none',
          transition: 'background 0.15s',
        }}>
          {riga.resa}
        </div>
        );
      })}
      {stato === 'traduco' && (
        <div style={{ fontSize: capovolto ? 28 : 18, color: C.textMuted, fontFamily: FONT,
          textAlign: capovolto ? 'center' : 'left' }}>…</div>
      )}
      {stato === 'errore' && <div style={{ color: '#ff5470', fontSize: 12.5, fontFamily: FONT }}>{L('speakNowError')}</div>}
      {/* b.417 — la traduzione e arrivata, la voce no. Non e l'errore della
          traduzione (quella si legge, li sopra): e un avviso, e va detto,
          perche restare zitti senza motivo e il difetto che stiamo chiudendo. */}
      {stato === 'muto' && <div style={{ color: C.textSecondary || 'rgba(255,255,255,0.6)', fontSize: 12.5, fontFamily: FONT }}>{L('speakNowVoiceless')}</div>}

      <div aria-hidden style={{ marginBottom: 'auto' }} />
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // LA RIGA DELLA VOCE — un microfono solo, in mezzo, sempre li.
  //
  // b.424, collaudo di Luca: «il secondo microfono in basso deve essere
  // solo una freccia di invio testo, il microfono in mezzo fa gia tutto
  // quello che serve per l'audio». Aveva ragione: erano due comandi per
  // la stessa cosa, e il secondo faceva dubitare del primo.
  //
  // Sta in una riga sua, ad altezza fissa, fra cio che si legge e cio che
  // si scrive. Non cresce e non rimpicciolisce quando arriva una
  // traduzione: se cambiasse misura sposterebbe tutto il resto, ed e la
  // regola che non si tocca.
  // Accanto, l'altoparlante per farla ripetere: le cose della voce stanno
  // insieme, quelle del testo stanno insieme.
  // ═══════════════════════════════════════════════════════════════
  const bloccoVoce = (
    <div key="voce" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, flexShrink: 0, padding: '2px 0' }}>
      <span style={{ width: 54 }} />
      <button onClick={detta} aria-pressed={detto} aria-label={L('dictateWord')}
        disabled={!micDisponibile}
        // b.445, ordine di Luca: «il pulsante microfono deve essere UGUALE a
        // quello della home, con dentro il disegno mic BIANCO». Stesse
        // misure e stesso alone della Home (168 col cerchio, 30 l'icona), e
        // l'icona bianca invece che azzurra. Quando registra resta rosso —
        // quello non e uno stile, e lo stato: dice che il microfono e vivo.
        style={vesteMicrofono({ misura: 168, acceso: detto, spento: !micDisponibile, C: S?.colors }).cerchio}>
        <Icon name="mic" size={vesteMicrofono({ misura: 168, C: S?.colors }).icona}
          color={vesteMicrofono({ misura: 168, acceso: detto, C: S?.colors }).coloreIcona} />
      </button>
      {/* b.536, ordine di Luca: «in fondo aggiungi una icona play che
          ripete il testo con la voce». Il tasto c'era gia e leggeva sempre
          l'ultima frase; ora, se ne hai SCELTA una, ripete QUELLA — e con
          la voce giusta: le frasi dell'ospite si rileggono nella mia
          lingua, le mie nella sua. Scelta accesa: il tasto si accende
          anche lui, cosi si vede che sono la stessa cosa. */}
      {(() => {
        const rigaScelta = sceltaIdx != null ? storia[sceltaIdx] : null;
        const daLeggere = rigaScelta ? rigaScelta.resa : ultimaResa;
        const linguaLettura = rigaScelta ? (rigaScelta.inverso ? miaLingua : meta) : undefined;
        return (
          <button onClick={() => parla(daLeggere, linguaLettura)} disabled={!daLeggere}
            aria-label={L('listenWord')} title={L('listenWord')}
            style={{ width: 54, height: 54, borderRadius: 999, flexShrink: 0, padding: 0,
              border: rigaScelta ? `1px solid ${C.accent || '#5b8cff'}` : bordo,
              background: rigaScelta ? `${C.accent || '#5b8cff'}1f` : 'rgba(255,255,255,0.06)',
              opacity: daLeggere ? 1 : 0.35, cursor: daLeggere ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="speaker" size={22} color={daLeggere ? (C.accent || '#5b8cff') : C.textMuted} />
          </button>
        );
      })()}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // LA RIGA DEL TESTO — il campo, e una freccia per mandarlo.
  //
  // b.424 — la freccia non aggiunge una strada nuova: la frase parte gia
  // da sola novecento millesimi dopo che smetti di scrivere. Serve a non
  // dover aspettare, e a dare un posto dove premere a chi si aspetta di
  // premere qualcosa. Non si ribalta mai: si scrive mentre l'altro legge.
  // ═══════════════════════════════════════════════════════════════
  const bloccoTesto = (
    <div key="testo" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
      <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={1}
        placeholder={L('writeWord')} aria-label={L('writeWord')}
        style={{ flex: 1, padding: '15px 14px', borderRadius: 16,
          border: detto ? '2px solid #ff5470' : bordo,
          background: 'rgba(255,255,255,0.05)', color: C.textPrimary, fontSize: 16,
          fontFamily: FONT, resize: 'none', outline: 'none', boxSizing: 'border-box',
          minHeight: 54, maxHeight: 110 }} />
      <button onClick={() => { if (testo.trim()) { vibrate(8); traduci(testo); } }}
        disabled={!testo.trim()} aria-label={L('sendWord')} title={L('sendWord')}
        style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0, padding: 0,
          border: testo.trim() ? `1px solid rgba(91,140,255,0.34)` : bordo,
          background: testo.trim() ? 'rgba(91,140,255,0.13)' : 'rgba(255,255,255,0.05)',
          opacity: testo.trim() ? 1 : 0.4, cursor: testo.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="send" size={22} color={testo.trim() ? (C.accent || '#5b8cff') : C.textMuted} />
      </button>
    </div>
  );

  return (
    <div style={{
      width: '100%', boxSizing: 'border-box',
      // b.357 — IL CONTENITORE RESTA DENTRO LO SCHERMO (collaudo di Luca:
      // «mantieni la chat e il contenitore all'interno dello schermo»).
      // b.423 — MA USA TUTTA L'ALTEZZA CHE C'E (collaudo di Luca: «penso
      // poi che dovresti usare tutta l'altezza disponibile»). Prima ne
      // lasciava fuori duecentodieci punti e sopra il testo restava una
      // fascia vuota grande quanto mezzo schermo.
      // b.424 — PAGINA INTERA (ordine di Luca). Non e piu un riquadro
      // dentro la home con i suoi bordi e i suoi margini: la home si e
      // girata, e questo e il retro del foglio. Quindi niente cornice —
      // riempie, e lascia in fondo solo lo spazio della barra di sistema.
      flex: '1 1 auto',
      minHeight: 0,
      display: 'flex', flexDirection: 'column', gap: 10,
      overflow: 'hidden',
      padding: '10px 20px calc(100px + env(safe-area-inset-bottom))',
    }}>
      {/* ── LA TESTATA. Resta DRITTA anche col ribaltone (a girare e solo
             l'area di lettura), quindi i tastini della misura si toccano
             mentre l'altro sta leggendo. ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* b.424 — LA FRECCIA PER TORNARE, in alto a sinistra dove la
            cercano tutti. Prima era una ✕ a destra: una ✕ dice «chiudi e
            butta via», una freccia dice «torna indietro» — e siccome il
            foglio si gira, tornare e proprio quello che succede. */}
        <button onClick={() => { try { memSet(FATTA, '1'); } catch { /* la memoria locale non e disponibile: si torna lo stesso */ } onChiudi?.(); }}
          aria-label={L('backWord')} title={L('backWord')}
          style={{ ...tondino(false), border: 'none' }}>
          <Icon name="back" size={22} color={C.textPrimary} />
        </button>
        {targhettaLingue}
        <span style={{ flex: 1 }} />
        {/* la misura del testo compare solo quando c'e del testo da misurare */}
        {!vuoto && (<>
          <button onClick={() => cambiaMisura(-1)} disabled={passo <= PASSO_MIN}
            aria-label={L('textSmaller')} title={L('textSmaller')}
            style={{ ...tondino(false), opacity: passo <= PASSO_MIN ? 0.35 : 1,
              color: C.textSecondary, fontSize: 15, fontWeight: 500 }}>A−</button>
          <button onClick={() => cambiaMisura(1)} disabled={passo >= PASSO_MAX}
            aria-label={L('textBigger')} title={L('textBigger')}
            style={{ ...tondino(false), opacity: passo >= PASSO_MAX ? 0.35 : 1,
              color: C.textSecondary, fontSize: 19, fontWeight: 500 }}>A+</button>
        </>)}
        {/* b.430 — DOVE VAI: il tasto che mancava. Apre campo, mappa e QR. */}
        <button onClick={() => { vibrate(6); setScegliDove((v) => !v); setScegliLingua(false); }}
          aria-pressed={scegliDove} aria-label={L('taxiWhereTo')} title={L('taxiWhereTo')}
          style={tondino(scegliDove)}>
          {/* b.458, ordine di Luca: «basta usare l'icona gialla di taxi e non
              di target nell'angolo». Il bersaglio non diceva niente a
              nessuno; il taxi dice a colpo d'occhio a cosa serve quel tasto
              — dire dove vuoi andare, e mandarci il tassista col QR. Ed e
              lui che rende inutile la voce TaxiTalk nel menu del piu: la
              stessa cosa, ma qui, dove si sta gia parlando. */}
          <span style={{ color: scegliDove ? (S?.colors?.goldAccent || '#ffc44d') : C.textMuted, lineHeight: 0 }}>
            <IconCar size={21} />
          </span>
        </button>
        <button onClick={() => { vibrate(6); setCapovolto((v) => !v); }}
          aria-pressed={capovolto} aria-label={L('faceToFaceWord')} title={L('faceToFaceWord')}
          style={tondino(capovolto)}>
          <Icon name="swap" size={19} color={capovolto ? (C.accent || '#5b8cff') : C.textMuted} />
        </button>
      </div>

      {/* ═══ b.445 — IL TASTO DELL'OSPITE, in alto e centrato ═══
          Ordine di Luca: «in alto nella pagina centrato devi mettere un
          bottone con la bandiera e la scritta SCHIACCIA E PARLA nella
          lingua dell'ospite».
          La scritta e in lingua VERA, non tradotta a mano: tLingua(meta,
          'holdToSpeak') legge la stessa chiave gia presente in tutti e
          trentotto i pacchetti. Chi hai davanti la trova nella sua lingua
          senza che nessuno abbia scritto niente a mano.
          Si tiene premuto, si parla, si lascia. E quando la pagina e
          capovolta gira anche lui, se no l'ospite se lo trova sottosopra
          proprio mentre e il suo turno di leggerlo. */}
      <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, padding: '10px 0 2px' }}>
        <button
          onPointerDown={ospiteGiu}
          onPointerUp={ospiteSu}
          onPointerLeave={ospiteSu}
          onPointerCancel={ospiteSu}
          aria-pressed={ospiteParla}
          aria-label={`${getLang(meta)?.name || meta}: ${tLingua(meta, 'holdToSpeak')}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            minHeight: TASTO, padding: '0 18px', borderRadius: 999,
            cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 500,
            border: ospiteParla
              ? `1.5px solid ${C.accent2 || '#38e1ff'}`
              : `1px solid ${(C.accent2 || '#38e1ff')}55`,
            background: ospiteParla
              ? `${C.accent2 || '#38e1ff'}22`
              : `${C.accent2 || '#38e1ff'}12`,
            color: C.accent2 || '#38e1ff',
            transform: capovolto ? 'rotate(180deg)' : 'none',
            WebkitTapHighlightColor: 'transparent', touchAction: 'none',
          }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>
            {getLang(meta)?.flag || String(meta).toUpperCase()}
          </span>
          <span>{tLingua(meta, 'holdToSpeak')}</span>
        </button>
      </div>

      {/* IL CENTRO: le lingue quando le chiedi, altrimenti cio che si legge.
          Una cosa per volta, sempre nello stesso posto: niente si sposta. */}
      {scegliLingua ? bloccoLingue : scegliDove ? bloccoDove : bloccoLettura}

      {/* Sotto, sempre e in quest'ordine: la voce, poi il testo. Nessuna
          delle due si ribalta — si parla e si scrive mentre l'altro legge. */}
      {!scegliLingua && !scegliDove && bloccoVoce}
      {!scegliLingua && !scegliDove && bloccoTesto}
    </div>
  );
}
