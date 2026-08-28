'use client';
import TendinaVetro from '../ui/TendinaVetro.js'; // b.535
import { memo, useState, useEffect, useCallback } from 'react';
import { FONT, vibrate, clayCard, CLAY_OMBRA } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { mieiCorsiUtente } from '../../lib/compagni/cliente.js';
import { elencoObiettivi, salvaObiettivo, rimuoviObiettivo,
  CATEGORIE_OBIETTIVO, STATI_OBIETTIVO, sincronizzaConCorsi } from '../../lib/compagni/obiettivi.js';

// b.224 — OBIETTIVI DI VITA (il "tutor che ti accompagna"). Qui li imposti;
// quando parli con un Compagno (Amico/Tavolo), lui li CONOSCE e ti aiuta a
// raggiungerli. Vivono sul dispositivo (localStorage).
//
// b.482 — QUESTA SCHEDA PASSA ALLO STANDARD DEL TEMPLATE, e cambia solo
// cio che si vede: rientri laterali a venti, ogni cosa che si tocca alta
// almeno quarantaquattro (sotto quella misura il dito sbaglia bersaglio),
// niente emoji a schermo, e le parole prese dai pacchetti lingua invece
// che dal ripiego italiano scritto qui dentro — le chiavi c'erano gia
// tutte, quindi a schermo non cambia una parola: cambia che ora anche
// chi non parla italiano le legge nella sua lingua.

const STATO_ETI = { attivo: 'Attivo', raggiunto: 'Raggiunto', pausa: 'In pausa' };

function GestioneObiettivi({ L, userToken, testoP, muto, accent, card, bordo, cambiaScheda }) {
  const [lista, setLista] = useState([]);
  const [bozza, setBozza] = useState(null); // null = elenco; oggetto = form

  useEffect(() => { setLista(elencoObiettivi()); }, []);

  // b.334 — i corsi dell'utente: per collegare un obiettivo a un corso e per
  // muovere le barre DA SOLE (sincronizzaConCorsi) all'apertura della scheda.
  const [corsiMiei, setCorsiMiei] = useState([]);
  useEffect(() => {
    if (!userToken) return;
    mieiCorsiUtente(userToken).then((cs) => {
      setCorsiMiei(cs || []);
      if (sincronizzaConCorsi(cs || [])) setLista(elencoObiettivi());
    }).catch(() => {});
  }, [userToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ b.494 — TAVOLA 10: «PER OGGI» — i compiti di oggi (e quelli in
  // ritardo) sono RIGHE qui dentro, non un'altra sezione da aprire.
  // Stessa porta dei Compiti (/api/compiti, azione elenca), sola
  // lettura: si tocca la riga e si va ai Compiti veri. Fallimento
  // silenzioso: senza rete o senza accesso la sezione semplicemente
  // non compare, gli obiettivi restano.
  const [perOggi, setPerOggi] = useState([]);
  useEffect(() => {
    if (!userToken) return;
    fetch('/api/compiti', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'elenca', userToken }),
      signal: AbortSignal.timeout(60000),
    }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d?.jobs) return;
      const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
      setPerOggi(d.jobs.filter((j) => {
        if (j.stato === 'fatto' || !j.scadenza) return false;
        const sc = new Date(j.scadenza + 'T00:00:00');
        return sc - oggi <= 0; // oggi o in ritardo
      }).slice(0, 3));
    }).catch(() => {});
  }, [userToken]);

  const vuoto = () => ({ id: '', titolo: '', descrizione: '', categoria: 'crescita', stato: 'attivo', priorita: 2, progresso: 0, corsoId: null });
  const campo = (k) => (e) => setBozza((b) => ({ ...b, [k]: e.target.value }));

  const salva = useCallback(() => {
    if (!bozza?.titolo?.trim()) return;
    setLista(salvaObiettivo(bozza));
    setBozza(null);
  }, [bozza]);

  const elimina = useCallback((id) => { setLista(rimuoviObiettivo(id)); }, []);

  const input = { width: '100%', padding: 11, borderRadius: 10, border: bordo, background: card, color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box' };
  const etich = { fontSize: 12, color: muto, margin: '10px 0 4px', display: 'block' };
  // b.482 — l'area dell'obiettivo si mostrava con un'emoji presa dal
  // catalogo. A schermo le emoji non si usano: qui si sceglie l'icona
  // del disegno comune, e il catalogo resta com'e.
  const ICONA_CAT = { studio: 'graduation', lavoro: 'doc', salute: 'wave', relazioni: 'users',
    hobby: 'music', crescita: 'zap', finanza: 'credit', creativita: 'star', altro: 'target' };
  const iconaCat = (id) => ICONA_CAT[id] || 'target';

  // ── FORM ──
  if (bozza) {
    return (
      <div>
        <button onClick={() => setBozza(null)} style={{ background: card, border: bordo, borderRadius: 10, padding: '8px 12px', minHeight: 44, cursor: 'pointer', color: testoP, fontFamily: FONT, marginBottom: 8 }}>
          <Icon name="back" size={14} color={testoP} /> {L('lifeGoalBack')}
        </button>

        <label style={etich}>{L('lifeGoalTitle')}</label>
        <input value={bozza.titolo} onChange={campo('titolo')} placeholder={L('lifeGoalTitlePh')} style={input} />

        <label style={etich}>{L('lifeGoalDesc')}</label>
        <textarea value={bozza.descrizione} onChange={campo('descrizione')} rows={3}
          placeholder={L('lifeGoalDescPh')} style={{ ...input, resize: 'vertical' }} />

        <label style={etich}>{L('lifeGoalCat')}</label>
        {/* b.535 — TendinaVetro al posto delle select di sistema. */}
        <TendinaVetro valore={bozza.categoria} targa={L('lifeGoalCat')}
          onScegli={(id) => setBozza((b) => ({ ...b, categoria: id }))}
          opzioni={CATEGORIE_OBIETTIVO.map((c) => ({ id: c.id, label: c.etichetta }))}
          stile={{ ...input, width: '100%' }} />

        <label style={etich}>{L('lifeGoalProgress')}: {bozza.progresso}%</label>
        <input type="range" min={0} max={100} value={bozza.progresso}
          onChange={(e) => setBozza((b) => ({ ...b, progresso: Number(e.target.value) }))}
          style={{ width: '100%', accentColor: accent, cursor: 'pointer' }} />

        <label style={etich}>{L('lifeGoalPriority')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map((p) => (
            <button key={p} onClick={() => setBozza((b) => ({ ...b, priorita: p }))}
              style={{ flex: 1, padding: 10, minHeight: 44, borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontWeight: 500,
                border: bordo, background: bozza.priorita === p ? accent : 'transparent', color: bozza.priorita === p ? '#04121c' : testoP }}>
              {p === 1 ? L('lifeGoalLow') : p === 2 ? L('lifeGoalMed') : L('lifeGoalHigh')}
            </button>
          ))}
        </div>

        <label style={etich}>{L('lifeGoalStatus')}</label>
        <TendinaVetro valore={bozza.stato} targa={L('lifeGoalStatus')}
          onScegli={(id) => setBozza((b) => ({ ...b, stato: id }))}
          opzioni={STATI_OBIETTIVO.map((st) => ({ id: st, label: STATO_ETI[st] || st }))}
          stile={{ ...input, width: '100%' }} />

        {/* b.334 — CORSO COLLEGATO: superare le lezioni muove la barra da
            sola; al 100% arriva la coppa. Basta obiettivi spostati a mano. */}
        {corsiMiei.length > 0 && <>
          <label style={etich}>{L('lifeGoalCourse')}</label>
          <TendinaVetro valore={bozza.corsoId || ''} targa={L('lifeGoalCourse')}
            onScegli={(id) => setBozza((b) => ({ ...b, corsoId: id || null }))}
            opzioni={[{ id: '', label: L('lifeGoalNoCourse') }, ...corsiMiei.map((c) => ({ id: c.id, label: `${c.titolo || c.argomento} (${c.percento}%)` }))]}
            stile={{ ...input, width: '100%' }} />
        </>}

        <button onClick={salva} disabled={!bozza.titolo.trim()} style={{ width: '100%', marginTop: 16, padding: 14, minHeight: 44, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 500, fontSize: 15, fontFamily: FONT, opacity: bozza.titolo.trim() ? 1 : 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="check" size={18} color="#04121c" /> {L('lifeGoalSave')}
        </button>
      </div>
    );
  }

  // ── ELENCO ──
  const attivi = lista.filter((o) => o.stato === 'attivo');
  return (
    <div>
      <div style={{ fontSize: 13, color: muto, marginBottom: 12, lineHeight: 1.5 }}>
        {L('lifeGoalIntro')}
      </div>

      {lista.length === 0
        ? <div style={{ fontSize: 13, color: muto, textAlign: 'center', padding: '24px 8px' }}>{L('lifeGoalEmpty')}</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map((o) => {
              // b.320 — decisione di Luca: l'obiettivo COMPLETATO resta in
              // lista con il TROFEO (coppa dorata), non sparisce.
              const vinto = o.stato === 'raggiunto' || o.progresso >= 100;
              return (
              <div key={o.id} style={{ padding: '14px 20px', ...clayCard(card), ...(vinto ? { boxShadow: `${CLAY_OMBRA}, 0 0 0 1.5px #f1c40f` } : o.stato === 'attivo' ? { boxShadow: `${CLAY_OMBRA}, 0 0 0 1.5px ${accent}` } : {}) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {vinto
                    ? <Icon name="trophy" size={20} color="#f1c40f" />
                    : <Icon name={iconaCat(o.categoria)} size={20} color={accent} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: vinto ? '#f1c40f' : testoP, fontSize: 14 }}>{o.titolo}</div>
                    {o.descrizione && <div style={{ fontSize: 12, color: muto, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.descrizione}</div>}
                  </div>
                  <button onClick={() => setBozza({ ...o })} aria-label={L('lifeGoalEdit')} style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, minHeight: 44, cursor: 'pointer' }}><Icon name="settings" size={14} color={testoP} /></button>
                  <button onClick={() => elimina(o.id)} aria-label={L('lifeGoalDelete')} style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, minHeight: 44, cursor: 'pointer' }}><Icon name="x" size={14} color="#f87171" /></button>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${o.progresso}%`, height: '100%', background: vinto ? '#f1c40f' : accent }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: vinto ? '#f1c40f' : muto }}>
                  <span>{vinto ? L('lifeGoalWon') : (STATO_ETI[o.stato] || o.stato)}</span><span>{o.progresso}%</span>
                </div>
              </div>
              );
            })}
          </div>}

      {/* b.494 — tavola 10: «PER OGGI», i compiti come righe. Toccarne
          una porta ai Compiti veri: qui non si gestisce, si vede. */}
      {perOggi.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, color: muto, margin: '18px 0 4px', textTransform: 'uppercase' }}>
          {L('forTodayWord')}
        </div>
        {perOggi.map((j) => (
          <button key={j.id} onClick={() => { vibrate(8); cambiaScheda && cambiaScheda('compiti'); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
              padding: '12px 4px', minHeight: 44, background: 'none', border: 'none',
              borderBottom: bordo, cursor: 'pointer', fontFamily: FONT }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: testoP }}>{j.titolo}</span>
              {j.materia && <span style={{ display: 'block', fontSize: 12, color: muto }}>{j.materia}</span>}
            </span>
            <Icon name="chevRight" size={14} color={muto} />
          </button>
        ))}
      </>}

      {/* b.494 — tavola 10: «Aggiungerne una e una riga sola» — la
          pillola grande sta IN FONDO, dopo cio che c'e gia. */}
      <button onClick={() => { vibrate(8); setBozza(vuoto()); }}
        style={{ width: '100%', padding: 14, minHeight: 54, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: accent, color: '#04121c', fontWeight: 500, fontSize: 15, fontFamily: FONT,
          marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="plus" size={18} color="#04121c" /> {L('lifeGoalNew')}
      </button>

      {attivi.length > 0 && <div style={{ fontSize: 11, color: muto, marginTop: 14, textAlign: 'center' }}>
        {attivi.length} {attivi.length === 1 ? L('lifeGoalActive1') : L('lifeGoalActiveN')} · {L('lifeGoalKnown')}
      </div>}
    </div>
  );
}

export default memo(GestioneObiettivi);
