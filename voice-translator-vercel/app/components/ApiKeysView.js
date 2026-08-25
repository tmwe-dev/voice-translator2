'use client';
import { useState } from 'react';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import Icon from './Icon.js';

// b.502 — tavola 29: lo STATO di ogni chiave viene dalla MASCHERA che
// il server gia manda (b.166: "sk-proj12...abcd") — mai la chiave
// intera, e mai un campo prefillato che un Salva distratto
// sovrascriverebbe. FUORI dal corpo del componente: dentro sarebbe un
// tipo nuovo a ogni disegno (la lezione di b.145).
const RigaStato = ({ L, userAccount, id, sblocca }) => {
  const maschera = userAccount?.apiKeys?.[id];
  const attiva = !!maschera;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, marginTop: 4 }}>
      <span style={{ color: attiva ? PALETTE.green : 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
        {attiva ? `\u25CF ${L('keyActiveWord')}` : L('notConfigured')}
      </span>
      {attiva && <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.45)' }}>{'\u2022\u2022\u2022\u2022'}{String(maschera).slice(-8)}</span>}
      <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.55)' }}>{sblocca}</span>
    </div>
  );
};

export default function ApiKeysView({ apiKeyInputs, setApiKeyInputs, saveUserApiKeys, authLoading,
  userAccount }) {
  const { L, S, setView, status, theme, setTheme } = useApp();
  const [saveStatus, setSaveStatus] = useState(null);
  // b.502 — tavola 29: Aa come su ogni pagina.
  const [zoomTesto, setZoomTesto] = useState(0);
  const [saveError, setSaveError] = useState('');
  const hasAnyKey = !!(apiKeyInputs.openai?.trim() || apiKeyInputs.anthropic?.trim() || apiKeyInputs.gemini?.trim() || apiKeyInputs.elevenlabs?.trim());

  const handleSave = async () => {
    if (!userAccount) {
      setSaveStatus('error');
      setSaveError(L('loginBeforeKeys'));
      return;
    }
    setSaveStatus(null);
    setSaveError('');
    const ok = await saveUserApiKeys((result, err) => {
      setSaveStatus(result);
      if (err) setSaveError(err);
      if (result === 'ok') setTimeout(() => setSaveStatus(null), 3000);
    });
  };

  // Show login prompt if not authenticated
  if (!userAccount) {
    return (
      <div style={S.page}>
        <div style={S.scrollCenter}>
          <div style={S.topBar}>
            <button style={S.backBtn} onClick={() => setView('settings')} aria-label={L('backWord')}><Icon name="back" size={16} /></button>
            <span style={{fontWeight:600, fontSize:17}}>{L('yourApiKeys')}</span>
          </div>
          <div style={S.card}>
            <div style={{textAlign:'center', padding:'24px 0'}}>
              <div style={{fontSize:40, marginBottom:12}}>{''}</div>
              <div style={{fontSize:15, fontWeight:600, marginBottom:8}}>{L('loginRequired')}</div>
              <div style={{fontSize:13, color:'rgba(255,255,255,0.6)', marginBottom:20, lineHeight:1.5}}>
                {L('loginBeforeKeysDesc')}
              </div>
              <button style={S.btn} onClick={() => setView('account')}>
                {L('loginToAccount')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('settings')} aria-label={L('backWord')}><Icon name="back" size={16} /></button>
          <span style={{fontWeight:600, fontSize:17, flex:1}}>{L('yourApiKeys')}</span>
          {/* b.502 — tavola 29: Aa in testata, come ovunque. */}
          <button onClick={() => setZoomTesto((z) => (z >= 3 ? 0 : z + 1))}
            title={L('textBigger')} aria-label={L('textBigger')}
            style={{ width:44, height:44, borderRadius:12, flexShrink:0, cursor:'pointer',
              background: zoomTesto ? 'rgba(255,255,255,0.10)' : 'none',
              border:'1px solid rgba(255,255,255,0.14)', color:'rgba(255,255,255,0.8)',
              fontSize:15, fontWeight:600 }}>
            Aa
          </button>
        </div>
        <div style={{...S.card, zoom: 1 + zoomTesto * 0.1}}>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.75)', marginBottom:16, lineHeight:1.5}}>
            {L('apiKeysDesc')}
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('openaiRequired')}</div>
            <input style={S.input} type="password" autoComplete="off" placeholder="sk-proj-..." value={apiKeyInputs.openai}
              onChange={e => setApiKeyInputs({...apiKeyInputs, openai:e.target.value})} />
            {/* b.502 — tavola 29: lo stato e COSA SBLOCCA, sotto ogni chiave. */}
            <RigaStato L={L} userAccount={userAccount} id="openai" sblocca={L('unlocksTranslateVoice')} />
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('anthropicOptional')}</div>
            <input style={S.input} type="password" autoComplete="off" placeholder="sk-ant-..." value={apiKeyInputs.anthropic}
              onChange={e => setApiKeyInputs({...apiKeyInputs, anthropic:e.target.value})} />
            <RigaStato L={L} userAccount={userAccount} id="anthropic" sblocca={L('unlocksAltTranslate')} />
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('geminiOptional')}</div>
            <input style={S.input} type="password" autoComplete="off" placeholder="AIza..." value={apiKeyInputs.gemini}
              onChange={e => setApiKeyInputs({...apiKeyInputs, gemini:e.target.value})} />
            <RigaStato L={L} userAccount={userAccount} id="gemini" sblocca={L('unlocksAltTranslate')} />
          </div>
          <div style={{marginTop:16, paddingTop:16, borderTop:'1px solid rgba(255,215,0,0.1)'}}>
            <div style={{fontSize:13, fontWeight:600, color:'#ffd700', marginBottom:8, display:'flex', alignItems:'center', gap:6}}>
              {/* b.482 — la stellina era un'emoji: a colori, disegnata dal
                  telefono, in mezzo a icone monocrome. */}
              <Icon name="star" size={13} /> TOP PRO - ElevenLabs
            </div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.75)', marginBottom:10, lineHeight:1.5}}>
              {L('elevenLabsDesc')}
            </div>
            <div style={S.field}>
              <div style={S.label}>ElevenLabs API Key</div>
              <input style={S.input} type="password" autoComplete="off" placeholder="xi_..." value={apiKeyInputs.elevenlabs}
                onChange={e => setApiKeyInputs({...apiKeyInputs, elevenlabs:e.target.value})} />
              <RigaStato L={L} userAccount={userAccount} id="elevenlabs" sblocca={L('elevenLabsDesc').split('.')[0]} />
            </div>
          </div>
          <button style={{...S.btn, marginTop:8, opacity:hasAnyKey?1:0.4}}
            disabled={!hasAnyKey || authLoading}
            onClick={handleSave}>
            {authLoading ? L('saving') : L('saveUseMyKeys')}
          </button>
          {saveStatus === 'ok' && (
            <div style={{marginTop:8, padding:'8px 12px', borderRadius:8, background:'rgba(34,197,94,0.15)', color:PALETTE.green, fontSize:13, textAlign:'center'}}>
              {L('keysSavedOk')}
            </div>
          )}
          {saveStatus === 'error' && (
            <div style={{marginTop:8, padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.15)', color:PALETTE.red, fontSize:13, textAlign:'center'}}>
              {saveError || L('saveFailed')}
            </div>
          )}
        </div>
        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}
