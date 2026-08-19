'use client';
import { useEffect, useRef, useMemo, useState } from 'react';
import { FONT, getLang, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';
import useStanzaVideo from '../hooks/useStanzaVideo.js';
import useParlatoTradotto, { useTraduzioneInArrivo } from '../hooks/useParlatoTradotto.js';

// ═══════════════════════════════════════════════════════════════
// STANZA VIDEO DI GRUPPO — modulo separato, in parallelo.
//
// Non sostituisce la videochiamata a due: quella resta dov'e, con il suo
// ducking e la sua gestione iOS. Questa e un'altra porta.
//
// COSA SI VEDE: un riquadro per persona, e sotto ognuno l'ultima cosa
// che ha detto, tradotta nella TUA lingua. La stanza resta libera di
// parlare: l'audio viaggia normalmente, la traduzione e un binario
// parallelo di testo che non rallenta nessuno.
// ═══════════════════════════════════════════════════════════════

function Riquadro({ nome, stream, stato, lingua, battuta, C, mio, volume = 1, muto = false, suVolume, suMuto }) {
  const ref = useRef(null);
  // b.291 — P2-11: il volume del singolo si applica al SUO video/audio.
  useEffect(() => {
    if (ref.current) { ref.current.volume = muto ? 0 : volume; ref.current.muted = mio || muto; }
  }, [volume, muto, mio]);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  // b.138 — questo riquadro aveva tre scritte in italiano fisso
  // ("Senza video", "In ascolto…", "Parla: ti traduco da solo.") ed e
  // un sotto-componente: il contesto ce l'ha lo stesso, essendo sotto
  // AppProvider come tutto il resto della stanza.
  const { L } = useApp();
  const l = lingua ? getLang(lingua) : null;

  return (
    <div style={{
      position: 'relative', borderRadius: 14, overflow: 'hidden',
      background: '#0b0d14', border: `1px solid ${C.cardBorder}`,
      aspectRatio: '4 / 3', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {stream ? (
          <video ref={ref} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover',
              transform: mio ? 'scaleX(-1)' : 'none' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 11.5, color: C.textMuted, fontFamily: FONT,
          }}>
            {stato === 'collego' ? L('connectingDots') : L('noVideo')}
          </div>
        )}

        {/* b.145 — la targhetta col nome aveva `backdropFilter: blur(6px)`.
            Sta dentro Riquadro, che si ripete una volta per partecipante:
            otto video in movimento, otto sfocature del fondo, ed e la
            stessa moltiplicazione che in b.143 aveva annebbiato l'intera
            scelta del paese. Il fondo nero al 55% basta a staccare il
            nome dal video, e non costa un livello di composizione.
            E "Tu" era in italiano fisso: la chiave c'era gia. */}
        <div style={{
          position: 'absolute', left: 6, bottom: 6,
          padding: '2px 8px', borderRadius: 999,
          background: 'rgba(0,0,0,0.55)',
          fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: FONT,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {l?.flag} {mio ? L('youWord') : nome}
        </div>
      </div>

      {/* Sotto il riquadro: quello che ha detto, nella TUA lingua */}
      <div style={{
        minHeight: 46, padding: '6px 9px', fontFamily: FONT,
        background: C.overlayBg, borderTop: `1px solid ${C.cardBorder}`,
      }}>
        {battuta ? (
          <>
            <div style={{ fontSize: 12.5, color: C.textPrimary, lineHeight: 1.35 }}>
              {battuta.tradotto || battuta.testo}
            </div>
            {battuta.tradotto && battuta.tradotto !== battuta.testo && (
              <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2, lineHeight: 1.3 }}>
                {battuta.testo}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 11, color: C.textMuted }}>
            {mio ? L('speakITranslate') : L('listeningDots')}
          </div>
        )}
        {/* b.291 — P2-11: OGNI persona ha il suo volume e il suo muto,
            qui sotto il suo riquadro. Grande, elementare: un altoparlante
            da toccare e una riga da trascinare. Vale solo per gli altri. */}
        {!mio && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <button onClick={() => suMuto?.(!muto)} aria-pressed={muto}
              aria-label={nome + (muto ? ' — riattiva audio' : ' — silenzia')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
                color: muto ? '#ef4444' : C.textPrimary, padding: 2, lineHeight: 1 }}>
              {muto ? '\u{1F507}' : '\u{1F50A}'}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muto ? 0 : volume}
              onChange={(e) => { const v = parseFloat(e.target.value); suVolume?.(v); if (v > 0 && muto) suMuto?.(false); }}
              aria-label={`Volume di ${nome}`} style={{ flex: 1, height: 4, accentColor: '#38e1ff' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function StanzaVideoGruppo({ roomId, roomSessionToken, mioNome, onEsci, queueAudio }) {
  const { L, S, prefs, savePrefs, myLang } = useApp();
  const C = S?.colors || {};
  const miaLingua = myLang || prefs?.lang || 'it';

  const stanza = useStanzaVideo({
    roomId, roomSessionToken, mioNome, attiva: true, conVideo: true,
  });

  // b.289 — P0: la preferenza "traduzione in chiamata" del PROFILO vale
  // anche qui, ed e di CIASCUN partecipante: off = niente trascrizione
  // ne traduzione; testo = solo sottotitoli; voce = anche la voce
  // tradotta, riprodotta col MIO motore, la MIA voce e il MIO volume
  // (passa dalla coda audio gia esistente e collaudata, non da un
  // secondo impianto).
  const sceltaTraduzione = prefs?.autoTraduzione || 'voce';
  // ═══ b.292 — IL PALCO: chi parla, chi aspetta, a chi tocca ═══
  const palco = stanza.palco || { posti: [], coda: [], offerta: null };
  const sonoIo = (n) => n && n.toLowerCase() === (mioNome || '').toLowerCase();
  const hoLaParola = palco.posti.some(sonoIo);
  const solo = stanza.partecipanti.length === 0;   // da solo si parla liberi
  const offertaAMe = palco.offerta && sonoIo(palco.offerta.nome) ? palco.offerta : null;
  const miaPosizioneInCoda = palco.coda.findIndex(sonoIo);
  // l'avviso a chi tocca: vibrazione una volta sola per offerta
  const offertaAvvisataRef = useRef(0);
  useEffect(() => {
    if (offertaAMe && offertaAvvisataRef.current !== offertaAMe.scade) {
      offertaAvvisataRef.current = offertaAMe.scade;
      vibrate(60);
    }
  }, [offertaAMe]);
  // il conto alla rovescia dell'offerta
  const [oraTic, setOraTic] = useState(0);
  useEffect(() => {
    if (!offertaAMe) return undefined;
    const t = setInterval(() => setOraTic(x => x + 1), 500);
    return () => clearInterval(t);
  }, [offertaAMe]);
  void oraTic;

  // b.291 — P2-11: volume e muto PER PERSONA (vivono qui, di ciascun
  // ascoltatore: le mie regolazioni non toccano gli altri).
  const [volumi, setVolumi] = useState({});
  const [muti, setMuti] = useState({});
  // e i MIEI interruttori: camera e microfono della stanza di gruppo
  const [cameraAccesa, setCameraAccesa] = useState(true);
  const [microfonoAcceso, setMicrofonoAcceso] = useState(true);
  useEffect(() => {
    const s = stanza.mioStream;
    if (!s) return;
    s.getVideoTracks().forEach(t => { t.enabled = cameraAccesa; });
    // b.292 — il microfono obbedisce anche al PALCO: parla chi ha la
    // parola (o chi e solo in stanza). Cosi la voce tradotta che esce
    // dagli altoparlanti degli altri non rientra nei microfoni aperti.
    s.getAudioTracks().forEach(t => { t.enabled = microfonoAcceso && (hoLaParola || solo); });
  }, [stanza.mioStream, cameraAccesa, microfonoAcceso, hoLaParola, solo]);
  const { battute, accogli } = useTraduzioneInArrivo(miaLingua, {
    roomId, roomSessionToken,
    // la voce tradotta si accoda solo se la scelta e "voce"
    suTradotto: sceltaTraduzione === 'voce' && queueAudio
      ? (tradotto, id) => { try { queueAudio(tradotto, getLang(miaLingua).speech, id); } catch { /* la voce e un di piu: il testo resta */ } }
      : null,
  });

  // Il canale dati consegna qui il parlato degli altri.
  useEffect(() => { stanza.quandoArrivaTesto(accogli); }, [stanza, accogli]);

  const mio = useParlatoTradotto({
    mioStream: stanza.mioStream,
    miaLingua,
    mandaTesto: stanza.mandaTesto,
    roomId, roomSessionToken,
    // b.289 — P0: con la preferenza su "spenta" il microfono non viene
    // trascritto affatto: zero chiamate, come da scelta dell'utente.
    attivo: stanza.stato === 'dentro' && sceltaTraduzione !== 'off' && (hoLaParola || solo),
  });

  // L'ultima battuta di ciascuno: sotto il riquadro sta una riga sola.
  const ultimaDi = useMemo(() => {
    const m = {};
    for (const b of battute) m[b.da] = b;
    return m;
  }, [battute]);

  const colonne = stanza.partecipanti.length <= 1 ? 1
    : stanza.partecipanti.length <= 3 ? 2 : 3;

  return (
    <div style={{ ...S.page, padding: '12px 12px 20px', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => { vibrate(); stanza.esci(); onEsci?.(); }}
          aria-label={L('exitVideoRoom')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textPrimary, display: 'flex' }}>
          <Icon name="back" size={20} color={C.textPrimary} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>{L('videoRoom')}</div>
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: C.textMuted }}>
          {stanza.partecipanti.length + 1}/{stanza.MAX_PARTECIPANTI}
        </div>
      </div>

      {stanza.stato === 'fermo' && (
        <div style={{
          padding: 16, borderRadius: 16, background: C.cardBg,
          border: `1px solid ${C.cardBorder}`, textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
            Parlate liberamente, ciascuno nella propria lingua. Sotto ogni
            riquadro compare quello che dice, tradotto per te.
          </div>
          <button onClick={() => { vibrate(); stanza.entra(); }} style={{
            padding: '13px 22px', borderRadius: 13, border: 'none', cursor: 'pointer',
            background: C.btnGradient || `linear-gradient(90deg, ${C.accent1}, ${C.accent2})`,
            color: '#fff', fontSize: 14.5, fontWeight: 800, fontFamily: FONT,
          }}>
            Entra in video
          </button>
        </div>
      )}

      {stanza.stato === 'apro' && (
        <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 20 }}>
          Accendo microfono e telecamera…
        </div>
      )}

      {stanza.errore && (
        <div style={{
          padding: '10px 12px', borderRadius: 12, marginBottom: 10,
          background: `${C.accent3}14`, border: `1px solid ${C.accent3}33`,
          fontSize: 12.5, color: C.accent3, lineHeight: 1.45,
        }}>
          {stanza.errore}
        </div>
      )}

      {stanza.stato === 'dentro' && (
        <>
          <div style={{
            display: 'grid', gap: 8,
            gridTemplateColumns: `repeat(${colonne}, minmax(0, 1fr))`,
          }}>
            <Riquadro mio nome={mioNome} stream={stanza.mioStream} stato="connesso"
              lingua={miaLingua} battuta={mio.ultimoMio ? { testo: mio.ultimoMio } : null} C={C} />
            {stanza.partecipanti.map(p => (
              <Riquadro key={p.nome} nome={p.nome} stream={p.stream} stato={p.stato}
                lingua={ultimaDi[p.nome]?.lingua} battuta={ultimaDi[p.nome]} C={C}
                volume={volumi[p.nome] ?? 1} muto={!!muti[p.nome]}
                suVolume={(v) => setVolumi(x => ({ ...x, [p.nome]: v }))}
                suMuto={(m) => setMuti(x => ({ ...x, [p.nome]: m }))} />
            ))}
          </div>

          {/* ═══ b.292 — LA PLANCIA DEL PALCO: un solo pulsante grande che
              dice sempre la cosa giusta da fare. Regole di Luca:
              1) chi e di turno viene AVVERTITO (vibrazione + riquadro) e
                 ha dieci secondi per prendere la parola;
              2) se non la prende, il turno passa da solo al prossimo
                 (lo fa il server, alla scadenza);
              3) chi parla puo CHIUDERE l'intervento e passare la palla. */}
          {!solo && (
            <div style={{ marginTop: 12 }}>
              {offertaAMe ? (
                <button onClick={() => { vibrate(); stanza.mossaPalco('prendo'); }}
                  style={{ width: '100%', padding: '16px 14px', borderRadius: 16, cursor: 'pointer',
                    background: 'linear-gradient(90deg, #16a34a, #3ddc84)', border: 'none',
                    color: '#fff', fontSize: 17, fontWeight: 900, fontFamily: FONT,
                    boxShadow: '0 6px 24px rgba(61,220,132,0.4)' }}>
                  {L('floorYourTurn')} · {Math.max(0, Math.ceil((offertaAMe.scade - Date.now()) / 1000))}s
                </button>
              ) : hoLaParola ? (
                <button onClick={() => { vibrate(); stanza.mossaPalco('chiudo'); }}
                  style={{ width: '100%', padding: '14px 14px', borderRadius: 16, cursor: 'pointer',
                    background: 'rgba(56,225,255,0.14)', border: '2px solid #38e1ff',
                    color: C.textPrimary, fontSize: 15, fontWeight: 800, fontFamily: FONT }}>
                  {'\u2705'} {L('floorDone')}
                </button>
              ) : miaPosizioneInCoda >= 0 ? (
                <button onClick={() => { vibrate(); stanza.mossaPalco('rinuncia'); }}
                  style={{ width: '100%', padding: '14px 14px', borderRadius: 16, cursor: 'pointer',
                    background: C.overlayBg, border: `2px solid ${C.cardBorder}`,
                    color: C.textPrimary, fontSize: 14, fontWeight: 800, fontFamily: FONT }}>
                  {'\u23F3'} {L('floorInQueue')} · {miaPosizioneInCoda + 1}\u00B0 — {L('floorLeave')}
                </button>
              ) : (
                <button onClick={() => { vibrate(); stanza.mossaPalco('chiedi'); }}
                  style={{ width: '100%', padding: '16px 14px', borderRadius: 16, cursor: 'pointer',
                    background: 'rgba(61,220,132,0.14)', border: '2px solid #3ddc84',
                    color: C.textPrimary, fontSize: 16, fontWeight: 900, fontFamily: FONT }}>
                  {'\u{1F64B}'} {L('floorAsk')}
                </button>
              )}
            </div>
          )}

          {/* b.291 — P2-11/12: i MIEI comandi, come nella chiamata a due.
              Icone grandi con la parola sotto: camera, microfono, e la
              scelta della traduzione (spenta / testo / voce) che scrive
              la STESSA preferenza del profilo. */}
          <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'camera', acceso: cameraAccesa, su: () => setCameraAccesa(v => !v), icona: cameraAccesa ? '\u{1F4F9}' : '\u{1F6AB}', parola: cameraAccesa ? 'Camera' : 'Spenta' },
              { id: 'micro', acceso: microfonoAcceso, su: () => setMicrofonoAcceso(v => !v), icona: microfonoAcceso ? '\u{1F3A4}' : '\u{1F507}', parola: microfonoAcceso ? 'Micro' : 'Muto' },
            ].map(b => (
              <button key={b.id} onClick={() => { vibrate(); b.su(); }} aria-pressed={b.acceso}
                style={{ width: 74, padding: '10px 4px', borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
                  background: b.acceso ? 'rgba(61,220,132,0.14)' : 'rgba(239,68,68,0.14)',
                  border: `2px solid ${b.acceso ? '#3ddc84' : '#ef4444'}`, color: C.textPrimary,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{b.icona}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800 }}>{b.parola}</span>
              </button>
            ))}
            {[['off','\u{1F6AB}'],['testo','\u{1F4D6}'],['voce','\u{1F50A}']].map(([id, icona]) => (
              <button key={id} onClick={() => { vibrate(); savePrefs && savePrefs({ ...prefs, autoTraduzione: id }); }}
                aria-pressed={sceltaTraduzione === id}
                style={{ width: 74, padding: '10px 4px', borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
                  background: sceltaTraduzione === id ? 'rgba(56,225,255,0.14)' : C.overlayBg,
                  border: `2px solid ${sceltaTraduzione === id ? '#38e1ff' : C.cardBorder}`, color: C.textPrimary,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{icona}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800 }}>
                  {id === 'off' ? L('autoTransOff').split(':')[0] : id === 'testo' ? L('autoTransTextOnly') : L('autoTransVoiceText')}
                </span>
              </button>
            ))}
          </div>

          <div style={{
            marginTop: 10, fontSize: 11.5, color: C.textMuted,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {mio.staScrivendo
              ? L('transcribingYou')
              : mio.errore
                ? mio.errore
                : L('autoTranslateNote')}
          </div>

          {stanza.partecipanti.length === 0 && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 12,
              background: C.overlayBg, fontSize: 12.5, color: C.textMuted, lineHeight: 1.5,
            }}>
              Per ora sei solo. Condividi il codice della stanza: chi entra
              compare qui accanto.
            </div>
          )}
        </>
      )}
    </div>
  );
}
