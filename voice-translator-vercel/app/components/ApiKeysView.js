'use client';
import { useState } from 'react';

export default function ApiKeysView({ L, S, apiKeyInputs, setApiKeyInputs, saveUserApiKeys, authLoading,
  userAccount, setView, status, theme, setTheme }) {
  const [saveStatus, setSaveStatus] = useState(null);
  const [saveError, setSaveError] = useState('');
  const hasAnyKey = !!(apiKeyInputs.openai?.trim() || apiKeyInputs.anthropic?.trim() || apiKeyInputs.gemini?.trim() || apiKeyInputs.elevenlabs?.trim());

  const handleSave = async () => {
    if (!userAccount) {
      setSaveStatus('error');
      setSaveError('Devi fare il login prima di salvare le chiavi');
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
            <button style={S.backBtn} onClick={() => setView('home')}>{'←'}</button>
            <span style={{fontWeight:600, fontSize:17}}>{L('yourApiKeys')}</span>
          </div>
          <div style={S.card}>
            <div style={{textAlign:'center', padding:'24px 0'}}>
              <div style={{fontSize:40, marginBottom:12}}>{'🔑'}</div>
              <div style={{fontSize:15, fontWeight:600, marginBottom:8}}>Login richiesto</div>
              <div style={{fontSize:13, color:'rgba(255,255,255,0.6)', marginBottom:20, lineHeight:1.5}}>
                Per salvare le tue chiavi API devi prima accedere al tuo account.
              </div>
              <button style={S.btn} onClick={() => setView('account')}>
                Accedi / Registrati
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
          <button style={S.backBtn} onClick={() => setView('home')}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('yourApiKeys')}</span>
        </div>
        <div style={S.card}>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.75)', marginBottom:16, lineHeight:1.5}}>
            {L('apiKeysDesc')}
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('openaiRequired')}</div>
            <input style={S.input} placeholder="sk-proj-..." value={apiKeyInputs.openai}
              onChange={e => setApiKeyInputs({...apiKeyInputs, openai:e.target.value})} />
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('anthropicOptional')}</div>
            <input style={S.input} placeholder="sk-ant-..." value={apiKeyInputs.anthropic}
              onChange={e => setApiKeyInputs({...apiKeyInputs, anthropic:e.target.value})} />
          </div>
          <div style={S.field}>
            <div style={S.label}>{L('geminiOptional')}</div>
            <input style={S.input} placeholder="AIza..." value={apiKeyInputs.gemini}
              onChange={e => setApiKeyInputs({...apiKeyInputs, gemini:e.target.value})} />
          </div>
          <div style={{marginTop:16, paddingTop:16, borderTop:'1px solid rgba(255,215,0,0.1)'}}>
            <div style={{fontSize:13, fontWeight:600, color:'#ffd700', marginBottom:8, display:'flex', alignItems:'center', gap:6}}>
              {'⭐'} TOP PRO - ElevenLabs
            </div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.75)', marginBottom:10, lineHeight:1.5}}>
              {L('elevenLabsDesc')}
            </div>
            <div style={S.field}>
              <div style={S.label}>ElevenLabs API Key</div>
              <input style={S.input} placeholder="xi_..." value={apiKeyInputs.elevenlabs}
                onChange={e => setApiKeyInputs({...apiKeyInputs, elevenlabs:e.target.value})} />
            </div>
          </div>
          <button style={{...S.btn, marginTop:8, opacity:hasAnyKey?1:0.4}}
            disabled={!hasAnyKey || authLoading}
            onClick={handleSave}>
            {authLoading ? L('saving') : L('saveUseMyKeys')}
          </button>
          {saveStatus === 'ok' && (
            <div style={{marginTop:8, padding:'8px 12px', borderRadius:8, background:'rgba(34,197,94,0.15)', color:'#22c55e', fontSize:13, textAlign:'center'}}>
              Chiavi salvate con successo!
            </div>
          )}
          {saveStatus === 'error' && (
            <div style={{marginTop:8, padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:13, textAlign:'center'}}>
              {saveError || 'Salvataggio fallito'}
            </div>
          )}
        </div>
        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}
