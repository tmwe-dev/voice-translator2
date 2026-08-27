'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { suInterruzione, apriCiclo } from '../../lib/voce.js';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { parlaTavolo, parlaTurno, sintesiTavolo, preparaBriefing, reportFinale, aggiornaRiassunto } from '../../lib/compagni/cliente.js';
import { memGet } from '../../lib/memoria.js';
import { obiettiviAttivi } from '../../lib/compagni/obiettivi.js';

// ═══════════════════════════════════════════════════════════════
// Tavolo — tu + 2-4 Compagni che conversano insieme. Scrivi, e ognuno
// risponde a te e agli altri, tradotto, con la propria voce. Superficie
// autonoma: NON è una stanza WebRTC. (Luca)
//
// b.482 — LA TAVOLA PASSA ALLO STANDARD DEL TEMPLATE, e cambia solo cio
// che si vede: rientri laterali a venti nei riquadri (briefing, sintesi,
// documento, righe da spuntare), ogni cosa che si tocca alta almeno
// quarantaquattro, niente emoji a schermo — al loro posto le icone del
// disegno comune — e i colori presi dalla tavolozza del tema invece che
// scritti a mano. Le parole vengono dai pacchetti lingua: le chiavi
// c'erano gia tutte, quindi a schermo non cambia una parola, cambia che
// ora anche chi non parla italiano le legge nella sua lingua.
// ═══════════════════════════════════════════════════════════════

// b.363 — le righe di servizio del tavolo (briefing, sintesi, documento
// finale) non sono turni di parola: non vanno mai spedite come tali.
const RIGHE_SERVIZIO = new Set(['__briefing', '__sintesi', '__documento']);
const soloVoci = (m) => !RIGHE_SERVIZIO.has(m.ruolo);

function Tavolo({ compagni, L, C = {}, lingua, userToken, testoP, muto, accent, card, bordo, obiettivoIniziale = '' }) {
  // b.482 — i colori vengono dai token del tema. Scritti a mano restavano
  // quelli del tema scuro anche sul chiaro, dove l'errore, l'avviso e il
  // fondo sono altri tre colori.
  const rosso = C.statusError;      // guasti e avvisi rossi
  const avviso = C.statusWarning;   // «senza fonti»: attenzione, non guasto
  const suAccento = C.bg;           // il testo sopra una superficie in accento
  const [scelti, setScelti] = useState([]);
  const [avviato, setAvviato] = useState(false);
  const [messaggi, setMessaggi] = useState([]); // {ruolo:'persona'|nome, testo, emoji, colore}
  // b.533 — LA MEMORIA CUMULATIVA (livello 3 di RadioChat): oltre la
  // finestra che il server vede (20 messaggi), il pezzo vecchio si
  // comprime in un VERBALE che viaggia con ogni giro. Aggiornato a
  // blocchi, non a ogni battuta. E le SEZIONI personali (KB) partono
  // dalle preferenze salvate.
  const riassuntoRef = useRef('');
  const riassuntiFinoARef = useRef(0);
  const sezioniUtente = () => { try { return JSON.parse(memGet('vt-prefs') || '{}').sezioniPrompt; } catch { return undefined; } };
  const aggiornaVerbale = async (storia) => {
    try {
      if (storia.length < 24) return;
      const daComprimere = storia.slice(riassuntiFinoARef.current, storia.length - 16);
      if (daComprimere.length < 8) return;
      const testo = daComprimere.map(m => `${m.ruolo}: ${m.testo}`).join('\n');
      const d = await aggiornaRiassunto({ testo, riassunto: riassuntoRef.current, lingua, userToken });
      if (d?.riassunto) { riassuntoRef.current = d.riassunto; riassuntiFinoARef.current = storia.length - 16; }
    } catch { /* senza verbale si vive: resta la finestra corta */ }
  };
  const [testo, setTesto] = useState('');
  const [attende, setAttende] = useState(false);
  // b.363 — il segnale di Interrompi che arriva dal telecomando di Life
  const fermatoRef = useRef(false);
  // b.412 · P1.11 — LO STOP NON ANNULLAVA LA GENERAZIONE GIA PARTITA.
  //
  // Il telecomando alzava `fermatoRef` e impediva la VOCE successiva, ma
  // il server stava intanto generando le risposte di due-quattro
  // Compagni: quel lavoro proseguiva fino in fondo, si pagava, e chi
  // aveva premuto Stop restava ad aspettare una cosa che non voleva piu.
  //
  // Ora la richiesta ha un filo che si puo tagliare. Cio che il fornitore
  // ha gia cominciato puo comunque essere addebitato — non lo controlliamo
  // noi — ma NESSUN turno successivo parte, e l'attesa finisce subito.
  const abortRef = useRef(null);
  const fermaTutto = useCallback(() => {
    fermatoRef.current = true;
    try { abortRef.current?.abort(); } catch { /* non c'era nessuna richiesta in volo */ }
    abortRef.current = null;
  }, []);
  const fermaRef = useRef(fermaTutto);
  useEffect(() => { fermaRef.current = fermaTutto; }, [fermaTutto]);
  useEffect(() => suInterruzione(() => fermaRef.current()), []);
  const [errore, setErrore] = useState('');
  const [obiettivo, setObiettivo] = useState(obiettivoIniziale || ''); // b.226 — Debate: l'obiettivo comune
  // b.302 — la Tavola rotonda assorbe il Dossier: puo partire da FONTI
  // reali (ricerca online, come faceva il Dossier) e produrre un
  // DOCUMENTO su richiesta, all'avvio o durante. Una sezione sola.
  const [conFonti, setConFonti] = useState(false);
  const [briefing, setBriefing] = useState('');   // l'articolo neutro dalle fonti
  // b.412 · P1.12 — e DA DOVE VIENE: verificate | assenti | guaste. Senza
  // questo, il report presentava come «fatti dalle fonti» anche un testo
  // nato quando la ricerca era fallita.
  const [statoFonti, setStatoFonti] = useState('verificate');
  const [fonti, setFonti] = useState([]);
  const [conDocumento, setConDocumento] = useState(false);
  const [documento, setDocumento] = useState(null);
  const fondo = useRef(null);

  useEffect(() => { if (fondo.current) fondo.current.scrollIntoView({ behavior: 'smooth' }); }, [messaggi, attende]);

  const toggle = (id) => setScelti((s) => s.includes(id) ? s.filter(x => x !== id) : (s.length >= 4 ? s : [...s, id]));
  const perId = new Map(compagni.map(c => [c.id, c]));

  const invia = useCallback(async () => {
    const t = testo.trim();
    if (!t || attende) return;
    fermatoRef.current = false;
    // b.412 — un filo nuovo per ogni giro: quello vecchio e gia tagliato.
    abortRef.current = new AbortController();
    setErrore('');
    const storia = [...messaggi, { ruolo: 'persona', testo: t }];
    setMessaggi(storia); setTesto(''); setAttende(true);
    const chiudiCiclo = apriCiclo();   // b.394 — un giro di voce comincia ora
    // messaggi per il server: {ruolo, testo} (persona o nome del Compagno)
    // b.363 — fuori le righe di servizio: briefing, sintesi e documento
    // non sono qualcuno che ha parlato. Partivano al modello come turni
    // di un tale chiamato "__briefing", e sporcavano la conversazione.
    const perServer = storia.filter(soloVoci).map(m => ({ ruolo: m.ruolo, testo: m.testo }));
    try {
      await aggiornaVerbale(perServer);
      const d = await parlaTavolo({ compagni: scelti, messaggi: perServer, lingua, userToken, obiettivi: obiettiviAttivi(), obiettivo, briefing, riassunto: riassuntoRef.current, sezioni: sezioniUtente(), segnale: abortRef.current?.signal });
      // b.412 · P1.11 — e si ricontrolla DOPO l'attesa, non solo prima:
      // fra la partenza e il ritorno ci stanno secondi, e in quei secondi
      // si preme Stop. Senza questo, le risposte comparivano lo stesso.
      if (fermatoRef.current) return;
      for (const r of (d.risposte || [])) {
        const c = perId.get(r.compagnoId) || {};
        setMessaggi((m) => [...m, { ruolo: r.nome, testo: r.testo, avatar: c.avatar, colore: c.colore }]);
      }
      // voci in sequenza
      // b.363 — lo Stop del telecomando fermava la voce in corso ma non
      // questo giro: la voce successiva ripartiva da sola. Ora il giro
      // guarda il segnale e si ferma.
      for (const r of (d.risposte || [])) {
        if (fermatoRef.current) break;
        // b.363 — la voce del tavolo entra nel telecomando di Life:
        // prima Pausa e Stop non avevano alcuna presa su di lei.
        // b.405 — la registrazione a mano non serve piu: la fa `parlaTurno`,
        // che e la strada di tutti. Qui resta solo il nome da mostrare.
        if (r.voceId) await parlaTurno({ voceId: r.voceId, testo: r.testo, lingua, userToken, chi: r.nome || 'Tavolo' });
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] perServer:', e?.message || e);
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { chiudiCiclo(); setAttende(false); }
  }, [testo, attende, messaggi, scelti, lingua, userToken, obiettivo, L]); // eslint-disable-line react-hooks/exhaustive-deps

  // b.226 — Debate: chiude la tavola con la SINTESI (risultato condiviso).
  // b.302 — avvio della tavola: con le fonti fa prima la ricerca (come il
  // Dossier) e la mette come primo "documento di partenza" a schermo.
  const avviaTavola = useCallback(async () => {
    if (scelti.length < 2) { setErrore(L('lifeNeedCompanions')); return; }
    setErrore(''); setMessaggi([]); setDocumento(null); setBriefing(''); setFonti([]);
    if (conFonti) {
      const tema = (obiettivo || '').trim();
      if (!tema) { setErrore(L('lifeTableNeedTopic')); return; }
      setAttende(true);
      try {
        const d = await preparaBriefing({ argomento: tema, lingua, userToken });
        if (d?.articolo) {
          // b.380 — LA RICERCA GUASTA SI DICE. Il server manda gia
          // `fontiGuaste` e nel suo file c'e pure scritto «cosi chi legge
          // il dossier sa» — ma qui nessuno la guardava. Risultato: si
          // spuntava "parti da fonti reali", la ricerca falliva, e usciva
          // un riquadro intitolato "Da cui partiamo (fonti)" con dentro
          // zero fonti e un saggio inventato. Un titolo che promette una
          // cosa che non c'e e peggio di nessun titolo: chi legge crede
          // di avere davanti un testo fondato.
          setBriefing(d.articolo);
          setFonti(d.fonti || []);
          // b.412 · P1.12 — lo stato non serve solo al riquadro: DEVE
          // arrivare al prompt del report, che altrimenti intitola «dalle
          // fonti» un testo nato senza fonti.
          setStatoFonti(!!d.fontiGuaste ? 'guaste' : ((d.fonti || []).length ? 'verificate' : 'assenti'));
          setMessaggi([{
            ruolo: '__briefing', testo: d.articolo, fonti: d.fonti || [],
            // guaste se il server lo dichiara, oppure se semplicemente non
            // e arrivata nessuna fonte: per chi legge e la stessa cosa.
            senzaFonti: !!d.fontiGuaste || !(d.fonti || []).length,
          }]);
        }
      } catch (e) {
        setErrore(e?.status === 401 ? L('lifeLoginNeeded') : L('lifeError'));
        setAttende(false); return;
      }
      setAttende(false);
    }
    vibrate(8); setAvviato(true);
  }, [scelti, conFonti, obiettivo, lingua, userToken, L]);

  // b.302 — il DOCUMENTO su richiesta: dal confronto (e dal briefing se
  // c'era) scrive il documento finale, sostanzioso, da conservare.
  const [genDoc, setGenDoc] = useState(false);
  const creaDocumento = useCallback(async () => {
    if (genDoc || messaggi.length < 2) return;
    setGenDoc(true); setErrore('');
    try {
      const discussione = messaggi
        .filter(soloVoci)
        .map(m => `${m.ruolo === 'persona' ? 'Persona' : m.ruolo}: ${m.testo}`).join('\n');
      const r = await reportFinale({ argomento: (obiettivo || '').trim() || L('lifeTableTopic'), briefing, statoFonti, discussione, lingua, userToken });
      if (r?.report) setDocumento(r.report);
    } catch (e) {
      setErrore(e?.status === 401 ? L('lifeLoginNeeded') : L('lifeError'));
    } finally { setGenDoc(false); }
  }, [genDoc, messaggi, obiettivo, briefing, statoFonti, lingua, userToken, L]);

  const concludi = useCallback(async () => {
    if (attende || messaggi.length < 2) return;
    setErrore(''); setAttende(true);
    try {
      const perServer = messaggi.filter(soloVoci).map(m => ({ ruolo: m.ruolo, nome: m.ruolo === 'persona' ? undefined : m.ruolo, testo: m.testo }));
      const s = await sintesiTavolo({ compagni: scelti, messaggi: perServer, lingua, userToken, obiettivo });
      if (s) setMessaggi((m) => [...m, { ruolo: '__sintesi', testo: s }]);
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { setAttende(false); }
  }, [attende, messaggi, scelti, lingua, userToken, obiettivo, L]);

  // ── Scelta dei partecipanti ──
  if (!avviato) {
    return (
      <div>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifeTableWho')}</div>
        {/* b.497 — tavola 23: «chi siede al tavolo si sceglie toccando le
            facce» — PILLOLE con la faccia piccola e il nome, accese o
            spente. Si vede subito chi c'e e chi no, e in una riga ce ne
            stanno tre. Stesso toggle di prima. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {compagni.map((c) => {
            const on = scelti.includes(c.id);
            return (
              <button key={c.id} onClick={() => { vibrate(6); toggle(c.id); }} aria-pressed={on}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px 8px 8px',
                  minHeight: 44, borderRadius: 999, cursor: 'pointer',
                  background: on ? `${c.colore}22` : card,
                  border: `1.5px solid ${on ? c.colore : bordo.split(' ').pop()}`, fontFamily: FONT }}>
                <img src={c.avatar} alt="" width={24} height={24} style={{ borderRadius: 999, display: 'block', objectFit: 'cover' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: testoP }}>{c.nome}</span>
              </button>
            );
          })}
        </div>
        {/* b.226 — Debate: l'obiettivo comune della tavola (facoltativo). */}
        {/* b.497 — tavola 23: l'etichetta dice SU COSA, prima del campo. */}
        <div style={{ fontSize: 12, color: muto, margin: '2px 0 6px' }}>{L('tableOnWhatWord')}</div>
        <input value={obiettivo} onChange={(e) => setObiettivo(e.target.value)}
          placeholder={L('lifeDebateGoalPh')}
          style={{ width: '100%', padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', marginBottom: 10 }} />
        {/* b.302 — le due opzioni ereditate dal Dossier: fonti + documento */}
        {/* b.497 — tavola 23: «le due opzioni sono righe con la
            spiegazione, non caselle da spuntare al buio» — la spunta e
            un pallino a destra, come sulla tavola. Stessi stati. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {[
            { on: conFonti, su: () => setConFonti(v => !v), icona: 'globe', t: L('lifeTableSources'), d: L('lifeTableSourcesDesc') },
            { on: conDocumento, su: () => setConDocumento(v => !v), icona: 'doc', t: L('lifeTableDoc'), d: L('lifeTableDocDesc') },
          ].map((r) => (
            <button key={r.icona} onClick={() => { vibrate(6); r.su(); }}
              aria-pressed={r.on}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', minHeight: 44,
                borderRadius: 12, background: card, border: bordo, cursor: 'pointer',
                fontFamily: FONT, boxSizing: 'border-box', textAlign: 'left', width: '100%' }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: testoP }}><Icon name={r.icona} size={16} color={testoP} />{r.t}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: muto }}>{r.d}</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 18, color: r.on ? accent : muto, flexShrink: 0 }}>{r.on ? '\u25C9' : '\u25CB'}</span>
            </button>
          ))}
        </div>
        <button onClick={avviaTavola} disabled={attende}
          style={{ width: '100%', padding: 14, minHeight: 44, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: suAccento, fontWeight: 600, fontSize: 15, fontFamily: FONT, opacity: attende ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {attende ? '…' : <><Icon name="users" size={18} color={suAccento} />{L('lifeDebateStart')}</>}
        </button>
        {errore && <div style={{ color: rosso, fontSize: 13, marginTop: 10 }}>{errore}</div>}
      </div>
    );
  }

  // ── Il tavolo ──
  // b.394 — vh non e dvh: su Safari iPhone vh conta lo schermo con le
  // barre del browser NASCOSTE, quindi questa colonna sfondava il bordo
  // visibile e la riga per scrivere finiva sotto. Il contenitore che la
  // ospita e gia in dvh: stessa unita, stesso comportamento.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70dvh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: bordo, marginBottom: 10 }}>
        <button onClick={() => setAvviato(false)} aria-label={L('lifeBack')} style={{ background: card, border: bordo, borderRadius: 10, padding: 7, minHeight: 44, cursor: 'pointer' }}>
          <Icon name="back" size={16} color={testoP} />
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {scelti.map(id => perId.get(id)).filter(Boolean).map(c => (
            <img key={c.id} src={c.avatar} alt="" width={26} height={26} style={{ borderRadius: 7, display: 'block', objectFit: 'cover' }} />
          ))}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messaggi.map((m, i) => {
          if (m.ruolo === '__briefing') {
            return (
              <div key={i} style={{ alignSelf: 'stretch', margin: '2px 0 8px', padding: '12px 20px', borderRadius: 14, background: card, border: bordo, color: testoP, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {/* b.380 — il titolo dice la verita su cosa c'e sotto. */}
                {m.senzaFonti ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: avviso, marginBottom: 6 }}>
                    <Icon name="x" size={16} color={avviso} />{L('lifeTableNoSources')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: accent, marginBottom: 6 }}><Icon name="globe" size={16} color={accent} />{L('lifeTableBrief')}</div>
                )}
                {m.senzaFonti && (
                  <div style={{ fontSize: 12, color: muto, marginBottom: 8, lineHeight: 1.5, whiteSpace: 'normal' }}>
                    {L('lifeTableNoSourcesWhy')}
                  </div>
                )}
                {m.testo}
                {m.fonti?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {m.fonti.slice(0, 4).map((f, k) => (
                      <a key={k} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: accent, textDecoration: 'none' }}><Icon name="link" size={13} color={accent} />{f.titolo || f.url}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          if (m.ruolo === '__sintesi') {
            return (
              <div key={i} style={{ alignSelf: 'stretch', margin: '6px 0', padding: '12px 20px', borderRadius: 14, background: `${accent}18`, border: `1px solid ${accent}`, color: testoP, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: accent, marginBottom: 6 }}><Icon name="check" size={16} color={accent} />{L('lifeDebateSynthesis')}</div>
                {m.testo}
              </div>
            );
          }
          const mio = m.ruolo === 'persona';
          return (
            <div key={i} style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: '84%' }}>
              {!mio && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: m.colore || accent, margin: '0 4px 2px' }}>{m.avatar && <img src={m.avatar} alt="" width={16} height={16} style={{ borderRadius: 5, objectFit: 'cover' }} />}{m.ruolo}</div>}
              <div style={{ padding: '9px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, fontFamily: FONT,
                background: mio ? accent : card, color: mio ? suAccento : testoP, border: mio ? 'none' : bordo }}>
                {m.testo}
              </div>
            </div>
          );
        })}
        {attende && <div style={{ alignSelf: 'flex-start', color: muto, fontSize: 13, padding: '4px 8px' }}>…</div>}
        <div ref={fondo} />
      </div>

      {errore && <div style={{ color: rosso, fontSize: 13, padding: '6px 0' }}>{errore}</div>}

      {documento && (
        <div style={{ alignSelf: 'stretch', margin: '6px 0', padding: '14px 20px', borderRadius: 14, background: `${accent}14`, border: `2px solid ${accent}`, color: testoP, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: accent }}><Icon name="doc" size={16} color={accent} />{L('lifeTableDoc')}</span>
            <button onClick={() => { try { navigator.clipboard.writeText(documento); } catch { /* il browser non concede gli appunti in questo contesto: il testo resta comunque a schermo */ } }}
              style={{ background: 'none', border: `1px solid ${accent}`, color: accent, borderRadius: 8, padding: '4px 10px', minHeight: 44, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              {L('lifeCopy')}
            </button>
          </div>
          {documento}
        </div>
      )}
      {messaggi.length >= 2 && (
        <div style={{ display: 'flex', gap: 8, alignSelf: 'center', margin: '6px 0', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={concludi} disabled={attende} style={{ padding: '7px 14px', minHeight: 44, borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="check" size={15} color={accent} />{L('lifeDebateConclude')}
          </button>
          <button onClick={creaDocumento} disabled={genDoc} style={{ padding: '7px 14px', minHeight: 44, borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT, opacity: genDoc ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {genDoc ? '…' : <><Icon name="doc" size={15} color={accent} />{L('lifeTableMakeDoc')}</>}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingTop: 10 }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') invia(); }}
          aria-label={L('lifeChatPh')} placeholder={L('lifeChatPh')} style={{ flex: 1, padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 15, fontFamily: FONT }} />
        <button onClick={invia} disabled={attende} aria-label={L('send')} style={{ padding: '0 16px', minHeight: 44, borderRadius: 12, border: 'none', background: accent, color: suAccento, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
          <Icon name="send" size={16} color={suAccento} />
        </button>
      </div>
    </div>
  );
}

export default memo(Tavolo);
