'use client';
import TendinaVetro from './ui/TendinaVetro.js'; // b.535
import { memo, useState, useEffect, useRef } from 'react';
import { LANGS, APP_URL, FONT } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
import Icon from './Icon.js';
import { disegnaQR } from '../lib/codiceQR.js';
import { membriDi } from '../lib/membri.js';

const LobbyView = memo(function LobbyView({ roomId, roomInfo, partnerConnected, inviteLang, setInviteLang,
  shareRoom, leaveRoom, unlockAudio, perVideo = false }) {
  const { L, S, setView, theme, setTheme } = useApp();

  const canvasRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);
  const [copiato, setCopiato] = useState(false); // b.487 — il feedback della pillola Copia

  // Generate QR code client-side using canvas
  useEffect(() => {
    if (!roomId || !canvasRef.current) return;
    const url = `${APP_URL}?room=${roomId}&lang=${inviteLang}`;
    let cancelled = false;

    // b.483 — il codice lo disegna app/lib/codiceQR.js, che e l'unico
    // posto dove si decide come si disegna un QR in questa applicazione.
    // Prima ogni schermata se lo scriveva da se, e infatti quello del
    // tassista era finito verde su blu scuro.
    disegnaQR(canvasRef.current, url, 180, 2).then((fatto) => {
      if (!cancelled) setQrReady(fatto);
    });

    return () => { cancelled = true; };
  }, [roomId, inviteLang]);

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={leaveRoom}>{'\u2190'}</button>
          <span style={{fontWeight: 500, fontSize:17}}>{L('yourRoom')}</span>
        </div>
        <div style={S.card}>
          {/* b.487 — tavola 14 del template: IL CODICE E' LA COSA PIU
              GRANDE A SCHERMO, perche e quello che si detta al telefono o
              si urla in un bar. Via l'etichetta «CODICE» (non informa: si
              capisce da se) e via il colore d'accento: 48 punti in testo
              pieno, cifre tabulari cosi non ballano. Sotto, la riga che
              dice COSA farci — che prima non c'era da nessuna parte. */}
          <div style={{textAlign:'center', marginBottom:16}}>
            <div style={{fontSize:48, fontWeight: 500, letterSpacing:6, color:S.colors.textPrimary,
              fontVariantNumeric:'tabular-nums', lineHeight:1.1}}>{roomId}</div>
            <div style={{fontSize:13, color:S.colors.textMuted, marginTop:2}}>{L('readCodeAloud')}</div>
          </div>
          <div style={{textAlign:'center', marginBottom:14, position:'relative'}}>
            <canvas ref={canvasRef}
              style={{borderRadius:16, background:'#fff', padding:8, display:'block', margin:'0 auto',
                maxWidth:180, maxHeight:180, opacity: qrReady ? 1 : 0, transition:'opacity .25s'}} />
            {/* b.90 — prima si vedeva un rettangolo BIANCO vuoto finche il
                codice non era disegnato: sembrava un QR rotto. */}
            {/* b.482 — l'attesa era scritta a mano in italiano: chi apriva
                l'invito in un'altra lingua leggeva una frase che non
                capiva. Ora viene dal pacchetto lingua come tutto il resto. */}
            {!qrReady && (
              <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center',
                color:S.colors.textMuted, fontSize:12}}>
                {L('preparingInvite')}
              </div>
            )}
            {/* b.482 — l'indirizzo di ripiego tiene SEMPRE il suo posto ad
                altezza fissa: prima compariva e spariva insieme al codice e
                tutto quello che sta sotto saltava su e giu. */}
            <div style={{fontSize:11, color:S.colors.textMuted, marginTop:6, height:14, overflow:'hidden'}}>
              {!qrReady ? `${APP_URL}?room=${roomId}` : ''}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={S.label}>{L('inviteLangLabel')}</div>
            {/* b.482 — la tendina e un bersaglio da toccare: sotto i 44 punti
                di altezza il dito sbaglia. */}
            {/* b.535 — TendinaVetro al posto della select di sistema. */}
            <TendinaVetro valore={inviteLang} onScegli={(v) => setInviteLang(v)} targa={L('inviteLangLabel')}
              opzioni={LANGS.map(l => ({ id: l.code, label: l.name, icona: l.flag }))}
              stile={{ ...S.select, fontSize: 14, minHeight: 44, width: '100%' }} />
          </div>
          {/* b.487 — tavola 14: DUE pillole, Copia e Condividi. «Copia»
              mancava: chi non ha (o non vuole) il foglio di condivisione
              del telefono non aveva modo di prendersi il link. */}
          <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:12}}>
            <button style={{...S.shareBtn, minHeight:44}} onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${APP_URL}?room=${roomId}&lang=${inviteLang}`);
                setCopiato(true); setTimeout(() => setCopiato(false), 2000);
              } catch { /* senza permesso appunti resta Condividi */ }
            }}>{copiato ? `\u2713 ${L('copiedShort')}` : L('copyWord')}</button>
            <button style={{...S.shareBtn, minHeight:44}} onClick={shareRoom}>{L('shareLink')}</button>
          </div>

          {/* b.461, ordine di Luca: «non deve proporre stanza video: le
              stanze partono normali come testo e si seleziona la camera
              all'interno della pagina chat». Via il tasto «Entra nella
              stanza video» che stava qui.
              Il motivo e giusto: da questa scheda non si e ancora in due —
              c'e il codice e si aspetta qualcuno. Proporre il video PRIMA
              che arrivi significa chiedere di scegliere il modo di parlare
              a chi non ha ancora nessuno con cui parlare. La stanza si apre
              come testo, che e quello che serve sempre; la telecamera si
              accende dentro, quando c'e davvero qualcuno dall'altra parte.
              La schermata video resta e resta raggiungibile: cambia solo
              che non si sceglie da qui. */}
          {/* ── INIZIO b.90 — "Videochiamata" apriva questa identica schermata ──
              Due voci diverse in Home portavano allo stesso posto, senza una
              parola sul video. Ora almeno si dice cosa succede dopo. */}
          {perVideo && !partnerConnected && (
            <div style={{
              textAlign:'center', fontSize:12.5, lineHeight:1.5, marginBottom:12,
              padding:'10px 20px', borderRadius:12,
              background:`${S.colors.accent1}12`, border:`1px solid ${S.colors.accent1}25`,
              color:S.colors.textSecondary,
            }}>
              {L('guestThenCall')}
            </div>
          )}
          {/* ── FINE b.90 ── */}
          {/* b.482 — la spunta era un carattere di quelli che il telefono
              puo disegnare come emoji: qui le figure vengono dal nostro
              foglio di icone, cosi restano uguali su ogni apparecchio. */}
          {/* b.487 — tavola 14: «In attesa» e una RIGA CON UN PALLINO, non
              un riquadro. Verde = la stanza e viva (lo stesso significato
              che il verde ha in tutta l'applicazione), e la riga cambia da
              sola quando entra qualcuno. */}
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            color:S.colors.textMuted, fontSize:13, marginBottom:12}}>
            <span style={{width:7, height:7, borderRadius:999, flexShrink:0,
              background: partnerConnected ? S.colors.accent2 : '#3ddc84'}} />
            {partnerConnected
              ? <span style={{color:S.colors.accent2}}>{membriDi(roomInfo)[1]?.name} <Icon name="check" size={14} color={S.colors.accent2} style={{verticalAlign:'-2px'}} /></span>
              : <span>{L('waitingForPartner')}</span>}
          </div>
          {/* b.487 — tavola 14: il bottone in fondo c'e SEMPRE. Prima si
              poteva entrare in stanza solo quando qualcuno era gia dentro:
              chi voleva prepararsi, scrivere il primo messaggio o
              semplicemente aspettare DENTRO restava chiuso fuori dalla sua
              stessa stanza. Da soli dice «Entra tu per primo», in due
              «Iniziamo» — stesso gesto, la scritta dice la verita. */}
          <button style={{...S.btn, minHeight:54, fontSize:15, fontWeight: 500}}
            onClick={() => { unlockAudio(); setView('room'); }}>
            {partnerConnected ? L('letsStart') : L('enterFirst')}
          </button>
        </div>
      </div>
    </div>
  );
});

export default LobbyView;
