'use client';
import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FONT, LANGS, vibrate, clayCard } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { useApp } from '../../contexts/AppContext.js';
import { COMPAGNI_PREDEFINITI } from '../../lib/compagni/catalogo.js';
import { LIVELLI, PROFILI } from '../../lib/compagni/corsi/catalogo.js';

// b.300 — idee per riempire il campo: un tocco mette una frase gia
// dettagliata, cosi anche un anziano o un bambino non parte dal vuoto.
// b.482 — via le faccine da queste idee: a schermo non ci vanno, e la
// parola da sola dice gia di che materia si tratta.
// b.483 — ANCHE QUESTE IDEE SI VEDONO A SCHERMO, e finora erano scritte
// in italiano dentro il codice: chi apre l'app in un'altra lingua trovava
// otto pulsanti in italiano, e toccandone uno si ritrovava una frase
// italiana dentro il campo. Ora ogni idea porta due chiavi — la parola
// sul pulsante (etK) e la frase che finisce nel campo (qK) — e il testo
// italiano resta come ripiego, come per tutte le altre parole di questa
// schermata.
const IDEE_CORSO = [
  { etK: 'lifeIdeaMath', et: 'Matematica', qK: 'lifeIdeaMathTopic', q: 'Matematica di base: numeri, operazioni ed equazioni semplici' },
  { etK: 'lifeIdeaHistory', et: 'Storia', qK: 'lifeIdeaHistoryTopic', q: 'Storia: dai secoli antichi ai giorni nostri, con date ed eventi chiave' },
  { etK: 'lifeIdeaMusic', et: 'Musica', qK: 'lifeIdeaMusicTopic', q: 'Storia della musica e dei grandi compositori, con esempi da ascoltare' },
  { etK: 'lifeIdeaEnglish', et: 'Inglese', qK: 'lifeIdeaEnglishTopic', q: 'Inglese per iniziare a parlare: frasi utili di ogni giorno' },
  { etK: 'lifeIdeaScience', et: 'Scienze', qK: 'lifeIdeaScienceTopic', q: 'Scienze: il corpo umano, la natura e come funziona il mondo' },
  { etK: 'lifeIdeaCooking', et: 'Cucina', qK: 'lifeIdeaCookingTopic', q: 'Cucina: ricette semplici passo dopo passo' },
  { etK: 'lifeIdeaComputer', et: 'Computer', qK: 'lifeIdeaComputerTopic', q: 'Usare il computer e internet senza paura, passo dopo passo' },
  { etK: 'lifeIdeaArt', et: 'Arte', qK: 'lifeIdeaArtTopic', q: 'Storia dell\'arte: opere famose e artisti da conoscere' },
];
import { generaTurnoPodcast, generaSyllabus, generaLezione, generaQuiz, parlaTurno, parlaBilingue, elencoMiei, corsiDisponibili, pubblicaCorso, generaIllustrazione, generaTavola, arricchisciLezione, registraEsito, chiediAlMaestro, salvaCorsoMio, mieiCorsiUtente, segnaLibroCorso, progressoCorso, profiloStudente, salvaProfiloStudente } from '../../lib/compagni/cliente.js';
import { pausa as pausaAudio, ferma as fermaAudio, fermaElemento, suInterruzione, apriCiclo } from '../../lib/voce.js';
import { rilevaLinguaStudiata, testoVisibile, staccaLettura } from '../../lib/compagni/corsi/lingua.js';
import PannelloLettura from './PannelloLettura.js';
import PannelloLaterale, { LinguettaPannello } from '../ui/PannelloLaterale.js';
import TestoLingua from './TestoLingua.js';
import CompagnoDiSventura from './CompagnoDiSventura.js';
import AvatarImg from '../AvatarImg.js';
import CompagnoLive from './CompagnoLive.js';
import { assistentePer, vocePrestata } from '../../lib/compagni/corsi/assistenti.js';
import { staccaScena } from '../../lib/compagni/corsi/scena.js';
import { apriScanner, ascoltaScansioni } from '../../lib/scanPonte.js';
import { sesSet } from '../../lib/memoria.js';
import { staccaEsercizio } from '../../lib/compagni/corsi/pronuncia.js';
import PannelloPronuncia from './PannelloPronuncia.js';
import GestioneCompagni from './GestioneCompagni.js';
import GestioneObiettivi from './GestioneObiettivi.js';
import CompitiView from './CompitiView.js';
import AmicoChat from './AmicoChat.js';
import Tavolo from './Tavolo.js';
import { conRipiego } from '../../lib/ripiego.js';
import Ascolta from '../Ascolta.js';  // b.404 — una sola grafica per ascoltare

// ═══════════════════════════════════════════════════════════════
// LifeView — la sezione Life (Luca). Autonoma: usa SOLO il dominio
// Compagni (catalogo, corsi, cliente) e le rotte /api/compagni/*.
// Due schede: Podcast (ascolta i Compagni discutere) e Impara (corsi).
// La voce passa dal TTS esistente; tutto passa dal wallet lato server.
// ═══════════════════════════════════════════════════════════════

function LifeView({ onApriStanza }) {
  const { L, S, prefs, userToken, setView } = useApp();
  const C = S?.colors || {};
  const lingua = prefs?.uiLang || prefs?.lang || 'it';
  const [scheda, setScheda] = useState('podcast');
  // b.503 — tavola F: le sette sezioni vivono nel pannello laterale.
  const [pannelloAperto, setPannelloAperto] = useState(false);
  // b.334 — arrivo da "Condividi -> BarTalk": la scheda giusta si apre da
  // sola col contenuto gia dentro (Spiegamelo -> Impara; Tavola -> Tavolo).
  const [imparaPreset, setImparaPreset] = useState('');
  const [tavoloPreset, setTavoloPreset] = useState('');
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('vt-life-preset');
      if (!raw) return;
      sessionStorage.removeItem('vt-life-preset');
      const p = JSON.parse(raw);
      if (p?.scheda === 'impara') { setImparaPreset(p.testo || ''); setScheda('impara'); }
      else if (p?.scheda === 'tavolo') { setTavoloPreset(p.testo || ''); setScheda('tavolo'); }
    } catch { /* nessun preset in attesa */ }
  }, []);

  // b.346 — DOCUMENTI DALLO SCANNER destinati ad Amico o al Tavolo: il
  // testo acquisito porta la scheda giusta gia carica. (La destinazione
  // "impara" la gestisce la scheda Impara, che ha il telaio dei corsi.)
  useEffect(() => {
    const spegni = ascoltaScansioni(({ testo, dest }) => {
      const t = String(testo || '');
      if (dest === 'amico') {
        try { sesSet('vt-coach-brief', `Ho scansionato questo documento, aiutami a studiarlo:\n\n${t.slice(0, 2400)}`); } catch { /* niente memoria di sessione */ }
        setScheda('amico');
      } else if (dest === 'tavolo') {
        setTavoloPreset(t.slice(0, 400));
        setScheda('tavolo');
      }
    });
    return spegni;
  }, []);
  const [miei, setMiei] = useState([]);
  // b.227 — Dossier→Debate. b.363: il valore non viene mai cambiato, la
  // scatola di stato prometteva un collegamento che non esiste.
  const debateObiettivo = '';

  const caricaMiei = useCallback(async () => {
    if (!userToken) { setMiei([]); return; }
    try { setMiei(await elencoMiei(userToken)); } catch { /* senza login o senza rete: solo i predefiniti */ }
  }, [userToken]);
  useEffect(() => { caricaMiei(); }, [caricaMiei]);
  // b.232 — memoizzato: prima si ricreava a ogni render e vanificava il memo()
  // dei figli (AmicoChat, Tavolo…), che ri-renderizzavano sempre.
  const tutti = useMemo(() => [...COMPAGNI_PREDEFINITI, ...miei], [miei]);

  // b.305 — TELECOMANDO AUDIO: un pulsante fluttuante che appare quando
  // qualcosa sta suonando e ti segue mentre cambi scheda di Life. Pausa,
  // riprendi, interrompi — sempre a portata.
  // b.404 — lo stato del telecomando non si tiene piu qui: lo legge il
  // telecomando stesso, che ora sta in page.js. Life continua a usare
  // pausa/ferma dal registro, che e cio che le serve davvero.

  const testoP = C.textPrimary || '#eef2ff';
  const muto = C.textMuted || 'rgba(242,244,247,0.6)';
  const accent = C.accent1 || '#26D9B0';
  const card = C.glassCard || 'rgba(12,16,30,0.65)';
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`;

  return (
    // ── INIZIO b.205 — lo scroll di Life non arrivava al tasto Salva ──
    // Il <body> ha overflow:hidden (layout.js): ogni vista deve scrollare
    // da sé. Qui c'era minHeight:100vh senza overflow: il form Compagni,
    // più alto dello schermo, veniva tagliato e il tasto Salva restava
    // irraggiungibile. Ora il contenitore è alto quanto lo schermo e
    // scorre internamente. Lo sfondo NON cambia (resta C.bg dietro il velo).
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: C.bg || '#0a0e1a', color: testoP, fontFamily: FONT }}>
    {/* ── FINE b.205 ── */}
    {/* b.300 — REGOLA DI SISTEMA (Luca): mai a tutta larghezza. Il
        contenuto vive in una colonna centrata, larga al massimo 640, con
        aria ai lati. Se serve piu spazio si sfrutta l'altezza, non si
        allarga oltre. Vale per tutte le pagine di Life. */}
    {/* b.394 — la riserva in fondo era 90 a occhio; la pillola misura
        60 (due tasti da 42, riempimento 8+8, bordo 1+1) piu lo stacco e
        la zona del trattino di casa. Cosi a scorrimento finito l'ultima
        riga resta sopra la pillola su qualunque telefono. */}
    {/* b.482 — il rientro laterale della colonna sale da 16 a 20, la misura
        del telaio comune: passando da una pagina all'altra il contenuto
        saltava di quattro punti. */}
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 20px calc(60px + max(16px, env(safe-area-inset-bottom)) + 12px)', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {/* b.206 — pulsante indietro uniforme (glifo ‹, r12) come le altre pagine */}
        {/* b.482 — il tasto piu premuto della pagina stava a 38: sotto i
            quarantaquattro il dito manca il bersaglio, e da qui si torna indietro. */}
        <button onClick={() => { vibrate(8); setView('home'); }} aria-label={L('lifeBack')}
          style={{ width: 44, height: 44, borderRadius: 12, background: card, border: bordo, color: testoP, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {'‹'}
        </button>
        <Icon name="star" size={20} color={accent} />
        <span style={{ fontSize: 20, fontWeight: 600 }}>Life</span>
      </div>

      {/* ═══ b.503 — TAVOLA F: «le sette sezioni non stanno piu in fila
          sopra la conversazione». La fila di schede (b.208) chiedeva di
          trascinare per vedere le ultime, e le ultime due non le trovava
          nessuno. Ora vivono nel PANNELLO LATERALE, in colonna, tutte
          visibili insieme (stesso pannello del Mondo, b.363); sopra la
          conversazione si recupera una riga intera. La linguetta sul
          bordo e la maniglia, la testata dice DOVE SEI. ═══ */}
      {(() => {
        const SEZIONI = [
          { id: 'podcast', icon: 'mic', label: L('lifePodcast') },
          { id: 'amico', icon: 'chat', label: L('lifeFriendTab') },
          { id: 'tavolo', icon: 'users', label: L('lifeTableTab') },
          { id: 'impara', icon: 'graduation', label: L('lifeLearn') },
          { id: 'obiettivi', icon: 'target', label: L('lifeGoalsTab') },
          { id: 'compiti', icon: 'history', label: L('lifeHomeworkTab') },
          { id: 'compagni', icon: 'star', label: L('lifeCompanionsTab') },
        ];
        const schedaAttiva = SEZIONI.find((t) => t.id === scheda);
        return (
          <>
            <button onClick={() => { vibrate(8); setPannelloAperto(true); }}
              aria-haspopup="dialog" aria-expanded={pannelloAperto}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                padding: '9px 14px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
                background: card, border: bordo, color: testoP, fontFamily: FONT,
                fontSize: 13.5, fontWeight: 600 }}>
              <Icon name={schedaAttiva?.icon || 'star'} size={17} color={accent} />
              {schedaAttiva?.label}
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.6} strokeLinecap="round" style={{ opacity: 0.6 }}>
                <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="14" y2="17" />
              </svg>
            </button>
            <LinguettaPannello onApri={() => setPannelloAperto(true)} C={C} etichetta={L('lifeSectionsWord')} />
            <PannelloLaterale aperto={pannelloAperto} onChiudi={() => setPannelloAperto(false)}
              titolo={L('lifeSectionsWord')} C={C}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {SEZIONI.map((t) => {
                  const on = scheda === t.id;
                  return (
                    <button key={t.id}
                      onClick={() => { vibrate(8); setScheda(t.id); setPannelloAperto(false); }}
                      aria-current={on ? 'page' : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                        padding: '12px 14px', minHeight: 48, borderRadius: 12, cursor: 'pointer', fontFamily: FONT,
                        background: on ? `${accent}18` : 'transparent',
                        border: `1px solid ${on ? accent : 'transparent'}`,
                        color: testoP, fontSize: 14.5, fontWeight: 600 }}>
                      <Icon name={t.icon} size={19} color={on ? accent : testoP} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </PannelloLaterale>
          </>
        );
      })()}

      {scheda === 'podcast' && <Podcast compagni={tutti} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {scheda === 'amico' && <AmicoChat compagni={tutti} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {scheda === 'tavolo' && <Tavolo compagni={tutti} obiettivoIniziale={tavoloPreset || debateObiettivo} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {/* b.302 — 'dossier' non e piu una scheda: chi ci arriva vede la Tavola. */}
      {scheda === 'impara' && <Impara compagni={tutti} argomentoIniziale={imparaPreset} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {scheda === 'obiettivi' && <GestioneObiettivi {...{ L, userToken, testoP, muto, accent, card, bordo }} cambiaScheda={setScheda} />}
      {/* b.482 — i Compiti ricevono anche la tavolozza del tema: i loro
          colori di stato erano scritti a mano e non seguivano il tema. */}
      {scheda === 'compiti' && <CompitiView {...{ L, C, userToken, lingua, testoP, muto, accent, card, bordo }} cambiaScheda={setScheda} />}
      {scheda === 'compagni' && <GestioneCompagni miei={miei} onCambiato={caricaMiei} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
    </div>

    {/* b.404 — IL TELECOMANDO E' USCITO DA QUI. Non era piu roba di
        Life: la voce suona anche nella stanza, nel taxi e nell'archivio,
        e li non c'era niente per fermarla. Ora sta in page.js accanto
        alla barra in basso, uguale identico, e lo vedono tutte le
        pagine. Life continua a comandarlo come prima, dal registro. */}
    </div>
  );
}

// b.222 — le lezioni arrivano in markdown leggero (### titoli, **grassetto**,
// elenchi con -). Prima si vedevano i simboli grezzi ("### Cuerpo", "**La
// vaca**"). Piccolo renderer senza dipendenze: titoli, grassetto, elenchi.
function inlineGrassetto(s, keyBase) {
  return String(s).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    (p.startsWith('**') && p.endsWith('**') && p.length > 4)
      ? <strong key={`${keyBase}-${i}`} style={{ fontWeight: 600 }}>{p.slice(2, -2)}</strong>
      : <span key={`${keyBase}-${i}`}>{p}</span>);
}
function TestoRicco({ testo, testoP, muto }) {
  const righe = String(testo || '').split('\n');
  const blocchi = righe.map((r, i) => {
    const t = r.trim();
    if (/^#{3,}\s+/.test(t)) return <div key={i} style={{ fontSize: 16, fontWeight: 600, color: testoP, margin: '14px 0 4px' }}>{inlineGrassetto(t.replace(/^#{3,}\s+/, ''), i)}</div>;
    if (/^##\s+/.test(t))    return <div key={i} style={{ fontSize: 18, fontWeight: 600, color: testoP, margin: '16px 0 6px' }}>{inlineGrassetto(t.replace(/^##\s+/, ''), i)}</div>;
    if (/^#\s+/.test(t))     return <div key={i} style={{ fontSize: 20, fontWeight: 600, color: testoP, margin: '16px 0 6px' }}>{inlineGrassetto(t.replace(/^#\s+/, ''), i)}</div>;
    if (/^[-*]\s+/.test(t))  return <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}><span style={{ color: muto }}>•</span><span>{inlineGrassetto(t.replace(/^[-*]\s+/, ''), i)}</span></div>;
    if (t === '')            return <div key={i} style={{ height: 8 }} />;
    return <div key={i} style={{ margin: '3px 0' }}>{inlineGrassetto(t, i)}</div>;
  });
  return <div style={{ fontSize: 15, color: testoP, lineHeight: 1.6 }}>{blocchi}</div>;
}

// ─────────────────────────────────────────────────────────────────
// SCHEDA PODCAST
// ─────────────────────────────────────────────────────────────────
function Podcast({ compagni, L, C, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [argomento, setArgomento] = useState('');
  const [scelti, setScelti] = useState([]);
  const [round, setRound] = useState(3);
  const [stato, setStato] = useState('pronto'); // pronto | genero | ascolto
  const [copioni, setCopioni] = useState([]);
  const [attuale, setAttuale] = useState(-1);
  const [errore, setErrore] = useState('');
  const fermatoRef = useRef(false);
  // b.363 — lo Stop del telecomando ferma anche questa fabbrica di turni
  useEffect(() => suInterruzione(() => { fermatoRef.current = true; }), []);
  const audioRef = useRef(null);
  // b.482 — il rosso dell'avviso viene dal tema: scritto a mano restava
  // lo stesso anche sui temi chiari, dove non era piu leggibile.
  const rosso = C?.statusError || '#f87171';

  const toggle = (id) => {
    setScelti((s) => s.includes(id) ? s.filter(x => x !== id) : (s.length >= 4 ? s : [...s, id]));
  };

  const ferma = useCallback(() => {
    fermatoRef.current = true;
    // b.405 — QUESTO STOP NON FERMAVA DAVVERO, e il difetto era invisibile.
    //
    // `parlaTurno` distingue una PAUSA (si riprende) da un'INTERRUZIONE (si
    // chiude e si libera il file), e riconosce la seconda dal segno che
    // lascia `fermaElemento`. Qui c'era un `pause()` nudo: nessun segno,
    // quindi la promessa del turno restava appesa per sempre, `vai()` non
    // usciva mai dal suo `await`, il `finally` non veniva raggiunto e
    // `chiudiCiclo()` non partiva. Sullo schermo tornava scritto «pronto»
    // mentre il telecomando restava convinto che si stesse ancora parlando.
    //
    // Stesso contratto del telecomando: un solo modo di dire basta.
    fermaElemento(audioRef.current);
    setStato('pronto'); setAttuale(-1);
  }, []);

  const vai = useCallback(async () => {
    setErrore('');
    if (!argomento.trim()) { setErrore(L('lifeNeedTopic')); return; }
    if (scelti.length < 2) { setErrore(L('lifeNeedCompanions')); return; }
    setStato('genero'); setCopioni([]); setAttuale(-1); fermatoRef.current = false;
    // b.394 — da qui comincia un giro di voce vero: la pillola si accende
    // adesso, non quando si e aperta la scheda.
    const chiudiCiclo = apriCiclo();
    try {
      // ── b.244 · un turno per volta, e si ascolta mentre si genera ──
      // Prima si aspettava che TUTTI i turni fossero pronti (fino a 16
      // chiamate in fila, col rischio di timeout) e solo dopo partiva la
      // voce. Ora il primo turno si sente quasi subito, e mentre parla si
      // prepara il successivo: nessuna richiesta puo scadere.
      const lista = [];
      setStato('ascolto');
      for (let i = 0; ; i++) {
        if (fermatoRef.current) break;
        const d = await generaTurnoPodcast({
          argomento: argomento.trim(), compagni: scelti, round, lingua, userToken,
          indice: i, precedenti: lista.slice(-6).map((t) => ({ nome: t.nome, testo: t.testo })),
        });
        // b.405 — SI RICONTROLLA DOPO L'ATTESA, non solo prima.
        //
        // Il controllo in cima al giro guardava lo stato di PRIMA della
        // richiesta. Ma una generazione dura secondi, e in quei secondi
        // l'utente puo premere Interrompi: il server finiva comunque, la
        // risposta tornava, e da qui partiva la voce di un turno che
        // nessuno voleva piu sentire — dopo lo Stop, con lo schermo che
        // diceva «pronto». Chi ha detto basta ha detto basta.
        if (fermatoRef.current) break;
        if (d.fine) break;
        if (d.saltato || !d.turno) { if (i >= (d.totale || 0) - 1) break; continue; }
        lista.push(d.turno);
        setCopioni([...lista]);
        setAttuale(lista.length - 1);
        // b.405 — `chi` al posto della registrazione a mano: ora registra
        // `parlaTurno`. Il callback serve solo a tenere il riferimento per
        // lo Stop locale.
        // b.483 — `chi` finisce scritto sul telecomando dell'audio: il
        // ripiego era una parola italiana cablata.
        await parlaTurno({ voceId: d.turno.voceId, testo: d.turno.testo, lingua, userToken, chi: d.turno.nome || L('lifePodcast') }, (a) => { audioRef.current = a; });
      }
      if (!fermatoRef.current) { setStato('pronto'); setAttuale(-1); }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] vai:', e?.message || e);
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
      setStato('pronto');
    } finally { chiudiCiclo(); }
  }, [argomento, scelti, round, lingua, userToken, L]);

  return (
    <div>
      <input value={argomento} onChange={(e) => setArgomento(e.target.value)} placeholder={L('lifeTopicPh')}
        style={{ width: '100%', padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 15, fontFamily: FONT, boxSizing: 'border-box', marginBottom: 12 }} />

      <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifeCompanions')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, marginBottom: 14 }}>
        {compagni.map((c) => {
          const on = scelti.includes(c.id);
          return (
            <button key={c.id} onClick={() => { vibrate(6); toggle(c.id); }}
              style={{ minHeight: 44, padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                background: on ? `${c.colore}22` : card, border: `1px solid ${on ? c.colore : (bordo.split(' ').pop())}`, fontFamily: FONT }}>
              {/* b.208 — avatar del Compagno, non l'emoji */}
              <img src={c.avatar} alt="" width={46} height={46} style={{ borderRadius: 12, display: 'block', margin: '0 auto 6px', objectFit: 'cover' }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: testoP }}>{c.nome}</div>
              <div style={{ fontSize: 10, color: muto }}>{c.ruolo}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: muto }}>{L('lifeRounds')}</span>
        {[2, 3, 4].map((n) => (
          <button key={n} onClick={() => setRound(n)}
            style={{ width: 44, height: 44, borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontFamily: FONT,
              background: round === n ? accent : card, color: round === n ? '#04121c' : testoP, border: bordo }}>{n}</button>
        ))}
      </div>

      {errore && <div style={{ color: rosso, fontSize: 13, marginBottom: 10 }}>{errore}</div>}

      {/* b.482 — via le faccine dal tasto grande: la parola dice gia tutto,
          e il bersaglio arriva ai quarantaquattro punti. */}
      {stato !== 'ascolto'
        ? <button onClick={vai} disabled={stato === 'genero'}
            style={{ width: '100%', minHeight: 44, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer',
              background: accent, color: '#04121c', fontWeight: 600, fontSize: 15, fontFamily: FONT, opacity: stato === 'genero' ? 0.6 : 1 }}>
            {stato === 'genero' ? L('lifeGenerating') : L('lifeGenListen')}
          </button>
        : <button onClick={ferma}
            style={{ width: '100%', minHeight: 44, padding: 14, borderRadius: 14, border: bordo, cursor: 'pointer', background: 'transparent', color: testoP, fontWeight: 600, fontSize: 15, fontFamily: FONT }}>
            {L('lifeStop')}
          </button>}

      {/* Copione / trascrizione */}
      {copioni.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {copioni.map((t, i) => (
            <div key={t.ordine} style={{ padding: 12, borderRadius: 12, background: card,
              border: `1px solid ${i === attuale ? accent : bordo.split(' ').pop()}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: accent, marginBottom: 4 }}>{t.nome}</div>
              <div style={{ fontSize: 14, color: testoP, lineHeight: 1.5 }}>{t.testo}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCHEDA IMPARA (corsi)
// ─────────────────────────────────────────────────────────────────
// b.312 — SELEZIONE IMMAGINI PER LA LEZIONE DINAMICA (Luca).
// Non "immagini a caso distribuite", ma: per ogni SEZIONE si sceglie
// l'immagine che meglio RAPPRESENTA quel pezzo (parole in comune fra il
// testo della sezione e titolo/sintesi dell'articolo), preferendo FONTI
// NUOVE (domini non ancora usati) — cosi la presentazione esplora risorse
// diverse invece di ripetere sempre la stessa. Se un'immagine coerente non
// c'e, la sezione resta senza (il documentario respira, non riempie a forza).
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
// b.334 — KARAOKE PER FRASE: il paragrafo attivo si spezza in frasi e quella
// in lettura si illumina. Stima onesta: proporzione del tempo audio sulla
// lunghezza del testo (precisa quando la sezione e un audio solo).
function spezzaFrasi(testo) {
  return String(testo || '').match(/[^.!?…]+[.!?…]+["»']?\s*|[^.!?…]+$/g)?.map((f) => f.trim()).filter(Boolean) || [String(testo || '')];
}
function dominioDi(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function paroleChiave(s) { return new Set((String(s || '').toLowerCase().match(/\p{L}{4,}/gu) || [])); }
function assegnaImmagini(paragrafi, items, illustrazione) {
  const usatiUrl = new Set();
  const usatiDomini = new Set();
  const disponibili = items.filter((it) => it && it.immagine);
  const scelte = paragrafi.map((p) => {
    const pw = paroleChiave(p);
    let best = null, bestScore = -1;
    for (const it of disponibili) {
      if (usatiUrl.has(it.immagine)) continue;
      const iw = paroleChiave(`${it.titolo || ''} ${it.sintesi || ''}`);
      let overlap = 0; for (const w of iw) if (pw.has(w)) overlap++;
      // b.363 — il bonus "fonte nuova" e uno SPAREGGIO, non un lasciapassare:
      // da solo faceva superare la soglia anche a immagini che col paragrafo
      // non avevano nemmeno una parola in comune, e sulla lavagna finivano
      // foto scollegate da quello che si stava leggendo.
      if (overlap === 0) continue;
      const dom = dominioDi(it.url);
      // preferenza alle FONTI NUOVE: un dominio gia usato pesa meno.
      const score = overlap + (dom && !usatiDomini.has(dom) ? 1.2 : 0);
      if (score > bestScore) { bestScore = score; best = it; }
    }
    if (best && bestScore > 0) { usatiUrl.add(best.immagine); const d = dominioDi(best.url); if (d) usatiDomini.add(d); return best.immagine; }
    return null;
  });
  // se NESSUNA sezione ha trovato un'immagine ma c'e l'illustrazione AI,
  // la si usa come diapositiva d'apertura.
  if (illustrazione && scelte.every((x) => !x)) scelte[0] = illustrazione;
  // b.375 — LO STESSO DISEGNO DUE VOLTE (collaudo di Luca: "il disegno e
  // ripetuto"). L'illustrazione poteva finire in cima E ricomparire piu
  // sotto se una sezione non trovava foto sue. Un disegno ripetuto nella
  // stessa pagina non e una decorazione: sembra un guasto. Qui ogni
  // immagine puo comparire UNA VOLTA SOLA.
  const gia = new Set();
  for (let i = 0; i < scelte.length; i++) {
    if (!scelte[i]) continue;
    if (gia.has(scelte[i])) { scelte[i] = null; continue; }
    gia.add(scelte[i]);
  }
  return scelte;
}

// b.374 — LE LINGUE CHE SI POSSONO STUDIARE. Non sono tutte le 44 che
// l'app sa tradurre: sono quelle per cui ha senso un CORSO, cioe quelle
// con una voce madrelingua decente da imitare. Aggiungerne una e una
// riga; toglierla pure.
const LINGUE_IMPARABILI = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'ru', 'nl', 'tr', 'hi'];
// b.378 — coreano e russo restano nell'elenco: si possono studiare, e
// accanto c'e scritto che la voce e approssimata. Toglierli sarebbe
// piu comodo per noi e peggio per chi li vuole imparare.

function Impara({ compagni, L, C, lingua, userToken, testoP, muto, accent, card, bordo, argomentoIniziale = '' }) {
  const [argomento, setArgomento] = useState(argomentoIniziale || '');
  const [categoria, setCategoria] = useState('altro');
  const [livello, setLivello] = useState('base');
  const [linguaCorso, setLinguaCorso] = useState(lingua || 'it'); // b.213 — lingua del corso, scelta esplicita (conta per i bambini)
  // ═══ b.374 — LA SEZIONE DEDICATA ALLE LINGUE (ordine di Luca) ═══
  //
  // «i corsi di lingue non vanno gestiti insieme agli altri: crea una
  // sezione dedicata dentro Impara, cosi gia iniziando il sistema sara
  // impostato correttamente».
  //
  // Il difetto che questo chiude: finora la lingua studiata si DEDUCEVA
  // dal titolo. "Inglese per principianti" funzionava; "Present perfect"
  // no — e in quel caso l'esercizio di pronuncia semplicemente non
  // compariva, senza dire perche. Un corso di inglese perfettamente
  // legittimo restava muto.
  //
  // Qui la lingua non si indovina: SI SCEGLIE, prima di cominciare. E la
  // scelta vince sempre sul titolo.
  const [sezione, setSezione] = useState('materie');   // 'materie' | 'lingue'
  const [linguaStudiata, setLinguaStudiata] = useState('');
  // b.378 — CHI STUDIA: un asse a parte dal livello. Un anziano non e
  // "piu difficile" di un ragazzo: e la stessa lingua studiata da
  // qualcun altro, con altri tempi e altre situazioni.
  const [profilo, setProfilo] = useState('chiunque');
  // b.384 — CHI MI STA ACCANTO. Non un elenco nuovo di personaggi: uno
  // dei miei Compagni, che da qui in poi mi accompagna anche mentre
  // studio. Si ricorda, perche non e una scelta da rifare ogni volta.
  const [sventuraId, setSventuraId] = useState('');
  useEffect(() => {
    try { setSventuraId(localStorage.getItem('bartalk_compagno_sventura') || ''); }
    catch { /* memoria del browser negata: si sceglie di nuovo, non e un guasto */ }
  }, []);
  const scegliSventura = useCallback((id) => {
    vibrate(6);
    const nuovo = sventuraId === id ? '' : id;
    setSventuraId(nuovo);
    try { localStorage.setItem('bartalk_compagno_sventura', nuovo); }
    catch { /* non poter RICORDARE la scelta non e un guasto da dire a nessuno */ }
  }, [sventuraId]);
  const compagnoSventura = (compagni || []).find((c) => c.id === sventuraId) || null;
  // b.376 — DOVE VOGLIO ANDARE (collaudo di Luca: «non ho modo di
  // avanzare nella lezione a punti piu avanti nel testo»). Il ciclo di
  // lettura sapeva gia saltare avanti — lo fa quando il Maestro decide
  // che una parte e gia stata coperta parlando. Mancava solo il modo di
  // dirglielo dal dito.
  const vaiARef = useRef(-1);
  // b.299 — COSA arricchisce la lezione: 'disegni' (illustrazioni fatte
  // dal Maestro), 'foto'/'link' (recuperati dalla community — Cobra),
  // 'video' (video collegati), 'nessuno'. Il default lo decide l'eta:
  // i bambini vedono disegni, gli universitari link e video.
  // b.301 — il livello e 'bambino' (singolare), come in catalogo.js e nel
  // generatore. Ieri (b.299) qui c'era 'bambini': per un corso da bambino
  // il default cadeva su 'link' invece che sui disegni. Corretto.
  // b.306 — i contenuti sono PIU DI UNO alla volta (Luca): non una scelta
  // singola ma un insieme. E il default CRESCE col livello — piu si va verso
  // l'alto, piu elementi si accendono in automatico — che l'utente puo poi
  // togliere a piacere. Cosi un corso universitario nasce gia ricco senza
  // costringere a cliccare quattro volte, ma niente e imposto.
  const defaultContenuti = (liv) => ({
    bambino: ['disegni'],
    base: ['disegni'],
    intermedio: ['disegni', 'foto'],
    avanzato: ['foto', 'link'],
    universitario: ['foto', 'link', 'video'],
    ricercatore: ['disegni', 'foto', 'link', 'video'],
  }[liv] || ['disegni']);
  const [contenuti, setContenuti] = useState(defaultContenuti('base'));
  const toggleContenuto = (id) => setContenuti((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const [arricchimento, setArricchimento] = useState(null);
  const [docenteId, setDocenteId] = useState('');
  const [lezioni, setLezioni] = useState([]);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');
  const [aperta, setAperta] = useState(null); // { lezione, contenuto, fonti, domande }
  // b.242 — le risposte date alla sfida: { indiceDomanda: indiceOpzione }.
  const [risposte, setRisposte] = useState({});

  // b.346 — DOCUMENTO DALLO SCANNER → LEZIONE. Il testo acquisito diventa un
  // Materiale e la lezione nasce SOLO da quello (stesso telaio di b.333).
  // DEVE stare DOPO le dichiarazioni qui sopra: elencandole fra le
  // dipendenze, se sta prima la pagina crolla al primo render (gia visto).
  useEffect(() => {
    const spegni = ascoltaScansioni(async ({ testo, dest }) => {
      if (dest !== 'impara') return;
      const t = String(testo || '');
      // b.483 — il titolo di ripiego si vedeva a schermo (testata della
      // lezione e campo dell'argomento) ed era scritto in italiano.
      const titolo = (t.split('\n').map((r) => r.trim()).find(Boolean) || tt('lifeScannedDoc', 'Documento scansionato')).slice(0, 80);
      if (!userToken) { setErrore(L('lifeLoginNeeded')); return; }
      setLavoro(true); setErrore(''); setArgomento(titolo);
      try {
        const r = await fetch('/api/compiti', { signal: AbortSignal.timeout(60000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ azione: 'salvaMateriale', userToken, materiale: { titolo, testo: t, origine: 'scanner' } }),
        });
        const d = await r.json().catch(() => null);
        if (!d?.materiale?.id) throw new Error(d?.error || 'materiale non salvato');
        const lez = await generaLezione({ argomento: titolo, categoria: 'altro', livello, lezione: { indice: 0, titolo }, lingua: linguaCorso, linguaStudiata: linguaStudiata || undefined, profilo, userToken, materialeId: d.materiale.id });
        setRisposte({});
        setAperta({ lezione: { titolo }, contenuto: lez.contenuto, fonti: lez.fonti || [], domande: null });
      } catch (e) {
        // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
        // registro non compariva nulla, e il motivo vero (rete caduta, attesa
        // scaduta, credito finito, server rotto) restava irrecuperabile.
        if (e?.name !== 'AbortError') console.warn('[b.363] /api/compiti:', e?.message || e);
        setErrore(e?.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
      } finally { setLavoro(false); }
    });
    return spegni;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userToken, livello, linguaCorso]);

  const [ascoltando, setAscoltando] = useState(false);
  const audioLezioneRef = useRef(null);
  // b.312 — LEZIONE DINAMICA: quando la si ASCOLTA diventa una presentazione
  // a diapositive (la "lavagna"), che avanza sezione per sezione con la voce.
  // `sezioneAttiva` e il paragrafo in lettura; `stopLetturaRef` ferma il giro.
  const [sezioneAttiva, setSezioneAttiva] = useState(-1);
  const stopLetturaRef = useRef(false);
  // b.363 — lo Stop del telecomando ferma anche la lettura della lezione
  useEffect(() => suInterruzione(() => { stopLetturaRef.current = true; }), []);
  // b.313 — ALZO LA MANO: interrompo il Maestro, chiedo, lui risponde e poi
  // riprende. La mano alzata NON taglia: il Maestro FINISCE il paragrafo, poi
  // si gira verso di te. `interruzionePendenteRef` = mano alzata in attesa che
  // finisca il pezzo; `inDomandaRef` = siamo nel dialogo (la lettura aspetta).
  const [manoAlzata, setManoAlzata] = useState(false);
  const [maestroStaFinendo, setMaestroStaFinendo] = useState(false);
  const [domanda, setDomanda] = useState('');
  const [dialogo, setDialogo] = useState([]); // [{ ruolo:'studente'|'maestro', testo }]
  const [chiedendo, setChiedendo] = useState(false);
  const inDomandaRef = useRef(false);
  const interruzionePendenteRef = useRef(false);
  const saltaRef = useRef(0); // b.315 — sezioni da saltare al rientro (gia trattate parlando)
  // b.334 — DETTARE la domanda: registra col microfono, trascrive, riempie
  // il campo. Secondo tocco = stop. La lezione va in pausa mentre registri.
  const [micDomanda, setMicDomanda] = useState(''); // '' | 'registro' | 'trascrivo'
  // b.335 — CONVERSAZIONE A VOCE COL MADRELINGUA (Modulo Lingue): il
  // contenitore dal-vivo di Amico, con l'Assistente come personaggio.
  const [parlaAssist, setParlaAssist] = useState(false);
  const micRecRef = useRef(null);
  const micStreamRef = useRef(null);
  const dettaDomanda = useCallback(async () => {
    if (micDomanda === 'registro') { try { micRecRef.current?.stop(); } catch { /* gia fermo: non e un guasto */ } return; }
    if (micDomanda) return;
    // b.342 — DETTATURA IN DIRETTA: prima il testo compariva tutto insieme
    // alla fine, "lasciando sorpreso l'utente" (collaudo di Luca). Dove il
    // browser sa trascrivere in tempo reale (Chrome/Safari), le parole
    // compaiono MENTRE si parla, gratis. Altrove resta la via registra-poi-
    // trascrivi, ma con lo stato bene in vista.
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (SR) {
      try {
        pausaAudio();
        const rec = new SR();
        rec.lang = linguaCorso || 'it';
        rec.interimResults = true;
        rec.continuous = true;
        const base = domanda ? domanda + ' ' : '';
        let definitivo = '';
        rec.onresult = (ev) => {
          let volatile = '';
          for (let k = ev.resultIndex; k < ev.results.length; k++) {
            const r = ev.results[k];
            if (r.isFinal) definitivo += r[0].transcript + ' ';
            else volatile += r[0].transcript;
          }
          setDomanda((base + definitivo + volatile).trimStart());
        };
        rec.onend = () => setMicDomanda('');
        rec.onerror = () => setMicDomanda('');
        micRecRef.current = rec;
        rec.start();
        setMicDomanda('registro');
      } catch { setMicDomanda(''); }
      return;
    }
    try {
      pausaAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const pezzi = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) pezzi.push(e.data); };
      rec.onstop = async () => {
        try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* microfono gia chiuso: non e un guasto */ }
        const blob = new Blob(pezzi, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 800) { setMicDomanda(''); return; }
        setMicDomanda('trascrivo');
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'domanda.webm');
          fd.append('sourceLang', linguaCorso || 'it');
          if (userToken) fd.append('userToken', userToken);
          const r = await fetch('/api/transcribe', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */, method: 'POST', body: fd });
          const d = await r.json().catch(() => null);
          const t = d?.original || '';
          if (t) setDomanda((prev) => (prev ? prev + ' ' : '') + t);
        } catch { /* la dettatura e un di piu: si scrive a mano */ }
        finally { setMicDomanda(''); }
      };
      micRecRef.current = rec;
      rec.start();
      setMicDomanda('registro');
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/transcribe:', e?.message || e);
      setMicDomanda(''); }
  }, [micDomanda, linguaCorso, userToken, domanda]);
  // b.315 — EVIDENZIA (leggi-e-segui): sfondo diverso al paragrafo che il
  // Maestro sta leggendo, cosi chi ascolta in un'altra lingua vede le parole.
  // E il testo SCORRE per tenere al centro il pezzo in lettura.
  const [evidenzia, setEvidenzia] = useState(true);
  const sezioneRef = useRef(null);
  const arricchimentoRef = useRef(null); // b.342 — dove atterra "Approfondisci"
  const fineContenutoRef = useRef(null); // b.342 — dove atterra "Vai a fondo"
  // b.228 — libreria condivisa "Corsi disponibili"
  const [disponibili, setDisponibili] = useState([]);
  // b.327 — Ondata A: I MIEI CORSI (persistiti, con progresso) e gli esiti
  // per-lezione del corso aperto (spunta ✓ con voto sulla lista).
  const [mieiCorsi, setMieiCorsi] = useState(null);
  const [esitiLezioni, setEsitiLezioni] = useState({}); // { indice: punteggio|null }
  const ricaricaMieiCorsi = useCallback(() => {
    if (!userToken) return;
    mieiCorsiUtente(userToken).then(setMieiCorsi).catch(() => {});
  }, [userToken]);
  useEffect(() => { ricaricaMieiCorsi(); }, [ricaricaMieiCorsi]);
  const ricaricaEsiti = useCallback((arg) => {
    if (!userToken || !arg) return;
    progressoCorso({ argomento: arg, userToken })
      .then((righe) => { const m = {}; for (const r of righe || []) m[r.lezione] = r.punteggio; setEsitiLezioni(m); })
      .catch(() => {});
  }, [userToken]);
  const [pubblicato, setPubblicato] = useState(false);
  // b.229 — illustrazione della lezione + tutor "compagno di viaggio"
  const [illustrazione, setIllustrazione] = useState(null);
  const [genIll, setGenIll] = useState(false);
  const tutor = compagni.find((c) => c.id === docenteId) || null;
  // b.328 — TEMPLATE RESPONSIVE (deciso con Luca): stesso contenuto,
  // distribuzione diversa. Su schermo largo le immagini vanno A MARGINE
  // (stile rivista/Wikipedia, accanto al pezzo che rappresentano); su
  // mobile restano in linea a tutta larghezza.
  const [schermoLargo, setSchermoLargo] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const aggiorna = () => setSchermoLargo(mq.matches);
    aggiorna();
    mq.addEventListener('change', aggiorna);
    return () => mq.removeEventListener('change', aggiorna);
  }, []);

  // b.300 — indice del livello per la barra
  const livelloIdx = Math.max(0, LIVELLI.findIndex((l) => l.id === livello));
  const tt = conRipiego(L); // b.362 — unica definizione, in lib/ripiego.js
  // b.482 — i colori di stato (avviso e attenzione) vengono dal tema:
  // scritti a mano restavano gli stessi anche sui temi chiari.
  const rosso = C?.statusError || '#f87171';
  const ambra = C?.statusWarning || '#f59e0b';

  // b.334 — PROFILO STUDENTE (chi sei, perche studi) + preferenze esperienza
  // (durata, stile, contenuti extra): si compilano QUI, una volta, e il
  // Maestro le riceve a ogni lezione. "Riduci o procedi" vive nella durata.
  const [prof, setProf] = useState({ eta: '', professione: '', obiettivo: '', interessi: '' });
  const [pref, setPref] = useState({ durata: 'normale', stile: '', extra: 'bilanciati' });
  const profCaricato = useRef(false);
  useEffect(() => {
    if (!userToken || profCaricato.current) return;
    profCaricato.current = true;
    profiloStudente(userToken).then((d) => {
      if (d?.profilo) setProf((p) => ({ ...p, ...d.profilo }));
      if (d?.preferenze) setPref((x) => ({ ...x, ...d.preferenze }));
    }).catch(() => {});
  }, [userToken]);
  // b.362 — DEBOUNCE: prima partiva un salvataggio A OGNI TASTO digitato
  // nei campi del profilo (una chiamata per lettera). Ora si aspetta che la
  // persona smetta di scrivere (800ms) e si salva una volta sola.
  const salvaProfTimer = useRef(null);
  const salvaProf = useCallback((profNuovo, prefNuove) => {
    if (!userToken) return;
    clearTimeout(salvaProfTimer.current);
    salvaProfTimer.current = setTimeout(() => {
      salvaProfiloStudente({ profilo: profNuovo, preferenze: prefNuove, userToken }).catch(() => { /* senza rete si risalvera al prossimo cambio */ });
    }, 800);
  }, [userToken]);
  useEffect(() => () => clearTimeout(salvaProfTimer.current), []);

  // b.334 — karaoke della frase + ripasso consigliato del corso aperto
  const [fraseK, setFraseK] = useState(-1);
  const [ripassoDa, setRipassoDa] = useState(0);

  // b.312 — paragrafi della lezione + immagine scelta per ciascuno. Calcolato
  // una volta sola (memo): serve sia alla narrazione (ritmo) sia al render
  // (lavagna/articolo), e deve coincidere fra i due.
  const { paragrafiLezione, paragrafiGrezzi, immaginiSezioni, frasiLettura } = useMemo(() => {
    if (!aperta) return { paragrafiLezione: [], paragrafiGrezzi: null, immaginiSezioni: [], frasiLettura: [] };
    // b.330 — il brano di LETTURA si stacca dal testo: diventa il pannello
    // dedicato, non prosa da mostrare o leggere nella narrazione.
    const { testo: senzaLettura, frasi } = staccaLettura(staccaEsercizio(testoVisibile(aperta.contenuto)).testo);
    const parti = senzaLettura.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const paragrafi = parti.length > 1 ? parti : [senzaLettura];
    // b.375 — LO STESSO TESTO, MA COI SEGNI ANCORA DENTRO. Serve per le
    // lingue: i tag [L2: ...] sono l'unico modo di sapere QUALI pezzi
    // sono nella lingua che si studia, e quindi quali si possono toccare
    // per sentirli. Togliendoli si perde l'informazione per sempre.
    const grezzo = staccaLettura(staccaEsercizio(String(aperta.contenuto || '')).testo).testo;
    const partiG = grezzo.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const paragrafiGrezzi = partiG.length === paragrafi.length ? partiG : null;
    const items = [...new Map((arricchimento?.link || []).filter((l) => l.immagine).map((l) => [l.immagine, l])).values()];
    return { paragrafiLezione: paragrafi, paragrafiGrezzi, immaginiSezioni: assegnaImmagini(paragrafi, items, illustrazione), frasiLettura: frasi };
  }, [aperta, arricchimento, illustrazione]);

  // b.336 — questo effetto DEVE stare dopo il memo qui sopra: elencando
  // paragrafiLezione fra le dipendenze, se sta prima la pagina crolla al
  // primo render ("Cannot access before initialization"). Gia successo.
  useEffect(() => {
    if (!ascoltando || sezioneAttiva < 0) { setFraseK(-1); return; }
    const timer = setInterval(() => {
      const a = audioLezioneRef.current;
      const par = paragrafiLezione[sezioneAttiva] || '';
      const frasi = spezzaFrasi(par);
      if (!a || !a.duration || frasi.length < 2) { setFraseK(0); return; }
      const f = Math.min(0.999, (a.currentTime || 0) / a.duration);
      const pos = f * par.length;
      let acc = 0, idx = 0;
      for (let k = 0; k < frasi.length; k++) { acc += frasi[k].length + 1; if (pos <= acc) { idx = k; break; } idx = k; }
      setFraseK(idx);
    }, 250);
    return () => clearInterval(timer);
  }, [ascoltando, sezioneAttiva, paragrafiLezione]);

  useEffect(() => { corsiDisponibili({}).then(setDisponibili).catch(() => {}); }, []);

  // b.315 — il testo SCORRE per tenere al centro il paragrafo in lettura.
  useEffect(() => {
    if (ascoltando && sezioneAttiva >= 0) {
      try { sezioneRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* niente scroll: non e un guasto */ }
    }
  }, [sezioneAttiva, ascoltando]);

  // b.482 — anche i menu a tendina e i campi si toccano col dito: sotto i
  // quarantaquattro punti il bersaglio e piu piccolo del polpastrello.
  const stileSelect = { flex: 1, minHeight: 44, padding: 10, borderRadius: 10, border: bordo, background: card, color: testoP, fontFamily: FONT, fontSize: 13 };

  // b.228 — apri un corso della libreria: carica struttura e impostazioni; le
  // lezioni si (ri)generano poi nella lingua scelta (conta per i bambini).
  const apriPubblico = useCallback((corso) => {
    setErrore(''); setAperta(null); setPubblicato(false);
    setArgomento(corso.argomento || corso.titolo || '');
    setCategoria(corso.categoria || 'altro');
    setLivello(corso.livello || 'base');
    setLinguaCorso(corso.lingua || linguaCorso);
    // b.374 — riaprendo un corso di lingua si ritrova la lingua scelta:
    // se no domani si tornerebbe a indovinarla dal titolo.
    setLinguaStudiata(corso.linguaStudiata || '');
    setSezione(corso.linguaStudiata ? 'lingue' : 'materie');
    setLezioni(corso.lezioni || []);
    // b.363 — aprendo il corso di un altro restavano appesi i MIEI voti,
    // il MIO ripasso e il MIO docente: sul corso nuovo comparivano
    // punteggi mai presi e "lezioni da riprendere" che non erano sue.
    setEsitiLezioni({});
    setRipassoDa(0);
    setDocenteId(corso.docenteId || '');
  }, [linguaCorso]);

  // b.327 — apri un MIO corso salvato: syllabus stabile, esiti, segnalibro.
  const apriMioCorso = useCallback((c) => {
    setErrore(''); setAperta(null); setPubblicato(false);
    setArgomento(c.argomento || '');
    setCategoria(c.categoria || 'altro');
    setLivello(c.livello || 'base');
    setLinguaCorso(c.lingua || linguaCorso);
    setDocenteId(c.docenteId || '');
    setLezioni(Array.isArray(c.lezioni) ? c.lezioni : []);
    const m = {}; for (const e of c.esiti || []) m[e.lezione] = e.punteggio;
    setEsitiLezioni(m);
    setRipassoDa(c.daRipassare || 0); // b.334 — ripasso a intervalli
  }, [linguaCorso]);

  // b.228 — pubblica il corso appena generato nella libreria condivisa.
  const pubblica = useCallback(async () => {
    if (!lezioni.length) return;
    try {
      await pubblicaCorso({ titolo: argomento.trim(), argomento: argomento.trim(), categoria, livello, lingua: linguaCorso, lezioni, docenteId: docenteId || undefined, userToken });
      setPubblicato(true);
      corsiDisponibili({}).then(setDisponibili).catch(() => {});
    } catch (e) {
      setErrore(e.status === 401 ? L('lifeLoginNeeded') : L('lifeError'));
    }
  }, [lezioni, argomento, categoria, livello, linguaCorso, docenteId, userToken, L]);

  const crea = useCallback(async () => {
    // b.232 — reset di `pubblicato`: senza questo, dopo aver pubblicato un
    // corso il tasto "Pubblica" restava bloccato su "✓ Pubblicato" anche per
    // il corso nuovo (sbloccabile solo cambiando scheda). apriPubblico lo fa già.
    setErrore(''); setLezioni([]); setAperta(null); setPubblicato(false);
    if (!argomento.trim()) { setErrore(L('lifeNeedTopic')); return; }
    setLavoro(true);
    try {
      const d = await generaSyllabus({ argomento: argomento.trim(), categoria, livello, docenteId: docenteId || undefined, lingua: linguaCorso, linguaStudiata: linguaStudiata || undefined, profilo, userToken });
      setLezioni(d.lezioni || []);
      // b.327 — il corso si SALVA da solo appena nasce: niente piu
      // rigenerazioni (e ripagamenti) alla prossima apertura.
      if (userToken && d.lezioni?.length) {
        salvaCorsoMio({ argomento: argomento.trim(), titolo: argomento.trim(), categoria, livello, lingua: linguaCorso, linguaStudiata: linguaStudiata || undefined, lezioni: d.lezioni, docenteId: docenteId || undefined, userToken })
          .then(() => ricaricaMieiCorsi()).catch(() => {});
      }
      // b.363 — creando un corso NUOVO restava appeso il ripasso del corso
      // precedente: sul corso appena nato compariva "lezioni da riprendere"
      // che riguardavano un altro corso.
      setEsitiLezioni({});
      setRipassoDa(0);
    } catch (e) {
      // b.358 — l'errore diceva sempre la stessa cosa («Qualcosa e andato
      // storto») qualunque fosse la causa: sessione scaduta, credito finito o
      // generazione fallita. Ora dice QUALE, e per il guasto tecnico porta
      // anche il motivo del server: senza, non si puo riparare niente.
      if (e.creditoEsaurito) setErrore(L('lifeNoCredit'));
      else if (e.status === 401) setErrore(L('lifeLoginNeeded'));
      else setErrore(e.motivo ? `${L('lifeError')} (${e.motivo})` : L('lifeError'));
    } finally { setLavoro(false); }
    // b.217 — `linguaCorso` andava nelle deps: il callback lo usa ma prima
    // elencava `lingua` (la lingua app, che non cambia mai). Chi cambiava
    // SOLO la lingua del corso e generava mandava ancora la lingua iniziale.
  }, [argomento, categoria, livello, docenteId, linguaCorso, userToken, L, ricaricaMieiCorsi]);

  const apri = useCallback(async (lezione) => {
    setLavoro(true); setErrore(''); setIllustrazione(null); setArricchimento(null);
    // b.327 — segnalibro: si riprende da qui alla prossima apertura.
    if (userToken && lezione?.indice !== undefined) segnaLibroCorso({ argomento: argomento.trim(), indice: lezione.indice, userToken }).catch(() => {});
    try {
      const d = await generaLezione({ argomento: argomento.trim(), categoria, livello, lezione, docenteId: docenteId || undefined, lingua: linguaCorso, linguaStudiata: linguaStudiata || undefined, profilo, userToken });
      setRisposte({});
      // b.348 — il tag [SCENA:] si stacca PRIMA di mostrare: e un'istruzione
      // per la tavola, non prosa da leggere ad alta voce.
      const { testo: contenutoPulito, scena } = staccaScena(d.contenuto || '');
      setAperta({ lezione, contenuto: contenutoPulito, fonti: d.fonti || [], fontiNonTrovate: !!d.fontiNonTrovate, domande: null });
      // b.299 — l'arricchimento segue il flag scelto alla creazione:
      // 'disegni' -> illustrazione del Maestro; 'foto'/'link'/'video' ->
      // dalla community (Cobra). 'nessuno' -> niente. Non blocca la
      // lezione: se l'arricchimento non arriva, il testo c'e comunque.
      // b.306 — piu contenuti INSIEME: se c'e 'disegni' si genera
      // l'illustrazione; per 'foto'/'link'/'video' si interroga la community e
      // si UNISCONO i risultati (link e video) in un solo blocco.
      // b.348 — LA TAVOLA DEL LIBRO: se la lezione ha dichiarato la sua scena
      // (corsi di lingua), si disegna QUELLA — ambiente e oggetti da nominare,
      // nello stile del livello — e non serve aver scelto "disegni": in un
      // libro di lingue la tavola non e un extra, e parte della lezione.
      if (scena) {
        generaTavola({ titolo: lezione?.titolo, argomento: argomento.trim(), livello, ambienteId: scena.ambienteId, elementi: scena.elementi, userToken })
          .then((url) => url && setIllustrazione(url)).catch(() => { /* la tavola e un di piu: la lezione resta leggibile */ });
      } else if (contenuti.includes('disegni')) {
        generaIllustrazione({ titolo: lezione?.titolo, argomento: argomento.trim(), livello, userToken })
          .then((url) => url && setIllustrazione(url)).catch(() => { /* niente disegno: si prosegue */ });
      }
      // b.334 — la manopola "Contenuti extra": minimi = niente community
      // (solo l'eventuale disegno), ricchi = tutto quello che c'e.
      const comunita = pref.extra === 'minimi' ? []
        : pref.extra === 'ricchi' ? ['foto', 'link', 'video']
        : contenuti.filter((c) => c === 'foto' || c === 'link' || c === 'video');
      if (comunita.length) {
        Promise.all(comunita.map((m) => arricchisciLezione({ modalita: m, titolo: lezione?.titolo, argomento: argomento.trim(), lingua: linguaCorso }).catch(() => null)))
          .then((esiti) => {
            const unito = { link: [], video: [] };
            for (const a of esiti) { if (!a) continue; if (Array.isArray(a.link)) unito.link.push(...a.link); if (Array.isArray(a.video)) unito.video.push(...a.video); }
            if (unito.link.length || unito.video.length) setArricchimento(unito);
          }).catch(() => {});
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] apri:', e?.message || e);
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
    } finally { setLavoro(false); }
    // b.217 — idem: `linguaCorso` nelle deps (la lezione va nella lingua scelta).
  }, [argomento, categoria, livello, docenteId, linguaCorso, userToken, L, contenuti, pref.extra]);

  // b.304 — la lezione successiva nell'elenco, per il tasto "Prosegui".
  const prossimaLezione = (() => {
    if (!aperta?.lezione || !lezioni.length) return null;
    const i = lezioni.findIndex(l => l.titolo === aperta.lezione.titolo);
    return (i >= 0 && i < lezioni.length - 1) ? lezioni[i + 1] : null;
  })();

  // b.304 — APPROFONDISCI su richiesta: cerca dalla community, ma con la
  // MODALITA tarata sul livello — bambino/base -> video semplici;
  // universitario/ricercatore -> documenti profondi (link); altrimenti
  // quello scelto alla creazione.
  const [genAppr, setGenAppr] = useState(false);
  const approfondisci = useCallback(async () => {
    if (!aperta || genAppr) return;
    setGenAppr(true);
    // b.306 — contenuti ora e un insieme: come ripiego si prende il primo
    // tipo "community" scelto (foto/link/video), altrimenti link.
    const sceltoComunita = contenuti.find((c) => c === 'foto' || c === 'link' || c === 'video');
    const perLivello = (livello === 'bambino' || livello === 'base') ? 'video'
      : (livello === 'universitario' || livello === 'ricercatore') ? 'link'
      : (sceltoComunita || 'link');
    try {
      const a = await arricchisciLezione({ modalita: perLivello, titolo: aperta.lezione?.titolo, argomento: argomento.trim(), lingua: linguaCorso });
      const nLink = Array.isArray(a?.link) ? a.link.length : 0;
      const nVideo = Array.isArray(a?.video) ? a.video.length : 0;
      if (a && (nLink || nVideo)) {
        // b.425 — SENZA DOPPIONI, e non e pignoleria.
        //
        // TROVATO NEL COLLAUDO DEL 23/08, premendo «Approfondisci» due
        // volte sulla stessa lezione: l'accumulo e voluto (ogni pressione
        // porta materiale NUOVO) ma la ricerca sullo stesso titolo
        // restituisce gli stessi articoli, e finivano in fila due volte.
        // Nella schermata si vedevano quattro link ripetuti identici.
        // L'accumulo resta; quello che sparisce e la ripetizione.
        const senzaDoppioni = (vecchi, nuovi) => {
          const visti = new Set();
          return [...(vecchi || []), ...(Array.isArray(nuovi) ? nuovi : [])].filter((x) => {
            const chiave = String(x?.url || x?.link || x?.id || x?.titolo || JSON.stringify(x));
            if (visti.has(chiave)) return false;
            visti.add(chiave); return true;
          });
        };
        setArricchimento((prec) => {
          const base = prec && (prec.link || prec.video) ? prec : { link: [], video: [] };
          return { link: senzaDoppioni(base.link, a.link), video: senzaDoppioni(base.video, a.video) };
        });
        // b.342 — il collaudo diceva "non fa niente": il risultato arrivava
        // fuori dallo schermo. Ora si va a VEDERLO.
        setTimeout(() => arricchimentoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      } else {
        setErrore(tt('lifeDeepenEmpty', 'La community non ha trovato materiali nuovi per questa lezione.'));
        setTimeout(() => setErrore(''), 5000);
      }
    } catch (e) {
      // b.342 — l'errore non si ingoia piu: si dice (credito compreso).
      setErrore(e?.creditoEsaurito ? L('lifeNoCredit') : tt('lifeDeepenFail', 'La ricerca di materiali non ha risposto. Riprova.'));
      setTimeout(() => setErrore(''), 5000);
    }
    finally { setGenAppr(false); }
  }, [aperta, genAppr, livello, contenuti, argomento, linguaCorso, tt, L]);

  // b.334 — LEZIONE DI RIPASSO: riprende SOLO le cose rimaste indietro
  // (le date di ripasso sono scadute), con esempi nuovi.
  const faiRipasso = useCallback(async () => {
    if (lavoro) return;
    setLavoro(true); setErrore(''); setIllustrazione(null); setArricchimento(null);
    try {
      // b.483 — questo titolo si legge in testa alla lezione: la parola
      // «Ripasso» era cablata in italiano per tutte le lingue.
      const titoloRipasso = `${tt('lifeReviewWord', 'Ripasso')} — ${argomento.trim()}`;
      const d = await generaLezione({ argomento: argomento.trim(), categoria, livello, lezione: { indice: 0, titolo: titoloRipasso }, docenteId: docenteId || undefined, lingua: linguaCorso, linguaStudiata: linguaStudiata || undefined, profilo, userToken, ripasso: true });
      setRisposte({});
      setAperta({ lezione: { titolo: titoloRipasso }, contenuto: d.contenuto, fonti: d.fonti || [], fontiNonTrovate: !!d.fontiNonTrovate, domande: null });
      setRipassoDa(0);
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] faiRipasso:', e?.message || e);
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError')); }
    finally { setLavoro(false); }
  }, [lavoro, argomento, categoria, livello, docenteId, linguaCorso, userToken, L, tt]);

  // b.334 — VAI A FONDO (terzo livello): il Maestro scava oltre, e il nuovo
  // pezzo si AGGIUNGE alla lezione (diapositive ricalcolate da sole).
  const [fondoLavoro, setFondoLavoro] = useState(false);
  const vaiAFondo = useCallback(async () => {
    if (!aperta || fondoLavoro) return;
    setFondoLavoro(true);
    try {
      const { risposta } = await chiediAlMaestro({
        argomento: argomento.trim(), lezione: aperta.lezione,
        sezione: (aperta.contenuto || '').slice(-1600),
        domanda: 'Vai a fondo: portami al livello successivo su questa lezione — le sfumature, un caso complesso, cio che pochi sanno. Prosa da documentario, senza rifare quanto gia detto.',
        modo: 'risposta', docenteId: docenteId || undefined, livello, lingua: linguaCorso, userToken,
      });
      if (risposta) {
        setAperta((a) => a ? { ...a, contenuto: `${a.contenuto}\n\n${risposta}` } : a);
        // b.342 — il nuovo pezzo si aggiunge in coda al testo: ci si va,
        // altrimenti "non fa niente" (collaudo di Luca).
        setTimeout(() => fineContenutoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      } else {
        setErrore(tt('lifeGoDeepEmpty', 'Il Maestro non ha aggiunto nulla: riprova fra poco.'));
        setTimeout(() => setErrore(''), 5000);
      }
    } catch (e) { setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError')); setTimeout(() => setErrore(''), 6000); }
    finally { setFondoLavoro(false); }
  }, [aperta, fondoLavoro, argomento, docenteId, livello, linguaCorso, userToken, L, tt]);

  const quiz = useCallback(async () => {
    if (!aperta) return;
    setLavoro(true);
    try {
      // b.231 — passiamo il CONTENUTO reale della lezione aperta e l'argomento:
      // il quiz chiede solo ciò che è stato davvero insegnato.
      const d = await generaQuiz({ lezione: aperta.lezione, lingua: linguaCorso, userToken, livello, contenuto: aperta.contenuto, argomento: argomento.trim() });
      setRisposte({});
      setAperta((a) => ({ ...a, domande: d.domande || [] }));
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
    } finally { setLavoro(false); }
    // b.217 — mancavano `linguaCorso` e `livello`: il quiz usa entrambi
    // (lingua del corso e registro bambino) ma le deps non li elencavano.
  }, [aperta, linguaCorso, livello, userToken, argomento, L]);

  // b.242-bis — leggi la lezione ad alta voce. Se e un corso di LINGUA, le
  // parti marcate [L2:...] passano a una voce madrelingua: e per questo che
  // il tag esiste. Altrimenti si comporta come una lettura normale.
  // b.312/b.313 — ferma del tutto la lettura/presentazione e ogni dialogo.
  const fermaLettura = useCallback(() => {
    stopLetturaRef.current = true;
    inDomandaRef.current = false;
    interruzionePendenteRef.current = false;
    fermaElemento(audioLezioneRef.current);
    setSezioneAttiva(-1);
    setAscoltando(false);
    setManoAlzata(false); setMaestroStaFinendo(false);
  }, []);

  // b.313 — ALZO LA MANO. Non taglia: segna l'intenzione. Il Maestro finisce
  // il paragrafo, poi si gira verso di te (la lettura si mette in attesa).
  const alzaMano = useCallback(() => {
    if (!ascoltando || manoAlzata) return;
    interruzionePendenteRef.current = true;
    setMaestroStaFinendo(true);
    setManoAlzata(true);
    setDialogo([]); setDomanda('');
  }, [ascoltando, manoAlzata]);

  // b.342 — la voce EFFETTIVA con cui il Maestro sta leggendo (dichiarata
  // dalla rotta): bloccata qui e riusata per risposte e rientro, cosi chi
  // interrompe non si trova davanti "un altro" che risponde al posto suo.
  const voceMaestroRef = useRef(null);

  // b.314 — il Maestro parla con la sua voce (usato per risposta e rientro).
  const diLaVoce = useCallback(async (testo) => {
    if (!testo) return;
    // b.483 — `chi` si legge sul telecomando dell'audio: senza un docente
    // scelto (il caso normale) compariva la parola italiana «Maestro».
    try { await parlaTurno({ voceId: tutor?.voce?.id || voceMaestroRef.current, testo, lingua: linguaCorso, userToken, chi: tutor?.nome || tt('lifeTeacherName', 'Maestro'), onVoce: (v) => { voceMaestroRef.current = v; } }, (a) => { audioLezioneRef.current = a; }); } catch { /* la voce e un di piu */ }
  }, [tutor, linguaCorso, userToken, tt]);

  // b.313/b.314 — invia la domanda; il Maestro risponde ancorato alla sezione,
  // poi CHIEDE se vuoi altro (non torna da solo). Dialogo a piu battute.
  const inviaDomanda = useCallback(async () => {
    const q = domanda.trim();
    if (!q || chiedendo) return;
    setChiedendo(true);
    const storiaPrec = dialogo;
    setDialogo((d) => [...d, { ruolo: 'studente', testo: q }]);
    setDomanda('');
    try {
      const sez = paragrafiLezione[Math.max(0, sezioneAttiva)] || aperta?.contenuto || '';
      const { risposta } = await chiediAlMaestro({ argomento: argomento.trim(), lezione: aperta?.lezione, sezione: sez, domanda: q, storia: storiaPrec, modo: 'risposta', docenteId: docenteId || undefined, livello, lingua: linguaCorso, userToken });
      setDialogo((d) => [...d, { ruolo: 'maestro', testo: risposta || '' }]);
      await diLaVoce(risposta);
    } catch (e) {
      setDialogo((d) => [...d, { ruolo: 'maestro', testo: e?.creditoEsaurito ? L('lifeNoCredit') : L('lifeError') }]);
    } finally { setChiedendo(false); }
  }, [domanda, chiedendo, dialogo, paragrafiLezione, sezioneAttiva, aperta, argomento, docenteId, livello, linguaCorso, userToken, diLaVoce, L]);

  // b.314 — chiusa la parentesi, il Maestro RIENTRA con garbo ("se non vi
  // dispiace, riprendiamo...") e solo dopo la lettura riparte dal punto dopo.
  const riprendiLezione = useCallback(async () => {
    if (chiedendo) return;
    setChiedendo(true);
    try {
      const sez = paragrafiLezione[Math.max(0, sezioneAttiva)] || aperta?.contenuto || '';
      const prossime = paragrafiLezione.slice(Math.max(0, sezioneAttiva) + 1, Math.max(0, sezioneAttiva) + 3);
      const { risposta: rientro, salta } = await chiediAlMaestro({ argomento: argomento.trim(), lezione: aperta?.lezione, sezione: sez, prossime, modo: 'ripresa', storia: dialogo, docenteId: docenteId || undefined, livello, lingua: linguaCorso, userToken });
      // b.315 — se parlando avete gia coperto le prossime sezioni, si saltano.
      saltaRef.current = Math.max(0, Math.min(prossime.length, Number(salta) || 0));
      await diLaVoce(rientro);
    } catch { /* niente rientro parlato: si riprende comunque */ }
    finally {
      setChiedendo(false);
      setManoAlzata(false); setMaestroStaFinendo(false);
      setDomanda(''); setDialogo([]);
      inDomandaRef.current = false; // sblocca la lettura
    }
  }, [chiedendo, paragrafiLezione, sezioneAttiva, aperta, argomento, dialogo, docenteId, livello, linguaCorso, userToken, diLaVoce]);

  const ascoltaLezione = useCallback(async () => {
    if (!aperta) return;
    if (ascoltando) { fermaLettura(); return; } // il tasto fa anche da STOP
    setAscoltando(true);
    const chiudiCicloLezione = apriCiclo();   // b.394 — la pillola serve DA ORA
    stopLetturaRef.current = false;
    inDomandaRef.current = false;
    interruzionePendenteRef.current = false;
    const l2 = (linguaStudiata || rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || ''));
    // b.312 — si legge SEZIONE per SEZIONE (paragrafi): cosi la lavagna puo
    // mostrare l'immagine giusta mentre la voce parla di quel pezzo. I tag
    // [L2:]/[PRONUNCIA:] restano gestiti da parlaBilingue dentro ogni pezzo.
    const testoTot = staccaLettura(staccaEsercizio(aperta.contenuto).testo).testo;
    const parti = testoTot.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const lista = parti.length > 1 ? parti : [testoTot];
    const aspettaDialogo = async () => { while (inDomandaRef.current && !stopLetturaRef.current) await attendi(150); };
    let partenza = 0;
    try {
      // se e stato chiesto un punto preciso, si comincia da li
      if (vaiARef.current >= 0) { partenza = Math.min(vaiARef.current, lista.length - 1); vaiARef.current = -1; }
      for (let i = partenza; i < lista.length; i++) {
        if (stopLetturaRef.current) break;
        // b.376 — un dito su un paragrafo piu avanti: si va li.
        if (vaiARef.current >= 0) { i = Math.min(vaiARef.current, lista.length - 1); vaiARef.current = -1; }
        setSezioneAttiva(i);
        await parlaBilingue({
          voceId: tutor?.voce?.id || voceMaestroRef.current,
          onVoce: (v) => { voceMaestroRef.current = v; },
          // b.323 — il DUETTO: le parti in lingua studiata le dice l'Assistente
          // madrelingua (sempre la stessa voce: lo studente lo riconosce).
          voceAssistente: (l2 && l2 !== linguaCorso) ? assistentePer(l2).voceId : null,
          testo: lista[i],
          linguaParlata: linguaCorso,
          linguaStudiata: (l2 && l2 !== linguaCorso) ? l2 : linguaCorso,
          userToken,
          // b.483 — la parola che compare sul telecomando dell'audio
          chi: tutor?.nome || L('lifeLesson'),
        }, (a) => { audioLezioneRef.current = a; });
        if (stopLetturaRef.current) break;
        // b.313 — hai alzato la mano DURANTE il paragrafo? Ora e' finito: il
        // Maestro si gira, si dialoga, e la lettura aspetta la ripresa.
        if (interruzionePendenteRef.current) {
          interruzionePendenteRef.current = false;
          inDomandaRef.current = true;
          setMaestroStaFinendo(false);
          await aspettaDialogo();
          if (stopLetturaRef.current) break;
          // b.315 — al rientro il Maestro puo aver deciso di saltare le sezioni
          // gia coperte parlando: si avanza di conseguenza.
          if (saltaRef.current > 0) { i += saltaRef.current; saltaRef.current = 0; }
        }
        // b.312 — RITMO DA DOCUMENTARIO: dopo aver letto una sezione, si
        // PRENDE IL TEMPO — piu lungo se c'e un'immagine da osservare — cosi
        // chi ascolta guarda e pensa prima che la voce riparta.
        if (!stopLetturaRef.current && i < lista.length - 1) await attendi(immaginiSezioni[i] ? 2200 : 800);
      }
    } catch { /* la voce e un di piu: la lezione resta leggibile */ }
    finally { chiudiCicloLezione(); setAscoltando(false); setSezioneAttiva(-1); inDomandaRef.current = false; setManoAlzata(false); setMaestroStaFinendo(false); }
  }, [aperta, ascoltando, argomento, linguaCorso, tutor, userToken, fermaLettura, immaginiSezioni, L]);

  // b.376 — VAI DA QUI. Un dito su un paragrafo e la voce ci si sposta.
  // Se la lezione non sta suonando, parte da li; se sta suonando, si
  // taglia la battuta in corso e si riprende dal punto chiesto.
  //
  // Perche col dito sul testo e non con due frecce: le frecce fanno
  // AVANTI E INDIETRO UNO ALLA VOLTA, e per arrivare al sesto paragrafo
  // sono sei tocchi al buio. Il testo e gia li sotto gli occhi — si
  // legge dove si vuole andare e ci si va, in un tocco solo.
  const vaiAlParagrafo = useCallback((n) => {
    vibrate(8);
    vaiARef.current = n;
    if (!ascoltando) { ascoltaLezione(); return; }
    // tagliare la voce in corso fa tornare l'attesa dentro il ciclo, che
    // al giro dopo legge il segnaposto e salta.
    fermaElemento(audioLezioneRef.current);
  }, [ascoltando, ascoltaLezione]);

  // b.242 — rispondi a una domanda; all'ultima si tirano le somme e si manda
  // l'esito al Maestro. La registrazione e' un DI PIU': se fallisce (o se non
  // hai un account) la sfida resta comunque giocata.
  const rispondi = useCallback((indice, opzione) => {
    setRisposte((prec) => {
      if (prec[indice] !== undefined) return prec;
      const nuove = { ...prec, [indice]: opzione };
      const domande = aperta?.domande || [];
      if (domande.length && Object.keys(nuove).length === domande.length) {
        const giuste = domande.filter((q, i) => nuove[i] === q.corretta).length;
        const daRivedere = domande.filter((q, i) => nuove[i] !== q.corretta).map((q) => q.domanda);
        // b.317 — audit B3: con Math.max(0, findIndex) un titolo non trovato
        // (corso di libreria, titolo cambiato) attribuiva il voto alla PRIMA
        // lezione in silenzio. Se non si trova, non si registra: l'esito e
        // un di piu, un esito sbagliato e peggio di nessun esito.
        const indiceLezione = lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo);
        if (indiceLezione >= 0) registraEsito({
          argomento: argomento.trim(),
          lezioneIndice: indiceLezione,
          punteggio: Math.round((giuste / domande.length) * 100),
          daRivedere,
          userToken,
        }).then(() => { ricaricaEsiti(argomento.trim()); ricaricaMieiCorsi(); })
          .catch(() => { /* il ricordo e un di piu: la sfida resta valida */ });
      }
      return nuove;
    });
  }, [aperta, lezioni, argomento, userToken, ricaricaEsiti, ricaricaMieiCorsi]);

  // b.229 — illustrazione della lezione (gpt-image-1). Costo dal wallet.
  const illustra = useCallback(async () => {
    if (!aperta || genIll) return;
    setGenIll(true);
    try {
      const url = await generaIllustrazione({ titolo: aperta.lezione?.titolo, argomento: argomento.trim(), livello, userToken });
      if (url) setIllustrazione(url);
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
    } finally { setGenIll(false); }
  }, [aperta, genIll, argomento, livello, userToken, L]);

  if (aperta) {
    return (
      <div>
        <button onClick={() => { stopLetturaRef.current = true; fermaElemento(audioLezioneRef.current); setSezioneAttiva(-1); setAperta(null); }} style={{ minHeight: 44, background: card, border: bordo, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: testoP, fontFamily: FONT, marginBottom: 12 }}>
          <Icon name="back" size={14} color={testoP} /> {L('lifeLessons')}
        </button>
        {/* b.229 — tutor "compagno di viaggio" accanto al titolo.
            b.323 — nel corso di lingua c'e anche l'ASSISTENTE MADRELINGUA:
            volto e nome accanto al Maestro, cosi si sa chi parla. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
          {tutor?.avatar && <img src={tutor.avatar} alt="" width={34} height={34} style={{ borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />}
          <h3 style={{ color: testoP, margin: 0, flex: 1 }}>{aperta.lezione.titolo}</h3>
          {(() => {
            const l2c = (linguaStudiata || rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || ''));
            if (!l2c || l2c === linguaCorso) return null;
            const assist = assistentePer(l2c);
            // b.482 — le parole di questo tasto erano scritte in italiano dentro
            // il codice: chi usa l'app in un'altra lingua leggeva l'italiano.
            return (
              <button onClick={() => { vibrate(8); fermaLettura(); setParlaAssist((v) => !v); }}
                title={`${tt('lifeSpeakLiveWith', 'Parla dal vivo con')} ${assist.nome}`}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '4px 9px', borderRadius: 999, background: parlaAssist ? `${accent}22` : card, border: parlaAssist ? `1px solid ${accent}` : bordo, flexShrink: 0, cursor: 'pointer', fontFamily: FONT }}>
                <img src={assist.avatar} alt="" width={22} height={22} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: parlaAssist ? accent : muto }}>{parlaAssist ? L('closeWord') : `${tt('lifeSpeakWith', 'Parla con')} ${assist.nome}`}</span>
              </button>
            );
          })()}
        </div>

        {/* b.435 — A CHE PUNTO SEI, che non si e mai visto. L'indice della
            lezione dentro il programma esisteva gia ed era calcolato in due
            punti — serviva a sapere qual e la prossima e a registrare gli
            esiti — ma a schermo non compariva da nessuna parte: si apriva
            una lezione senza sapere se era la prima di tre o l'ottava di
            venti, cioe senza sapere quanto manca.
            Il contatore e scritto coi soli numeri («3 / 12») e non con una
            parola in mezzo: cosi non serve una traduzione in trentotto
            lingue per dire una cosa che i numeri dicono da soli.
            Altezza fissa: se le lezioni non ci sono, il posto resta vuoto e
            non si sposta niente. */}
        {lezioni.length > 0 && (() => {
          const posto = lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo);
          if (posto < 0) return null;
          const quota = ((posto + 1) / lezioni.length) * 100;
          return (
            <div style={{ margin: '0 0 14px' }} aria-label={`${posto + 1} / ${lezioni.length}`}>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
                <div style={{ width: `${quota}%`, height: '100%', background: accent, transition: 'width 240ms ease' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: muto,
                fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>
                {posto + 1} / {lezioni.length}
              </div>
            </div>
          );
        })()}

        {/* b.335 — la conversazione VOCALE col Madrelingua: role-play vero,
            in lingua originale, dentro la lezione. */}
        {parlaAssist && (() => {
          const l2c = (linguaStudiata || rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || ''));
          if (!l2c) return null;
          const assist = assistentePer(l2c);
          const finto = {
            nome: assist.nome,
            ruolo: 'insegnante madrelingua',
            avatar: assist.avatar,
            personalita: `Sei ${assist.nome}, insegnante madrelingua (${assist.tratto}). Stai facendo CONVERSAZIONE con uno studente che studia la tua lingua (lezione: "${aperta.lezione?.titolo || argomento}"). Parla SOLO nella tua lingua, con frasi brevi e chiare, adattate al livello che senti; se lo studente si blocca, rallenta e semplifica; correggi NEL FLUSSO ripetendo bene la frase, senza fermare la conversazione per la grammatica. Metti lo studente in situazioni vere (ordinare, chiedere, raccontare) e fallo parlare piu di te.`,
            lingua: l2c,
          };
          // b.339 — anche qui la sessione dal vivo conosce il terreno: titolo
          // della lezione e la parte di testo su cui si sta lavorando.
          const brano = (paragrafiLezione[sezioneAttiva >= 0 ? sezioneAttiva : 0] || paragrafiLezione[0] || '').slice(0, 1200);
          return <CompagnoLive L={L} compagno={finto} lingua={l2c} onChiudi={() => setParlaAssist(false)}
            contesto={`Lezione in corso: "${aperta.lezione?.titolo || argomento}".\nBrano su cui stiamo lavorando:\n${brano}`}
            {...{ testoP, muto, accent, card, bordo }} />;
        })()}

        {/* b.315 — CONTROLLI IN ALTO: ascolta/ferma, evidenzia, alza la mano.
            Restano in cima mentre il testo scorre sotto. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, position: 'sticky', top: 0, zIndex: 5, paddingTop: 2 }}>
          {/* b.404 — grafica comune. Il quadrato di Stop non serve piu
              qui: mentre suona il telecomando in basso e acceso, ed e li
              che si ferma — in un posto solo, per tutta l'app. */}
          <Ascolta onAscolta={ascoltaLezione} suona={ascoltando}
            parola={ascoltando ? tt('lifeStopListen', 'Ferma') : tt('lifeListen', 'Ascolta')}
            etichetta={tt('lifeListen', 'Ascolta')}
            colore={accent} bordo={`1px solid ${accent}`}
            sfondo={ascoltando ? `${accent}22` : 'transparent'} />
          <button onClick={() => setEvidenzia((v) => !v)} aria-pressed={evidenzia}
            style={{ minHeight: 44, padding: '9px 12px', borderRadius: 12, border: bordo, background: evidenzia ? `${accent}14` : 'transparent', color: evidenzia ? accent : muto, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
            {evidenzia ? '✓ ' : ''}{tt('lifeHighlight', 'Evidenzia')}
          </button>
          {ascoltando && !manoAlzata && (
            <button onClick={alzaMano}
              style={{ minHeight: 44, padding: '9px 12px', borderRadius: 12, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="chat" size={15} color={accent} /> {tt('lifeRaiseHand', 'Alza la mano')}
            </button>
          )}
        </div>

        {/* b.229/b.299 — l'illustrazione (modalita 'disegni'). Il pulsante
            manuale resta come ripiego se l'auto non e partita. */}
        {illustrazione
          ? <img src={illustrazione} alt="" style={{ width: '100%', borderRadius: 14, marginBottom: 12, display: 'block' }} />
          : contenuti.includes('disegni') && <button onClick={illustra} disabled={genIll}
              style={{ minHeight: 44, marginBottom: 12, padding: '8px 12px', borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT, opacity: genIll ? 0.6 : 1 }}>
              {genIll ? '…' : tt('lifeLessonIllustrate', 'Genera illustrazione')}
            </button>}

        {/* b.299 — l'arricchimento dalla community (Cobra): link o video. */}
        {arricchimento?.link?.length > 0 && (
          <div ref={arricchimentoRef} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {arricchimento.link.map((f, i) => (
              <a key={i} href={f.url || f.link} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '9px 11px', borderRadius: 10,
                  background: card, color: accent, textDecoration: 'none', fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                <Icon name="link" size={15} color={accent} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.titolo || f.title || f.url}</span>
              </a>
            ))}
          </div>
        )}
        {arricchimento?.video?.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {arricchimento.video.map((v, i) => (
              <a key={i} href={v.url || `https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '9px 11px', borderRadius: 10,
                  background: card, color: accent, textDecoration: 'none', fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                <Icon name="video" size={15} color={accent} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.titolo || v.title || tt('lifeContentVideo', 'Video')}</span>
              </a>
            ))}
          </div>
        )}

        {/* b.242-bis — il tag [L2:...] non si mostra MAI: e un'istruzione per
            la voce, non testo da leggere.
            b.312 — LEZIONE DINAMICA: in ASCOLTO diventa una lavagna (immagine
            della sezione + testo di quel pezzo, che avanza con la voce); in
            LETTURA le immagini reali sono impaginate fra i paragrafi, come in
            un articolo di giornale. Le immagini vengono dalla community
            (anteprime reali del web), gratis; l'illustrazione AI resta in cima. */}
        {/* b.315 — UN SOLO testo, che scorre. In ascolto il paragrafo in
            lettura si EVIDENZIA (sfondo diverso) e il testo scorre per tenerlo
            al centro; le immagini reali restano impaginate accanto al pezzo che
            rappresentano (stile Wikipedia). Il pannello "alza la mano" compare
            sotto il paragrafo in corso. */}
        <div>
          {paragrafiLezione.map((p, i) => {
            const attivo = ascoltando && i === sezioneAttiva;
            const evid = attivo && evidenzia;
            return (
              <div key={i} ref={attivo ? sezioneRef : null}
                // b.376 — il paragrafo si tocca e la voce ci va. Doppio
                // tocco per non rubare la selezione del testo a chi
                // vuole copiare una frase.
                onDoubleClick={() => vaiAlParagrafo(i)}
                title={tt('lifeJumpHere', 'Tocca due volte: la voce riprende da qui')}
                style={{ cursor: 'pointer', minHeight: 44, borderRadius: 12, padding: evid ? '10px 12px' : 0, margin: evid ? '4px -12px 8px' : '0 0 2px',
                  background: evid ? `${accent}14` : 'transparent',
                  borderLeft: `3px solid ${attivo ? accent : 'transparent'}`,
                  transition: 'background 0.3s, border-color 0.3s',
                  // b.328 — chiude il float dell'immagine a margine (desktop)
                  // prima della sezione successiva.
                  overflow: schermoLargo ? 'hidden' : undefined }}>
                {/* b.328 — su schermo largo l'immagine sta PRIMA del testo,
                    flottata a destra: il testo la abbraccia (stile rivista).
                    Su mobile resta dopo il paragrafo, a tutta larghezza. */}
                {immaginiSezioni[i] && schermoLargo && (
                  <img src={immaginiSezioni[i]} alt="" style={{ float: 'right', width: '42%', marginLeft: 14, marginBottom: 8, borderRadius: 12, objectFit: 'cover', maxHeight: 220, border: bordo }} />
                )}
                {attivo && evidenzia && fraseK >= 0 ? (
                  // b.334 — KARAOKE: la frase che la voce sta dicendo e accesa,
                  // le gia dette restano piene, quelle in arrivo sono tenui.
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: testoP }}>
                    {spezzaFrasi(p).map((f, k) => (
                      <span key={k} style={{
                        opacity: k < fraseK ? 0.85 : k === fraseK ? 1 : 0.38,
                        background: k === fraseK ? `${accent}1f` : 'transparent',
                        borderRadius: 6, padding: k === fraseK ? '1px 3px' : 0,
                        transition: 'opacity 0.25s, background 0.25s' }}>{f} </span>
                    ))}
                  </div>
                ) : (linguaStudiata && paragrafiGrezzi?.[i]) ? (
                  // b.375 — NELLE LINGUE IL TESTO SI TOCCA. Ogni parte in
                  // lingua straniera la dice la voce madrelingua: e la
                  // ragione per cui uno apre un corso di lingua invece di
                  // un libro. Nelle materie resta il testo normale.
                  <TestoLingua testo={paragrafiGrezzi[i]} lingua={linguaStudiata}
                    voceAssistente={assistentePer(linguaStudiata).voceId} userToken={userToken}
                    testoP={testoP} muto={muto} accent={accent} card={card} bordo={bordo} />
                ) : (
                  <TestoRicco testo={p} testoP={testoP} muto={muto} />
                )}
                {immaginiSezioni[i] && !schermoLargo && (
                  <img src={immaginiSezioni[i]} alt="" style={{ width: '100%', borderRadius: 14, margin: '6px 0 14px', display: 'block', objectFit: 'cover', maxHeight: 320, border: bordo }} />
                )}

                {/* b.313/b.314 — "alza la mano": il dialogo col Maestro, sotto
                    il paragrafo in corso. */}
                {attivo && manoAlzata && (
                  <div style={{ marginTop: 10, padding: 14, borderRadius: 14, background: card, border: `1px solid ${accent}55` }}>
                    {maestroStaFinendo
                      ? <div style={{ fontSize: 12, color: muto, marginBottom: 10 }}>{tt('lifeHandUp', 'Mano alzata — il Maestro finisce la frase e si gira verso di te…')}</div>
                      : <div style={{ fontSize: 12, fontWeight: 600, color: accent, marginBottom: 10 }}>{tt('lifeAskNow', 'Il Maestro ti ascolta. Cosa vuoi chiedere?')}</div>}
                    {dialogo.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        {dialogo.map((t, k) => (
                          <div key={k} style={{ alignSelf: t.ruolo === 'studente' ? 'flex-end' : 'flex-start', maxWidth: '90%',
                            padding: '9px 12px', borderRadius: 12,
                            background: t.ruolo === 'studente' ? `${accent}1f` : 'rgba(255,255,255,0.05)',
                            border: t.ruolo === 'studente' ? `1px solid ${accent}44` : bordo }}>
                            {t.ruolo === 'maestro'
                              ? <TestoRicco testo={t.testo} testoP={testoP} muto={muto} />
                              : <span style={{ fontSize: 14, color: testoP }}>{t.testo}</span>}
                          </div>
                        ))}
                        {chiedendo && <div style={{ alignSelf: 'flex-start', fontSize: 12, color: muto }}>…</div>}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                      <textarea value={domanda} onChange={(e) => setDomanda(e.target.value)} rows={2}
                        placeholder={dialogo.length ? tt('lifeAskMore', 'Un’altra domanda…') : tt('lifeAskPh', 'La tua domanda… (o dettala col microfono)')}
                        style={{ flex: 1, padding: 11, borderRadius: 10, border: bordo, background: 'rgba(255,255,255,0.04)', color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', resize: 'vertical' }} />
                      {/* b.334 — la domanda si puo DETTARE: registra, trascrive, riempie. */}
                      <button onClick={dettaDomanda}
                        aria-label={tt('lifeDictate', 'Detta la domanda')}
                        style={{ width: 44, height: 44, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                          border: micDomanda === 'registro' ? `2px solid ${rosso}` : `1px solid ${accent}`,
                          background: micDomanda === 'registro' ? 'rgba(248,113,113,0.15)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="mic" size={17} color={micDomanda === 'registro' ? rosso : accent} />
                      </button>
                    </div>
                    {micDomanda === 'registro' && <div style={{ fontSize: 11, color: rosso, marginTop: 4 }}>{tt('lifeListeningTap', 'Ti ascolto — parla; tocca di nuovo il microfono per fermare')}</div>}
                    {micDomanda === 'trascrivo' && <div style={{ fontSize: 11, color: muto, marginTop: 4 }}>{tt('lifeTranscribing', 'Trascrivo…')}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button onClick={inviaDomanda} disabled={chiedendo || !domanda.trim()}
                        style={{ flex: 1, minWidth: 120, minHeight: 44, padding: 11, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, opacity: (chiedendo || !domanda.trim()) ? 0.6 : 1 }}>
                        {chiedendo ? '…' : tt('lifeAsk', 'Chiedi')}
                      </button>
                      <button onClick={riprendiLezione} disabled={chiedendo}
                        style={{ flex: 1, minWidth: 120, minHeight: 44, padding: 11, borderRadius: 12, border: bordo, background: 'transparent', color: testoP, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, opacity: chiedendo ? 0.6 : 1 }}>
                        {tt('lifeResumeLesson', 'Riprendi la lezione')} →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* b.244 — se il Maestro ha proposto [PRONUNCIA: ...], qui si dice ad
            alta voce e si scopre subito com'e andata. L'esito torna a lui:
            le parole sbagliate ricompaiono piu avanti, dentro altre frasi. */}
        {(() => {
          const es = staccaEsercizio(testoVisibile(aperta.contenuto)).esercizio;
          if (!es) return null;
          const l2 = (linguaStudiata || rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || ''));
          // b.317 — audit 6.8: senza `key`, cambiando lezione React riusava il
          // pannello e si vedeva il punteggio della frase precedente sotto la
          // frase nuova. Con key={es} il pannello riparte pulito.
          return <PannelloPronuncia key={es} frase={es} lingua={l2 || linguaCorso} userToken={userToken}
            voceAssistente={l2 ? assistentePer(l2).voceId : null} nomeAssistente={l2 ? assistentePer(l2).nome : ''}
            onEsito={({ punteggio, daRivedere }) => {
              // b.317 — audit B2/6.2: quiz e pronuncia scrivevano sulla STESSA
              // riga (stesso corso+lezione) e l'ultimo cancellava l'altro. La
              // pronuncia ora vive sotto una chiave-corso separata; e con
              // findIndex non trovato non si registra (vedi sopra).
              const idx = lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo);
              // b.334 — la risposta TORNA al pannello: se una parola e alla
              // seconda volta, il drill parte da solo.
              if (idx >= 0) return registraEsito({
                argomento: `${argomento.trim()} · pronuncia`,
                lezioneIndice: idx,
                punteggio, daRivedere, userToken,
                tipo: 'pronuncia', linguaStudiata: l2 || linguaCorso,
              }).catch(() => { /* il ricordo e un di piu */ });
            }}
            {...{ testoP, muto, accent, card, bordo }} />;
        })()}

        {/* b.330 — LETTURA GUIDATA (duetto): il brano in lingua originale,
            frase per frase — l'Assistente la dice (anche lenta), poi la
            leggi tu, col confronto e il grafico della fonia. */}
        {/* b.384 — la striscia di chi mi sta accanto. Sta in fondo alla
            lezione, occupa sempre la stessa altezza, e parla solo quando
            un pezzo e finito — cioe quando la voce del Maestro tace. */}
        {compagnoSventura && (
          <CompagnoDiSventura
            compagno={compagnoSventura}
            argomento={argomento}
            pezzo={paragrafiLezione[Math.max(0, sezioneAttiva)] || ''}
            indicePezzo={sezioneAttiva}
            lingua={linguaCorso} userToken={userToken}
            testoP={testoP} muto={muto} accent={accent} card={card} bordo={bordo} L={tt} />
        )}

        {frasiLettura.length > 0 && (() => {
          const l2c = (linguaStudiata || rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || ''));
          if (!l2c) return null;
          const assist = assistentePer(l2c);
          return <PannelloLettura frasi={frasiLettura} lingua={l2c}
            voceAssistente={assist.voceId} nomeAssistente={assist.nome} userToken={userToken}
            onEsito={({ punteggio, daRivedere }) => {
              const idx = lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo);
              if (idx >= 0) return registraEsito({
                argomento: `${argomento.trim()} · pronuncia`, lezioneIndice: idx,
                punteggio, daRivedere, userToken, tipo: 'pronuncia', linguaStudiata: l2c,
              }).catch(() => { /* il ricordo e un di piu */ });
            }}
            {...{ testoP, muto, accent, card, bordo }} />;
        })()}
        {/* b.315 — il tasto Ascolta e' salito in ALTO (barra dei controlli);
            qui in fondo non serve piu. */}
        {/* b.363 — se le fonti non si sono trovate lo si DICE: prima una
            lezione senza un solo documento era identica a una fondata. */}
        {aperta.fontiNonTrovate && aperta.fonti.length === 0 && (
          <div style={{ marginTop: 14, fontSize: 12, color: muto }}>
            {L('lifeNoSourcesFound')}
          </div>
        )}
        {aperta.fonti.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12, color: muto }}>
            <b style={{ fontWeight: 600 }}>{L('lifeSources')}:</b> {aperta.fonti.map((f, i) => <span key={i}>{f.titolo}{i < aperta.fonti.length - 1 ? ' · ' : ''}</span>)}
          </div>
        )}
        {/* b.304 — dopo la lezione: APPROFONDISCI o PROSEGUI. Approfondisci
            cerca video/articoli dalla community TARATI sul livello (bambino
            -> semplici; universitario -> documenti profondi). Prosegui apre
            la lezione successiva. Poi, quando vuole, il quiz. */}
        <div ref={fineContenutoRef} />
        {/* b.342 — l'errore si vede QUI, accanto ai tasti che l'hanno causato:
            prima compariva solo in cima, fuori schermo, e "i tasti sembravano
            morti" (collaudo di Luca — era il credito esaurito). */}
        {errore && <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.12)', color: rosso, fontSize: 13, fontFamily: FONT }}>{errore}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={approfondisci} disabled={genAppr}
            style={{ flex: 1, minWidth: 130, minHeight: 44, padding: 12, borderRadius: 12, border: `2px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, opacity: genAppr ? 0.6 : 1 }}>
            {genAppr ? '…' : tt('lifeDeepen', 'Approfondisci')}
          </button>
          {/* b.334 — il TERZO livello: il Maestro scava oltre e il nuovo pezzo
              si aggiunge alla lezione (diapositive ricalcolate da sole). */}
          <button onClick={vaiAFondo} disabled={fondoLavoro}
            style={{ flex: 1, minWidth: 130, minHeight: 44, padding: 12, borderRadius: 12, border: `2px solid ${accent}`, background: `${accent}14`, color: accent, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, opacity: fondoLavoro ? 0.6 : 1 }}>
            {fondoLavoro ? '…' : tt('lifeGoDeep', 'Vai a fondo')}
          </button>
          {prossimaLezione && (
            <button onClick={() => apri(prossimaLezione)} disabled={lavoro}
              style={{ flex: 1, minWidth: 130, minHeight: 44, padding: 12, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              {tt('lifeContinue', 'Prosegui')} →
            </button>
          )}
        </div>
        {!aperta.domande
          ? <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={quiz} disabled={lavoro} style={{ flex: 1, minHeight: 44, padding: 12, borderRadius: 12, border: 'none', background: card, color: testoP, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                {lavoro ? L('lifeGenerating') : L('lifeQuiz')}
              </button>
              {/* b.320 — decisione di Luca: il quiz NON e obbligatorio, si puo
                  SALTARE. Ma il salto viene REGISTRATO (lezione vista senza
                  verifica, punteggio nullo): incide sulla valutazione globale
                  del raggiungimento dell'obiettivo. */}
              <button onClick={() => {
                  const idx = lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo);
                  if (idx >= 0) registraEsito({ argomento: argomento.trim(), lezioneIndice: idx, punteggio: null, daRivedere: [], userToken })
                    .then(() => { ricaricaEsiti(argomento.trim()); ricaricaMieiCorsi(); })
                    .catch(() => { /* il ricordo e un di piu */ });
                  if (prossimaLezione) apri(prossimaLezione); else setAperta(null);
                }} disabled={lavoro}
                style={{ minHeight: 44, padding: '12px 14px', borderRadius: 12, border: bordo, background: 'transparent', color: muto, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
                {tt('lifeQuizSkip', 'Salta')} →
              </button>
            </div>
          : <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* ── b.242 · LA SFIDA SI GIOCA ──
                  Prima le risposte giuste erano gia segnate col ✓: non c'era
                  niente da rispondere, e quindi niente da imparare e niente
                  da ricordare. Ora si sceglie, si vede subito com'e andata, e
                  l'esito arriva al Maestro (registraEsito) che la prossima
                  volta sa dove sei e cosa e rimasto indietro. */}
              {aperta.domande.map((q, i) => {
                const scelta = risposte[i];
                const data = scelta !== undefined;
                return (
                  <div key={i} style={{ padding: 12, borderRadius: 12, background: card, border: bordo }}>
                    <div style={{ fontWeight: 600, color: testoP, marginBottom: 8 }}>{i + 1}. {q.domanda}</div>
                    {q.opzioni.map((o, j) => {
                      const giusta = j === q.corretta;
                      const miaSbagliata = data && scelta === j && !giusta;
                      const colore = data ? (giusta ? accent : miaSbagliata ? rosso : muto) : testoP;
                      return (
                        <button key={j} onClick={() => !data && rispondi(i, j)} disabled={data}
                          style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', fontSize: 14, color: colore,
                            padding: '7px 10px', margin: '3px 0', borderRadius: 9, fontFamily: FONT,
                            border: `1px solid ${data && (giusta || miaSbagliata) ? colore : 'transparent'}`,
                            background: data ? 'transparent' : card, cursor: data ? 'default' : 'pointer' }}>
                          {data ? (giusta ? '✓ ' : miaSbagliata ? '✗ ' : '· ') : '· '}{o}
                        </button>
                      );
                    })}
                    {data && q.spiegazione && <div style={{ fontSize: 12, color: muto, marginTop: 6 }}>{q.spiegazione}</div>}
                  </div>
                );
              })}
              {/* Il risultato arriva solo quando hai risposto a tutto. */}
              {aperta.domande.length > 0 && Object.keys(risposte).length === aperta.domande.length && (
                <div style={{ padding: 14, borderRadius: 12, background: card, border: `1px solid ${accent}`, color: testoP, fontWeight: 600 }}>
                  {(() => {
                    const giuste = aperta.domande.filter((q, i) => risposte[i] === q.corretta).length;
                    const tot = aperta.domande.length;
                    return `${giuste}/${tot} — ${giuste === tot ? tt('lifeQuizAll', 'tutte giuste')
                      : giuste * 2 >= tot ? tt('lifeQuizGood', 'ci siamo')
                      : tt('lifeQuizRetry', 'da riprendere insieme')}`;
                  })()}
                </div>
              )}
            </div>}
      </div>
    );
  }

  return (
    <div>
      {/* b.327 — I MIEI CORSI: persistiti, con barra di avanzamento e
          Riprendi. Le lezioni saltate contano meta (il salto pesa). */}
      {mieiCorsi?.length > 0 && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{tt('lifeMyCourses', 'I miei corsi')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mieiCorsi.slice(0, 6).map((c) => (
            <button key={c.id} onClick={() => { vibrate(8); apriMioCorso(c); }}
              style={{ textAlign: 'left', minHeight: 44, padding: 13, ...clayCard(card), cursor: 'pointer', fontFamily: FONT, color: testoP }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titolo || c.argomento}</div>
                  <div style={{ fontSize: 11, color: muto, marginTop: 2 }}>{c.superate}/{c.totale} {tt('lifeLessonsDone', 'superate')}{c.saltate ? ` · ${c.saltate} ${tt('lifeLessonsSkipped', 'saltate')}` : ''} · {tt('lifeResume', 'riprendi')}: {Math.min((c.ultimaLezione || 0) + 1, c.totale)}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.percento >= 100 ? '#f1c40f' : accent }}>{c.percento}%</span>
              </div>
              <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${c.percento}%`, height: '100%', background: c.percento >= 100 ? '#f1c40f' : accent }} />
              </div>
            </button>
          ))}
        </div>
      </div>}

      {/* b.228 — libreria condivisa: corsi già pronti, da avviare con un tocco. */}
      {disponibili.length > 0 && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{tt('lifeCoursesAvailable', 'Corsi disponibili')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {disponibili.slice(0, 8).map((corso) => (
            <button key={corso.id} onClick={() => apriPubblico(corso)}
              style={{ textAlign: 'left', minHeight: 44, padding: 13, ...clayCard(card), cursor: 'pointer', fontFamily: FONT, color: testoP }}>
              {/* b.482 — la faccina che diceva "per bambini" diventa un'icona:
                  a schermo le emoticon non ci vanno. */}
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{corso.perBambini ? <Icon name="user" size={13} color={muto} /> : null}{corso.titolo}</div>
              <div style={{ fontSize: 11, color: muto, marginTop: 2 }}>{(LANGS.find(l => l.code === corso.lingua)?.flag || '')} {corso.lezioni?.length || 0} {tt('lifeLessonsCount', 'lezioni')} · {corso.livello}</div>
            </button>
          ))}
        </div>
      </div>}

      <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{tt('lifeCreateOwn', 'Crea un corso')}</div>

      {/* ═══ b.374 — DUE SEZIONI, NON UNA (ordine di Luca) ═══
          Una materia e una lingua non si studiano allo stesso modo: la
          materia si legge, la lingua si PARLA. Tenendole insieme, un
          corso di lingua partiva con l'impostazione di una materia
          qualunque, e l'esercizio a voce compariva solo se il titolo
          conteneva per caso la parola giusta. Qui la sezione si sceglie
          per prima, e da li tutto il resto si imposta di conseguenza. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { id: 'materie', et: tt('lifeSectionSubjects', 'Materie'), ic: 'doc' },
          { id: 'lingue',  et: tt('lifeSectionLanguages', 'Lingue'),  ic: 'chat' },
        ].map((sz) => {
          const on = sezione === sz.id;
          return (
            <button key={sz.id} onClick={() => {
                setSezione(sz.id);
                // cambiando sezione si azzera cio che apparteneva all'altra:
                // un titolo di storia in mezzo alle lingue non ha senso.
                setLinguaStudiata(''); setArgomento(''); setLezioni([]); setAperta(null);
              }}
              aria-pressed={on}
              style={{
                flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT,
                fontSize: 13.5, fontWeight: 600,
                background: on ? `${accent}1E` : card, border: on ? `1px solid ${accent}55` : bordo,
                color: on ? accent : testoP,
              }}>
              <Icon name={sz.ic} size={14} color={on ? accent : muto} />
              {sz.et}
            </button>
          );
        })}
      </div>

      {/* LA SEZIONE LINGUE: si sceglie QUALE lingua, e da quel momento il
          sistema sa che si studia una lingua — non lo deve dedurre. */}
      {sezione === 'lingue' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>
            {tt('lifeWhichLanguage', 'Quale lingua vuoi imparare?')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LINGUE_IMPARABILI.map((code) => {
              const l = LANGS.find((x) => x.code === code);
              if (!l) return null;
              const on = linguaStudiata === code;
              return (
                <button key={code} onClick={() => {
                    setLinguaStudiata(code);
                    // il titolo si scrive da solo: e il nome della lingua.
                    // Resta modificabile, ma non serve piu azzeccarlo.
                    setArgomento(l.name);
                  }}
                  aria-pressed={on}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '8px 12px',
                    borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                    fontSize: 13, fontWeight: 600,
                    background: on ? `${accent}1E` : card, border: on ? `1px solid ${accent}55` : bordo,
                    color: on ? accent : testoP,
                  }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>{l.flag}</span>
                  {l.name}
                  {/* b.378 — SI DICE. Per coreano e russo non abbiamo una
                      voce davvero certificata: la sintesi esce
                      comprensibile ma con l'accento di un'altra lingua.
                      Su un corso di conversazione passerebbe; su un corso
                      di PRONUNCIA no — staremmo insegnando a imitare un
                      accento sbagliato. Chi sceglie deve saperlo prima,
                      non scoprirlo dopo aver studiato un mese. */}
                  {vocePrestata(code) && (
                    <span title={tt('lifeBorrowedVoiceWhy', 'Per questa lingua non abbiamo ancora una voce madrelingua certificata: la pronuncia del modello e approssimata.')}
                      style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: .4,
                        padding: '1px 5px', borderRadius: 5,
                        background: 'rgba(224,138,94,0.16)', color: '#e08a5e',
                      }}>
                      {tt('lifeBorrowedVoice', 'voce approssimata')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* b.378 — CHI STUDIA. Non e il livello: e un asse a parte, e
              cambia la FORMA della lezione (quanto dura, in quali
              situazioni si svolge, quanto si ripete) — non il tono, che
              lo decide gia il livello. */}
          <div style={{ fontSize: 12, color: muto, margin: '16px 0 8px' }}>
            {tt('lifeWhoStudies', 'Chi studia')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PROFILI.map((pr) => {
              const on = profilo === pr.id;
              return (
                <button key={pr.id} onClick={() => { vibrate(6); setProfilo(pr.id); }}
                  aria-pressed={on}
                  title={pr.minuti ? `${pr.minuti} min` : ''}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '8px 12px',
                    borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                    fontSize: 13, fontWeight: 600,
                    background: on ? `${accent}1E` : card, border: on ? `1px solid ${accent}55` : bordo,
                    color: on ? accent : testoP,
                  }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{pr.icona}</span>
                  {pr.etichetta}
                </button>
              );
            })}
          </div>

          {/* b.384 — CHI MI STA ACCANTO. Non un elenco nuovo: uno dei
              Compagni che ho gia. Da qui in poi quello stesso personaggio
              mi accompagna anche mentre studio — e se domani lo voglio
              anche come coach degli obiettivi, e sempre lui. */}
          {compagni?.length > 0 && (<>
            <div style={{ fontSize: 12, color: muto, margin: '16px 0 8px' }}>
              {tt('sideCompanionWho', 'Chi mi sta accanto')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {compagni.slice(0, 8).map((c) => {
                const on = sventuraId === c.id;
                return (
                  <button key={c.id} onClick={() => scegliSventura(c.id)} aria-pressed={on}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '6px 11px 6px 6px',
                      borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                      fontSize: 13, fontWeight: 600,
                      background: on ? `${accent}1E` : card, border: on ? `1px solid ${accent}55` : bordo,
                      color: on ? accent : testoP,
                    }}>
                    <AvatarImg src={c.avatar} alt={c.nome} size={22} />
                    {c.nome}
                  </button>
                );
              })}
            </div>
          </>)}
        </div>
      )}

      {/* il titolo libero resta, ma nelle Lingue e gia compilato */}
      <input value={argomento} onChange={(e) => setArgomento(e.target.value)} placeholder={L('lifeLearnPh')}
        style={{ width: '100%', padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 15, fontFamily: FONT, boxSizing: 'border-box', marginBottom: 12 }} />

      {/* b.300 — via il dropdown "categoria": basta il campo di ricerca.
          Sotto, BADGE di idee per riempirlo — toccandone uno si aggiunge
          un dettaglio al testo (es. Matematica -> "con equazioni"). */}
      {sezione === 'materie' && !argomento.trim() && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {IDEE_CORSO.map((idea) => (
            <button key={idea.etK} onClick={() => setArgomento(tt(idea.qK, idea.q))}
              style={{ minHeight: 44, padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                fontSize: 13, fontWeight: 600, background: card, color: testoP, border: bordo }}>
              {tt(idea.etK, idea.et)}
            </button>
          ))}
        </div>
      )}

      {/* b.300 — il livello e una BARRA, non un menu: si trascina, si vede
          subito dove sei. La parola e l'eta sopra, chiare. */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: testoP, opacity: 0.7 }}>{tt('lifeLevelWord', 'Livello')}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: accent }}>{LIVELLI[livelloIdx]?.icona} {LIVELLI[livelloIdx]?.etichetta}</span>
        </div>
        <input type="range" min="0" max={LIVELLI.length - 1} step="1" value={livelloIdx}
          onChange={(e) => { const i = parseInt(e.target.value, 10); setLivello(LIVELLI[i].id); setContenuti(defaultContenuti(LIVELLI[i].id)); }}
          aria-label={tt('lifeLevelWord', 'Livello')}
          style={{ width: '100%', accentColor: accent, height: 6 }} />
        <div style={{ fontSize: 11, color: muto, marginTop: 4 }}>{LIVELLI[livelloIdx]?.nota}</div>
      </div>

      {/* b.299 — COSA vuoi nella lezione: quattro pulsanti GRANDI (regola
          anziani/bambini). Il default segue l'eta; l'utente lo cambia con
          un tocco. 'foto', 'link' e 'video' arrivano dalla community. */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: testoP, opacity: 0.7, marginBottom: 6 }}>{tt('lifeContentKind', 'Contenuti della lezione')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            { id: 'disegni', ic: 'star', et: tt('lifeContentDraw', 'Disegni') },
            { id: 'foto',    ic: 'eye', et: tt('lifeContentPhoto', 'Immagini') },
            { id: 'link',    ic: 'link', et: tt('lifeContentLink', 'Approfondimenti') },
            { id: 'video',   ic: 'video', et: tt('lifeContentVideo', 'Video') },
          ].map((o) => {
            const on = contenuti.includes(o.id);
            return (
              <button key={o.id} onClick={() => toggleContenuto(o.id)} aria-pressed={on}
                style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 10px', borderRadius: 12,
                  cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, textAlign: 'left',
                  background: on ? `${accent}22` : card, color: testoP,
                  border: `2px solid ${on ? accent : 'transparent'}` }}>
                <Icon name={o.ic} size={20} color={on ? accent : muto} />{o.et}
              </button>
            );
          })}
        </div>
      </div>

      {/* b.213 — lingua del corso: scelta esplicita. Conta soprattutto per i
          bambini (registro e vocabolario adatti nella loro lingua). */}
      <select value={linguaCorso} onChange={(e) => setLinguaCorso(e.target.value)} style={{ ...stileSelect, width: '100%', marginBottom: 10 }}>
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
      </select>

      {/* b.300 — il Maestro si SCEGLIE con la faccia, come nelle altre
          sezioni: avatar tondo + nome, non un menu di nomi. */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: testoP, opacity: 0.7, marginBottom: 8 }}>{L('lifeTeacher')}</div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {compagni.slice(0, 12).map((c) => {
            const on = docenteId === c.id;
            return (
              <button key={c.id} onClick={() => setDocenteId(on ? '' : c.id)} aria-pressed={on}
                title={`${c.nome} — ${c.ruolo}`}
                style={{ flexShrink: 0, width: 74, minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
                <span style={{ width: 58, height: 58, borderRadius: '50%', overflow: 'hidden',
                  border: `3px solid ${on ? accent : 'transparent'}`, background: card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.avatar
                    ? <img src={c.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="user" size={26} color={muto} />}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: on ? accent : testoP,
                  maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* b.334 — IL MAESTRO TI CONOSCE: chi sei e come preferisci imparare.
          Compilato una volta, arriva in ogni lezione. La DURATA e la manopola
          "riduci o procedi": leggero di default, comandi all'utente. */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 12, color: muto, cursor: 'pointer', fontWeight: 600 }}>{tt('lifeProfileTitle', 'Il Maestro ti conosce (chi sei, come preferisci imparare)')}</summary>
        <div style={{ padding: 12, marginTop: 8, borderRadius: 12, background: card, border: bordo }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input value={prof.eta} onChange={(e) => { const p2 = { ...prof, eta: e.target.value }; setProf(p2); salvaProf(p2, pref); }}
              placeholder={tt('lifeProfAge', 'Età')} style={stileSelect} />
            <input value={prof.professione} onChange={(e) => { const p2 = { ...prof, professione: e.target.value }; setProf(p2); salvaProf(p2, pref); }}
              placeholder={tt('lifeProfJob', 'Professione')} style={stileSelect} />
          </div>
          <input value={prof.obiettivo} onChange={(e) => { const p2 = { ...prof, obiettivo: e.target.value }; setProf(p2); salvaProf(p2, pref); }}
            placeholder={tt('lifeProfWhy', 'Perché studi? (es. lavoro, viaggio, esame)')} style={{ ...stileSelect, width: '100%', marginBottom: 8, boxSizing: 'border-box' }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: muto, margin: '6px 0 4px' }}>{tt('lifeProfDuration', 'Durata sessione')}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {[['breve', tt('lifeDurShort', 'Breve 3-5’')], ['normale', tt('lifeDurNormal', 'Normale 6-10’')], ['approfondita', tt('lifeDurLong', 'Approfondita 10-15’')]].map(([id, et]) => (
              <button key={id} onClick={() => { const x = { ...pref, durata: id }; setPref(x); salvaProf(prof, x); }}
                style={{ flex: 1, minHeight: 44, padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  background: pref.durata === id ? `${accent}22` : 'transparent', color: pref.durata === id ? accent : muto,
                  border: pref.durata === id ? `1px solid ${accent}` : bordo }}>{et}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: muto, margin: '6px 0 4px' }}>{tt('lifeProfExtra', 'Contenuti extra')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['minimi', tt('lifeExtraMin', 'Minimi')], ['bilanciati', tt('lifeExtraMid', 'Bilanciati')], ['ricchi', tt('lifeExtraMax', 'Ricchi')]].map(([id, et]) => (
              <button key={id} onClick={() => { const x = { ...pref, extra: id }; setPref(x); salvaProf(prof, x); }}
                style={{ flex: 1, minHeight: 44, padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  background: pref.extra === id ? `${accent}22` : 'transparent', color: pref.extra === id ? accent : muto,
                  border: pref.extra === id ? `1px solid ${accent}` : bordo }}>{et}</button>
            ))}
          </div>
        </div>
      </details>

      {errore && <div style={{ color: rosso, fontSize: 13, marginBottom: 10 }}>{errore}</div>}

      <button onClick={crea} disabled={lavoro} style={{ width: '100%', minHeight: 44, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 600, fontSize: 15, fontFamily: FONT, opacity: lavoro ? 0.6 : 1 }}>
        {lavoro ? L('lifeGenerating') : L('lifeCreateCourse')}
      </button>
      {/* b.346 — la lezione puo nascere da un DOCUMENTO SCANSIONATO: si apre
          lo scanner (il BizCard in modo documenti), e al ritorno del testo la
          lezione si costruisce SOLO su quello (via Materiali, come da b.333). */}
      <button onClick={() => apriScanner({ doc: true, dest: 'impara' })} disabled={lavoro}
        style={{ width: '100%', minHeight: 44, marginTop: 8, padding: 12, borderRadius: 14, border: `1px solid ${accent}`, cursor: 'pointer', background: 'transparent', color: accent, fontWeight: 600, fontSize: 14, fontFamily: FONT }}>
        {tt('lifeFromScan', 'Crea da un documento (scanner)')}
      </button>

      {lezioni.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: muto }}>{L('lifeLessons')}</div>
          {/* b.334 — RIPASSO A INTERVALLI: quando delle lezioni sono "scadute",
              il ripasso si propone da solo (mai obbligo, sempre invito). */}
          {ripassoDa > 0 && (
            <button onClick={faiRipasso} disabled={lavoro}
              style={{ minHeight: 44, padding: 12, borderRadius: 12, border: `1px solid ${ambra}`, background: 'rgba(245,158,11,0.10)', color: ambra, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
              {tt('lifeReviewDue', 'Ripasso consigliato')} — {ripassoDa} {tt('lifeReviewLessons', 'lezioni da riprendere')} →
            </button>
          )}
          {lezioni.map((lz, i) => (
            // b.232 — difesa sui corsi della libreria (lezioni grezze dal DB):
            // `indice`/`obiettivi` possono mancare → key/NaN e crash su .length.
            <button key={lz.indice ?? i} onClick={() => apri(lz)} disabled={lavoro}
              style={{ textAlign: 'left', minHeight: 44, padding: 13, ...clayCard(card), cursor: 'pointer', fontFamily: FONT, color: testoP }}>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* b.334 — Content Value: i concetti FONDAMENTALI hanno la stella. */}
                {lz.peso === 'alto' && <Icon name="star" size={12} color="#f1c40f" />}
                <span style={{ flex: 1 }}>{(lz.indice ?? i) + 1}. {lz.titolo}</span>
                {/* b.327 — l'esito si VEDE: voto, oppure "saltata" (pesa meta). */}
                {(() => {
                  const e = esitiLezioni[lz.indice ?? i];
                  if (e === undefined) return null;
                  if (e === null) return <span style={{ fontSize: 11, fontWeight: 600, color: muto }}>{tt('lifeSkippedBadge', 'saltata')}</span>;
                  return <span style={{ fontSize: 12, fontWeight: 600, color: e >= 80 ? accent : e >= 50 ? ambra : rosso }}>✓ {e}%</span>;
                })()}
              </div>
              {lz.obiettivi?.length > 0 && <div style={{ fontSize: 12, color: muto, marginTop: 3 }}>{lz.obiettivi.join(' · ')}</div>}
            </button>
          ))}
          {/* b.228 — pubblica il corso nella libreria condivisa. */}
          <button onClick={pubblica} disabled={pubblicato}
            style={{ minHeight: 44, marginTop: 6, padding: 12, borderRadius: 12, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, cursor: pubblicato ? 'default' : 'pointer', fontFamily: FONT, opacity: pubblicato ? 0.6 : 1 }}>
            {pubblicato ? `✓ ${tt('lifeCoursePublished', 'Pubblicato')}` : tt('lifeCoursePublish', 'Pubblica nella libreria')}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(LifeView);
