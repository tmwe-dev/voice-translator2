'use client';
import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FONT, LANGS, vibrate, clayCard } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { useApp } from '../../contexts/AppContext.js';
import { COMPAGNI_PREDEFINITI } from '../../lib/compagni/catalogo.js';
import { CATEGORIE, LIVELLI } from '../../lib/compagni/corsi/catalogo.js';

// b.300 — idee per riempire il campo: un tocco mette una frase gia
// dettagliata, cosi anche un anziano o un bambino non parte dal vuoto.
const IDEE_CORSO = [
  { ic: '🔢', et: 'Matematica', q: 'Matematica di base: numeri, operazioni ed equazioni semplici' },
  { ic: '🌍', et: 'Storia', q: 'Storia: dai secoli antichi ai giorni nostri, con date ed eventi chiave' },
  { ic: '🎵', et: 'Musica', q: 'Storia della musica e dei grandi compositori, con esempi da ascoltare' },
  { ic: '🗣️', et: 'Inglese', q: 'Inglese per iniziare a parlare: frasi utili di ogni giorno' },
  { ic: '🔬', et: 'Scienze', q: 'Scienze: il corpo umano, la natura e come funziona il mondo' },
  { ic: '🍳', et: 'Cucina', q: 'Cucina: ricette semplici passo dopo passo' },
  { ic: '💻', et: 'Computer', q: 'Usare il computer e internet senza paura, passo dopo passo' },
  { ic: '🎨', et: 'Arte', q: 'Storia dell\'arte: opere famose e artisti da conoscere' },
];
import { generaTurnoPodcast, generaSyllabus, generaLezione, generaQuiz, parlaTurno, parlaBilingue, elencoMiei, corsiDisponibili, pubblicaCorso, generaIllustrazione, arricchisciLezione, registraEsito, chiediAlMaestro } from '../../lib/compagni/cliente.js';
import { suona as registraAudio, pausa as pausaAudio, riprendi as riprendiAudio, ferma as fermaAudio, ascolta as ascoltaAudio } from '../../lib/audioLife.js';
import { rilevaLinguaStudiata, testoVisibile } from '../../lib/compagni/corsi/lingua.js';
import { staccaEsercizio } from '../../lib/compagni/corsi/pronuncia.js';
import PannelloPronuncia from './PannelloPronuncia.js';
import GestioneCompagni from './GestioneCompagni.js';
import GestioneObiettivi from './GestioneObiettivi.js';
import AmicoChat from './AmicoChat.js';
import Tavolo from './Tavolo.js';

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
  const [miei, setMiei] = useState([]);
  const [debateObiettivo, setDebateObiettivo] = useState(''); // b.227 — Dossier→Debate

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
  const [audioStato, setAudioStato] = useState({ attivo: false, inPausa: false, etichetta: '' });
  useEffect(() => ascoltaAudio(setAudioStato), []);

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
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 16px 90px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {/* b.206 — pulsante indietro uniforme (glifo ‹, 38×38, r12) come le altre pagine */}
        <button onClick={() => { vibrate(8); setView('home'); }} aria-label={L('lifeBack')}
          style={{ width: 38, height: 38, borderRadius: 12, background: card, border: bordo, color: testoP, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {'‹'}
        </button>
        <Icon name="star" size={20} color={accent} />
        <span style={{ fontSize: 20, fontWeight: 800 }}>Life</span>
      </div>

      {/* ── b.208 — Schede senza box: icone SVG monocolore più grandi.
          Niente pulsante intorno; attivo = colore accento + sottolineatura. ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {[
          { id: 'podcast', icon: 'mic', label: L('lifePodcast') },
          { id: 'amico', icon: 'chat', label: L('lifeFriendTab') },
          // b.302 — Dossier e Tavolo erano due porte per la stessa stanza:
          // fuse in una, "Tavola rotonda", che cerca online e produce un
          // documento su richiesta. Il Dossier non e piu una scheda a se.
          { id: 'tavolo', icon: 'users', label: L('lifeTableTab') },
          { id: 'impara', icon: 'graduation', label: L('lifeLearn') },
          // b.247 — la chiave ora esiste in tutti e quindici i pacchetti:
          // via il ripiego che confrontava il risultato con la chiave stessa.
          { id: 'obiettivi', icon: 'target', label: L('lifeGoalsTab') },
          { id: 'compagni', icon: 'star', label: L('lifeCompanionsTab') },
        ].map((t) => {
          const on = scheda === t.id;
          // b.210 — contrasto: gli inattivi erano grigio tenue e sparivano sul
          // fondo scuro. Ora l'inattivo è testo pieno ad alto contrasto,
          // l'attivo è in accento con sottolineatura.
          const colore = on ? accent : testoP;
          return (
            <button key={t.id} onClick={() => { vibrate(8); setScheda(t.id); }}
              aria-label={t.label} aria-current={on ? 'page' : undefined}
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '4px 2px', background: 'none', border: 'none', cursor: 'pointer', color: colore, opacity: on ? 1 : 0.92, fontFamily: FONT }}>
              <Icon name={t.icon} size={26} color={colore} />
              <span style={{ fontSize: 10.5, fontWeight: on ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{t.label}</span>
              <span style={{ width: 16, height: 2, borderRadius: 2, background: on ? accent : 'transparent' }} />
            </button>
          );
        })}
      </div>

      {scheda === 'podcast' && <Podcast compagni={tutti} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {scheda === 'amico' && <AmicoChat compagni={tutti} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {scheda === 'tavolo' && <Tavolo compagni={tutti} obiettivoIniziale={debateObiettivo} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {/* b.302 — 'dossier' non e piu una scheda: chi ci arriva vede la Tavola. */}
      {scheda === 'impara' && <Impara compagni={tutti} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {scheda === 'obiettivi' && <GestioneObiettivi {...{ L, testoP, muto, accent, card, bordo }} />}
      {scheda === 'compagni' && <GestioneCompagni miei={miei} onCambiato={caricaMiei} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
    </div>

    {/* b.305 — il telecomando audio: appare solo se qualcosa suona, resta
        fisso in basso e ti segue mentre cambi scheda. */}
    {audioStato.attivo && (
      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'max(16px, env(safe-area-inset-bottom))', zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 16px',
        borderRadius: 999, background: 'rgba(8,11,22,0.94)', backdropFilter: 'blur(14px)',
        border: `1px solid ${accent}55`, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontFamily: FONT }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: testoP, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {'\u{1F509}'} {audioStato.etichetta || L('lifeAudio')}
        </span>
        <button onClick={() => audioStato.inPausa ? riprendiAudio() : pausaAudio()}
          aria-label={audioStato.inPausa ? 'Riprendi' : 'Pausa'}
          style={{ width: 42, height: 42, borderRadius: 21, border: 'none', cursor: 'pointer',
            background: accent, color: '#04121c', fontSize: 18, fontWeight: 900 }}>
          {audioStato.inPausa ? '\u25B6' : '\u23F8'}
        </button>
        <button onClick={() => fermaAudio()} aria-label="Interrompi"
          style={{ width: 42, height: 42, borderRadius: 21, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${testoP}44`, color: testoP, fontSize: 15 }}>
          {'\u23F9'}
        </button>
      </div>
    )}
    </div>
  );
}

// b.222 — le lezioni arrivano in markdown leggero (### titoli, **grassetto**,
// elenchi con -). Prima si vedevano i simboli grezzi ("### Cuerpo", "**La
// vaca**"). Piccolo renderer senza dipendenze: titoli, grassetto, elenchi.
function inlineGrassetto(s, keyBase) {
  return String(s).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    (p.startsWith('**') && p.endsWith('**') && p.length > 4)
      ? <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>
      : <span key={`${keyBase}-${i}`}>{p}</span>);
}
function TestoRicco({ testo, testoP, muto }) {
  const righe = String(testo || '').split('\n');
  const blocchi = righe.map((r, i) => {
    const t = r.trim();
    if (/^#{3,}\s+/.test(t)) return <div key={i} style={{ fontSize: 16, fontWeight: 800, color: testoP, margin: '14px 0 4px' }}>{inlineGrassetto(t.replace(/^#{3,}\s+/, ''), i)}</div>;
    if (/^##\s+/.test(t))    return <div key={i} style={{ fontSize: 18, fontWeight: 800, color: testoP, margin: '16px 0 6px' }}>{inlineGrassetto(t.replace(/^##\s+/, ''), i)}</div>;
    if (/^#\s+/.test(t))     return <div key={i} style={{ fontSize: 20, fontWeight: 800, color: testoP, margin: '16px 0 6px' }}>{inlineGrassetto(t.replace(/^#\s+/, ''), i)}</div>;
    if (/^[-*]\s+/.test(t))  return <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}><span style={{ color: muto }}>•</span><span>{inlineGrassetto(t.replace(/^[-*]\s+/, ''), i)}</span></div>;
    if (t === '')            return <div key={i} style={{ height: 8 }} />;
    return <div key={i} style={{ margin: '3px 0' }}>{inlineGrassetto(t, i)}</div>;
  });
  return <div style={{ fontSize: 15, color: testoP, lineHeight: 1.6 }}>{blocchi}</div>;
}

// ─────────────────────────────────────────────────────────────────
// SCHEDA PODCAST
// ─────────────────────────────────────────────────────────────────
function Podcast({ compagni, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [argomento, setArgomento] = useState('');
  const [scelti, setScelti] = useState([]);
  const [round, setRound] = useState(3);
  const [stato, setStato] = useState('pronto'); // pronto | genero | ascolto
  const [copioni, setCopioni] = useState([]);
  const [attuale, setAttuale] = useState(-1);
  const [errore, setErrore] = useState('');
  const fermatoRef = useRef(false);
  const audioRef = useRef(null);

  const toggle = (id) => {
    setScelti((s) => s.includes(id) ? s.filter(x => x !== id) : (s.length >= 4 ? s : [...s, id]));
  };

  const ferma = useCallback(() => {
    fermatoRef.current = true;
    if (audioRef.current) { try { audioRef.current.pause(); } catch { /* già fermo o non avviato */ } }
    setStato('pronto'); setAttuale(-1);
  }, []);

  const vai = useCallback(async () => {
    setErrore('');
    if (!argomento.trim()) { setErrore(L('lifeNeedTopic')); return; }
    if (scelti.length < 2) { setErrore(L('lifeNeedCompanions')); return; }
    setStato('genero'); setCopioni([]); setAttuale(-1); fermatoRef.current = false;
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
        if (d.fine) break;
        if (d.saltato || !d.turno) { if (i >= (d.totale || 0) - 1) break; continue; }
        lista.push(d.turno);
        setCopioni([...lista]);
        setAttuale(lista.length - 1);
        await parlaTurno({ voceId: d.turno.voceId, testo: d.turno.testo, lingua, userToken }, (a) => { audioRef.current = a; registraAudio(a, 'Podcast'); });
      }
      if (!fermatoRef.current) { setStato('pronto'); setAttuale(-1); }
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
      setStato('pronto');
    }
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
              style={{ padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                background: on ? `${c.colore}22` : card, border: `1px solid ${on ? c.colore : (bordo.split(' ').pop())}`, fontFamily: FONT }}>
              {/* b.208 — avatar del Compagno, non l'emoji */}
              <img src={c.avatar} alt="" width={46} height={46} style={{ borderRadius: 12, display: 'block', margin: '0 auto 6px', objectFit: 'cover' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: testoP }}>{c.nome}</div>
              <div style={{ fontSize: 10, color: muto }}>{c.ruolo}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: muto }}>{L('lifeRounds')}</span>
        {[2, 3, 4].map((n) => (
          <button key={n} onClick={() => setRound(n)}
            style={{ width: 40, height: 36, borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontFamily: FONT,
              background: round === n ? accent : card, color: round === n ? '#04121c' : testoP, border: bordo }}>{n}</button>
        ))}
      </div>

      {errore && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{errore}</div>}

      {stato !== 'ascolto'
        ? <button onClick={vai} disabled={stato === 'genero'}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer',
              background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT, opacity: stato === 'genero' ? 0.6 : 1 }}>
            {stato === 'genero' ? L('lifeGenerating') : `🎙️ ${L('lifeGenListen')}`}
          </button>
        : <button onClick={ferma}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: bordo, cursor: 'pointer', background: 'transparent', color: testoP, fontWeight: 800, fontSize: 15, fontFamily: FONT }}>
            ⏹ {L('lifeStop')}
          </button>}

      {/* Copione / trascrizione */}
      {copioni.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {copioni.map((t, i) => (
            <div key={t.ordine} style={{ padding: 12, borderRadius: 12, background: card,
              border: `1px solid ${i === attuale ? accent : bordo.split(' ').pop()}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 4 }}>{t.nome}</div>
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
  return scelte;
}

function Impara({ compagni, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [argomento, setArgomento] = useState('');
  const [categoria, setCategoria] = useState('altro');
  const [livello, setLivello] = useState('base');
  const [linguaCorso, setLinguaCorso] = useState(lingua || 'it'); // b.213 — lingua del corso, scelta esplicita (conta per i bambini)
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
  const [ascoltando, setAscoltando] = useState(false);
  const audioLezioneRef = useRef(null);
  // b.312 — LEZIONE DINAMICA: quando la si ASCOLTA diventa una presentazione
  // a diapositive (la "lavagna"), che avanza sezione per sezione con la voce.
  // `sezioneAttiva` e il paragrafo in lettura; `stopLetturaRef` ferma il giro.
  const [sezioneAttiva, setSezioneAttiva] = useState(-1);
  const stopLetturaRef = useRef(false);
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
  // b.315 — EVIDENZIA (leggi-e-segui): sfondo diverso al paragrafo che il
  // Maestro sta leggendo, cosi chi ascolta in un'altra lingua vede le parole.
  // E il testo SCORRE per tenere al centro il pezzo in lettura.
  const [evidenzia, setEvidenzia] = useState(true);
  const sezioneRef = useRef(null);
  // b.228 — libreria condivisa "Corsi disponibili"
  const [disponibili, setDisponibili] = useState([]);
  const [pubblicato, setPubblicato] = useState(false);
  // b.229 — illustrazione della lezione + tutor "compagno di viaggio"
  const [illustrazione, setIllustrazione] = useState(null);
  const [genIll, setGenIll] = useState(false);
  const tutor = compagni.find((c) => c.id === docenteId) || null;
  // b.300 — indice del livello per la barra
  const livelloIdx = Math.max(0, LIVELLI.findIndex((l) => l.id === livello));
  const tt = (k, f) => { const v = L(k); return v && v !== k ? v : f; };

  // b.312 — paragrafi della lezione + immagine scelta per ciascuno. Calcolato
  // una volta sola (memo): serve sia alla narrazione (ritmo) sia al render
  // (lavagna/articolo), e deve coincidere fra i due.
  const { paragrafiLezione, immaginiSezioni } = useMemo(() => {
    if (!aperta) return { paragrafiLezione: [], immaginiSezioni: [] };
    const testoPulito = staccaEsercizio(testoVisibile(aperta.contenuto)).testo;
    const parti = testoPulito.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const paragrafi = parti.length > 1 ? parti : [testoPulito];
    const items = [...new Map((arricchimento?.link || []).filter((l) => l.immagine).map((l) => [l.immagine, l])).values()];
    return { paragrafiLezione: paragrafi, immaginiSezioni: assegnaImmagini(paragrafi, items, illustrazione) };
  }, [aperta, arricchimento, illustrazione]);

  useEffect(() => { corsiDisponibili({}).then(setDisponibili).catch(() => {}); }, []);

  // b.315 — il testo SCORRE per tenere al centro il paragrafo in lettura.
  useEffect(() => {
    if (ascoltando && sezioneAttiva >= 0) {
      try { sezioneRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* niente scroll: non e un guasto */ }
    }
  }, [sezioneAttiva, ascoltando]);

  const stileSelect = { flex: 1, padding: 10, borderRadius: 10, border: bordo, background: card, color: testoP, fontFamily: FONT, fontSize: 13 };

  // b.228 — apri un corso della libreria: carica struttura e impostazioni; le
  // lezioni si (ri)generano poi nella lingua scelta (conta per i bambini).
  const apriPubblico = useCallback((corso) => {
    setErrore(''); setAperta(null); setPubblicato(false);
    setArgomento(corso.argomento || corso.titolo || '');
    setCategoria(corso.categoria || 'altro');
    setLivello(corso.livello || 'base');
    setLinguaCorso(corso.lingua || linguaCorso);
    setLezioni(corso.lezioni || []);
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
      const d = await generaSyllabus({ argomento: argomento.trim(), categoria, livello, docenteId: docenteId || undefined, lingua: linguaCorso, userToken });
      setLezioni(d.lezioni || []);
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
    } finally { setLavoro(false); }
    // b.217 — `linguaCorso` andava nelle deps: il callback lo usa ma prima
    // elencava `lingua` (la lingua app, che non cambia mai). Chi cambiava
    // SOLO la lingua del corso e generava mandava ancora la lingua iniziale.
  }, [argomento, categoria, livello, docenteId, linguaCorso, userToken, L]);

  const apri = useCallback(async (lezione) => {
    setLavoro(true); setErrore(''); setIllustrazione(null); setArricchimento(null);
    try {
      const d = await generaLezione({ argomento: argomento.trim(), categoria, livello, lezione, docenteId: docenteId || undefined, lingua: linguaCorso, userToken });
      setRisposte({});
      setAperta({ lezione, contenuto: d.contenuto, fonti: d.fonti || [], domande: null });
      // b.299 — l'arricchimento segue il flag scelto alla creazione:
      // 'disegni' -> illustrazione del Maestro; 'foto'/'link'/'video' ->
      // dalla community (Cobra). 'nessuno' -> niente. Non blocca la
      // lezione: se l'arricchimento non arriva, il testo c'e comunque.
      // b.306 — piu contenuti INSIEME: se c'e 'disegni' si genera
      // l'illustrazione; per 'foto'/'link'/'video' si interroga la community e
      // si UNISCONO i risultati (link e video) in un solo blocco.
      if (contenuti.includes('disegni')) {
        generaIllustrazione({ titolo: lezione?.titolo, argomento: argomento.trim(), livello, userToken })
          .then((url) => url && setIllustrazione(url)).catch(() => {});
      }
      const comunita = contenuti.filter((c) => c === 'foto' || c === 'link' || c === 'video');
      if (comunita.length) {
        Promise.all(comunita.map((m) => arricchisciLezione({ modalita: m, titolo: lezione?.titolo, argomento: argomento.trim(), lingua: linguaCorso }).catch(() => null)))
          .then((esiti) => {
            const unito = { link: [], video: [] };
            for (const a of esiti) { if (!a) continue; if (Array.isArray(a.link)) unito.link.push(...a.link); if (Array.isArray(a.video)) unito.video.push(...a.video); }
            if (unito.link.length || unito.video.length) setArricchimento(unito);
          }).catch(() => {});
      }
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
    } finally { setLavoro(false); }
    // b.217 — idem: `linguaCorso` nelle deps (la lezione va nella lingua scelta).
  }, [argomento, categoria, livello, docenteId, linguaCorso, userToken, L, contenuti]);

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
      if (a) setArricchimento((prec) => {
        const base = prec && (prec.link || prec.video) ? prec : { link: [], video: [] };
        return { link: [...(base.link || []), ...(Array.isArray(a.link) ? a.link : [])], video: [...(base.video || []), ...(Array.isArray(a.video) ? a.video : [])] };
      });
    } catch { /* la community non risponde: la lezione resta com'e */ }
    finally { setGenAppr(false); }
  }, [aperta, genAppr, livello, contenuti, argomento, linguaCorso]);

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
    try { audioLezioneRef.current?.pause(); } catch { /* audio gia fermo */ }
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

  // b.314 — il Maestro parla con la sua voce (usato per risposta e rientro).
  const diLaVoce = useCallback(async (testo) => {
    if (!testo) return;
    try { await parlaTurno({ voceId: tutor?.voce?.id, testo, lingua: linguaCorso, userToken }, (a) => { audioLezioneRef.current = a; registraAudio(a, 'Maestro'); }); } catch { /* la voce e un di piu */ }
  }, [tutor, linguaCorso, userToken]);

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
    stopLetturaRef.current = false;
    inDomandaRef.current = false;
    interruzionePendenteRef.current = false;
    const l2 = rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || '');
    // b.312 — si legge SEZIONE per SEZIONE (paragrafi): cosi la lavagna puo
    // mostrare l'immagine giusta mentre la voce parla di quel pezzo. I tag
    // [L2:]/[PRONUNCIA:] restano gestiti da parlaBilingue dentro ogni pezzo.
    const testoTot = staccaEsercizio(aperta.contenuto).testo;
    const parti = testoTot.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const lista = parti.length > 1 ? parti : [testoTot];
    const aspettaDialogo = async () => { while (inDomandaRef.current && !stopLetturaRef.current) await attendi(150); };
    try {
      for (let i = 0; i < lista.length; i++) {
        if (stopLetturaRef.current) break;
        setSezioneAttiva(i);
        await parlaBilingue({
          voceId: tutor?.voce?.id,
          testo: lista[i],
          linguaParlata: linguaCorso,
          linguaStudiata: (l2 && l2 !== linguaCorso) ? l2 : linguaCorso,
          userToken,
        }, (a) => { audioLezioneRef.current = a; registraAudio(a, 'Lezione'); });
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
    finally { setAscoltando(false); setSezioneAttiva(-1); inDomandaRef.current = false; setManoAlzata(false); setMaestroStaFinendo(false); }
  }, [aperta, ascoltando, argomento, linguaCorso, tutor, userToken, fermaLettura, immaginiSezioni]);

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
        }).catch(() => { /* il ricordo e un di piu: la sfida resta valida */ });
      }
      return nuove;
    });
  }, [aperta, lezioni, argomento, userToken]);

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
        <button onClick={() => { stopLetturaRef.current = true; try { audioLezioneRef.current?.pause(); } catch { /* audio gia fermo */ } setSezioneAttiva(-1); setAperta(null); }} style={{ background: card, border: bordo, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: testoP, fontFamily: FONT, marginBottom: 12 }}>
          <Icon name="back" size={14} color={testoP} /> {L('lifeLessons')}
        </button>
        {/* b.229 — tutor "compagno di viaggio" accanto al titolo. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
          {tutor?.avatar && <img src={tutor.avatar} alt="" width={34} height={34} style={{ borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />}
          <h3 style={{ color: testoP, margin: 0, flex: 1 }}>{aperta.lezione.titolo}</h3>
        </div>

        {/* b.315 — CONTROLLI IN ALTO: ascolta/ferma, evidenzia, alza la mano.
            Restano in cima mentre il testo scorre sotto. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, position: 'sticky', top: 0, zIndex: 5, paddingTop: 2 }}>
          <button onClick={ascoltaLezione}
            style={{ padding: '9px 14px', borderRadius: 12, border: `1px solid ${accent}`, background: ascoltando ? `${accent}22` : 'transparent', color: accent, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
            {ascoltando ? `■ ${tt('lifeStopListen', 'Ferma')}` : `▶ ${tt('lifeListen', 'Ascolta')}`}
          </button>
          <button onClick={() => setEvidenzia((v) => !v)} aria-pressed={evidenzia}
            style={{ padding: '9px 12px', borderRadius: 12, border: bordo, background: evidenzia ? `${accent}14` : 'transparent', color: evidenzia ? accent : muto, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
            {evidenzia ? '✓ ' : ''}{tt('lifeHighlight', 'Evidenzia')}
          </button>
          {ascoltando && !manoAlzata && (
            <button onClick={alzaMano}
              style={{ padding: '9px 12px', borderRadius: 12, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>✋</span> {tt('lifeRaiseHand', 'Alza la mano')}
            </button>
          )}
        </div>

        {/* b.229/b.299 — l'illustrazione (modalita 'disegni'). Il pulsante
            manuale resta come ripiego se l'auto non e partita. */}
        {illustrazione
          ? <img src={illustrazione} alt="" style={{ width: '100%', borderRadius: 14, marginBottom: 12, display: 'block' }} />
          : contenuti.includes('disegni') && <button onClick={illustra} disabled={genIll}
              style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, opacity: genIll ? 0.6 : 1 }}>
              {genIll ? '…' : `🎨 ${tt('lifeLessonIllustrate', 'Genera illustrazione')}`}
            </button>}

        {/* b.299 — l'arricchimento dalla community (Cobra): link o video. */}
        {arricchimento?.link?.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {arricchimento.link.map((f, i) => (
              <a key={i} href={f.url || f.link} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 10,
                  background: card, color: accent, textDecoration: 'none', fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                <span>🔗</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.titolo || f.title || f.url}</span>
              </a>
            ))}
          </div>
        )}
        {arricchimento?.video?.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {arricchimento.video.map((v, i) => (
              <a key={i} href={v.url || `https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 10,
                  background: card, color: accent, textDecoration: 'none', fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                <span>🎬</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.titolo || v.title || 'Video'}</span>
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
                style={{ borderRadius: 12, padding: evid ? '10px 12px' : 0, margin: evid ? '4px -12px 8px' : '0 0 2px',
                  background: evid ? `${accent}14` : 'transparent',
                  borderLeft: `3px solid ${attivo ? accent : 'transparent'}`,
                  transition: 'background 0.3s, border-color 0.3s' }}>
                <TestoRicco testo={p} testoP={testoP} muto={muto} />
                {immaginiSezioni[i] && (
                  <img src={immaginiSezioni[i]} alt="" style={{ width: '100%', borderRadius: 14, margin: '6px 0 14px', display: 'block', objectFit: 'cover', maxHeight: 320, border: bordo }} />
                )}

                {/* b.313/b.314 — "alza la mano": il dialogo col Maestro, sotto
                    il paragrafo in corso. */}
                {attivo && manoAlzata && (
                  <div style={{ marginTop: 10, padding: 14, borderRadius: 14, background: card, border: `1px solid ${accent}55` }}>
                    {maestroStaFinendo
                      ? <div style={{ fontSize: 12, color: muto, marginBottom: 10 }}>✋ {tt('lifeHandUp', 'Mano alzata — il Maestro finisce la frase e si gira verso di te…')}</div>
                      : <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 10 }}>{tt('lifeAskNow', 'Il Maestro ti ascolta. Cosa vuoi chiedere?')}</div>}
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
                    <textarea value={domanda} onChange={(e) => setDomanda(e.target.value)} rows={2}
                      placeholder={dialogo.length ? tt('lifeAskMore', 'Un’altra domanda…') : tt('lifeAskPh', 'La tua domanda…')}
                      style={{ width: '100%', padding: 11, borderRadius: 10, border: bordo, background: 'rgba(255,255,255,0.04)', color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button onClick={inviaDomanda} disabled={chiedendo || !domanda.trim()}
                        style={{ flex: 1, minWidth: 120, padding: 11, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, opacity: (chiedendo || !domanda.trim()) ? 0.6 : 1 }}>
                        {chiedendo ? '…' : tt('lifeAsk', 'Chiedi')}
                      </button>
                      <button onClick={riprendiLezione} disabled={chiedendo}
                        style={{ flex: 1, minWidth: 120, padding: 11, borderRadius: 12, border: bordo, background: 'transparent', color: testoP, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, opacity: chiedendo ? 0.6 : 1 }}>
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
          const l2 = rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || '');
          // b.317 — audit 6.8: senza `key`, cambiando lezione React riusava il
          // pannello e si vedeva il punteggio della frase precedente sotto la
          // frase nuova. Con key={es} il pannello riparte pulito.
          return <PannelloPronuncia key={es} frase={es} lingua={l2 || linguaCorso} userToken={userToken}
            onEsito={({ punteggio, daRivedere }) => {
              // b.317 — audit B2/6.2: quiz e pronuncia scrivevano sulla STESSA
              // riga (stesso corso+lezione) e l'ultimo cancellava l'altro. La
              // pronuncia ora vive sotto una chiave-corso separata; e con
              // findIndex non trovato non si registra (vedi sopra).
              const idx = lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo);
              if (idx >= 0) registraEsito({
                argomento: `${argomento.trim()} · pronuncia`,
                lezioneIndice: idx,
                punteggio, daRivedere, userToken,
              }).catch(() => { /* il ricordo e un di piu */ });
            }}
            {...{ testoP, muto, accent, card, bordo }} />;
        })()}
        {/* b.315 — il tasto Ascolta e' salito in ALTO (barra dei controlli);
            qui in fondo non serve piu. */}
        {aperta.fonti.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12, color: muto }}>
            <b>{L('lifeSources')}:</b> {aperta.fonti.map((f, i) => <span key={i}>{f.titolo}{i < aperta.fonti.length - 1 ? ' · ' : ''}</span>)}
          </div>
        )}
        {/* b.304 — dopo la lezione: APPROFONDISCI o PROSEGUI. Approfondisci
            cerca video/articoli dalla community TARATI sul livello (bambino
            -> semplici; universitario -> documenti profondi). Prosegui apre
            la lezione successiva. Poi, quando vuole, il quiz. */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={approfondisci} disabled={genAppr}
            style={{ flex: 1, minWidth: 130, padding: 12, borderRadius: 12, border: `2px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 800, cursor: 'pointer', fontFamily: FONT, opacity: genAppr ? 0.6 : 1 }}>
            {genAppr ? '…' : `🔎 ${tt('lifeDeepen', 'Approfondisci')}`}
          </button>
          {prossimaLezione && (
            <button onClick={() => apri(prossimaLezione)} disabled={lavoro}
              style={{ flex: 1, minWidth: 130, padding: 12, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>
              {tt('lifeContinue', 'Prosegui')} →
            </button>
          )}
        </div>
        {!aperta.domande
          ? <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={quiz} disabled={lavoro} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: card, color: testoP, fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>
                {lavoro ? L('lifeGenerating') : `📝 ${L('lifeQuiz')}`}
              </button>
              {/* b.320 — decisione di Luca: il quiz NON e obbligatorio, si puo
                  SALTARE. Ma il salto viene REGISTRATO (lezione vista senza
                  verifica, punteggio nullo): incide sulla valutazione globale
                  del raggiungimento dell'obiettivo. */}
              <button onClick={() => {
                  const idx = lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo);
                  if (idx >= 0) registraEsito({ argomento: argomento.trim(), lezioneIndice: idx, punteggio: null, daRivedere: [], userToken })
                    .catch(() => { /* il ricordo e un di piu */ });
                  if (prossimaLezione) apri(prossimaLezione); else setAperta(null);
                }} disabled={lavoro}
                style={{ padding: '12px 14px', borderRadius: 12, border: bordo, background: 'transparent', color: muto, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
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
                    <div style={{ fontWeight: 700, color: testoP, marginBottom: 8 }}>{i + 1}. {q.domanda}</div>
                    {q.opzioni.map((o, j) => {
                      const giusta = j === q.corretta;
                      const miaSbagliata = data && scelta === j && !giusta;
                      const colore = data ? (giusta ? accent : miaSbagliata ? '#f87171' : muto) : testoP;
                      return (
                        <button key={j} onClick={() => !data && rispondi(i, j)} disabled={data}
                          style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 14, color: colore,
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
                <div style={{ padding: 14, borderRadius: 12, background: card, border: `1px solid ${accent}`, color: testoP, fontWeight: 700 }}>
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
      {/* b.228 — libreria condivisa: corsi già pronti, da avviare con un tocco. */}
      {disponibili.length > 0 && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{tt('lifeCoursesAvailable', 'Corsi disponibili')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {disponibili.slice(0, 8).map((corso) => (
            <button key={corso.id} onClick={() => apriPubblico(corso)}
              style={{ textAlign: 'left', padding: 13, ...clayCard(card), cursor: 'pointer', fontFamily: FONT, color: testoP }}>
              <div style={{ fontWeight: 700 }}>{corso.perBambini ? '🧒 ' : ''}{corso.titolo}</div>
              <div style={{ fontSize: 11, color: muto, marginTop: 2 }}>{(LANGS.find(l => l.code === corso.lingua)?.flag || '')} {corso.lezioni?.length || 0} {tt('lifeLessonsCount', 'lezioni')} · {corso.livello}</div>
            </button>
          ))}
        </div>
      </div>}

      <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{tt('lifeCreateOwn', 'Crea un corso')}</div>
      <input value={argomento} onChange={(e) => setArgomento(e.target.value)} placeholder={L('lifeLearnPh')}
        style={{ width: '100%', padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 15, fontFamily: FONT, boxSizing: 'border-box', marginBottom: 12 }} />

      {/* b.300 — via il dropdown "categoria": basta il campo di ricerca.
          Sotto, BADGE di idee per riempirlo — toccandone uno si aggiunge
          un dettaglio al testo (es. Matematica -> "con equazioni"). */}
      {!argomento.trim() && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {IDEE_CORSO.map((idea) => (
            <button key={idea.q} onClick={() => setArgomento(idea.q)}
              style={{ padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                fontSize: 13, fontWeight: 600, background: card, color: testoP, border: bordo }}>
              {idea.ic} {idea.et}
            </button>
          ))}
        </div>
      )}

      {/* b.300 — il livello e una BARRA, non un menu: si trascina, si vede
          subito dove sei. La parola e l'eta sopra, chiare. */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: testoP, opacity: 0.7 }}>{tt('lifeLevelWord', 'Livello')}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: accent }}>{LIVELLI[livelloIdx]?.icona} {LIVELLI[livelloIdx]?.etichetta}</span>
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
        <div style={{ fontSize: 12, fontWeight: 800, color: testoP, opacity: 0.7, marginBottom: 6 }}>{tt('lifeContentKind', 'Contenuti della lezione')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            { id: 'disegni', ic: '🎨', et: tt('lifeContentDraw', 'Disegni') },
            { id: 'foto',    ic: '🖼️', et: tt('lifeContentPhoto', 'Immagini') },
            { id: 'link',    ic: '🔗', et: tt('lifeContentLink', 'Approfondimenti') },
            { id: 'video',   ic: '🎬', et: tt('lifeContentVideo', 'Video') },
          ].map((o) => {
            const on = contenuti.includes(o.id);
            return (
              <button key={o.id} onClick={() => toggleContenuto(o.id)} aria-pressed={on}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 10px', borderRadius: 12,
                  cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, textAlign: 'left',
                  background: on ? `${accent}22` : card, color: testoP,
                  border: `2px solid ${on ? accent : 'transparent'}` }}>
                <span style={{ fontSize: 20 }}>{o.ic}</span>{o.et}
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
        <div style={{ fontSize: 12, fontWeight: 800, color: testoP, opacity: 0.7, marginBottom: 8 }}>{L('lifeTeacher')}</div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {compagni.slice(0, 12).map((c) => {
            const on = docenteId === c.id;
            return (
              <button key={c.id} onClick={() => setDocenteId(on ? '' : c.id)} aria-pressed={on}
                title={`${c.nome} — ${c.ruolo}`}
                style={{ flexShrink: 0, width: 74, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
                <span style={{ width: 58, height: 58, borderRadius: '50%', overflow: 'hidden',
                  border: `3px solid ${on ? accent : 'transparent'}`, background: card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.avatar
                    ? <img src={c.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 26 }}>{c.emoji || '🧑\u200d🏫'}</span>}
                </span>
                <span style={{ fontSize: 11, fontWeight: on ? 800 : 600, color: on ? accent : testoP,
                  maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {errore && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{errore}</div>}

      <button onClick={crea} disabled={lavoro} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT, opacity: lavoro ? 0.6 : 1 }}>
        {lavoro ? L('lifeGenerating') : `📚 ${L('lifeCreateCourse')}`}
      </button>

      {lezioni.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: muto }}>{L('lifeLessons')}</div>
          {lezioni.map((lz, i) => (
            // b.232 — difesa sui corsi della libreria (lezioni grezze dal DB):
            // `indice`/`obiettivi` possono mancare → key/NaN e crash su .length.
            <button key={lz.indice ?? i} onClick={() => apri(lz)} disabled={lavoro}
              style={{ textAlign: 'left', padding: 13, ...clayCard(card), cursor: 'pointer', fontFamily: FONT, color: testoP }}>
              <div style={{ fontWeight: 700 }}>{(lz.indice ?? i) + 1}. {lz.titolo}</div>
              {lz.obiettivi?.length > 0 && <div style={{ fontSize: 12, color: muto, marginTop: 3 }}>{lz.obiettivi.join(' · ')}</div>}
            </button>
          ))}
          {/* b.228 — pubblica il corso nella libreria condivisa. */}
          <button onClick={pubblica} disabled={pubblicato}
            style={{ marginTop: 6, padding: 12, borderRadius: 12, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, cursor: pubblicato ? 'default' : 'pointer', fontFamily: FONT, opacity: pubblicato ? 0.6 : 1 }}>
            {pubblicato ? `✓ ${tt('lifeCoursePublished', 'Pubblicato')}` : `📤 ${tt('lifeCoursePublish', 'Pubblica nella libreria')}`}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(LifeView);
