'use client';
import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FONT, LANGS, vibrate, clayCard } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { useApp } from '../../contexts/AppContext.js';
import { COMPAGNI_PREDEFINITI } from '../../lib/compagni/catalogo.js';
import { CATEGORIE, LIVELLI } from '../../lib/compagni/corsi/catalogo.js';
import { generaTurnoPodcast, generaSyllabus, generaLezione, generaQuiz, parlaTurno, parlaBilingue, elencoMiei, corsiDisponibili, pubblicaCorso, generaIllustrazione, arricchisciLezione, registraEsito } from '../../lib/compagni/cliente.js';
import { rilevaLinguaStudiata, testoVisibile } from '../../lib/compagni/corsi/lingua.js';
import { staccaEsercizio } from '../../lib/compagni/corsi/pronuncia.js';
import PannelloPronuncia from './PannelloPronuncia.js';
import GestioneCompagni from './GestioneCompagni.js';
import GestioneObiettivi from './GestioneObiettivi.js';
import AmicoChat from './AmicoChat.js';
import Tavolo from './Tavolo.js';
import Dossier from './Dossier.js';

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
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: C.bg || '#0a0e1a', color: testoP, fontFamily: FONT, padding: '14px 14px 90px' }}>
    {/* ── FINE b.205 ── */}
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
          { id: 'tavolo', icon: 'users', label: L('lifeTableTab') },
          { id: 'dossier', icon: 'doc', label: L('lifeDossierTab') },
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
      {scheda === 'dossier' && <Dossier compagni={tutti} onApriStanza={onApriStanza}
        onDebate={(obiettivo) => { setDebateObiettivo(obiettivo || ''); setScheda('tavolo'); }}
        {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {scheda === 'impara' && <Impara compagni={tutti} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
      {scheda === 'obiettivi' && <GestioneObiettivi {...{ L, testoP, muto, accent, card, bordo }} />}
      {scheda === 'compagni' && <GestioneCompagni miei={miei} onCambiato={caricaMiei} {...{ L, C, lingua, userToken, testoP, muto, accent, card, bordo }} />}
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
        await parlaTurno({ voceId: d.turno.voceId, testo: d.turno.testo, lingua, userToken }, (a) => { audioRef.current = a; });
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
function Impara({ compagni, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [argomento, setArgomento] = useState('');
  const [categoria, setCategoria] = useState('altro');
  const [livello, setLivello] = useState('base');
  const [linguaCorso, setLinguaCorso] = useState(lingua || 'it'); // b.213 — lingua del corso, scelta esplicita (conta per i bambini)
  // b.299 — COSA arricchisce la lezione: 'disegni' (illustrazioni fatte
  // dal Maestro), 'foto'/'link' (recuperati dalla community — Cobra),
  // 'video' (video collegati), 'nessuno'. Il default lo decide l'eta:
  // i bambini vedono disegni, gli universitari link e video.
  const defaultContenuti = (liv) => (liv === 'bambini' || liv === 'base') ? 'disegni' : 'link';
  const [contenuti, setContenuti] = useState(defaultContenuti('base'));
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
  // b.228 — libreria condivisa "Corsi disponibili"
  const [disponibili, setDisponibili] = useState([]);
  const [pubblicato, setPubblicato] = useState(false);
  // b.229 — illustrazione della lezione + tutor "compagno di viaggio"
  const [illustrazione, setIllustrazione] = useState(null);
  const [genIll, setGenIll] = useState(false);
  const tutor = compagni.find((c) => c.id === docenteId) || null;
  const tt = (k, f) => { const v = L(k); return v && v !== k ? v : f; };

  useEffect(() => { corsiDisponibili({}).then(setDisponibili).catch(() => {}); }, []);

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
      if (contenuti === 'disegni') {
        generaIllustrazione({ titolo: lezione?.titolo, argomento: argomento.trim(), livello, userToken })
          .then((url) => url && setIllustrazione(url)).catch(() => {});
      } else if (contenuti && contenuti !== 'nessuno') {
        arricchisciLezione({ modalita: contenuti, titolo: lezione?.titolo, argomento: argomento.trim(), lingua: linguaCorso })
          .then((a) => a && setArricchimento(a)).catch(() => {});
      }
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : L('lifeError'));
    } finally { setLavoro(false); }
    // b.217 — idem: `linguaCorso` nelle deps (la lezione va nella lingua scelta).
  }, [argomento, categoria, livello, docenteId, linguaCorso, userToken, L, contenuti]);

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
  const ascoltaLezione = useCallback(async () => {
    if (!aperta || ascoltando) return;
    setAscoltando(true);
    try {
      const l2 = rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || '');
      await parlaBilingue({
        voceId: tutor?.voce?.id,
        // b.252 — il tag [PRONUNCIA:] va tolto anche dal percorso VOCE.
        // A schermo era gia staccato (piu sotto), ma qui passava grezzo:
        // nei corsi di lingua la voce leggeva ad alta voce "PRONUNCIA due
        // punti ..." in mezzo alla lezione. I tag [L2:] restano: servono a
        // segmentiPerVoce per far dire la parte straniera a una voce
        // madrelingua — e tutto il senso della lezione bilingue.
        testo: staccaEsercizio(aperta.contenuto).testo,
        linguaParlata: linguaCorso,
        linguaStudiata: (l2 && l2 !== linguaCorso) ? l2 : linguaCorso,
        userToken,
      }, (a) => { audioLezioneRef.current = a; });
    } catch { /* la voce e un di piu: la lezione resta leggibile */ }
    finally { setAscoltando(false); }
  }, [aperta, ascoltando, argomento, linguaCorso, tutor, userToken]);

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
        const indiceLezione = Math.max(0, lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo));
        registraEsito({
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
        <button onClick={() => { try { audioLezioneRef.current?.pause(); } catch { /* audio gia fermo */ } setAperta(null); }} style={{ background: card, border: bordo, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: testoP, fontFamily: FONT, marginBottom: 12 }}>
          <Icon name="back" size={14} color={testoP} /> {L('lifeLessons')}
        </button>
        {/* b.229 — tutor "compagno di viaggio" accanto al titolo. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
          {tutor?.avatar && <img src={tutor.avatar} alt="" width={34} height={34} style={{ borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />}
          <h3 style={{ color: testoP, margin: 0, flex: 1 }}>{aperta.lezione.titolo}</h3>
        </div>

        {/* b.229/b.299 — l'illustrazione (modalita 'disegni'). Il pulsante
            manuale resta come ripiego se l'auto non e partita. */}
        {illustrazione
          ? <img src={illustrazione} alt="" style={{ width: '100%', borderRadius: 14, marginBottom: 12, display: 'block' }} />
          : contenuti === 'disegni' && <button onClick={illustra} disabled={genIll}
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
            la voce, non testo da leggere. Senza questo, in un corso di lingua
            si vedeva "[L2: beautiful]" scritto nella lezione. */}
        <TestoRicco testo={staccaEsercizio(testoVisibile(aperta.contenuto)).testo} testoP={testoP} muto={muto} />
        {/* b.244 — se il Maestro ha proposto [PRONUNCIA: ...], qui si dice ad
            alta voce e si scopre subito com'e andata. L'esito torna a lui:
            le parole sbagliate ricompaiono piu avanti, dentro altre frasi. */}
        {(() => {
          const es = staccaEsercizio(testoVisibile(aperta.contenuto)).esercizio;
          if (!es) return null;
          const l2 = rilevaLinguaStudiata(argomento.trim(), aperta.lezione?.titolo || '');
          return <PannelloPronuncia frase={es} lingua={l2 || linguaCorso} userToken={userToken}
            onEsito={({ punteggio, daRivedere }) => {
              registraEsito({
                argomento: argomento.trim(),
                lezioneIndice: Math.max(0, lezioni.findIndex((l) => l.titolo === aperta.lezione?.titolo)),
                punteggio, daRivedere, userToken,
              }).catch(() => { /* il ricordo e un di piu */ });
            }}
            {...{ testoP, muto, accent, card, bordo }} />;
        })()}
        {/* La lezione si ASCOLTA: nei corsi di lingua le parti in lingua
            straniera le dice una voce madrelingua (voce doppia, b.241) —
            e' tutto il senso del tag L2. */}
        <button onClick={ascoltaLezione} disabled={ascoltando}
          style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, opacity: ascoltando ? 0.6 : 1 }}>
          {ascoltando ? tt('lifeListening', 'Sto leggendo…') : tt('lifeListen', 'Ascolta la lezione')}
        </button>
        {aperta.fonti.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12, color: muto }}>
            <b>{L('lifeSources')}:</b> {aperta.fonti.map((f, i) => <span key={i}>{f.titolo}{i < aperta.fonti.length - 1 ? ' · ' : ''}</span>)}
          </div>
        )}
        {!aperta.domande
          ? <button onClick={quiz} disabled={lavoro} style={{ marginTop: 16, padding: 12, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>
              {lavoro ? L('lifeGenerating') : `📝 ${L('lifeQuiz')}`}
            </button>
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={stileSelect}>
          {CATEGORIE.map((c) => <option key={c.id} value={c.id}>{c.icona} {c.etichetta}</option>)}
        </select>
        <select value={livello} onChange={(e) => { setLivello(e.target.value); setContenuti(defaultContenuti(e.target.value)); }} style={stileSelect}>
          {LIVELLI.map((l) => <option key={l.id} value={l.id}>{l.icona} {l.etichetta}</option>)}
        </select>
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
            const on = contenuti === o.id;
            return (
              <button key={o.id} onClick={() => setContenuti(o.id)} aria-pressed={on}
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

      <select value={docenteId} onChange={(e) => setDocenteId(e.target.value)} style={{ ...stileSelect, width: '100%', marginBottom: 12 }}>
        <option value="">{L('lifeTeacher')}…</option>
        {compagni.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.ruolo}</option>)}
      </select>

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
