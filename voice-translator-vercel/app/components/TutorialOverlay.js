'use client';
import S from '../lib/styles.js';
import { FONT } from '../lib/constants.js';

export default function TutorialOverlay({ L, tutorialStep, setTutorialStep, setShowTutorial }) {
  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:9999,
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:20, boxSizing:'border-box'}} onClick={() => setShowTutorial(false)}>
      <div style={{maxWidth:360, width:'100%', textAlign:'center'}} onClick={e => e.stopPropagation()}>
        {/* Step indicator */}
        <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:24}}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{width:tutorialStep===i?24:8, height:8, borderRadius:4,
              background:tutorialStep===i?'#f5576c':'rgba(255,255,255,0.15)',
              transition:'all 0.3s'}} />
          ))}
        </div>
        {/* Step content */}
        <div style={{fontSize:48, marginBottom:16}}>
          {['\u{1F3E0}','\u{1F517}','\u{1F399}','\u{1F4CB}'][tutorialStep]}
        </div>
        <div style={{fontSize:20, fontWeight:700, marginBottom:8, color:'#fff'}}>
          {L(`tutorialStep${tutorialStep+1}Title`)}
        </div>
        <div style={{fontSize:14, color:'rgba(255,255,255,0.6)', lineHeight:1.6, marginBottom:32}}>
          {L(`tutorialStep${tutorialStep+1}Desc`)}
        </div>
        {/* Navigation */}
        <div style={{display:'flex', gap:12, justifyContent:'center'}}>
          <button style={{padding:'10px 24px', borderRadius:14, background:'none',
            border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.5)',
            fontSize:13, cursor:'pointer', fontFamily:FONT}}
            onClick={() => setShowTutorial(false)}>
            {L('skip')}
          </button>
          <button style={{padding:'10px 32px', borderRadius:14, border:'none',
            background:'linear-gradient(135deg, #f5576c, #e94560)', color:'#fff',
            fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:FONT,
            boxShadow:'0 4px 16px rgba(233,69,96,0.4)'}}
            onClick={() => {
              if (tutorialStep < 3) setTutorialStep(tutorialStep + 1);
              else { setShowTutorial(false); localStorage.setItem('vt-tutorial-done','1'); }
            }}>
            {tutorialStep < 3 ? L('next') : L('gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}
