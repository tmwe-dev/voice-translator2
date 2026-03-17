'use client';
import { memo, useRef, useEffect } from 'react';
import AvatarImg from './AvatarImg.js';

/**
 * VideoCallOverlay — Extracted from RoomView.js
 *
 * Handles both fullscreen and inline video call UI.
 * The hidden <audio> element for WebRTC audio stays in RoomView
 * (always rendered regardless of video UI state).
 *
 * Props:
 * - webrtc: WebRTC hook return value
 * - partner: partner member object { name, lang, avatar }
 * - getSenderAvatar: function(name) => avatar URL
 * - videoFullscreen / setVideoFullscreen
 * - showVideoCall / setShowVideoCall
 * - videoDucking / setVideoDucking
 * - partnerVolume / setPartnerVolume
 * - lastTranslationSubtitle: { text, original, ts } | null
 * - S: styles object
 */
const VideoCallOverlay = memo(function VideoCallOverlay({
  webrtc, partner, getSenderAvatar,
  videoFullscreen, setVideoFullscreen,
  showVideoCall, setShowVideoCall,
  videoDucking, setVideoDucking,
  partnerVolume, setPartnerVolume,
  lastTranslationSubtitle,
  S,
}) {
  // Separate refs for fullscreen vs inline to avoid ref conflicts when switching modes
  const localVideoRef = useRef(null);
  const localVideoInlineRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteVideoInlineRef = useRef(null);

  // ── Attach local video stream to BOTH fullscreen and inline elements ──
  useEffect(() => {
    const stream = webrtc?.localStream;
    if (!stream) return;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    if (localVideoInlineRef.current) localVideoInlineRef.current.srcObject = stream;
  }, [webrtc?.localStream, videoFullscreen]);

  // ── Attach remote VIDEO stream (MUTED — audio via hidden <audio> in parent) ──
  useEffect(() => {
    const stream = webrtc?.remoteStream;
    if (!stream) return;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.muted = true;
    }
    if (remoteVideoInlineRef.current) {
      remoteVideoInlineRef.current.srcObject = stream;
      remoteVideoInlineRef.current.muted = true;
    }
  }, [webrtc?.remoteStream, webrtc?.remoteVideoActive, videoFullscreen, showVideoCall]);

  if (!webrtc) return null;

  return (
    <>
      {/* ── Fullscreen Video Call ── show during BOTH connecting and connected ── */}
      {videoFullscreen && (webrtc.webrtcConnected || webrtc.webrtcState === 'connecting') && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:200,
          background:'#000', display:'flex', flexDirection:'column',
        }}>
          {/* Remote video (full screen) */}
          <div style={{flex:1, position:'relative', overflow:'hidden'}}>
            {webrtc.remoteVideoActive && webrtc.remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline muted
                style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:16, background:'#0a0a0a'}}>
                <AvatarImg src={partner ? getSenderAvatar(partner.name) : null} size={96} />
                <span style={{color:'#94a3b8', fontSize:16, fontWeight:500}}>
                  {!webrtc.webrtcConnected
                    ? 'Connessione in corso...'
                    : `${partner?.name || 'Partner'} - Camera off`}
                </span>
                {!webrtc.webrtcConnected && (
                  <div style={{width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.1)', overflow:'hidden'}}>
                    <div style={{width:'60%', height:'100%', borderRadius:2, background:'#60a5fa',
                      animation:'vtConnecting 1.5s ease-in-out infinite'}} />
                  </div>
                )}
              </div>
            )}

            {/* Local video PiP (top-right) */}
            {webrtc.localStream && webrtc.videoEnabled && (
              <div style={{position:'absolute', top:110, right:16, width:120, height:90,
                borderRadius:12, overflow:'hidden', border:'2px solid rgba(255,255,255,0.2)',
                boxShadow:'0 4px 20px rgba(0,0,0,0.6)'}}>
                <video ref={localVideoRef} autoPlay playsInline muted
                  style={{width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)'}} />
              </div>
            )}

            {/* Status bar (top-left) */}
            <div style={{position:'absolute', top:16, left:16, display:'flex', alignItems:'center', gap:8,
              padding:'6px 14px', borderRadius:24, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)'}}>
              <div style={{width:8, height:8, borderRadius:4,
                background: webrtc.webrtcConnected ? '#4ade80' : '#f59e0b',
                animation: webrtc.webrtcConnected ? 'none' : 'vtBattPulse 1.5s infinite'}} />
              <span style={{fontSize:12, color:'#fff', fontWeight:600}}>
                {webrtc.webrtcConnected ? 'P2P' : 'Connessione...'}
              </span>
              {partner && <span style={{fontSize:12, color:'#94a3b8'}}>{partner.name}</span>}
            </div>

            {/* Controls (top-right): volume slider + ducking toggle */}
            <div style={{position:'absolute', top:16, right:16, display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end'}}>
              <button onClick={() => setVideoDucking(!videoDucking)}
                style={{padding:'6px 12px', borderRadius:20,
                  background: videoDucking ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.15)',
                  border:'none', cursor:'pointer', color:'#fff', fontSize:11, fontWeight:500,
                  backdropFilter:'blur(4px)', display:'flex', alignItems:'center', gap:6}}>
                {videoDucking ? '\u{1F509}' : '\u{1F50A}'} {videoDucking ? 'Ducking ON' : 'Ducking OFF'}
              </button>
              <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:20,
                background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)'}}>
                <span style={{fontSize:14}}>{partnerVolume < 0.01 ? '\u{1F507}' : partnerVolume < 0.4 ? '\u{1F509}' : '\u{1F50A}'}</span>
                <input type="range" min="0" max="100" step="5"
                  value={Math.round(partnerVolume * 100)}
                  onChange={e => setPartnerVolume(Number(e.target.value) / 100)}
                  style={{width:80, accentColor:'#60a5fa', height:3}} />
                <span style={{fontSize:10, color:'#94a3b8', fontFamily:'monospace', minWidth:28}}>
                  {Math.round(partnerVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Translation subtitle overlay */}
            {lastTranslationSubtitle && (
              <div style={{
                position:'absolute', bottom:100, left:16, right:16,
                background:'linear-gradient(to top, rgba(255,255,255,0.95), rgba(245,245,245,0.92))',
                borderRadius:16, padding:'14px 20px',
                boxShadow:'0 -4px 20px rgba(0,0,0,0.3)', backdropFilter:'blur(12px)',
                animation:'vtSlideUp 0.3s ease-out',
              }}>
                <div style={{fontSize:15, fontWeight:600, color:'#1e3a5f', lineHeight:1.5}}>
                  {lastTranslationSubtitle.text}
                </div>
                {lastTranslationSubtitle.original && (
                  <div style={{fontSize:11, color:'#64748b', marginTop:4}}>
                    {lastTranslationSubtitle.original}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Video call controls (bottom bar) */}
          <div style={{
            padding:'16px 0 32px', display:'flex', justifyContent:'center', gap:16,
            background:'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7))',
          }}>
            <button onClick={() => webrtc.toggleVideo()}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background: webrtc.videoEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)',
                color:'#fff', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center'}}>
              {webrtc.videoEnabled ? '\u{1F4F7}' : '\u{1F6AB}'}
            </button>
            <button onClick={() => webrtc.toggleAudio()}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background: webrtc.audioEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)',
                color:'#fff', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center'}}>
              {webrtc.audioEnabled ? '\u{1F3A4}' : '\u{1F507}'}
            </button>
            <button onClick={() => webrtc.flipCamera()}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:20,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{1F504}'}
            </button>
            <button onClick={() => setVideoFullscreen(false)}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:20,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{2B07}\uFE0F'}
            </button>
            <button onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
              style={{width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
                background:'#ef4444', color:'#fff', fontSize:20,
                display:'flex', alignItems:'center', justifyContent:'center'}}>
              {'\u{1F4F5}'}
            </button>
          </div>
        </div>
      )}

      {/* Video Call Panel (inline, non-fullscreen) */}
      {showVideoCall && !videoFullscreen && (
        <div style={{position:'relative', flexShrink:0, background:'#000',
          borderBottom: S ? `1px solid ${S.colors.overlayBorder}` : '1px solid rgba(255,255,255,0.1)'}}>
          {/* Remote video (full width) */}
          <div style={{position:'relative', width:'100%', height:240, background:'#111'}}>
            {webrtc.remoteVideoActive && webrtc.remoteStream ? (
              <video ref={remoteVideoInlineRef} autoPlay playsInline muted
                style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:8}}>
                <AvatarImg src={partner ? getSenderAvatar(partner.name) : null} size={64} />
                <span style={{color: S?.colors?.textMuted || '#94a3b8', fontSize:12}}>
                  {webrtc.webrtcState === 'connecting' ? 'Connessione...'
                    : webrtc.webrtcConnected ? (partner?.name || 'Partner') + ' - Camera off'
                    : 'In attesa di connessione...'}
                </span>
              </div>
            )}
            {/* Local video (picture-in-picture) */}
            {webrtc.localStream && webrtc.videoEnabled && (
              <div style={{position:'absolute', bottom:8, right:8, width:100, height:75,
                borderRadius:10, overflow:'hidden', border: S ? `2px solid ${S.colors.accent4Border}` : '2px solid #60a5fa',
                boxShadow:'0 4px 12px rgba(0,0,0,0.5)'}}>
                <video ref={localVideoInlineRef} autoPlay playsInline muted
                  style={{width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)'}} />
              </div>
            )}
            {/* WebRTC state badge */}
            <div style={{position:'absolute', top:8, left:8, display:'flex', alignItems:'center', gap:6,
              padding:'4px 10px', borderRadius:20, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)'}}>
              <div style={{width:8, height:8, borderRadius:4,
                background: webrtc.webrtcConnected ? (S?.colors?.statusOk || '#4ade80')
                  : webrtc.webrtcState === 'connecting' ? (S?.colors?.statusWarning || '#f59e0b')
                  : (S?.colors?.statusError || '#ef4444')}} />
              <span style={{fontSize:10, color:'#fff', fontWeight:600}}>
                {webrtc.webrtcConnected ? 'P2P' : webrtc.webrtcState === 'connecting' ? '...' : 'OFF'}
              </span>
            </div>
          </div>
          {/* Video controls */}
          <div style={{background:'rgba(0,0,0,0.9)', padding:'8px 12px'}}>
            {/* Volume slider row */}
            <div style={{display:'flex', alignItems:'center', gap:8, padding:'4px 0 8px'}}>
              <span style={{fontSize:14}}>
                {partnerVolume < 0.01 ? '\u{1F507}' : partnerVolume < 0.4 ? '\u{1F509}' : '\u{1F50A}'}
              </span>
              <input type="range" min="0" max="100" step="5"
                value={Math.round(partnerVolume * 100)}
                onChange={e => setPartnerVolume(Number(e.target.value) / 100)}
                style={{flex:1, accentColor:'#60a5fa', height:4}} />
              <span style={{fontSize:10, color:'#94a3b8', fontFamily:'monospace', minWidth:32, textAlign:'right'}}>
                {Math.round(partnerVolume * 100)}%
              </span>
            </div>
            {/* Buttons row */}
            <div style={{display:'flex', justifyContent:'space-around', gap:4}}>
              <button onClick={() => webrtc.toggleVideo()}
                title={webrtc.videoEnabled ? 'Spegni camera' : 'Accendi camera'}
                style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  padding:'6px 10px', borderRadius:10, border:'none', cursor:'pointer',
                  background: webrtc.videoEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                  color: webrtc.videoEnabled ? '#22c55e' : '#94a3b8', transition:'all 0.2s'}}>
                <span style={{fontSize:20}}>{webrtc.videoEnabled ? '\u{1F4F9}' : '\u{1F6AB}'}</span>
                <span style={{fontSize:8, fontWeight:600}}>{webrtc.videoEnabled ? 'Camera' : 'Camera OFF'}</span>
              </button>
              <button onClick={() => webrtc.flipCamera()}
                title="Ruota camera"
                style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  padding:'6px 10px', borderRadius:10, border:'none', cursor:'pointer',
                  background:'rgba(255,255,255,0.08)', color:'#fff', transition:'all 0.2s'}}>
                <span style={{fontSize:20}}>{'\u{1F504}'}</span>
                <span style={{fontSize:8, fontWeight:600, color:'#94a3b8'}}>Ruota</span>
              </button>
              <button onClick={() => setVideoFullscreen(true)}
                title="Espandi a schermo intero"
                style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  padding:'6px 14px', borderRadius:10, border:'none', cursor:'pointer',
                  background:'rgba(96,165,250,0.15)', color:'#60a5fa', transition:'all 0.2s'}}>
                <span style={{fontSize:20}}>{'\u{1F5A5}\uFE0F'}</span>
                <span style={{fontSize:8, fontWeight:700}}>FULLSCREEN</span>
              </button>
              <button onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
                title="Chiudi videochiamata"
                style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  padding:'6px 10px', borderRadius:10, border:'none', cursor:'pointer',
                  background:'rgba(239,68,68,0.15)', color:'#ef4444', transition:'all 0.2s'}}>
                <span style={{fontSize:20}}>{'\u{1F4F5}'}</span>
                <span style={{fontSize:8, fontWeight:600}}>Chiudi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default VideoCallOverlay;
