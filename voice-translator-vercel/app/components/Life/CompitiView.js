'use client';
import { memo, useState, useEffect, useCallback } from 'react';
import { FONT, vibrate, clayCard } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { generaLezione, generaQuiz } from '../../lib/compagni/cliente.js';
import { sesSet } from '../../lib/memoria.js';

// ═══════════════════════════════════════════════════════════════
// COMPITI — l'agenda di studio (b.332, Ondata 1 di "Ripetizioni e
// Compiti"). Ogni studente arriva a casa con un calendario: qui i JOBS
// — cosa studiare, per quale materia, entro quando — raggruppati per
// urgenza (In ritardo / Oggi / Questa settimana / Piu avanti), con lo
// stato a un tocco. Le Ondate 2-3 aggiungono i Materiali (foto/PDF ->
// tabella -> lezione) e il Coach serale.
// ═══════════════════════════════════════════════════════════════

async function chiama(azione, corpo, userToken) {
  const r = await fetch('/api/compiti', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ azione, userToken, ...corpo }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error(d?.error || 'errore'); e.status = r.status; throw e; }
  return d;
}

function gruppoDi(scadenza) {
  if (!scadenza) return 'senza';
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const s = new Date(scadenza + 'T00:00:00');
  const diff = Math.round((s - oggi) / 86400000);
  if (diff < 0) return 'ritardo';
  if (diff === 0) return 'oggi';
  if (diff <= 7) return 'settimana';
  return 'avanti';
}

const GRUPPI = [
  { id: 'ritardo', titolo: 'In ritardo', colore: '#f87171' },
  { id: 'oggi', titolo: 'Oggi', colore: '#f59e0b' },
  { id: 'settimana', titolo: 'Questa settimana', colore: null },
  { id: 'avanti', titolo: 'Più avanti', colore: null },
  { id: 'senza', titolo: 'Senza data', colore: null },
];

function CompitiView({ L, userToken, lingua, cambiaScheda, testoP, muto, accent, card, bordo }) {
  const [vista, setVista] = useState('agenda'); // agenda | materiali
  const [jobs, setJobs] = useState(null);
  // b.333 — MATERIALI: appunti incollati (gratis) o fotografati (AI, wallet).
  const [materiali, setMateriali] = useState(null);
  const [matAperto, setMatAperto] = useState(null);   // materiale col testo
  const [matBozza, setMatBozza] = useState(null);     // { titolo, materia, testo } in creazione
  const [ocrLavoro, setOcrLavoro] = useState(false);
  const [lezioneMat, setLezioneMat] = useState(null); // testo lezione generata
  const [quizMat, setQuizMat] = useState(null);       // domande quiz
  const [risposteMat, setRisposteMat] = useState({});
  const [lavoroMat, setLavoroMat] = useState('');     // '' | 'lezione' | 'quiz'
  const [errore, setErrore] = useState('');
  const [aggiungo, setAggiungo] = useState(false);
  const [bozza, setBozza] = useState({ titolo: '', materia: '', scadenza: '', note: '' });
  const [salvando, setSalvando] = useState(false);
  const tt = (k, f) => { const v = L(k); return v && v !== k ? v : f; };

  const ricarica = useCallback(() => {
    if (!userToken) { setJobs([]); return; }
    chiama('elenca', {}, userToken).then((d) => setJobs(d.jobs || [])).catch((e) => {
      setJobs([]); setErrore(e.status === 401 ? tt('lifeLoginNeeded', 'Accedi per usare i Compiti') : '');
    });
  }, [userToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ricarica(); }, [ricarica]);

  const salva = useCallback(async () => {
    if (!bozza.titolo.trim() || salvando) return;
    setSalvando(true); setErrore('');
    try {
      await chiama('salva', { job: { ...bozza, titolo: bozza.titolo.trim(), scadenza: bozza.scadenza || null } }, userToken);
      setBozza({ titolo: '', materia: '', scadenza: '', note: '' });
      setAggiungo(false);
      ricarica();
    } catch (e) { setErrore(e.status === 401 ? tt('lifeLoginNeeded', 'Accedi') : tt('lifeError', 'Qualcosa è andato storto')); }
    finally { setSalvando(false); }
  }, [bozza, salvando, userToken, ricarica]); // eslint-disable-line react-hooks/exhaustive-deps

  const avanzaStato = useCallback(async (j) => {
    const prossimo = j.stato === 'da_fare' ? 'in_corso' : j.stato === 'in_corso' ? 'fatto' : 'da_fare';
    vibrate(8);
    setJobs((prev) => prev.map((x) => x.id === j.id ? { ...x, stato: prossimo } : x));
    try { await chiama('stato', { id: j.id, stato: prossimo }, userToken); } catch { ricarica(); }
  }, [userToken, ricarica]);

  const elimina = useCallback(async (id) => {
    setJobs((prev) => prev.filter((x) => x.id !== id));
    try { await chiama('elimina', { id }, userToken); } catch { ricarica(); }
  }, [userToken, ricarica]);

  // ── b.333 · MATERIALI ──
  const ricaricaMateriali = useCallback(() => {
    if (!userToken) return;
    chiama('materiali', {}, userToken).then((d) => setMateriali(d.materiali || [])).catch(() => setMateriali([]));
  }, [userToken]);
  useEffect(() => { if (vista === 'materiali' && materiali === null) ricaricaMateriali(); }, [vista, materiali, ricaricaMateriali]);

  // Rimpicciolisce la foto prima dell'AI: meno token, meno costo.
  const fotoInTesto = useCallback((file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        const scala = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scala); c.height = Math.round(img.height * scala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = rej;
      img.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  }), []);

  const scattaOcr = useCallback(async (file) => {
    if (!file || ocrLavoro) return;
    setOcrLavoro(true); setErrore('');
    try {
      const dataUrl = await fotoInTesto(file);
      const d = await chiama('ocr', { immagine: dataUrl }, userToken);
      setMatBozza((b) => ({ ...(b || { titolo: '', materia: '', testo: '' }), titolo: b?.titolo || d.titolo || '', testo: [(b?.testo || ''), d.testo].filter(Boolean).join('\n\n') }));
    } catch (e) {
      setErrore(e.status === 402 ? tt('lifeNoCredit', 'Credito esaurito') : tt('lifeError', 'Qualcosa è andato storto'));
    } finally { setOcrLavoro(false); }
  }, [ocrLavoro, fotoInTesto, userToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // b.334 — PDF: base64 al server, testo indietro, GRATIS (niente wallet).
  const caricaPdf = useCallback(async (file) => {
    if (!file || ocrLavoro) return;
    if (file.size > 5 * 1024 * 1024) { setErrore(tt('lifeMatPdfBig', 'PDF troppo grande (max 5MB)')); return; }
    setOcrLavoro(true); setErrore('');
    try {
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      const d = await chiama('pdf', { pdf: b64 }, userToken);
      setMatBozza((b) => ({ ...(b || { titolo: '', materia: '', testo: '' }), titolo: b?.titolo || file.name.replace(/\.pdf$/i, ''), testo: [(b?.testo || ''), d.testo].filter(Boolean).join('\n\n') }));
    } catch { setErrore(tt('lifeMatPdfErr', 'PDF non leggibile (se è una scansione, usa la foto)')); }
    finally { setOcrLavoro(false); }
  }, [ocrLavoro, userToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvaMat = useCallback(async () => {
    if (!matBozza?.testo?.trim()) return;
    try {
      await chiama('salvaMateriale', { materiale: { titolo: matBozza.titolo || 'Materiale', materia: matBozza.materia || '', origine: 'appunti', testo: matBozza.testo } }, userToken);
      setMatBozza(null); ricaricaMateriali();
    } catch (e) { setErrore(e.status === 401 ? tt('lifeLoginNeeded', 'Accedi') : tt('lifeError', 'Qualcosa è andato storto')); }
  }, [matBozza, userToken, ricaricaMateriali]); // eslint-disable-line react-hooks/exhaustive-deps

  const apriMat = useCallback(async (id) => {
    setLezioneMat(null); setQuizMat(null); setRisposteMat({});
    try { const d = await chiama('leggiMateriale', { id }, userToken); setMatAperto(d.materiale); }
    catch { setErrore(tt('lifeError', 'Qualcosa è andato storto')); }
  }, [userToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const creaLezioneDaMat = useCallback(async () => {
    if (!matAperto || lavoroMat) return;
    setLavoroMat('lezione'); setErrore('');
    try {
      const d = await generaLezione({ argomento: matAperto.titolo, categoria: 'altro', livello: 'base', lezione: { titolo: matAperto.titolo, obiettivi: [] }, lingua: lingua || 'it', userToken, materialeId: matAperto.id });
      setLezioneMat(d.contenuto || '');
    } catch (e) { setErrore(e.creditoEsaurito ? tt('lifeNoCredit', 'Credito esaurito') : tt('lifeError', 'Qualcosa è andato storto')); }
    finally { setLavoroMat(''); }
  }, [matAperto, lavoroMat, lingua, userToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const creaQuizDaMat = useCallback(async () => {
    if (!matAperto || lavoroMat) return;
    setLavoroMat('quiz'); setErrore('');
    try {
      const d = await generaQuiz({ lezione: { titolo: matAperto.titolo }, lingua: lingua || 'it', userToken, livello: 'base', contenuto: (lezioneMat || matAperto.testo || '').slice(0, 4000), argomento: matAperto.titolo });
      setQuizMat(d.domande || []); setRisposteMat({});
    } catch (e) { setErrore(e.creditoEsaurito ? tt('lifeNoCredit', 'Credito esaurito') : tt('lifeError', 'Qualcosa è andato storto')); }
    finally { setLavoroMat(''); }
  }, [matAperto, lavoroMat, lezioneMat, lingua, userToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // b.333 — COACH: porta l'agenda di oggi dal Compagno (scheda Amico) con
  // il riassunto gia scritto nel campo messaggio.
  const studiaColCoach = useCallback(() => {
    const aperti = (jobs || []).filter((j) => j.stato !== 'fatto').slice(0, 6);
    const righe = aperti.map((j) => `- ${j.titolo}${j.materia ? ` (${j.materia})` : ''}${j.scadenza ? ` entro ${j.scadenza}` : ''}`).join('\n');
    sesSet('vt-coach-brief', `Stasera devo studiare:\n${righe}\nAiutami a organizzarmi: da cosa parto e come divido il tempo?`);
    vibrate(10);
    cambiaScheda?.('amico');
  }, [jobs, cambiaScheda]);

  const input = { width: '100%', padding: 11, borderRadius: 10, border: bordo, background: card, color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box' };

  if (!userToken) return <div style={{ fontSize: 13, color: muto, textAlign: 'center', padding: '30px 10px' }}>{tt('lifeLoginNeeded', 'Accedi per usare i Compiti')}</div>;
  if (jobs === null) return <div style={{ fontSize: 13, color: muto, textAlign: 'center', padding: '30px 10px' }}>…</div>;

  const perGruppo = new Map(GRUPPI.map((g) => [g.id, []]));
  for (const j of jobs) perGruppo.get(gruppoDi(j.scadenza)).push(j);
  const fatti = jobs.filter((j) => j.stato === 'fatto').length;

  return (
    <div>
      {/* Testata: quanto resta da fare, oggi. */}
      <div style={{ padding: 14, ...clayCard(card), marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="graduation" size={22} color={accent} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: testoP, fontSize: 14 }}>{tt('lifeHomeworkTitle', 'Agenda di studio')}</div>
          <div style={{ fontSize: 11, color: muto }}>{jobs.length - fatti} {tt('lifeHomeworkOpen', 'da fare')} · {fatti} {tt('lifeHomeworkDone', 'fatti')}</div>
        </div>
        {jobs.length - fatti > 0 && (
          <button onClick={studiaColCoach} title={tt('lifeCoachHint', 'Porta l’agenda dal tuo Compagno')}
            style={{ padding: '9px 12px', borderRadius: 12, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 800, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
            {tt('lifeCoachBtn', 'Coach')}
          </button>
        )}
        <button onClick={() => { vibrate(8); setAggiungo((v) => !v); }}
          style={{ padding: '9px 14px', borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
          {aggiungo ? tt('lifeCancel', 'Annulla') : `+ ${tt('lifeHomeworkAdd', 'Compito')}`}
        </button>
      </div>

      {/* b.333 — le due anime dei Compiti: l'AGENDA e i MATERIALI. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[{ id: 'agenda', et: tt('lifeHomeworkAgenda', 'Agenda') }, { id: 'materiali', et: tt('lifeHomeworkMaterials', 'Materiali') }].map((t) => (
          <button key={t.id} onClick={() => setVista(t.id)}
            style={{ flex: 1, padding: '9px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
              background: vista === t.id ? `${accent}22` : card, color: vista === t.id ? accent : muto,
              border: vista === t.id ? `1px solid ${accent}` : bordo }}>{t.et}</button>
        ))}
      </div>

      {vista === 'agenda' && <>

      {aggiungo && (
        <div style={{ padding: 14, ...clayCard(card), marginBottom: 12 }}>
          <input value={bozza.titolo} onChange={(e) => setBozza((b) => ({ ...b, titolo: e.target.value }))}
            placeholder={tt('lifeHomeworkPh', 'Es. Studiare capitolo 4 di storia')} autoFocus style={{ ...input, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={bozza.materia} onChange={(e) => setBozza((b) => ({ ...b, materia: e.target.value }))}
              placeholder={tt('lifeHomeworkSubject', 'Materia')} style={{ ...input, flex: 1 }} />
            <input type="date" value={bozza.scadenza} onChange={(e) => setBozza((b) => ({ ...b, scadenza: e.target.value }))}
              style={{ ...input, flex: 1 }} />
          </div>
          <textarea value={bozza.note} onChange={(e) => setBozza((b) => ({ ...b, note: e.target.value }))} rows={2}
            placeholder={tt('lifeHomeworkNotes', 'Note (pagine, esercizi, cosa portare)…')} style={{ ...input, resize: 'vertical', marginBottom: 8 }} />
          <button onClick={salva} disabled={salvando || !bozza.titolo.trim()}
            style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, opacity: (salvando || !bozza.titolo.trim()) ? 0.6 : 1 }}>
            {salvando ? '…' : tt('lifeSave', 'Salva')}
          </button>
        </div>
      )}

      {errore && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{errore}</div>}

      {jobs.length === 0 && !aggiungo && (
        <div style={{ fontSize: 13, color: muto, textAlign: 'center', padding: '24px 10px', lineHeight: 1.6 }}>
          {tt('lifeHomeworkEmpty', 'Ancora nessun compito. Aggiungi cosa devi studiare e per quando: l’agenda ti tiene il passo.')}
        </div>
      )}

      {GRUPPI.map((g) => {
        const lista = perGruppo.get(g.id) || [];
        if (!lista.length) return null;
        return (
          <div key={g.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: g.colore || muto, marginBottom: 6 }}>{g.titolo.toUpperCase()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lista.map((j) => {
                const fatto = j.stato === 'fatto';
                return (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, ...clayCard(card), opacity: fatto ? 0.6 : 1 }}>
                    {/* lo stato avanza a un tocco: da fare -> in corso -> fatto */}
                    <button onClick={() => avanzaStato(j)} aria-label={j.stato}
                      style={{ width: 26, height: 26, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
                        border: `2px solid ${fatto ? accent : j.stato === 'in_corso' ? '#f59e0b' : 'rgba(255,255,255,0.25)'}`,
                        background: fatto ? accent : j.stato === 'in_corso' ? 'rgba(245,158,11,0.18)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {fatto && <Icon name="check" size={13} color="#04121c" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: testoP, fontSize: 14, textDecoration: fatto ? 'line-through' : 'none' }}>{j.titolo}</div>
                      <div style={{ fontSize: 11, color: muto }}>
                        {[j.materia, j.scadenza, j.stato === 'in_corso' ? tt('lifeHomeworkInProgress', 'in corso') : ''].filter(Boolean).join(' · ')}
                      </div>
                      {j.note && <div style={{ fontSize: 11, color: muto, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.note}</div>}
                    </div>
                    <button onClick={() => elimina(j.id)} aria-label={tt('lifeDelete', 'Elimina')}
                      style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                      <Icon name="x" size={13} color="#f87171" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </>}

      {vista === 'materiali' && (
        <div>
          {/* nuovo materiale: INCOLLA (gratis) o FOTO -> AI (wallet) */}
          {!matBozza && !matAperto && (
            <button onClick={() => setMatBozza({ titolo: '', materia: '', testo: '' })}
              style={{ width: '100%', padding: 13, borderRadius: 14, border: bordo, cursor: 'pointer', background: 'transparent', color: testoP, fontWeight: 700, fontSize: 14, fontFamily: FONT, marginBottom: 12 }}>
              + {tt('lifeMatAdd', 'Aggiungi materiale (appunti, pagine, dispense)')}
            </button>
          )}

          {matBozza && (
            <div style={{ padding: 14, ...clayCard(card), marginBottom: 12 }}>
              <input value={matBozza.titolo} onChange={(e) => setMatBozza((b) => ({ ...b, titolo: e.target.value }))}
                placeholder={tt('lifeMatTitle', 'Titolo (es. Storia — cap. 4)')} style={{ ...input, marginBottom: 8 }} />
              <textarea value={matBozza.testo} onChange={(e) => setMatBozza((b) => ({ ...b, testo: e.target.value }))} rows={7}
                placeholder={tt('lifeMatPaste', 'Incolla qui il testo degli appunti (gratis)… oppure fotografa la pagina qui sotto.')}
                style={{ ...input, resize: 'vertical', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ flex: 1, minWidth: 150, padding: 11, borderRadius: 12, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, textAlign: 'center', opacity: ocrLavoro ? 0.6 : 1 }}>
                  {ocrLavoro ? tt('lifeMatReading', 'Leggo la pagina…') : tt('lifeMatPhoto', 'Fotografa la pagina (AI, ~1 cent)')}
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) scattaOcr(f); }} />
                </label>
                {/* b.334 — PDF: testo estratto LATO SERVER, gratis (fino a 30 pagine). */}
                <label style={{ flex: 1, minWidth: 120, padding: 11, borderRadius: 12, border: bordo, background: 'transparent', color: testoP, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, textAlign: 'center', opacity: ocrLavoro ? 0.6 : 1 }}>
                  {tt('lifeMatPdf', 'Carica PDF (gratis)')}
                  <input type="file" accept="application/pdf" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) caricaPdf(f); }} />
                </label>
                <button onClick={salvaMat} disabled={!matBozza.testo.trim()}
                  style={{ flex: 1, minWidth: 120, padding: 11, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, opacity: matBozza.testo.trim() ? 1 : 0.5 }}>
                  {tt('lifeSave', 'Salva')}
                </button>
                <button onClick={() => setMatBozza(null)}
                  style={{ padding: 11, borderRadius: 12, border: bordo, background: 'transparent', color: muto, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  {tt('lifeCancel', 'Annulla')}
                </button>
              </div>
            </div>
          )}

          {/* elenco materiali */}
          {!matAperto && (materiali || []).map((m) => (
            <button key={m.id} onClick={() => apriMat(m.id)}
              style={{ width: '100%', textAlign: 'left', padding: 13, ...clayCard(card), cursor: 'pointer', fontFamily: FONT, color: testoP, marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{m.titolo}</div>
              <div style={{ fontSize: 11, color: muto }}>{[m.materia, m.origine].filter(Boolean).join(' · ')}</div>
            </button>
          ))}
          {!matAperto && materiali?.length === 0 && !matBozza && (
            <div style={{ fontSize: 13, color: muto, textAlign: 'center', padding: '20px 8px', lineHeight: 1.6 }}>
              {tt('lifeMatEmpty', 'Nessun materiale ancora. Incolla i tuoi appunti (gratis) o fotografa una pagina: da lì nascono lezione e test su misura.')}
            </div>
          )}

          {/* materiale aperto: testo + Crea lezione + Quiz su misura */}
          {matAperto && (
            <div>
              <button onClick={() => { setMatAperto(null); setLezioneMat(null); setQuizMat(null); }}
                style={{ background: card, border: bordo, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: testoP, fontFamily: FONT, marginBottom: 10 }}>
                <Icon name="back" size={13} color={testoP} /> {tt('lifeHomeworkMaterials', 'Materiali')}
              </button>
              <div style={{ fontWeight: 800, color: testoP, fontSize: 15, marginBottom: 8 }}>{matAperto.titolo}</div>
              <div style={{ padding: 12, borderRadius: 12, background: card, border: bordo, maxHeight: 220, overflowY: 'auto', fontSize: 13, color: testoP, whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 10 }}>
                {matAperto.testo}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={creaLezioneDaMat} disabled={!!lavoroMat}
                  style={{ flex: 1, minWidth: 140, padding: 12, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, opacity: lavoroMat ? 0.6 : 1 }}>
                  {lavoroMat === 'lezione' ? tt('lifeGenerating', 'Un momento…') : tt('lifeMatLesson', 'Crea la lezione')}
                </button>
                <button onClick={creaQuizDaMat} disabled={!!lavoroMat}
                  style={{ flex: 1, minWidth: 140, padding: 12, borderRadius: 12, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 800, cursor: 'pointer', fontFamily: FONT, opacity: lavoroMat ? 0.6 : 1 }}>
                  {lavoroMat === 'quiz' ? tt('lifeGenerating', 'Un momento…') : tt('lifeMatQuiz', 'Test su misura')}
                </button>
              </div>

              {lezioneMat && (
                <div style={{ padding: 14, borderRadius: 14, background: card, border: `1px solid ${accent}44`, marginBottom: 12, fontSize: 14, color: testoP, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {lezioneMat}
                </div>
              )}

              {quizMat && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  {quizMat.map((q, i) => {
                    const scelta = risposteMat[i];
                    const data = scelta !== undefined;
                    return (
                      <div key={i} style={{ padding: 12, borderRadius: 12, background: card, border: bordo }}>
                        <div style={{ fontWeight: 700, color: testoP, marginBottom: 8, fontSize: 13.5 }}>{i + 1}. {q.domanda}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {q.opzioni.map((o, j) => {
                            const giusta = j === q.corretta;
                            const mia = scelta === j;
                            return (
                              <button key={j} onClick={() => { if (!data) setRisposteMat((r) => ({ ...r, [i]: j })); }}
                                style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: data ? 'default' : 'pointer', fontFamily: FONT, fontSize: 13,
                                  background: data ? (giusta ? 'rgba(52,211,153,0.14)' : mia ? 'rgba(248,113,113,0.12)' : 'transparent') : 'rgba(255,255,255,0.04)',
                                  border: data && giusta ? '1px solid rgba(52,211,153,0.5)' : data && mia ? '1px solid rgba(248,113,113,0.5)' : bordo,
                                  color: testoP }}>
                                {o}
                              </button>
                            );
                          })}
                        </div>
                        {data && q.spiegazione && <div style={{ fontSize: 12, color: muto, marginTop: 8 }}>{q.spiegazione}</div>}
                      </div>
                    );
                  })}
                  {quizMat.length > 0 && Object.keys(risposteMat).length === quizMat.length && (
                    <div style={{ padding: 12, borderRadius: 12, background: card, border: `1px solid ${accent}`, color: testoP, fontWeight: 800, textAlign: 'center' }}>
                      {quizMat.filter((q, i) => risposteMat[i] === q.corretta).length}/{quizMat.length}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(CompitiView);
