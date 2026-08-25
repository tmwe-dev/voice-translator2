'use client';
import { useState } from 'react';
import { useApp } from '../contexts/AppContext.js';
import { IconLoader } from './Icons.js';
import { membriDi } from '../lib/membri.js';
import { getLang } from '../lib/constants.js';

export default function SummaryView({ currentConv, summaryLoading, shareSummary,
  setCurrentConv, verifiedName }) {
  const { L, S, prefs, setView, status, theme, setTheme, uiLang } = useApp();
  // b.500 — tavola 26: Aa come su ogni pagina. Il gancio sta PRIMA
  // dell'uscita anticipata: i ganci di React vogliono lo stesso ordine
  // a ogni disegno.
  const [zoomTesto, setZoomTesto] = useState(0);
  if (!currentConv) return null;
  const s = currentConv.summary;
  const isHost = currentConv.host === (verifiedName || prefs.name);
  const colors = S.colors;
  // b.500 — la testata dice CHI e QUANDO («Kenji · ieri»), non una
  // parola generica.
  const ingr = 1 + zoomTesto * 0.15;
  const membri = membriDi(currentConv);
  const quando = currentConv.created ? new Date(currentConv.created).toLocaleDateString(uiLang) : '';

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={{...S.backBtn, width:44, height:44}} onClick={() => { setCurrentConv(null); setView('history'); }}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {[membri.map(m => m.name).join(' & '), quando].filter(Boolean).join(' · ') || L('reportWord')}
          </span>
          <button onClick={() => setZoomTesto((z) => (z >= 3 ? 0 : z + 1))}
            title={L('textBigger')} aria-label={L('textBigger')}
            style={{ width:44, height:44, borderRadius:12, flexShrink:0, cursor:'pointer',
              background: zoomTesto ? `${colors.accent1}22` : 'none',
              border:`1px solid ${colors.overlayBorder}`, color:colors.textSecondary,
              fontSize:15, fontWeight:600 }}>
            Aa
          </button>
        </div>

        {/* b.500 — tavola 26: le lingue e i numeri nella prima riga,
            come nell'archivio. */}
        <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%', maxWidth:380, margin:'2px 0 10px', fontSize:12, color:colors.textMuted }}>
          <span style={{ display:'inline-flex', gap:4, padding:'3px 10px', borderRadius:999,
            background:colors.overlayBg, border:`1px solid ${colors.overlayBorder}` }}>
            {membri.filter(m => m.lang).map((m, i) => (
              <span key={i} aria-hidden="true">{getLang(m.lang).flag}</span>
            ))}
          </span>
          <span>{currentConv.msgCount} {L('messages')}{s?.duration ? ` · ${s.duration}` : ''}</span>
        </div>

        {summaryLoading ? (
          <div style={{textAlign:'center', marginTop:40}}>
            <div style={{marginBottom:8, color:colors.textMuted}}><IconLoader size={24} /></div>
            <div style={{color:colors.textMuted, fontSize:13}}>{L('aiReportLoading')}</div>
          </div>
        ) : s ? (
          <div style={{...S.card, width:'100%', maxWidth:380}}>
            <div style={{fontSize:18, fontWeight:600, marginBottom:8, color:colors.textPrimary,
              lineHeight:1.3}}>{s.title || L('reportWord')}</div>

            {s.topics?.length > 0 && (
              <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:12}}>
                {s.topics.map((topic,i) => (
                  <span key={i} style={{padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:600,
                    background:colors.accent3Bg, color:colors.accent3, textTransform:'uppercase',
                    letterSpacing:0.5}}>{topic}</span>
                ))}
                {s.sentiment && (
                  <span style={{padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:600,
                    background:colors.accent2Bg, color:colors.accent2, letterSpacing:0.5}}>
                    {s.sentiment}
                  </span>
                )}
              </div>
            )}

            <div style={{...S.label, marginBottom:6}}>{L('inTwoLinesWord')}</div>
            <div style={{fontSize:15*ingr, color:colors.textPrimary, lineHeight:1.5, marginBottom:16}}>
              {s.summary}
            </div>

            {s.keyPoints?.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{...S.label, marginBottom:8}}>{L('keyPointsLabel')}</div>
                {/* b.500 — tavola 26: le decisioni sono RIGHE, come
                    sulla tavola — e la ragione per cui si riapre una
                    conversazione vecchia. */}
                {s.keyPoints.map((p,i) => (
                  <div key={i} style={{padding:'11px 2px', fontSize:14*ingr,
                    color:colors.textPrimary, lineHeight:1.5,
                    borderBottom: i < s.keyPoints.length-1 ? `1px solid ${colors.dividerColor}` : 'none'}}>
                    {p}
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0',
              borderTop:`1px solid ${colors.dividerColor}`, fontSize:11, color:colors.textMuted}}>
              <span>{s.participants || membriDi(currentConv).map(m => m.name).join(' & ')}</span>
              <span>{s.duration || ''} | {s.messageCount || currentConv.msgCount} msg</span>
            </div>

            {isHost && (
              <button style={{...S.btn, marginTop:12, minHeight:44}} onClick={shareSummary}>
                {L('shareReport')}
              </button>
            )}
          </div>
        ) : (
          <div style={{...S.card, width:'100%', maxWidth:380}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12, color:colors.textSecondary}}>
              {L('savedConversation')}
            </div>
            <div style={{fontSize:13, color:colors.textTertiary, marginBottom:8}}>
              {membriDi(currentConv).map(m => m.name).join(' & ')} - {currentConv.msgCount} {L('messages')}
            </div>
            <div style={{fontSize:11, color:colors.textMuted}}>
              {currentConv.created ? new Date(currentConv.created).toLocaleString(uiLang) : ''}
            </div>
          </div>
        )}

        {/* b.500 — tavola 26: la trascrizione NON sta piu doppiata qui
            dentro: ai messaggi si va con la pillola qui sotto, che apre
            la vista vera (detail). Un contenuto in due posti invecchia
            male in uno dei due. */}
        {currentConv.messages?.length > 0 && (
          <button style={{...S.btn, marginTop:12, width:'100%', maxWidth:380, minHeight:44}} onClick={() => setView('detail')}>
            {L('viewMessages')}
          </button>
        )}

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}
