'use client';
import { memo, useState, useEffect, useCallback } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import {
  elencoObiettivi, salvaObiettivo, rimuoviObiettivo,
  CATEGORIE_OBIETTIVO, STATI_OBIETTIVO,
} from '../../lib/compagni/obiettivi.js';

// b.224 — OBIETTIVI DI VITA (il "tutor che ti accompagna"). Qui li imposti;
// quando parli con un Compagno (Amico/Tavolo), lui li CONOSCE e ti aiuta a
// raggiungerli. Vivono sul dispositivo (localStorage).

const STATO_ETI = { attivo: 'Attivo', raggiunto: 'Raggiunto', pausa: 'In pausa' };

function GestioneObiettivi({ L, testoP, muto, accent, card, bordo }) {
  const [lista, setLista] = useState([]);
  const [bozza, setBozza] = useState(null); // null = elenco; oggetto = form

  useEffect(() => { setLista(elencoObiettivi()); }, []);

  const tt = (k, f) => { const v = L(k); return v && v !== k ? v : f; };
  const vuoto = () => ({ id: '', titolo: '', descrizione: '', categoria: 'crescita', stato: 'attivo', priorita: 2, progresso: 0 });
  const campo = (k) => (e) => setBozza((b) => ({ ...b, [k]: e.target.value }));

  const salva = useCallback(() => {
    if (!bozza?.titolo?.trim()) return;
    setLista(salvaObiettivo(bozza));
    setBozza(null);
  }, [bozza]);

  const elimina = useCallback((id) => { setLista(rimuoviObiettivo(id)); }, []);

  const input = { width: '100%', padding: 11, borderRadius: 10, border: bordo, background: card, color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box' };
  const etich = { fontSize: 12, color: muto, margin: '10px 0 4px', display: 'block' };
  const iconaCat = (id) => (CATEGORIE_OBIETTIVO.find((c) => c.id === id) || {}).icona || '🎯';

  // ── FORM ──
  if (bozza) {
    return (
      <div>
        <button onClick={() => setBozza(null)} style={{ background: card, border: bordo, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: testoP, fontFamily: FONT, marginBottom: 8 }}>
          <Icon name="back" size={14} color={testoP} /> {tt('lifeGoalBack', 'Indietro')}
        </button>

        <label style={etich}>{tt('lifeGoalTitle', 'Obiettivo')}</label>
        <input value={bozza.titolo} onChange={campo('titolo')} placeholder={tt('lifeGoalTitlePh', 'Es. Imparare lo spagnolo, correre 5 km…')} style={input} />

        <label style={etich}>{tt('lifeGoalDesc', 'Dettagli (facoltativo)')}</label>
        <textarea value={bozza.descrizione} onChange={campo('descrizione')} rows={3}
          placeholder={tt('lifeGoalDescPh', 'Perché conta, cosa vuoi ottenere…')} style={{ ...input, resize: 'vertical' }} />

        <label style={etich}>{tt('lifeGoalCat', 'Area')}</label>
        <select value={bozza.categoria} onChange={campo('categoria')} style={input}>
          {CATEGORIE_OBIETTIVO.map((c) => <option key={c.id} value={c.id}>{c.icona} {c.etichetta}</option>)}
        </select>

        <label style={etich}>{tt('lifeGoalProgress', 'Avanzamento')}: {bozza.progresso}%</label>
        <input type="range" min={0} max={100} value={bozza.progresso}
          onChange={(e) => setBozza((b) => ({ ...b, progresso: Number(e.target.value) }))}
          style={{ width: '100%', accentColor: accent, cursor: 'pointer' }} />

        <label style={etich}>{tt('lifeGoalPriority', 'Priorità')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map((p) => (
            <button key={p} onClick={() => setBozza((b) => ({ ...b, priorita: p }))}
              style={{ flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontWeight: 700,
                border: bordo, background: bozza.priorita === p ? accent : 'transparent', color: bozza.priorita === p ? '#04121c' : testoP }}>
              {p === 1 ? tt('lifeGoalLow', 'Bassa') : p === 2 ? tt('lifeGoalMed', 'Media') : tt('lifeGoalHigh', 'Alta')}
            </button>
          ))}
        </div>

        <label style={etich}>{tt('lifeGoalStatus', 'Stato')}</label>
        <select value={bozza.stato} onChange={campo('stato')} style={input}>
          {STATI_OBIETTIVO.map((s) => <option key={s} value={s}>{STATO_ETI[s] || s}</option>)}
        </select>

        <button onClick={salva} disabled={!bozza.titolo.trim()} style={{ width: '100%', marginTop: 16, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT, opacity: bozza.titolo.trim() ? 1 : 0.6 }}>
          ✅ {tt('lifeGoalSave', 'Salva obiettivo')}
        </button>
      </div>
    );
  }

  // ── ELENCO ──
  const attivi = lista.filter((o) => o.stato === 'attivo');
  return (
    <div>
      <div style={{ fontSize: 13, color: muto, marginBottom: 12, lineHeight: 1.5 }}>
        {tt('lifeGoalIntro', 'Imposta i tuoi obiettivi di vita. I tuoi Compagni li conoscono e ti accompagnano a raggiungerli.')}
      </div>

      <button onClick={() => { vibrate(8); setBozza(vuoto()); }} style={{ width: '100%', padding: 13, borderRadius: 14, border: bordo, cursor: 'pointer', background: 'transparent', color: testoP, fontWeight: 700, fontSize: 14, fontFamily: FONT, marginBottom: 16 }}>
        ➕ {tt('lifeGoalNew', 'Nuovo obiettivo')}
      </button>

      {lista.length === 0
        ? <div style={{ fontSize: 13, color: muto, textAlign: 'center', padding: '24px 8px' }}>{tt('lifeGoalEmpty', 'Ancora nessun obiettivo. Aggiungine uno: il tuo Compagno inizierà a tenerlo presente.')}</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map((o) => (
              <div key={o.id} style={{ padding: 12, borderRadius: 12, background: card, border: `1px solid ${o.stato === 'attivo' ? accent : (bordo.split(' ').pop())}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{iconaCat(o.categoria)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: testoP, fontSize: 14 }}>{o.titolo}</div>
                    {o.descrizione && <div style={{ fontSize: 12, color: muto, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.descrizione}</div>}
                  </div>
                  <button onClick={() => setBozza({ ...o })} aria-label={tt('lifeGoalEdit', 'Modifica')} style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, cursor: 'pointer' }}><Icon name="settings" size={14} color={testoP} /></button>
                  <button onClick={() => elimina(o.id)} aria-label={tt('lifeGoalDelete', 'Elimina')} style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, cursor: 'pointer' }}><Icon name="x" size={14} color="#f87171" /></button>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${o.progresso}%`, height: '100%', background: accent }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: muto }}>
                  <span>{STATO_ETI[o.stato] || o.stato}</span><span>{o.progresso}%</span>
                </div>
              </div>
            ))}
          </div>}

      {attivi.length > 0 && <div style={{ fontSize: 11, color: muto, marginTop: 14, textAlign: 'center' }}>
        {attivi.length} {attivi.length === 1 ? tt('lifeGoalActive1', 'obiettivo attivo') : tt('lifeGoalActiveN', 'obiettivi attivi')} · {tt('lifeGoalKnown', 'i Compagni li conoscono')}
      </div>}
    </div>
  );
}

export default memo(GestioneObiettivi);
