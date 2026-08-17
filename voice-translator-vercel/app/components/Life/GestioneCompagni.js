'use client';
import { memo, useState, useCallback } from 'react';
import { FONT, LANGS, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { COMPAGNI_PREDEFINITI, compagnoVuoto, VOCI_ELENCO, AVATAR_SCELTE, MODELLI, LIBERTA, LIBERTA_ETICHETTE } from '../../lib/compagni/catalogo.js';
import { salvaMio, cancellaMio, parlaTurno } from '../../lib/compagni/cliente.js';

// ═══════════════════════════════════════════════════════════════
// GestioneCompagni — la sezione dedicata per CREARE e GESTIRE i tuoi
// Compagni: nome, ruolo, personalità, avatar, VOCE (con anteprima),
// LINGUA, modello, libertà. Facile: una lista + un form. Salvataggio via
// /api/compagni/mie (persistenza nostra). (Luca)
// ═══════════════════════════════════════════════════════════════

function GestioneCompagni({ miei, onCambiato, L, lingua, userToken, testoP, muto, accent, card, bordo }) {
  const [bozza, setBozza] = useState(null); // null = lista; oggetto = form aperto
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');

  const nuovo = () => { setErrore(''); setBozza(compagnoVuoto()); };
  const modifica = (c) => { setErrore(''); setBozza({ ...c }); };
  const daBase = (c) => { setErrore(''); setBozza({ ...c, id: '', nome: `${c.nome} (mio)`, predefinito: false }); };

  const campo = (v) => (e) => setBozza((b) => ({ ...b, [v]: e.target.value }));

  const salva = useCallback(async () => {
    if (!userToken) { setErrore(L('lifeLoginNeeded')); return; }
    if (!bozza?.nome?.trim()) { setErrore(L('lifeNeedName')); return; }
    setSalvando(true); setErrore('');
    try {
      await salvaMio(bozza, userToken);
      setBozza(null);
      if (onCambiato) await onCambiato();
    } catch (e) {
      setErrore(e.status === 401 ? L('lifeLoginNeeded') : L('lifeError'));
    } finally { setSalvando(false); }
  }, [bozza, userToken, onCambiato, L]);

  const elimina = useCallback(async (id) => {
    if (!userToken) return;
    try { await cancellaMio(id, userToken); if (onCambiato) await onCambiato(); } catch { /* rete assente: la lista si aggiorna al prossimo caricamento */ }
  }, [userToken, onCambiato]);

  const provaVoce = useCallback((voceId) => {
    parlaTurno({ voceId, testo: L('lifeVoiceSample'), lingua, userToken });
  }, [lingua, userToken, L]);

  const input = { width: '100%', padding: 11, borderRadius: 10, border: bordo, background: card, color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box' };
  const etich = { fontSize: 12, color: muto, margin: '10px 0 4px', display: 'block' };

  // ── FORM ──
  if (bozza) {
    return (
      <div>
        <button onClick={() => setBozza(null)} style={{ background: card, border: bordo, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: testoP, fontFamily: FONT, marginBottom: 8 }}>
          <Icon name="back" size={14} color={testoP} /> {L('lifeCancel')}
        </button>

        <label style={etich}>{L('lifeName')}</label>
        <input value={bozza.nome} onChange={campo('nome')} style={input} placeholder="Socrate, JFK…" />

        <label style={etich}>{L('lifeRole')}</label>
        <input value={bozza.ruolo} onChange={campo('ruolo')} style={input} placeholder={L('lifeRole')} />

        <label style={etich}>{L('lifePersonality')}</label>
        <textarea value={bozza.personalita} onChange={campo('personalita')} rows={5} style={{ ...input, resize: 'vertical' }}
          placeholder="Come parla, cosa sa, cosa evita…" />

        <label style={etich}>{L('lifeAvatar')}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {AVATAR_SCELTE.map((a) => (
            <button key={a} onClick={() => setBozza((b) => ({ ...b, avatar: a }))}
              style={{ padding: 0, borderRadius: 10, cursor: 'pointer', border: `2px solid ${bozza.avatar === a ? accent : 'transparent'}`, background: 'none' }}>
              <img src={a} alt="" width={44} height={44} style={{ borderRadius: 8, display: 'block' }} />
            </button>
          ))}
        </div>

        <label style={etich}>{L('lifeVoice')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={bozza.voce?.id || ''} onChange={(e) => { const v = VOCI_ELENCO.find(x => x.id === e.target.value); setBozza((b) => ({ ...b, voce: v || b.voce })); }} style={{ ...input, flex: 1 }}>
            {VOCI_ELENCO.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
          <button onClick={() => provaVoce(bozza.voce?.id)} style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: accent, color: '#04121c', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>▶ {L('lifeTryVoice')}</button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={etich}>{L('lifeLanguage')}</label>
            <select value={bozza.lingua || ''} onChange={campo('lingua')} style={input}>
              <option value="">{L('lifeLangAuto')}</option>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={etich}>{L('lifeFreedom')}</label>
            <select value={bozza.liberta} onChange={campo('liberta')} style={input}>
              {LIBERTA.map((k) => <option key={k} value={k}>{L('lifeFreedom')}: {LIBERTA_ETICHETTE[k]}</option>)}
            </select>
          </div>
        </div>

        <label style={etich}>{L('lifeModel')}</label>
        <select value={`${bozza.provider}|${bozza.modello}`} onChange={(e) => { const [p, m] = e.target.value.split('|'); setBozza((b) => ({ ...b, provider: p, modello: m })); }} style={input}>
          {MODELLI.map((m) => <option key={`${m.provider}|${m.modello}`} value={`${m.provider}|${m.modello}`}>{m.label}</option>)}
        </select>

        <label style={{ ...etich, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 14 }}
          onClick={() => setBozza((b) => ({ ...b, memoria: !b.memoria }))}>
          <span style={{ width: 42, height: 24, borderRadius: 999, background: bozza.memoria ? accent : card, border: bordo, position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
            <span style={{ position: 'absolute', top: 2, left: bozza.memoria ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
          </span>
          <span><b style={{ color: testoP }}>{L('lifeMemory')}</b> — {L('lifeMemoryHint')}</span>
        </label>

        {errore && <div style={{ color: '#f87171', fontSize: 13, margin: '10px 0' }}>{errore}</div>}

        <button onClick={salva} disabled={salvando} style={{ width: '100%', marginTop: 16, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? L('lifeGenerating') : `✨ ${L('lifeSave')}`}
        </button>
      </div>
    );
  }

  // ── LISTA ──
  const carta = (c, mio) => (
    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: card, border: bordo }}>
      <img src={c.avatar} alt="" width={38} height={38} style={{ borderRadius: 8 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: testoP, fontSize: 14 }}>{c.emoji} {c.nome}</div>
        <div style={{ fontSize: 11, color: muto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ruolo}</div>
      </div>
      {mio
        ? <>
            <button onClick={() => modifica(c)} aria-label={L('lifeEdit')} style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, cursor: 'pointer' }}><Icon name="settings" size={14} color={testoP} /></button>
            <button onClick={() => elimina(c.id)} aria-label={L('lifeDelete')} style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, cursor: 'pointer' }}><Icon name="x" size={14} color="#f87171" /></button>
          </>
        : <button onClick={() => daBase(c)} style={{ background: 'none', border: bordo, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: accent, fontSize: 12, fontWeight: 700, fontFamily: FONT }}>{L('lifeDuplicate')}</button>}
    </div>
  );

  return (
    <div>
      <button onClick={() => { vibrate(8); nuovo(); }} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: '#04121c', fontWeight: 800, fontSize: 15, fontFamily: FONT, marginBottom: 16 }}>
        ✨ {L('lifeCreateCompanion')}
      </button>

      {miei.length > 0 && <>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifeMine')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>{miei.map((c) => carta(c, true))}</div>
      </>}

      <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifePredefined')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{COMPAGNI_PREDEFINITI.map((c) => carta(c, false))}</div>
    </div>
  );
}

export default memo(GestioneCompagni);
