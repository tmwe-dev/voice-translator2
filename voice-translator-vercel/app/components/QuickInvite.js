'use client';
import TendinaVetro from './ui/TendinaVetro.js'; // b.535
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { APP_URL, LANGS, FONT, vibrate, metaScelta} from '../lib/constants.js';
import Icon from './Icon.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import { disegnaQR } from '../lib/codiceQR.js';
import { t, preloadLang, mapLang } from '../lib/i18n.js';
import { createLogger } from '../lib/logger.js';
const log = createLogger('QuickInvite');   // b.604 — niente console.* sparsi: tutto dal logger

// b.482 — I COLORI ARRIVANO DAL TEMA, non da valori scritti a mano dentro
// la schermata: l'invito restava scuro e verde-acqua anche col tema chiaro,
// e quel verde non esisteva in nessun'altra pagina dell'applicazione.
const vetroDi = (C) => ({
  btn: {
    background: C.glassCard || 'rgba(140,170,255,0.06)',
    border: `1px solid ${C.cardBorder || 'rgba(160,190,255,0.14)'}`,
  },
  text: {
    primary: C.textPrimary || PALETTE.grayLight,
    secondary: C.textSecondary || 'rgba(238,242,255,0.82)',
    muted: C.textMuted || 'rgba(238,242,255,0.52)',
  },
});

function QuickInvite({ handleCreateRoom, roomId, setViewAfterCreate }) {
  const { L, S, prefs, theme, setView } = useApp();
  const lang = prefs?.lang || 'it';
  // b.482 — un posto solo da cui prendere i colori di questa schermata.
  const C = S?.colors || {};
  const glass = vetroDi(C);
  const accento1 = C.accent1 || PALETTE.violet;
  const accento2 = C.accent2 || PALETTE.teal;
  // b.462 — l'ospite si invita nella LINGUA 2, quella scelta nel carosello,
  // non in un ripiego calcolato sulla mia. Se non c'e, resta il ripiego.
  const [guestLang, setGuestLang] = useState(() => metaScelta(prefs) || (lang === 'en' ? 'it' : 'en'));
  const [creating, setCreating] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState(roomId || '');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  // Create room function (used on mount + retry)
  const doCreateRoom = useCallback(() => {
    if (createdRoomId || creating) return;
    setCreating(true);
    setError('');
    handleCreateRoom(lang)
      .then(room => { if (room?.id || room?.roomId) setCreatedRoomId(room.id || room.roomId); else setError(L('roomCreateFailed')); })
      .catch(e => { log.warn('[QuickInvite]', e); setError(L('connErrorRetry')); })
      .finally(() => setCreating(false));
  }, [createdRoomId, creating, handleCreateRoom, lang, L]);

  // Auto-create room on mount
  useEffect(() => {
    doCreateRoom();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // QR code — regenerates when guest lang changes
  useEffect(() => {
    if (!createdRoomId || !canvasRef.current) return;
    const url = `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1&gl=${guestLang}`;
    let cancelled = false;
    // b.483 — il codice lo disegna app/lib/codiceQR.js, che e l'unico
    // posto dove si decide come si disegna un QR in questa applicazione.
    // Prima ogni schermata se lo scriveva da se, e infatti quello del
    // tassista era finito verde su blu scuro.
    // E il tratto passa dal blu notte al NERO: quel blu era quasi nero e
    // di solito si legge, ma "quasi" su un codice a barre vuol dire che
    // qualche fotocamera ce la fa e qualcuna no, senza dire quale.
    disegnaQR(canvasRef.current, url, 260, 2);
    return () => { cancelled = true; };
  }, [createdRoomId, lang, guestLang]);

  const getUrl = () => `${APP_URL}?room=${createdRoomId}&lang=${lang}&auto=1&gl=${guestLang}`;

  // b.489 — tavola 16: il messaggio dei canali (WhatsApp/SMS/Email) parte
  // NELLA LINGUA DI CHI LO LEGGERA', non nella mia. Il pacchetto si
  // scalda appena si sceglie la lingua; se non fa in tempo, t() ripiega
  // sull'inglese — che per un invito e comunque meglio dell'italiano a
  // un giapponese.
  useEffect(() => { preloadLang(mapLang(guestLang)); }, [guestLang]);
  const testoInvito = () => `${t(mapLang(guestLang), 'inviteText')} ${getUrl()}`;

  const copyLink = useCallback(() => {
    if (!createdRoomId) return;
    navigator.clipboard.writeText(getUrl()).then(() => {
      vibrate(); setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [createdRoomId, lang, guestLang]);

  const enterRoom = useCallback(() => {
    vibrate();
    if (setViewAfterCreate) setViewAfterCreate();
    else setView('room');
  }, [setView, setViewAfterCreate]);

  const guestLangInfo = LANGS.find(l => l.code === guestLang);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bgGradient || PALETTE.bgDeep,
      fontFamily: FONT,
    }}>
      {/* b.482 — TESTATA: rientro laterale a venti come nel template, cosi
          passando da una schermata all'altra il contenuto non salta. */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px', flexShrink: 0,
      }}>
        {/* b.482 — il tasto indietro e il piu premuto dell'applicazione:
            quarantaquattro di lato, sotto i quali un dito sbaglia bersaglio. */}
        {/* b.510 — se questo invito e per una stanza gia esistente
            (roomId arriva da fuori: si e stati mandati qui da dentro la
            stanza, non dal logo di Home), «indietro» deve tornare LI, non
            a home — altrimenti si esce dalla stanza solo per aver toccato
            invita. setViewAfterCreate e la stessa funzione che «entra
            nella stanza» usa piu sotto: e gia quella giusta. */}
        <button onClick={() => { if (roomId && setViewAfterCreate) setViewAfterCreate(); else setView('home'); }}
          style={{
            width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
            ...glass.btn,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: glass.text.secondary, fontSize: 18,
          }}>
          {'‹'}
        </button>
        <div style={{ flex: 1 }}>
          {/* b.489 — tavola 16: il titolo e testo pieno, come su ogni altra
              pagina. Il gradiente sul titolo era un colore scritto a mano
              (regola 06 del template) e rendeva questa testata diversa da
              tutte le altre senza dire niente in cambio. */}
          <div style={{ fontSize: 17, fontWeight: 500, color: glass.text.primary }}>
            {L('inviteShort')}
          </div>
        </div>
      </header>

      <div style={{
        flex: 1, overflow: 'auto', padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        maxWidth: 400, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>

        {/* SPINNER */}
        {creating && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', margin: '0 auto 12px',
              border: `3px solid ${accento2}26`, borderTopColor: accento2,
              animation: 'vtSpin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: glass.text.muted }}>{L('preparingInvite')}</div>
          </div>
        )}

        {/* ERRORE */}
        {error && !creating && !createdRoomId && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: C.accent3 || PALETTE.coral, marginBottom: 16 }}>{error}</div>
            <button onClick={doCreateRoom}
              style={{
                padding: '14px 32px', minHeight: 44, borderRadius: 14, cursor: 'pointer', border: 'none',
                background: `linear-gradient(135deg, ${accento1} 0%, ${accento2} 100%)`,
                color: '#000', fontFamily: FONT, fontSize: 15, fontWeight: 500,
              }}>
              {L('retryWord')}
            </button>
          </div>
        )}

        {/* QR + LINGUA */}
        {createdRoomId && !creating && (
          <>
            {/* b.489 — tavola 16: PRIMA di tutto si dice cosa succede.
                «Chi apre il link entra nella tua stanza. Sceglie la sua
                lingua da solo.» Era il pezzo che mancava: la pagina
                mostrava un QR senza mai dire a cosa portasse. */}
            <div style={{ fontSize: 13, color: glass.text.muted, textAlign: 'center',
              lineHeight: 1.5, marginBottom: 14, maxWidth: 300 }}>
              {L('inviteExplain')}
            </div>

            {/* b.489 — tavola 16: IL LINK SI VEDE PER INTERO prima di
                mandarlo. «Nessuno manda una cosa che non ha letto.» */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 14, marginBottom: 10, boxSizing: 'border-box',
              background: C.inputBg || 'rgba(140,170,255,0.05)',
              border: `1px solid ${C.inputBorder || 'rgba(160,190,255,0.16)'}` }}>
              <span style={{ flex: 1, fontSize: 13, color: glass.text.secondary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums' }}>{getUrl()}</span>
              <button onClick={copyLink} aria-label={L('copyLink')}
                style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
                  ...glass.btn, color: copied ? accento2 : glass.text.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {copied ? '\u2713' : <Icon name="link" size={15} color="currentColor" />}
              </button>
            </div>

            {/* b.489 — tavola 16: i canali per mandarlo, per nome. WhatsApp,
                SMS ed Email sono NOMI PROPRI: non si traducono. Il testo
                dentro parte nella lingua che l'ospite leggera. */}
            <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 16 }}>
              {[
                ['WhatsApp', () => window.open(`https://wa.me/?text=${encodeURIComponent(testoInvito())}`, '_blank')],
                ['SMS', () => { window.location.href = `sms:?&body=${encodeURIComponent(testoInvito())}`; }],
                ['Email', () => { window.location.href = `mailto:?subject=BarTalk&body=${encodeURIComponent(testoInvito())}`; }],
              ].map(([nome, via]) => (
                <button key={nome} onClick={() => { vibrate(); via(); }}
                  style={{ flex: 1, minHeight: 44, borderRadius: 14, cursor: 'pointer',
                    ...glass.btn, color: glass.text.primary, fontFamily: FONT,
                    fontSize: 13.5, fontWeight: 500 }}>
                  {nome}
                </button>
              ))}
            </div>

            {/* Lingua invitato — tavola 16: «IN CHE LINGUA LO LEGGERA'».
                Le pillole della tavola mostrano due lingue d'esempio; qui
                le lingue sono quarantaquattro e stanno in una tendina, che
                e la forma del kit per una scelta lunga. */}
            <div style={{ width: '100%', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase',
                color: glass.text.muted, marginBottom: 6, textAlign: 'center' }}>
                {L('inviteReadLang')}
              </div>
              {/* b.482 — la scelta della lingua e un bersaglio da toccare:
                  almeno quarantaquattro di altezza utile. */}
              {/* b.526 — «lascia lo spagnolo anche a me» (Luca): la tendina
                  escludeva la lingua dell'invitante, ma b.465 ha gia
                  stabilito che due lingue uguali sono un caso legittimo
                  (si usa la stanza senza traduzione). Tutte le lingue. */}
              {/* INIZIO b.535 — la tendina di sistema esce, entra la
                  TendinaVetro dell'app (stessa forma del kit, pannello di
                  vetro coerente). FINE b.535 */}
              <TendinaVetro
                valore={guestLang}
                onScegli={(v) => setGuestLang(v)}
                targa={L('inviteReadLang')}
                C={C}
                centrato
                opzioni={LANGS.map(l => ({ id: l.code, label: l.name, icona: l.flag }))}
                stile={{ width: '100%', padding: '12px 14px', minHeight: 44, borderRadius: 14, boxSizing: 'border-box',
                  background: C.inputBg || 'rgba(140,170,255,0.05)',
                  border: `1px solid ${C.inputBorder || 'rgba(160,190,255,0.16)'}`,
                  color: glass.text.primary, fontSize: 15 }}
              />
            </div>

            {/* b.482 — IL QR RESTA NERO SU BIANCO: e l'unica eccezione ai
                colori del tema, perche una fotocamera lo deve poter leggere. */}
            <canvas ref={canvasRef}
              style={{
                borderRadius: 18, background: '#fff', padding: 12,
                display: 'block', margin: '0 auto 16px', maxWidth: 240, width: '100%',
              }} />

            {/* b.489 — il codice in testo pieno, cifre tabulari: come nella
                sala d'attesa (tavola 14). Il gradiente era decorazione. */}
            <div style={{
              fontSize: 26, fontWeight: 500, letterSpacing: 5, textAlign: 'center',
              color: glass.text.primary, fontVariantNumeric: 'tabular-nums', marginBottom: 16,
            }}>
              {createdRoomId}
            </div>

            {/* Copia + Condividi */}
            <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 12 }}>
              <button onClick={copyLink}
                style={{
                  flex: 1, padding: '14px 16px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
                  background: copied ? `linear-gradient(135deg, ${accento1}, ${accento2})` : glass.btn.background,
                  border: copied ? 'none' : glass.btn.border,
                  color: copied ? '#000' : glass.text.primary,
                  fontFamily: FONT, fontSize: 14, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {copied ? `✓ ${L('copiedShort')}` : <><Icon name="link" size={14} color="currentColor" /> {L('copyLink')}</>}
              </button>
              <button onClick={() => {
                if (navigator.share) navigator.share({ title: 'BarTalk', url: getUrl() }).catch(() => {});
                else copyLink();
              }}
                style={{
                  padding: '14px 16px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
                  ...glass.btn, color: glass.text.primary, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Icon name="share" size={18} color={glass.text.primary} />
              </button>
            </div>

            {/* Entra */}
            <button onClick={enterRoom}
              style={{
                width: '100%', padding: '16px 0', minHeight: 44, borderRadius: 16, cursor: 'pointer', border: 'none',
                background: `linear-gradient(135deg, ${accento1} 0%, ${accento2} 100%)`,
                color: '#000', fontFamily: FONT, fontSize: 16, fontWeight: 500,
                boxShadow: `0 8px 32px ${accento1}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <Icon name="doorCreate" size={20} color="#000" /> {L('enterTheRoom')}
            </button>

            <div style={{ fontSize: 10, color: glass.text.muted, marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
              {L('guestScansQR')}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default memo(QuickInvite);
