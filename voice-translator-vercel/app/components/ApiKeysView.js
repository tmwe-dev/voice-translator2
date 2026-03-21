'use client';

export default function ApiKeysView({ L, S, apiKeyInputs, setApiKeyInputs, saveUserApiKeys, authLoading,
  userAccount, setView, status, theme, setTheme }) {
  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView(userAccount ? 'home' : 'account')}>{'←'}</button>
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
          <button style={{...S.btn, marginTop:8, opacity:apiKeyInputs.openai.trim()?1:0.4}}
            disabled={!apiKeyInputs.openai.trim() || authLoading}
            onClick={saveUserApiKeys}>
            {authLoading ? L('saving') : L('saveUseMyKeys')}
          </button>
        </div>
        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}