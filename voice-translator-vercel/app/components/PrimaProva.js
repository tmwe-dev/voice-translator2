'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext.js';
import { memDel, memSet } from '../lib/memoria.js';
import { LANGS, getLang, FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { parlaColSistema } from '../lib/voceSistema.js'; // b.417

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

export default function PrimaProva({ onChiudi }) {
  const { L, S, prefs, savePrefs } = useApp();
  const C = S?.colors || {};

  const miaLingua = prefs?.lang || 'it';
  const [meta, setMeta] = useState(() => (RAPIDE.find((m) => m.split('-')[0] !== (prefs?.lang || 'it').split('-')[0]) || 'en'));
  const [testo, setTesto] = useState('');
  // b.356 — i messaggi SI SUSSEGUONO, non scompaiono (collaudo di Luca):
  // ogni frase tradotta resta nel registro, la nuova si accoda sotto.
  const [storia, setStoria] = useState([]);
  const [stato, setStato] = useState('quieto'); // quieto | traduco | parlo | errore | muto (b.417: la traduzione c'e, la voce no)
  const [capovolto, setCapovolto] = useState(false); // FACCIA A FACCIA
  const [detto, setDetto] = useState(false);         // microfono acceso
  // b.422 — LA PAGINA HA UNA COSA SOLA A SCHERMO (disegno approvato da Luca,
  // template/parla-ora.html, strada A). Chi apre trova un microfono e due
  // bandiere. Le lingue si aprono quando servono, e prendono SEMPRE lo
  // stesso posto — non spingono giu niente.
  // b.423 — VIA L'ICONA TASTIERA (collaudo di Luca: «l'icona tastiera non
  // serve, eliminala e lascia sempre un campo di testo disponibile per
  // scrivere»). Un comando che apre una cosa che poteva star li da sola e
  // un tocco chiesto per niente.
  const [scegliLingua, setScegliLingua] = useState(false); // la fila delle lingue e a schermo
  const recRef = useRef(null);
  const dettoRef = useRef(false); // per decidere la voce senza rilegare gli effetti
  const timerRef = useRef(null);
  const numeroRef = useRef(0);
  const testoRef = useRef(''); // specchio del campo, per decidere senza rincorrere lo stato
  const giaChiestaRef = useRef(''); // l'ultima frase gia chiesta: non si chiede due volte
  const audioRef = useRef(null);
  const registroRef = useRef(null);

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
  const parla = useCallback(async (daLeggere) => {
    const t = String(daLeggere || '').trim();
    if (!t) return;
    setStato('parlo');
    const tgt = getLang(meta);
    const lingua = tgt?.speech || meta;

    // Chiede una voce a una rotta. Torna il suono, oppure null quando non
    // c'e NIENTE DA SUONARE — che comprende il caso «200 con zero byte».
    const chiediVoce = async (rotta) => {
      try {
        const v = await fetch(rotta, {
          // b.363 — prima non c'era tetto di attesa: se la rete restava muta
          // la chiamata pendeva per sempre e l'utente non vedeva mai un esito.
          signal: AbortSignal.timeout(30000),
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, langCode: lingua }),
        });
        if (!v.ok) return null;
        const suono = await v.blob();
        return suono && suono.size > 0 ? suono : null;
      } catch (e) {
        // b.363 — prima questo guasto non lasciava traccia da nessuna parte:
        // nel registro non compariva nulla, e il motivo vero (rete caduta,
        // attesa scaduta, credito finito, server rotto) restava irrecuperabile.
        if (e?.name !== 'AbortError') console.warn(`[b.417] ${rotta}:`, e?.message || e);
        return null;
      }
    };

    let suono = await chiediVoce('/api/tts-elevenlabs');
    if (!suono) suono = await chiediVoce('/api/tts-edge');

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
    const impronta = `${meta}|${t}`;
    if (giaChiestaRef.current === impronta) return;
    giaChiestaRef.current = impronta;
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
      if (!d?.translated) { if (mio === numeroRef.current) setStato('errore'); return; }
      // b.357 — QUANDO LA TRADUZIONE NON C'E, NON SI FINGE. Se il controllo
      // di qualita del server la respinge, la risposta torna col testo
      // ORIGINALE dentro: finiva nel registro come se fosse tradotto (nello
      // schermo di Luca comparivano frasi italiane sotto la bandiera tedesca)
      // e la voce le leggeva pure. Meglio dirlo e lasciar riprovare.
      if (d.validationFailed) {
        giaChiestaRef.current = ''; // riprovare la stessa frase deve essere possibile
        if (mio === numeroRef.current) setStato('errore');
        return;
      }
      // Se l'utente sta ANCORA ALLUNGANDO la stessa frase, questa resa e
      // parziale: si butta, arrivera quella piena. Se invece ha gia
      // iniziato la frase dopo, questa resta valida e si accoda comunque:
      // i messaggi si susseguono, non scompaiono (collaudo di Luca).
      const attuale = testoRef.current.trim();
      const staAllungando = attuale !== t && attuale.startsWith(t);
      if (staAllungando) return;
      // in ordine di partenza, anche se le risposte arrivano scomposte
      setStoria((prima) => [...prima, { n: mio, detto: t, resa: d.translated }].sort((a, b) => a.n - b.n));
      // b.363 — la firma anti-doppione si azzera a risposta ACQUISITA: senza
      // questo, ripetere la stessa frase ("si", "ok", "grazie") non produceva
      // piu nulla — ne riga ne voce — e nessun segnale. Il doppione di b.357
      // resta comunque bloccato: timer e fine-dettatura scattano PRIMA che la
      // risposta arrivi, quindi trovano la firma ancora armata.
      giaChiestaRef.current = '';
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
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/translate:', e?.message || e);
      if (mio === numeroRef.current) setStato('errore'); }
  }, [miaLingua, meta, parla]);

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

  // ── LA DETTATURA (trascrizione dal vivo, stessa via di b.352) ──
  const detta = useCallback(() => {
    if (detto) {
      try { recRef.current?.stop(); } catch { /* il riconoscimento era gia fermo: fermarlo due volte non e un guasto */ }
      setDetto(false); dettoRef.current = false;
      return;
    }
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = miaLingua;
      rec.interimResults = true;
      rec.continuous = true;
      const base = testo ? testo + ' ' : '';
      let definitivo = '';
      rec.onresult = (ev) => {
        let volatile = '';
        for (let k = ev.resultIndex; k < ev.results.length; k++) {
          const r = ev.results[k];
          if (r.isFinal) definitivo += r[0].transcript + ' ';
          else volatile += r[0].transcript;
        }
        setTesto((base + definitivo + volatile).trimStart());
      };
      rec.onend = () => {
        setDetto(false); dettoRef.current = false;
        // il microfono si e chiuso: l'ultima frase parte SUBITO, con la voce.
        // E si disarma il timer della scrittura, altrimenti la stessa frase
        // ripartirebbe una seconda volta (b.357).
        clearTimeout(timerRef.current);
        setTesto((attuale) => { if (attuale.trim()) traduci(attuale); return attuale; });
      };
      rec.onerror = () => { setDetto(false); dettoRef.current = false; };
      recRef.current = rec;
      rec.start();
      setDetto(true); dettoRef.current = true;
      vibrate(8);
    } catch { setDetto(false); dettoRef.current = false; }
  }, [detto, testo, miaLingua, traduci]);

  useEffect(() => () => {
    try { recRef.current?.stop(); } catch { /* il riconoscimento era gia fermo: fermarlo due volte non e un guasto */ }
    try { audioRef.current?.pause(); } catch { /* la voce era gia ferma: fermarla due volte non e un guasto */ }
    clearTimeout(timerRef.current);
  }, []);

  const micDisponibile = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
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
        borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 700,
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
  const bloccoLingue = (
    <div key="lingue" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none',
      display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start', padding: '4px 0' }}>
      {mete.map((l) => (
        <button key={l.code} onClick={() => { vibrate(6); setMeta(l.code); setScegliLingua(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 15px', height: TASTO,
            borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
            background: meta === l.code ? `${C.accent || '#5b8cff'}22` : 'transparent',
            border: meta === l.code ? `1.5px solid ${C.accent || '#5b8cff'}` : bordo,
            color: meta === l.code ? (C.accent || '#5b8cff') : C.textSecondary }}>
          <span style={{ fontSize: 17 }}>{l.flag}</span>{l.name}
        </button>
      ))}
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

      {vuoto && !capovolto && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <button onClick={detta} aria-pressed={detto} aria-label={L('dictateWord')}
            disabled={!micDisponibile}
            style={{ width: 132, height: 132, borderRadius: 999, padding: 0,
              cursor: micDisponibile ? 'pointer' : 'default',
              border: `1px solid ${detto ? '#ff5470' : 'rgba(91,140,255,0.34)'}`,
              background: detto
                ? 'radial-gradient(circle at 50% 38%, rgba(255,84,112,0.30), rgba(255,84,112,0.08) 62%, transparent 74%)'
                : 'radial-gradient(circle at 50% 38%, rgba(91,140,255,0.30), rgba(91,140,255,0.08) 62%, transparent 74%)',
              boxShadow: detto
                ? '0 0 0 10px rgba(255,84,112,0.06), 0 20px 60px -18px rgba(255,84,112,0.55)'
                : '0 0 0 10px rgba(91,140,255,0.05), 0 20px 60px -18px rgba(91,140,255,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={46} color={detto ? '#ff5470' : (C.accent || '#5b8cff')} />
          </button>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, fontFamily: FONT }}>
            {detto ? L('speakNowListening') : L('speakNowTitle')}
          </span>
        </div>
      )}

      {vuoto && capovolto && (
        <span style={{ color: C.textMuted, fontWeight: 600, fontFamily: FONT,
          fontSize: 22, textAlign: 'center' }}>{L('speakNowEmptyFlipped')}</span>
      )}

      {storia.map((riga, i) => (
        <div key={i} style={{
          // b.356 — «piu grande il testo»: l'ultima frase e un testone,
          // le precedenti restano leggibili ma si fanno da parte.
          // b.422 — la misura ora la decide chi guarda, e resta decisa.
          fontSize: i === storia.length - 1 ? misuraTestone : misuraVecchie,
          fontWeight: 800, lineHeight: 1.25,
          color: i === storia.length - 1 ? C.textPrimary : C.textMuted,
          textAlign: capovolto ? 'center' : 'left',
          fontFamily: FONT, overflowWrap: 'anywhere',
        }}>
          {riga.resa}
        </div>
      ))}
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
  // LA RIGA IN BASSO — sempre li, sempre dritta, anche col ribaltone.
  // Il campo per scrivere non si apre e non si chiude: c'e. Accanto il
  // microfono e l'altoparlante, tutti e due grandi abbastanza da
  // prenderli senza guardare.
  // ═══════════════════════════════════════════════════════════════
  const bloccoBasso = (
    <div key="basso" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
      <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={1}
        placeholder={L('writeWord')} aria-label={L('writeWord')}
        style={{ flex: 1, padding: '15px 14px', borderRadius: 16,
          border: detto ? '2px solid #ff5470' : bordo,
          background: 'rgba(255,255,255,0.05)', color: C.textPrimary, fontSize: 16,
          fontFamily: FONT, resize: 'none', outline: 'none', boxSizing: 'border-box',
          minHeight: 54, maxHeight: 110 }} />
      {micDisponibile && (
        <button onClick={detta} aria-pressed={detto} aria-label={L('dictateWord')}
          style={{ width: 54, height: 54, borderRadius: 16, cursor: 'pointer', flexShrink: 0, padding: 0,
            border: detto ? '2px solid #ff5470' : `1px solid rgba(91,140,255,0.34)`,
            background: detto ? 'rgba(255,84,112,0.16)' : 'rgba(91,140,255,0.13)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="mic" size={24} color={detto ? '#ff5470' : (C.accent || '#5b8cff')} />
        </button>
      )}
      <button onClick={() => parla(ultimaResa)} disabled={!ultimaResa}
        aria-label={L('listenWord')} title={L('listenWord')}
        style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0, padding: 0,
          border: bordo, background: 'rgba(255,255,255,0.06)',
          opacity: ultimaResa ? 1 : 0.4, cursor: ultimaResa ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="speaker" size={22} color={ultimaResa ? (C.accent || '#5b8cff') : C.textMuted} />
      </button>
    </div>
  );

  return (
    <div style={{
      width: '100%', margin: '0 0 10px', boxSizing: 'border-box',
      // b.357 — IL CONTENITORE RESTA DENTRO LO SCHERMO (collaudo di Luca:
      // «mantieni la chat e il contenitore all'interno dello schermo»).
      // b.423 — MA USA TUTTA L'ALTEZZA CHE C'E (collaudo di Luca: «penso
      // poi che dovresti usare tutta l'altezza disponibile»). Prima ne
      // lasciava fuori duecentodieci punti e sopra il testo restava una
      // fascia vuota grande quanto mezzo schermo.
      flex: '1 1 auto',
      minHeight: 0,
      height: 'calc(100dvh - 158px)',
      maxHeight: 'calc(100dvh - 140px)',
      display: 'flex', flexDirection: 'column', gap: 10,
      overflow: 'hidden',
      background: C.cardBg || 'rgba(16,24,48,0.6)', border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.1)'}`,
      borderRadius: 20, padding: 14,
    }}>
      {/* ── LA TESTATA. Resta DRITTA anche col ribaltone (a girare e solo
             l'area di lettura), quindi i tastini della misura si toccano
             mentre l'altro sta leggendo. ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {targhettaLingue}
        <span style={{ flex: 1 }} />
        {/* la misura del testo compare solo quando c'e del testo da misurare */}
        {!vuoto && (<>
          <button onClick={() => cambiaMisura(-1)} disabled={passo <= PASSO_MIN}
            aria-label={L('textSmaller')} title={L('textSmaller')}
            style={{ ...tondino(false), opacity: passo <= PASSO_MIN ? 0.35 : 1,
              color: C.textSecondary, fontSize: 15, fontWeight: 800 }}>A−</button>
          <button onClick={() => cambiaMisura(1)} disabled={passo >= PASSO_MAX}
            aria-label={L('textBigger')} title={L('textBigger')}
            style={{ ...tondino(false), opacity: passo >= PASSO_MAX ? 0.35 : 1,
              color: C.textSecondary, fontSize: 19, fontWeight: 800 }}>A+</button>
        </>)}
        <button onClick={() => { vibrate(6); setCapovolto((v) => !v); }}
          aria-pressed={capovolto} aria-label={L('faceToFaceWord')} title={L('faceToFaceWord')}
          style={tondino(capovolto)}>
          <Icon name="swap" size={19} color={capovolto ? (C.accent || '#5b8cff') : C.textMuted} />
        </button>
        <button onClick={() => { try { memSet(FATTA, '1'); } catch { /* la memoria locale non e disponibile: si chiude lo stesso */ } onChiudi?.(); }}
          aria-label={L('close')}
          style={{ ...tondino(false), border: 'none', color: C.textMuted, fontSize: 21 }}>✕</button>
      </div>

      {/* IL CENTRO: le lingue quando le chiedi, altrimenti cio che si legge.
          Una cosa per volta, sempre nello stesso posto: niente si sposta. */}
      {scegliLingua ? bloccoLingue : bloccoLettura}

      {/* LA RIGA IN BASSO, sempre. Non si ribalta: si continua a scrivere
          mentre l'altro legge. */}
      {!scegliLingua && bloccoBasso}
    </div>
  );
}
