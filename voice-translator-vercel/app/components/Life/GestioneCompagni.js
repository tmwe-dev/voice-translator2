'use client';
import { memo, useState, useCallback } from 'react';
import { FONT, LANGS, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { COMPAGNI_PREDEFINITI, compagnoVuoto, voceDaGenere, VOCI_ELENCO, AVATAR_SCELTE, MODELLI, LIBERTA, LIBERTA_ETICHETTE } from '../../lib/compagni/catalogo.js';
import { salvaMio, cancellaMio, parlaTurno, generaAgente } from '../../lib/compagni/cliente.js';
import { componiPersonalita } from '../../lib/compagni/genera.js';

// b.212 — le barre "stile ElevenLabs": l'utente regola il carattere a vista.
const BARRE = [
  { k: 'tono', nome: 'Tono', a: 'Formale', b: 'Informale' },
  { k: 'calore', nome: 'Calore', a: 'Distaccato', b: 'Caloroso' },
  { k: 'sintesi', nome: 'Sintesi', a: 'Conciso', b: 'Prolisso' },
  { k: 'umorismo', nome: 'Umorismo', a: 'Serio', b: 'Spiritoso' },
  { k: 'assertivita', nome: 'Assertività', a: 'Cauto', b: 'Deciso' },
  { k: 'creativita', nome: 'Libertà creativa', a: 'Preciso', b: 'Creativo' },
];
const BARRE_NEUTRE = { tono: 50, calore: 60, sintesi: 40, umorismo: 40, assertivita: 55, creativita: 50 };

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
  const [barre, setBarre] = useState(BARRE_NEUTRE); // carattere a barre (aiuto di creazione)
  const [descAg, setDescAg] = useState('');         // "Crea da un personaggio"
  const [generando, setGenerando] = useState(false);

  // b.214 — L() restituisce la CHIAVE quando manca la traduzione, quindi
  // `L(k) || fallback` non ripiegava mai. tt() ripiega davvero.
  const tt = (k, f) => { const v = L(k); return v && v !== k ? v : f; };

  const nuovo = () => { setErrore(''); setBarre(BARRE_NEUTRE); setBozza(compagnoVuoto()); };
  const modifica = (c) => { setErrore(''); setBarre(BARRE_NEUTRE); setBozza({ ...c }); };
  const daBase = (c) => { setErrore(''); setBarre(BARRE_NEUTRE); setBozza({ ...c, id: '', nome: `${c.nome} (mio)`, predefinito: false }); };

  // ── Costruzione automatica del Compagno (stile RadioChat) ──
  // b.215 — la GENERAZIONE non richiede account: gira sul wallet come Podcast
  // e le altre sezioni Life (l'API /genera risponde 200 anche da ospite).
  // Prima un `if(!userToken) return` bloccava tutto in silenzio (l'errore non
  // era nemmeno reso nella lista): pulsante morto. Il gate resta solo sul
  // SALVATAGGIO (/mie), che richiede l'email di sessione.
  const crea = useCallback(async (sorpresa) => {
    setGenerando(true); setErrore('');
    try {
      const a = await generaAgente({ descrizione: descAg, sorpresa, lingua, userToken });
      const nb = { ...BARRE_NEUTRE, ...(a.barre || {}) };
      setBarre(nb);
      setBozza({
        ...compagnoVuoto(),
        nome: a.nome || descAg.trim() || '',
        ruolo: a.ruolo || '',
        personalita: componiPersonalita(a.personalita || '', nb),
        liberta: a.liberta || 'balanced',
        // b.217 — la voce segue il genere generato (prima restava Adam per tutti).
        voce: voceDaGenere(a.genere),
      });
      setDescAg('');
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { setGenerando(false); }
  }, [descAg, lingua, userToken, L]);

  // Trascinando una barra ricompongo la riga di stile dentro la personalità.
  const cambiaBarra = (k) => (e) => {
    const nb = { ...barre, [k]: Number(e.target.value) };
    setBarre(nb);
    setBozza((b) => b ? { ...b, personalita: componiPersonalita(b.personalita, nb) } : b);
  };

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

        {/* b.212 — carattere a barre (stile ElevenLabs): regoli a vista */}
        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: card, border: bordo }}>
          <div style={{ fontSize: 11, color: muto, marginBottom: 6, fontWeight: 700 }}>{tt('lifeCharacter', 'Carattere')}</div>
          {BARRE.map((s) => (
            <div key={s.k} style={{ margin: '9px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: testoP, marginBottom: 3 }}>
                <span style={{ fontWeight: 700 }}>{s.nome}</span>
              </div>
              <input type="range" min={0} max={100} value={barre[s.k]} onChange={cambiaBarra(s.k)}
                style={{ width: '100%', accentColor: accent, cursor: 'pointer' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: muto }}>
                <span>{s.a}</span><span>{s.b}</span>
              </div>
            </div>
          ))}
        </div>

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
        <div style={{ fontWeight: 700, color: testoP, fontSize: 14 }}>{c.nome}</div>
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
      {/* b.212 — costruzione automatica: scrivi un personaggio e l'AI crea tutto */}
      <div style={{ padding: 14, borderRadius: 16, background: card, border: bordo, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: testoP, marginBottom: 8 }}>{tt('lifeCreateFrom', 'Crea da un personaggio')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={descAg} onChange={(e) => setDescAg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !generando) crea(false); }}
            placeholder={tt('lifeCreateFromPh', 'Es. Elvis Presley, oppure una coach diretta')}
            style={{ ...input, flex: 1 }} />
          <button onClick={() => crea(false)} disabled={generando}
            style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: accent, color: '#04121c', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, opacity: generando ? 0.6 : 1 }}>
            {generando ? '…' : `✨ ${tt('lifeCreate', 'Crea')}`}
          </button>
        </div>
        <button onClick={() => crea(true)} disabled={generando}
          style={{ marginTop: 8, background: 'none', border: 'none', color: accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, padding: 4 }}>
          🎲 {tt('lifeSurprise', 'Sorprendimi')}
        </button>
        {/* b.215 — la lista non rendeva mai `errore`: un fallimento di
            generazione (credito, rete, 401) spariva in silenzio. Ora si vede. */}
        {errore && <div style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{errore}</div>}
      </div>

      <button onClick={() => { vibrate(8); nuovo(); }} style={{ width: '100%', padding: 13, borderRadius: 14, border: bordo, cursor: 'pointer', background: 'transparent', color: testoP, fontWeight: 700, fontSize: 14, fontFamily: FONT, marginBottom: 16 }}>
        {tt('lifeCreateManual', 'Crea a mano')}
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
