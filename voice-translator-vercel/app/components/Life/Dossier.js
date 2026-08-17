'use client';
import { memo, useState, useCallback } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { preparaBriefing, generaPodcast, reportFinale } from '../../lib/compagni/cliente.js';

// ═══════════════════════════════════════════════════════════════
// Dossier — dall'argomento al documento (Luca).
// 1) cerca + scrive un ARTICOLO neutro da discutere (con fonti)
// 2) fa DISCUTERE 2-3 Compagni su quell'argomento
// 3) ne ricava un REPORT finale, da copiare o da cui aprire una stanza.
// Riusa le rotte /api/compagni/dossier e /api/compagni/podcast. (Luca)
// ═══════════════════════════════════════════════════════════════

function Dossier({ compagni, onApriStanza, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [argomento, setArgomento] = useState('');
  const [scelti, setScelti] = useState(compagni.slice(0, 3).map(c => c.id));
  const [brief, setBrief] = useState(null);
  const [copioni, setCopioni] = useState([]);
  const [report, setReport] = useState('');
  const [fase, setFase] = useState('');   // '', briefing, discussione, report
  const [errore, setErrore] = useState('');

  const err = (e) => setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
  const toggle = (id) => setScelti((s) => s.includes(id) ? s.filter(x => x !== id) : (s.length >= 4 ? s : [...s, id]));

  const passo1 = useCallback(async () => {
    if (!argomento.trim()) { setErrore(L('lifeNeedTopic')); return; }
    setErrore(''); setBrief(null); setCopioni([]); setReport(''); setFase('briefing');
    try { const d = await preparaBriefing({ argomento: argomento.trim(), lingua, userToken }); setBrief(d); }
    catch (e) { err(e); } finally { setFase(''); }
  }, [argomento, lingua, userToken, L]);

  const passo2 = useCallback(async () => {
    if (scelti.length < 2) { setErrore(L('lifeNeedCompanions')); return; }
    setErrore(''); setFase('discussione');
    try { const d = await generaPodcast({ argomento: argomento.trim(), compagni: scelti, round: 2, lingua, userToken }); setCopioni(d.copioni || []); }
    catch (e) { err(e); } finally { setFase(''); }
  }, [scelti, argomento, lingua, userToken, L]);

  const passo3 = useCallback(async () => {
    setErrore(''); setFase('report');
    const discussione = copioni.map(t => `${t.nome}: ${t.testo}`).join('\n\n');
    try { const d = await reportFinale({ argomento: argomento.trim(), briefing: brief?.articolo || '', discussione, lingua, userToken }); setReport(d.report); }
    catch (e) { err(e); } finally { setFase(''); }
  }, [copioni, brief, argomento, lingua, userToken]);

  const btn = (onClick, testo, on = true) => (
    <button onClick={onClick} disabled={!!fase || !on}
      style={{ width: '100%', padding: 13, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT, opacity: (fase || !on) ? 0.6 : 1, marginTop: 10 }}>
      {testo}
    </button>
  );
  const sezione = (t) => <div style={{ fontSize: 12, color: muto, margin: '16px 0 8px' }}>{t}</div>;

  return (
    <div>
      <input value={argomento} onChange={(e) => setArgomento(e.target.value)} placeholder={L('lifeDossierPh')}
        style={{ width: '100%', padding: 12, borderRadius: 12, border: bordo, background: card, color: testoP, fontSize: 15, fontFamily: FONT, boxSizing: 'border-box' }} />
      {btn(passo1, fase === 'briefing' ? L('lifeGenerating') : `📰 ${L('lifeDossierBriefing')}`)}
      {errore && <div style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{errore}</div>}

      {brief && <>
        {sezione(L('lifeDossierArticle'))}
        <div style={{ padding: 12, borderRadius: 12, background: card, border: bordo, fontSize: 14, color: testoP, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{brief.articolo}</div>
        {brief.domande?.length > 0 && <div style={{ marginTop: 8, fontSize: 13, color: muto }}>❓ {brief.domande.join(' · ')}</div>}
        {brief.fonti?.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: muto }}>{L('lifeSources')}: {brief.fonti.map((f, i) => <span key={i}>{f.titolo}{i < brief.fonti.length - 1 ? ' · ' : ''}</span>)}</div>}

        {sezione(L('lifeCompanions'))}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
          {compagni.map((c) => {
            const on = scelti.includes(c.id);
            return (
              <button key={c.id} onClick={() => { vibrate(6); toggle(c.id); }}
                style={{ padding: '8px 4px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', background: on ? `${c.colore}22` : card, border: `1px solid ${on ? c.colore : bordo.split(' ').pop()}`, fontFamily: FONT }}>
                <div style={{ fontSize: 20 }}>{c.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: testoP }}>{c.nome}</div>
              </button>
            );
          })}
        </div>
        {btn(passo2, fase === 'discussione' ? L('lifeGenerating') : `🎙️ ${L('lifeDossierDiscuss')}`)}
      </>}

      {copioni.length > 0 && <>
        {sezione(L('lifeDossierDiscussion'))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {copioni.map((t) => (
            <div key={t.ordine} style={{ padding: 10, borderRadius: 12, background: card, border: bordo }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>{t.nome}</div>
              <div style={{ fontSize: 13, color: testoP, lineHeight: 1.45 }}>{t.testo}</div>
            </div>
          ))}
        </div>
        {btn(passo3, fase === 'report' ? L('lifeGenerating') : `📄 ${L('lifeDossierReport')}`)}
      </>}

      {report && <>
        {sezione(L('lifeDossierFinal'))}
        <div style={{ padding: 14, borderRadius: 12, background: card, border: `1px solid ${accent}`, fontSize: 14, color: testoP, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{report}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => { try { navigator.clipboard?.writeText(report); } catch { /* la clipboard puo non essere disponibile qui */ } }}
            style={{ flex: 1, padding: 12, borderRadius: 12, border: bordo, background: 'transparent', color: testoP, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
            <Icon name="copy" size={14} color={testoP} /> {L('lifeCopy')}
          </button>
          {onApriStanza && (
            <button onClick={() => onApriStanza({ nome: argomento.trim(), descrizione: brief?.articolo || '' })}
              style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>
              {L('lifeDossierRoom')}
            </button>
          )}
        </div>
      </>}
    </div>
  );
}

export default memo(Dossier);
