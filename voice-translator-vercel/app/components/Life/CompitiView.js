'use client';
import { memo, useState, useEffect, useCallback } from 'react';
import { FONT, vibrate, clayCard } from '../../lib/constants.js';
import Icon from '../Icon.js';

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

function CompitiView({ L, userToken, testoP, muto, accent, card, bordo }) {
  const [jobs, setJobs] = useState(null);
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
        <button onClick={() => { vibrate(8); setAggiungo((v) => !v); }}
          style={{ padding: '9px 14px', borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
          {aggiungo ? tt('lifeCancel', 'Annulla') : `+ ${tt('lifeHomeworkAdd', 'Compito')}`}
        </button>
      </div>

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
    </div>
  );
}

export default memo(CompitiView);
