'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext.js';
import { memDel, memSet } from '../lib/memoria.js';
import { LANGS, getLang, FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import Ascolta from './Ascolta.js';  // b.404
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
  const { L, S, prefs } = useApp();
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

  // ── I DUE BLOCCHI (si scambiano di posto col capovolgimento) ──
  const bloccoScrittura = (
    <div key="scrivi" style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={capovolto ? 2 : 3}
          placeholder={detto ? L('speakNowListening') : L('speakNowPlaceholder')}
          style={{ flex: 1, padding: 13, borderRadius: 14, border: detto ? '2px solid #ff5470' : bordo,
            background: 'rgba(255,255,255,0.05)', color: C.textPrimary, fontSize: 16,
            fontFamily: FONT, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
        {micDisponibile && (
          <button onClick={detta} aria-pressed={detto} aria-label={L('dictateWord')}
            style={{ width: 52, borderRadius: 14, cursor: 'pointer', flexShrink: 0,
              border: detto ? '2px solid #ff5470' : bordo,
              background: detto ? 'rgba(255,84,112,0.15)' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={20} color={detto ? '#ff5470' : (C.accent || '#5b8cff')} />
          </button>
        )}
      </div>
      {/* la meta: fila di mete scorrevole */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 0 2px', scrollbarWidth: 'none' }}>
        {mete.map((l) => (
          <button key={l.code} onClick={() => { vibrate(6); setMeta(l.code); }}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
              background: meta === l.code ? `${C.accent || '#5b8cff'}22` : 'transparent',
              border: meta === l.code ? `1.5px solid ${C.accent || '#5b8cff'}` : bordo,
              color: meta === l.code ? (C.accent || '#5b8cff') : C.textSecondary }}>
            <span style={{ fontSize: 15 }}>{l.flag}</span>{l.name}
          </button>
        ))}
      </div>
    </div>
  );

  // Il REGISTRO: le frasi si susseguono, l'ultima e un testone.
  const bloccoTradotto = (
    <div key="letto" ref={registroRef} style={{
      // b.357 — il registro SCORRE dentro il pannello e non lo sfonda:
      // `minHeight: 0` e cio che permette a un figlio flessibile di
      // rimpicciolirsi invece di spingere fuori schermo il contenitore.
      flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 14,
      padding: capovolto ? '18px 14px' : 13, borderRadius: 16, border: bordo,
      background: 'rgba(255,255,255,0.04)',
      // IL RIBALTONE: la persona davanti legge dal suo lato. Girando di 180°
      // anche lo scorrimento si gira: le frasi nuove entrano dal SUO basso e
      // spingono in alto le vecchie, nel verso opposto al mio — naturalmente.
      transform: capovolto ? 'rotate(180deg)' : 'none',
    }}>
      {/* b.357 — le frasi stanno IN BASSO, ma senza `justify-content:flex-end`:
          con quello, quando il testo supera l'altezza, la parte che esce sopra
          diventa irraggiungibile (si vedeva la frase nuova tagliata a meta).
          Un distanziatore che si mangia lo spazio libero fa la stessa cosa e
          lascia scorrere tutto. */}
      <div aria-hidden style={{ marginTop: 'auto' }} />
      {storia.length === 0 && stato !== 'traduco' && (
        <span style={{ color: C.textMuted, fontWeight: 500, fontFamily: FONT,
          fontSize: capovolto ? 22 : 14, textAlign: capovolto ? 'center' : 'left' }}>
          {capovolto ? L('speakNowEmptyFlipped') : L('speakNowEmpty')}
        </span>
      )}
      {storia.map((riga, i) => (
        <div key={i} style={{
          // b.356 — «piu grande il testo»: l'ultima frase e un testone,
          // le precedenti restano leggibili ma si fanno da parte.
          fontSize: i === storia.length - 1
            ? (capovolto ? 'clamp(34px, 8vw, 58px)' : 26)
            : (capovolto ? 20 : 15),
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
      {stato === 'errore' && <div style={{ color: '#ff5470', fontSize: 12, fontFamily: FONT }}>{L('speakNowError')}</div>}
      {/* b.417 — la traduzione e arrivata, la voce no. Non e l'errore della
          traduzione (quella si legge, li sopra): e un avviso, e va detto,
          perche restare zitti senza motivo e il difetto che stiamo chiudendo. */}
      {stato === 'muto' && <div style={{ color: C.textSecondary || 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: FONT }}>{L('speakNowVoiceless')}</div>}
    </div>
  );

  return (
    <div style={{
      width: '100%', margin: '0 0 14px', boxSizing: 'border-box',
      // b.357 — IL CONTENITORE RESTA DENTRO LO SCHERMO (collaudo di Luca:
      // «mantieni la chat e il contenitore all'interno dello schermo»).
      // Prima cresceva col testo e usciva dal video, tagliando in alto la
      // frase piu nuova. Ora ha un'altezza sua, misurata sullo schermo
      // vero (dvh tiene conto delle barre del telefono), e a scorrere e
      // il registro dentro di lui.
      flex: '1 1 auto',
      minHeight: 0,
      height: 'calc(100dvh - 210px)',
      maxHeight: 'calc(100dvh - 190px)',
      display: 'flex', flexDirection: 'column', gap: 10,
      overflow: 'hidden',
      background: C.cardBg || 'rgba(16,24,48,0.6)', border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.1)'}`,
      borderRadius: 20, padding: 14,
    }}>
      {/* testata del palco */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Icon name="speaker" size={16} color={C.accent || '#5b8cff'} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: C.textPrimary, fontFamily: FONT }}>
          {L('speakNowTitle')}
        </span>
        <button onClick={() => { vibrate(6); setCapovolto((v) => !v); }}
          aria-pressed={capovolto}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
            cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 800,
            background: capovolto ? `${C.accent || '#5b8cff'}22` : 'transparent',
            border: capovolto ? `1.5px solid ${C.accent || '#5b8cff'}` : bordo,
            color: capovolto ? (C.accent || '#5b8cff') : C.textSecondary }}>
          <Icon name="swap" size={14} color={capovolto ? (C.accent || '#5b8cff') : C.textSecondary} />
          {L('faceToFaceWord')}
        </button>
        <button onClick={() => { try { memSet(FATTA, '1'); } catch { /* la memoria locale non e disponibile: si chiude lo stesso */ } onChiudi?.(); }}
          aria-label={L('close')}
          style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 17, cursor: 'pointer', padding: 4 }}>✕</button>
      </div>

      {/* i due blocchi: dritti, oppure capovolti (testone su, scrittura giu) */}
      {capovolto ? (<>{bloccoTradotto}{bloccoScrittura}</>) : (<>{bloccoScrittura}{bloccoTradotto}</>)}

      {/* la voce, sempre a portata di mano per farla ripetere */}
      {/* b.404 — grafica comune. Qui era un bottone a riga piena col
          triangolo scritto nel testo: stessa azione, settima forma. */}
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <Ascolta onAscolta={() => parla(ultimaResa)}
          preparando={stato === 'parlo'} disabilitato={!ultimaResa}
          parola={L('listenWord')} etichetta={L('listenWord')}
          sfondo="rgba(255,255,255,0.06)"
          colore={ultimaResa ? (C.accent || '#5b8cff') : C.textMuted} />
      </div>
    </div>
  );
}
