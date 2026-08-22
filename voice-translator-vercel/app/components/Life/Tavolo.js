'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { suona as registraAudio, suInterruzione } from '../../lib/audioLife.js';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { parlaTavolo, parlaTurno, sintesiTavolo, preparaBriefing, reportFinale } from '../../lib/compagni/cliente.js';
import { obiettiviAttivi } from '../../lib/compagni/obiettivi.js';
import { conRipiego } from '../../lib/ripiego.js';

// ═══════════════════════════════════════════════════════════════
// Tavolo — tu + 2-4 Compagni che conversano insieme. Scrivi, e ognuno
// risponde a te e agli altri, tradotto, con la propria voce. Superficie
// autonoma: NON è una stanza WebRTC. (Luca)
// ═══════════════════════════════════════════════════════════════

// b.363 — le righe di servizio del tavolo (briefing, sintesi, documento
// finale) non sono turni di parola: non vanno mai spedite come tali.
const RIGHE_SERVIZIO = new Set(['__briefing', '__sintesi', '__documento']);
const soloVoci = (m) => !RIGHE_SERVIZIO.has(m.ruolo);

function Tavolo({ compagni, L, lingua, userToken, testoP, muto, accent, card, bordo, obiettivoIniziale = '' }) {
  const [scelti, setScelti] = useState([]);
  const [avviato, setAvviato] = useState(false);
  const [messaggi, setMessaggi] = useState([]); // {ruolo:'persona'|nome, testo, emoji, colore}
  const [testo, setTesto] = useState('');
  const [attende, setAttende] = useState(false);
  // b.363 — il segnale di Interrompi che arriva dal telecomando di Life
  const fermatoRef = useRef(false);
  useEffect(() => suInterruzione(() => { fermatoRef.current = true; }), []);
  const [errore, setErrore] = useState('');
  const [obiettivo, setObiettivo] = useState(obiettivoIniziale || ''); // b.226 — Debate: l'obiettivo comune
  // b.302 — la Tavola rotonda assorbe il Dossier: puo partire da FONTI
  // reali (ricerca online, come faceva il Dossier) e produrre un
  // DOCUMENTO su richiesta, all'avvio o durante. Una sezione sola.
  const [conFonti, setConFonti] = useState(false);
  const [briefing, setBriefing] = useState('');   // l'articolo neutro dalle fonti
  const [fonti, setFonti] = useState([]);
  const [conDocumento, setConDocumento] = useState(false);
  const [documento, setDocumento] = useState(null);
  const fondo = useRef(null);
  const tt = conRipiego(L); // b.362 — unica definizione, in lib/ripiego.js

  useEffect(() => { if (fondo.current) fondo.current.scrollIntoView({ behavior: 'smooth' }); }, [messaggi, attende]);

  const toggle = (id) => setScelti((s) => s.includes(id) ? s.filter(x => x !== id) : (s.length >= 4 ? s : [...s, id]));
  const perId = new Map(compagni.map(c => [c.id, c]));

  const invia = useCallback(async () => {
    const t = testo.trim();
    if (!t || attende) return;
    fermatoRef.current = false;
    setErrore('');
    const storia = [...messaggi, { ruolo: 'persona', testo: t }];
    setMessaggi(storia); setTesto(''); setAttende(true);
    // messaggi per il server: {ruolo, testo} (persona o nome del Compagno)
    // b.363 — fuori le righe di servizio: briefing, sintesi e documento
    // non sono qualcuno che ha parlato. Partivano al modello come turni
    // di un tale chiamato "__briefing", e sporcavano la conversazione.
    const perServer = storia.filter(soloVoci).map(m => ({ ruolo: m.ruolo, testo: m.testo }));
    try {
      const d = await parlaTavolo({ compagni: scelti, messaggi: perServer, lingua, userToken, obiettivi: obiettiviAttivi(), obiettivo, briefing });
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
        if (r.voceId) await parlaTurno({ voceId: r.voceId, testo: r.testo, lingua, userToken },
          (a) => registraAudio(a, r.nome || 'Tavolo'));
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] perServer:', e?.message || e);
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { setAttende(false); }
  }, [testo, attende, messaggi, scelti, lingua, userToken, obiettivo, L]); // eslint-disable-line react-hooks/exhaustive-deps

  // b.226 — Debate: chiude la tavola con la SINTESI (risultato condiviso).
  // b.302 — avvio della tavola: con le fonti fa prima la ricerca (come il
  // Dossier) e la mette come primo "documento di partenza" a schermo.
  const avviaTavola = useCallback(async () => {
    if (scelti.length < 2) { setErrore(L('lifeNeedCompanions')); return; }
    setErrore(''); setMessaggi([]); setDocumento(null); setBriefing(''); setFonti([]);
    if (conFonti) {
      const tema = (obiettivo || '').trim();
      if (!tema) { setErrore(tt('lifeTableNeedTopic', 'Con le fonti, scrivi prima di cosa parlare nell\'obiettivo.')); return; }
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
  }, [scelti, conFonti, obiettivo, lingua, userToken, L]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const r = await reportFinale({ argomento: (obiettivo || '').trim() || tt('lifeTableTopic', 'la tavola rotonda'), briefing, discussione, lingua, userToken });
      if (r?.report) setDocumento(r.report);
    } catch (e) {
      setErrore(e?.status === 401 ? L('lifeLoginNeeded') : L('lifeError'));
    } finally { setGenDoc(false); }
  }, [genDoc, messaggi, obiettivo, briefing, lingua, userToken, L]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, marginBottom: 14 }}>
          {compagni.map((c) => {
            const on = scelti.includes(c.id);
            return (
              <button key={c.id} onClick={() => { vibrate(6); toggle(c.id); }}
                style={{ padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', background: on ? `${c.colore}22` : card, border: `1px solid ${on ? c.colore : bordo.split(' ').pop()}`, fontFamily: FONT }}>
                <img src={c.avatar} alt="" width={46} height={46} style={{ borderRadius: 12, display: 'block', margin: '0 auto 6px', objectFit: 'cover' }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: testoP }}>{c.nome}</div>
              </button>
            );
          })}
        </div>
        {/* b.226 — Debate: l'obiettivo comune della tavola (facoltativo). */}
        <input value={obiettivo} onChange={(e) => setObiettivo(e.target.value)}
          placeholder={tt('lifeDebateGoalPh', 'Obiettivo del confronto (facoltativo): a cosa volete arrivare?')}
          style={{ width: '100%', padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', marginBottom: 10 }} />
        {/* b.302 — le due opzioni ereditate dal Dossier: fonti + documento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, background: card, border: bordo, cursor: 'pointer', fontFamily: FONT }}>
            <input type="checkbox" checked={conFonti} onChange={(e) => setConFonti(e.target.checked)} style={{ width: 20, height: 20, accentColor: accent }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: testoP }}>🔎 {tt('lifeTableSources', 'Parti da fonti reali')}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: muto }}>{tt('lifeTableSourcesDesc', 'Cerca online e dai agli esperti dei fatti da cui partire')}</span>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, background: card, border: bordo, cursor: 'pointer', fontFamily: FONT }}>
            <input type="checkbox" checked={conDocumento} onChange={(e) => setConDocumento(e.target.checked)} style={{ width: 20, height: 20, accentColor: accent }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: testoP }}>📄 {tt('lifeTableDoc', 'Produci un documento')}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: muto }}>{tt('lifeTableDocDesc', 'Alla fine, un documento da conservare — o chiedilo quando vuoi durante')}</span>
            </span>
          </label>
        </div>
        <button onClick={avviaTavola} disabled={attende}
          style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT, opacity: attende ? 0.6 : 1 }}>
          {attende ? '…' : `⚖️ ${tt('lifeDebateStart', 'Apri la Tavola rotonda')}`}
        </button>
        {errore && <div style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{errore}</div>}
      </div>
    );
  }

  // ── Il tavolo ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: bordo, marginBottom: 10 }}>
        <button onClick={() => setAvviato(false)} aria-label={L('lifeBack')} style={{ background: card, border: bordo, borderRadius: 10, padding: 7, cursor: 'pointer' }}>
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
              <div key={i} style={{ alignSelf: 'stretch', margin: '2px 0 8px', padding: '12px 14px', borderRadius: 14, background: card, border: bordo, color: testoP, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {/* b.380 — il titolo dice la verita su cosa c'e sotto. */}
                {m.senzaFonti ? (
                  <div style={{ fontWeight: 800, color: '#e08a5e', marginBottom: 6 }}>
                    ⚠ {tt('lifeTableNoSources', 'Senza fonti: la ricerca non ha trovato niente')}
                  </div>
                ) : (
                  <div style={{ fontWeight: 800, color: accent, marginBottom: 6 }}>🔎 {tt('lifeTableBrief', 'Da cui partiamo (fonti)')}</div>
                )}
                {m.senzaFonti && (
                  <div style={{ fontSize: 12, color: muto, marginBottom: 8, lineHeight: 1.5, whiteSpace: 'normal' }}>
                    {tt('lifeTableNoSourcesWhy', 'Quello che segue lo ha scritto il modello con quello che sa, non e tratto da documenti. Trattalo come un punto di partenza da verificare.')}
                  </div>
                )}
                {m.testo}
                {m.fonti?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {m.fonti.slice(0, 4).map((f, k) => (
                      <a key={k} href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: accent, textDecoration: 'none' }}>🔗 {f.titolo || f.url}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          if (m.ruolo === '__sintesi') {
            return (
              <div key={i} style={{ alignSelf: 'stretch', margin: '6px 0', padding: '12px 14px', borderRadius: 14, background: `${accent}18`, border: `1px solid ${accent}`, color: testoP, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                <div style={{ fontWeight: 800, color: accent, marginBottom: 6 }}>⚖️ {tt('lifeDebateSynthesis', 'Conclusione condivisa')}</div>
                {m.testo}
              </div>
            );
          }
          const mio = m.ruolo === 'persona';
          return (
            <div key={i} style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: '84%' }}>
              {!mio && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: m.colore || accent, margin: '0 4px 2px' }}>{m.avatar && <img src={m.avatar} alt="" width={16} height={16} style={{ borderRadius: 5, objectFit: 'cover' }} />}{m.ruolo}</div>}
              <div style={{ padding: '9px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, fontFamily: FONT,
                background: mio ? accent : card, color: mio ? '#04121c' : testoP, border: mio ? 'none' : bordo }}>
                {m.testo}
              </div>
            </div>
          );
        })}
        {attende && <div style={{ alignSelf: 'flex-start', color: muto, fontSize: 13, padding: '4px 8px' }}>…</div>}
        <div ref={fondo} />
      </div>

      {errore && <div style={{ color: '#f87171', fontSize: 13, padding: '6px 0' }}>{errore}</div>}

      {documento && (
        <div style={{ alignSelf: 'stretch', margin: '6px 0', padding: '14px 16px', borderRadius: 14, background: `${accent}14`, border: `2px solid ${accent}`, color: testoP, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: accent }}>📄 {tt('lifeTableDoc', 'Documento')}</span>
            <button onClick={() => { try { navigator.clipboard.writeText(documento); } catch { /* il browser non concede gli appunti in questo contesto: il testo resta comunque a schermo */ } }}
              style={{ background: 'none', border: `1px solid ${accent}`, color: accent, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
              {tt('lifeCopy', 'Copia')}
            </button>
          </div>
          {documento}
        </div>
      )}
      {messaggi.length >= 2 && (
        <div style={{ display: 'flex', gap: 8, alignSelf: 'center', margin: '6px 0', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={concludi} disabled={attende} style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
            ⚖️ {tt('lifeDebateConclude', 'Conclusione condivisa')}
          </button>
          <button onClick={creaDocumento} disabled={genDoc} style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, opacity: genDoc ? 0.6 : 1 }}>
            {genDoc ? '…' : `📄 ${tt('lifeTableMakeDoc', 'Fai il documento')}`}
          </button>
        </div>
      )}

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

export default memo(Tavolo);
