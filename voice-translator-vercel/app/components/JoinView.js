'use client';
import TendinaVetro from './ui/TendinaVetro.js'; // b.535
import Icon from './Icon.js';
import { useState, useEffect, useRef } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import { t } from '../lib/i18n.js';
import { memGet } from '../lib/memoria.js';
import getStyles from '../lib/styles.js';
import AvatarImg from './AvatarImg.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// JOIN VIEW — Redesigned with glassmorphism
//
// Invited guests: 3-step wizard (name → lang → audio → join)
// Manual join: single card with room code input
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// b.133 · IL CAMPO NOME CHE ACCETTAVA UNA LETTERA SOLA
//
// Luca: "il campo nome non accetta piu di un carattere e ti butta
// fuori dal campo".
//
// GlassCard e PrimaryBtn erano definiti DENTRO il corpo di JoinView.
// Ogni battuta cambia `prefs` → JoinView si ridisegna → quelle due
// funzioni vengono RICREATE → React le vede come tipi di componente
// NUOVI → smonta tutto il sottoalbero e lo rimonta da capo.
//
// L'input veniva distrutto e ricostruito dopo ogni carattere. Il fuoco
// se ne andava con lui, e la lettera successiva finiva nel vuoto.
//
// Non e un difetto di validazione o di `maxLength`: e la posizione
// della definizione. Un componente definito dentro un altro non e mai
// lo stesso componente due volte.
//
// Portati fuori: adesso la loro identita e stabile per tutta la vita
// del modulo, e React riconosce lo stesso albero.
// ═══════════════════════════════════════════════════════════════

function GlassCard({ children, style = {}, C }) {
  return (
    <div style={{
      background: C.card, borderRadius: 22, padding: '24px 20px',
      border: `1px solid ${C.cardBorder}`,
      backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
      width: '100%', maxWidth: 400,
      boxShadow: `0 20px 60px -15px rgba(0,0,0,0.5)`,
      animation: 'vtScaleIn 0.35s ease-out',
      ...style,
    }}>
      {children}
    </div>
  );
}

// b.482 — il tasto principale dichiara la sua altezza minima di 44: e la
// misura sotto la quale un dito comincia a sbagliare bersaglio. E il
// bianco del testo viene dal listino colori, non da un valore scritto qui.
function PrimaryBtn({ onClick, disabled, children, style = {}, C, FONT }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', minHeight: 44, padding: '14px 20px', borderRadius: 14, border: 'none',
      background: disabled ? C.card : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
      color: PALETTE.white, fontSize: 15, fontWeight: 500, fontFamily: FONT,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      boxShadow: disabled ? 'none' : `0 4px 20px ${C.accent}35`,
      WebkitTapHighlightColor: 'transparent',
      transition: 'all 0.2s',
      ...style,
    }}>
      {children}
    </button>
  );
}

export default function JoinView({ joinCode,
  setJoinCode, inviteMsgLang, setInviteMsgLang, handleJoinRoom, userToken, setAuthStep,
  unlockAudio }) {
  const { L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, setView, status, theme, setTheme } = useApp();

  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    // Fondo dal TEMA: prima era fisso e il tema chiaro restava nero.
    bg: col.bg || PALETTE.bgDeep,
    textPrimary: col.textPrimary || PALETTE.grayLight,
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    input: col.inputBg || 'rgba(14,18,32,0.6)',
    inputBorder: col.inputBorder || 'rgba(255,255,255,0.07)',
    accent: col.accent1 || PALETTE.teal,
    purple: col.accent2 || PALETTE.violet,
    red: col.accent3 || PALETTE.coral,
  };

  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [guestStep, setGuestStep] = useState(0);
  const [gender, setGender] = useState(prefs.gender || '');
  const [audioAutoPlay, setAudioAutoPlay] = useState(prefs.autoPlay !== false);
  const [selectedVoicePref, setSelectedVoicePref] = useState(prefs.voice || 'nova');
  const nameInputRef = useRef(null);

  // b.136 — il ripiego era `prefs.lang`, la lingua PARLATA. Qui si
  // scrivono i testi che l'ospite LEGGE, quindi il ripiego giusto e la
  // lingua dell'interfaccia: sono due impostazioni distinte da questa
  // versione. `inviteMsgLang` resta davanti a tutto perche e la lingua
  // che ha scelto chi invita, e vince (b.115).
  const iL = inviteMsgLang || prefs.uiLang || prefs.lang || 'en';
  const tI = (key) => t(iL, key);
  const isInvited = !!inviteMsgLang;
  // b.133 — IL GENERE NON E UN REQUISITO PER ENTRARE.
  //
  // Prima serviva anche `prefs.gender`, che arriva solo dal parametro
  // `gg=` dei nostri QR. Un invito normale non ce l'ha, quindi l'ospite
  // finiva nelle tre schermate anche quando aveva gia nome e lingua.
  // Il genere serve a scegliere una voce: e una preferenza, non una
  // chiave d'ingresso, e si imposta dopo con la chat gia aperta.
  // b.389 — L'INVITO APERTO SULLO STESSO BROWSER DELL'HOST.
  //
  // Secondo collaudo di Luca: aprendo il link in una scheda nuova si
  // entrava dritti nella stanza COME L'HOST — tutti i messaggi marcati
  // «Tu», la lobby ferma su «In attesa del partner…» perche il partner
  // era lui stesso, e la stanza che non registrava nessuno.
  //
  // La causa e l'ingresso automatico, che di per se e giusto: «l'ospite
  // non deve fare niente, deve solo aprire la pagina e scrivere». Ma il
  // nome lo prende dalle preferenze, che sono condivise fra le schede —
  // quindi chi apre l'invito eredita l'identita di chi c'era.
  //
  // Non si toglie l'ingresso automatico: si interrompe SOLO nel caso che
  // sbaglia. Se il nome con cui entrerei e gia quello dell'host della
  // stanza, e non ho il segreto che dimostra che l'host sono io, allora
  // e una collisione: si chiede chi sei. Per tutti gli altri — cioe per
  // gli ospiti veri, che sono la maggioranza — non cambia niente.
  const [collisioneHost, setCollisioneHost] = useState(false);
  useEffect(() => {
    const codice = String(joinCode || '').trim().toUpperCase();
    const mio = String(prefs.name || '').trim();
    if (!isInvited || !codice || !mio) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/room?id=${encodeURIComponent(codice)}`, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        const host = d?.room?.host;
        if (!vivo || !host || host !== mio) return;
        let segreto = null;
        // si legge dallo STESSO magazzino in cui lo scrive chi crea la
        // stanza (useRoomPolling): leggerlo altrove vorrebbe dire non
        // trovarlo mai, e chiedere il nome anche all'host che rientra.
        try { segreto = JSON.parse(memGet('vt-host-secrets') || '{}')[codice] || null; }
        catch { /* memoria negata: senza prova si chiede, ed e la scelta prudente */ }
        if (!segreto) setCollisioneHost(true);
      } catch { /* la stanza non si legge: si prosegue come prima, non si blocca nessuno */ }
    })();
    return () => { vivo = false; };
  }, [joinCode, prefs.name, isInvited]);

  // b.389 — in collisione il modulo TORNA a chiedere: il nome c'e gia
  // scritto ma si puo cambiare, ed e proprio quello che serve.
  const isPrefilled = prefs.name && isInvited && !collisioneHost;

  // ─── ENTRA DA SOLO (b.133) ───
  //
  // "Non deve fare niente, deve solo aprire la pagina e scrivere."
  //
  // L'avvio automatico vive in page.js e scatta 600 ms dopo il
  // caricamento. Ma finche non ha finito, questa schermata mostrava il
  // modulo — quindi l'ospite VEDEVA comunque le domande, e se l'avvio
  // per qualsiasi motivo non andava a buon fine restava li dentro
  // convinto di doverle compilare.
  //
  // Ora, se c'e un invito e c'e un nome (anche provvisorio), non si
  // mostra nessun modulo: si mostra che stiamo entrando. E se dopo 1,2 s
  // siamo ANCORA qui, vuol dire che l'avvio di page.js non e partito e
  // allora entriamo da questa parte. Se il timer di page.js ha
  // funzionato questo componente e gia smontato e il timer muore con lui:
  // non c'e modo di chiedere l'ingresso due volte.
  const entraDaSolo = isInvited && !!String(prefs.name || '').trim() && !collisioneHost;
  const [ingressoBloccato, setIngressoBloccato] = useState(false);
  const ingressoRef = useRef(false);

  useEffect(() => {
    if (!entraDaSolo || ingressoRef.current) return;
    ingressoRef.current = true;

    const ripiego = setTimeout(() => {
      try { unlockAudio?.(); } catch (e) { /* l'audio si sbloccera al primo tocco: non e un motivo per non entrare */ }
      savePrefs(prefs);
      handleJoinRoom();
    }, 1200);

    // Se dopo otto secondi siamo ancora su questa schermata, l'ingresso
    // non e riuscito davvero (stanza piena, codice scaduto, rete). A quel
    // punto e giusto ridare i comandi invece di lasciare girare un cerchio.
    const resa = setTimeout(() => setIngressoBloccato(true), 8000);

    return () => { clearTimeout(ripiego); clearTimeout(resa); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entraDaSolo]);

  useEffect(() => {
    if (guestStep === 0 && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 300);
    }
  }, [guestStep]);

  // ── b.139 · IL MINI-DIZIONARIO INTERNO E STATO SMONTATO ──
  //
  // Qui viveva una funzione di traduzione tutta sua, con la mappa dentro:
  // quattordici frasi scritte a mano in it/es/fr/de/en e basta. Chi arrivava
  // con l'interfaccia in giapponese, arabo o russo leggeva l'inglese, e non
  // per una scelta ma perche quelle lingue nella mappa non c'erano.
  //
  // Era anche una SECONDA fonte di verita per gli stessi testi: la
  // stessa etichetta poteva vivere qui e nei pacchetti lingua, con due
  // parole diverse. Ora le chiavi sono quelle vere, in tutti e 15 i
  // pacchetti, e passano da `tI()` come tutto il resto della pagina —
  // che rispetta anche la lingua scelta da chi invita (b.115).

  // Shared button styles

  // ─── MANUAL JOIN (no invite link) ───
  if (!isInvited) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', padding: '20px 20px',
        background: C.bg, fontFamily: FONT, position: 'relative', overflowY: 'auto', overflowX: 'hidden',
      }}>
        {/* Ambient orb */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-30%', width: '70vw', height: '70vw',
          borderRadius: '50%', background: `radial-gradient(circle, ${C.purple}0A 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <GlassCard C={C}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            {/* b.482 — il tasto INDIETRO era 36 punti, sotto la misura minima
                per un dito: sale a 44 come nella cornice comune (b.481). */}
            <button onClick={() => { window.history.replaceState({}, '', window.location.pathname); setView('home'); setJoinCode(''); setInviteMsgLang(null); }}
              style={{
                width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
                background: `${C.accent}10`, border: `1px solid ${C.accent}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.textMuted, fontSize: 16, WebkitTapHighlightColor: 'transparent',
              }}>
              ‹
            </button>
            <div style={{ fontSize: 17, fontWeight: 500, color: C.textPrimary }}>{L('joinRoom')}</div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>{L('name')}</div>
            <input style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              background: C.input, border: `1px solid ${C.inputBorder}`,
              color: C.textPrimary, fontSize: 14, fontFamily: FONT, outline: 'none',
              boxSizing: 'border-box',
            }} placeholder={L('namePlaceholder')} value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>

          {/* Room code */}
          {/* b.248 — IL CAMPO ACCETTAVA 6 CARATTERI, IL CODICE NE HA 8.
              Il server genera il codice stanza con randomBytes(4)
              .toString('hex').toUpperCase() (createRoom, store.js): QUATTRO
              byte esadecimali = OTTO caratteri, sempre. Qui pero c'era
              maxLength={6} e il placeholder "ABC123": un codice reale come
              A4F72C19 si fermava a "A4F72C" e l'ingresso manuale era
              IMPOSSIBILE per costruzione. Ora il campo tiene 8 caratteri e
              l'esempio mostra la forma vera del codice. */}
          {/* b.488 — TAVOLA 15 DEL TEMPLATE: caselle, non un campo. «Si sa
              quanto e lungo il codice prima di cominciare a scriverlo.»
              La tavola le disegna per un codice da quattro; i codici veri
              ne hanno OTTO da sempre (b.248: randomBytes(4) in esadecimale)
              e le caselle sono quante i caratteri veri, dimensionate per
              stare in una riga. La digitazione passa da un input invisibile
              steso sopra la fila: cosi tastiera, incolla e correzione
              funzionano come prima, e le caselle sono solo il vestito. */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, color: C.textMuted, marginBottom: 12, textAlign: 'center' }}>{L('codeGiven')}</div>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                {Array.from({ length: 8 }, (_, i) => {
                  const pieno = joinCode[i] || '';
                  const attiva = i === joinCode.length;
                  return (
                    <span key={i} style={{
                      width: 36, height: 50, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 500, color: C.textPrimary, fontFamily: FONT,
                      background: attiva ? `${C.accent}1A` : C.input,
                      border: attiva ? `1px solid ${C.accent}` : `1px solid ${C.inputBorder}`,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}>{pieno}</span>
                  );
                })}
              </div>
              <input aria-label={L('roomCode')} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                value={joinCode} maxLength={8}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  opacity: 0, cursor: 'text', fontSize: 22, background: 'transparent',
                  border: 'none', outline: 'none', color: 'transparent', caretColor: 'transparent',
                }} />
            </div>
          </div>

          {/* Language */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>{L('yourLang')}</div>
            {/* b.535 — TendinaVetro al posto della select di sistema.
                L'ordine alfabetico di b.146 resta. */}
            <TendinaVetro
              valore={myLang}
              onScegli={(v) => { setMyLang(v); setPrefs(p => ({ ...p, lang: v })); }}
              targa={L('yourLang')}
              C={C}
              opzioni={[...LANGS].sort((a, b) => a.name.localeCompare(b.name, 'en')).map(l => ({ id: l.code, label: l.name, icona: l.flag }))}
              stile={{ width: '100%', padding: '12px 14px', borderRadius: 12,
                background: C.input, border: `1px solid ${C.inputBorder}`,
                color: C.textPrimary, fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          <PrimaryBtn C={C} FONT={FONT} onClick={() => { if (unlockAudio) unlockAudio(); savePrefs(prefs); handleJoinRoom(); }}
            disabled={joinCode.length < 8 || !prefs.name.trim()}>
            {L('enterRoom')} →
          </PrimaryBtn>

          {status && <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: C.red }}>{status}</div>}
        </GlassCard>

        <style>{`@keyframes vtScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

  // ─── SI ENTRA, NON SI CHIEDE (b.133) ───
  // Nessun modulo, nessun bottone: un solo respiro e si e dentro.
  if (entraDaSolo && !ingressoBloccato) {
    const bandiera = LANGS.find(l => l.code === myLang)?.flag || '';
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', padding: '20px 20px',
        background: C.bg, fontFamily: FONT, position: 'relative', overflowY: 'auto', overflowX: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '10%', width: '80vw', height: '80vw',
          borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}12 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          width: 64, height: 64, borderRadius: 32, marginBottom: 22,
          border: `2px solid ${C.accent}30`, borderTopColor: C.accent,
          animation: 'vtGira 0.9s linear infinite',
        }} />
        <div style={{ fontSize: 18, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>
          {bandiera} {prefs.name}
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', maxWidth: 300 }}>
          {tI('joining')}
        </div>
        {status && <div style={{ marginTop: 14, fontSize: 13, color: C.red }}>{status}</div>}
        <style>{`@keyframes vtGira { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── INSTANT JOIN: guest with pre-filled data from QR ───
  if (isInvited && isPrefilled) {
    const guestLangInfo = LANGS.find(l => l.code === myLang);
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', padding: '20px 20px',
        background: C.bg, fontFamily: FONT, position: 'relative', overflowY: 'auto', overflowX: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: '-10%', left: '10%', width: '80vw', height: '80vw',
          borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}12 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw',
          borderRadius: '50%', background: `radial-gradient(circle, ${C.purple}08 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />

        <GlassCard C={C} style={{ textAlign: 'center', maxWidth: 380 }}>
          {/* Invite image / welcome illustration */}
          {/* b.482 — questa casella era VUOTA: un riquadro di cento punti col
              bordo colorato e niente dentro, la prima cosa che vede chi apre
              un invito. Ci va la porta aperta, la stessa del primo passo. */}
          <div style={{
            width: 100, height: 100, borderRadius: 28, margin: '0 auto 20px',
            background: `linear-gradient(135deg, ${C.accent}20, ${C.purple}20)`,
            border: `2px solid ${C.accent}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
            boxShadow: `0 12px 40px ${C.accent}15`,
          }}>
            <Icon name="doorOpen" size={48} color={C.accent} />
          </div>

          {/* Minimal welcome — just name and big Chat button */}
          <div style={{
            fontSize: 20, fontWeight: 500, color: C.textPrimary, marginBottom: 8,
          }}>
            {guestLangInfo?.flag} {prefs.name}
          </div>

          <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 28 }}>
            {tI('invitedToTranslated')}
          </div>

          {/* ONE BIG BUTTON — just "Chat" */}
          <button onClick={() => {
            if (unlockAudio) unlockAudio();
            savePrefs(prefs);
            handleJoinRoom();
          }} style={{
            width: '100%', minHeight: 44, padding: '20px 24px', borderRadius: 20, border: 'none',
            background: `linear-gradient(135deg, ${C.accent} 0%, #1EB898 50%, ${C.purple} 100%)`,
            color: PALETTE.white, fontSize: 22, fontWeight: 500, fontFamily: FONT,
            cursor: 'pointer', letterSpacing: -0.3,
            boxShadow: `0 8px 32px ${C.accent}30, 0 4px 12px rgba(0,0,0,0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {tI('navChat')}
          </button>

          {status && <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: C.red }}>{status}</div>}
        </GlassCard>

        <style>{`@keyframes vtScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

  // ─── INVITED GUEST FLOW (3 steps) ───
  function handleNext() {
    if (guestStep === 0 && prefs.name.trim()) {
      setPrefs(p => ({ ...p, gender }));
      setGuestStep(1);
    } else if (guestStep === 1) {
      setGuestStep(2);
    }
  }

  function handleJoin() {
    if (unlockAudio) unlockAudio();
    setPrefs(p => ({ ...p, gender, autoPlay: audioAutoPlay, voice: selectedVoicePref }));
    savePrefs({ ...prefs, gender, autoPlay: audioAutoPlay, voice: selectedVoicePref });
    handleJoinRoom();
  }

  const canProceedStep0 = prefs.name.trim().length >= 1;
  const canJoin = joinCode.length >= 4 && prefs.name.trim();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', padding: '20px 20px',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'auto',
    }}>
      {/* Ambient orb */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-20%', width: '60vw', height: '60vw',
        borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: guestStep === i ? 24 : 8, height: 8, borderRadius: 4,
            background: guestStep === i
              ? `linear-gradient(135deg, ${C.accent}, ${C.purple})`
              : `${C.accent}20`,
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* ═══ STEP 0: Welcome + Name + Gender ═══ */}
      {guestStep === 0 && (
        <GlassCard C={C}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, margin: '0 auto 12px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              border: `1px solid ${C.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
            }}><Icon name="doorOpen" size={34} color={C.accent || 'rgba(255,255,255,0.4)'} /></div>
            <div style={{ fontSize: 19, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>
              {tI('inviteWelcome')}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
              {tI('inviteInstructions')}
            </div>
          </div>

          {/* Name input */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>{tI('name')} *</div>
            <input ref={nameInputRef} style={{
              width: '100%', fontSize: 18, fontWeight: 500, padding: '14px 16px',
              textAlign: 'center', borderRadius: 14, boxSizing: 'border-box',
              border: `2px solid ${prefs.name.trim() ? C.accent : C.inputBorder}`,
              background: C.input, color: C.textPrimary, fontFamily: FONT, outline: 'none',
              transition: 'border-color 0.2s',
            }} placeholder={tI('namePlaceholder')} value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>

          {/* Gender */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{tI('genderWord')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'male', icon: '♂', label: tI('maleWord') },
                { key: 'female', icon: '♀', label: tI('femaleWord') },
                { key: 'other', icon: '⚧', label: tI('otherWord') },
              ].map(g => (
                <button key={g.key} onClick={() => setGender(g.key)} style={{
                  flex: 1, minHeight: 44, padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
                  border: `2px solid ${gender === g.key ? C.accent : C.cardBorder}`,
                  background: gender === g.key ? `${C.accent}12` : 'transparent',
                  fontFamily: FONT, fontSize: 13, textAlign: 'center',
                  color: gender === g.key ? C.accent : C.textPrimary,
                  fontWeight: gender === g.key ? 600 : 400,
                  transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 2 }}>{g.icon}</div>
                  <div>{g.label}</div>
                </button>
              ))}
            </div>
          </div>

          <PrimaryBtn C={C} FONT={FONT} onClick={handleNext} disabled={!canProceedStep0} style={{ marginTop: 16 }}>
            {tI('continueWord')} →
          </PrimaryBtn>
        </GlassCard>
      )}

      {/* ═══ STEP 1: Language + Avatar ═══ */}
      {guestStep === 1 && (
        <GlassCard C={C}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: C.textPrimary }}>{tI('yourLang')}</div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>{tI('yourLangDesc')}</div>
          </div>

          {/* Language grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
            marginBottom: 18, maxHeight: 240, overflowY: 'auto', padding: 2,
          }}>
            {[...LANGS].sort((a, b) => a.name.localeCompare(b.name, 'en')).map(l => (
              <button key={l.code} onClick={() => { setMyLang(l.code); setPrefs(p => ({...p, lang: l.code})); }}
                style={{
                  minHeight: 44, padding: '10px 6px', borderRadius: 12, textAlign: 'center', cursor: 'pointer', fontFamily: FONT,
                  border: `2px solid ${myLang === l.code ? C.accent : 'transparent'}`,
                  background: myLang === l.code ? `${C.accent}12` : `rgba(255,255,255,0.03)`,
                  color: C.textPrimary, fontSize: 11, fontWeight: myLang === l.code ? 600 : 400,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{l.flag}</div>
                <div style={{ lineHeight: 1.2 }}>{l.name}</div>
              </button>
            ))}
          </div>

          {/* Avatar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{tI('avatarWord')}</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {AVATARS.map((av, i) => (
                <div key={i} onClick={() => setPrefs(p => ({...p, avatar: av}))}
                  style={{
                    cursor: 'pointer', flexShrink: 0, minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    opacity: prefs.avatar === av ? 1 : 0.5,
                    transform: prefs.avatar === av ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.2s',
                  }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 23,
                    border: `2px solid ${prefs.avatar === av ? C.accent : 'transparent'}`,
                    overflow: 'hidden',
                  }}>
                    <AvatarImg src={av} size={46} />
                  </div>
                  <div style={{ fontSize: 8, color: prefs.avatar === av ? C.accent : C.textMuted }}>{AVATAR_NAMES[i]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setGuestStep(0)} style={{
              width: 48, height: 48, borderRadius: 14, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${C.cardBorder}`,
              color: C.textMuted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>←</button>
            <PrimaryBtn C={C} FONT={FONT} onClick={handleNext} style={{ flex: 1 }}>
              {tI('continueWord')} →
            </PrimaryBtn>
          </div>
        </GlassCard>
      )}

      {/* ═══ STEP 2: Audio + Voice + Join ═══ */}
      {guestStep === 2 && (
        <GlassCard C={C}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: C.textPrimary }}>{tI('audioPrefs')}</div>
          </div>

          {/* Auto-play toggle */}
          {/* b.482 — l'interruttore restava alto 26 punti, meta del bersaglio
              minimo. La levetta si vede uguale a prima: cio che cresce e la
              zona che risponde al dito, un bordo trasparente tutto intorno
              che i margini negativi riassorbono, cosi la riga non si muove. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', background: `rgba(255,255,255,0.03)`, borderRadius: 14, marginBottom: 12,
            border: `1px solid ${C.cardBorder}`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>{tI('autoPlayLabel')}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{tI('autoPlayDesc')}</div>
            </div>
            <button onClick={() => setAudioAutoPlay(!audioAutoPlay)} style={{
              width: 48, height: 26, boxSizing: 'content-box', padding: 9, margin: -9,
              borderRadius: 22, border: 'none', cursor: 'pointer',
              background: audioAutoPlay ? C.accent : `rgba(255,255,255,0.1)`,
              backgroundClip: 'content-box',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 10, background: PALETTE.white,
                position: 'absolute', top: 12,
                left: audioAutoPlay ? 34 : 12, transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* Voice grid */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{tI('transVoice')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {VOICES.map(v => (
                <button key={v} onClick={() => setSelectedVoicePref(v)} style={{
                  minHeight: 44, padding: '10px 6px', borderRadius: 12, textAlign: 'center', cursor: 'pointer', fontFamily: FONT,
                  border: `2px solid ${selectedVoicePref === v ? C.accent : 'transparent'}`,
                  background: selectedVoicePref === v ? `${C.accent}12` : `rgba(255,255,255,0.03)`,
                  color: selectedVoicePref === v ? C.accent : C.textPrimary,
                  fontSize: 12, fontWeight: selectedVoicePref === v ? 600 : 400,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>
                    {v === 'nova' || v === 'shimmer' || v === 'fable' ? '♀' : '♂'}
                  </div>
                  <div style={{ textTransform: 'capitalize' }}>{v}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: C.textMuted, textAlign: 'center', marginTop: 4 }}>{tI('changeVoiceLater')}</div>
          </div>

          {/* Edge TTS gender */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 20px', background: `rgba(255,255,255,0.03)`, borderRadius: 12, marginBottom: 14,
            border: `1px solid ${C.cardBorder}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary }}>{tI('freeVoiceEdge')}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['female', 'male'].map(g => (
                <button key={g} onClick={() => setPrefs(p => ({...p, edgeTtsVoiceGender: g}))} style={{
                  minHeight: 44, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: FONT, fontSize: 11,
                  background: (prefs.edgeTtsVoiceGender || 'female') === g ? C.accent : 'transparent',
                  color: (prefs.edgeTtsVoiceGender || 'female') === g ? PALETTE.white : C.textMuted,
                  fontWeight: (prefs.edgeTtsVoiceGender || 'female') === g ? 600 : 400,
                }}>
                  {g === 'female' ? '♀' : '♂'} {g === 'female' ? tI('femaleWord') : tI('maleWord')}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={{
            background: `${C.accent}10`, borderRadius: 14, padding: '12px 20px',
            marginBottom: 8, border: `1px solid ${C.accent}15`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
                <AvatarImg src={prefs.avatar} size={40} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary }}>{prefs.name || '...'}</div>
                <div style={{ fontSize: 11, color: C.textSecondary }}>
                  {LANGS.find(l => l.code === myLang)?.flag} {LANGS.find(l => l.code === myLang)?.name}
                  {gender && ` · ${gender === 'male' ? '♂' : gender === 'female' ? '♀' : '⚧'}`}
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.accent, fontWeight: 500 }}>
                {AVATAR_NAMES[AVATARS.indexOf(prefs.avatar)] || ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setGuestStep(1)} style={{
              width: 48, height: 48, borderRadius: 14, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${C.cardBorder}`,
              color: C.textMuted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>←</button>
            <PrimaryBtn C={C} FONT={FONT} onClick={handleJoin} disabled={!canJoin} style={{ flex: 1 }}>
              {tI('inviteJoinBtn') || tI('joinChat')}
            </PrimaryBtn>
          </div>

          {!userToken && (
            <button style={{
              marginTop: 10, background: 'none', border: 'none', color: C.textMuted,
              fontSize: 11, cursor: 'pointer', fontFamily: FONT, padding: 6, minHeight: 44,
              textDecoration: 'underline', width: '100%', textAlign: 'center',
            }} onClick={() => setShowInvitePopup(true)}>
              {tI('inviteInfoLink')}
            </button>
          )}

          {status && <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: C.red }}>{status}</div>}
        </GlassCard>
      )}

      {/* Info popup */}
      {showInvitePopup && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setShowInvitePopup(false)}>
          <div style={{
            background: C.card, borderRadius: 22, padding: '24px 20px', maxWidth: 360, width: '100%',
            border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
            boxShadow: '0 20px 60px -15px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            {/* b.482 — anche qui la casella d'icona era rimasta vuota. La
                finestra parla dell'account personale: ci va la persona. */}
            <div style={{
              width: 56, height: 56, borderRadius: 18, margin: '0 auto 12px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>
              <Icon name="user" size={26} color={C.accent} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, color: C.textPrimary, textAlign: 'center', marginBottom: 10 }}>
              {tI('invitePopupTitle')}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
              {tI('invitePopupDesc')}
            </div>
            <div style={{
              fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 14,
              padding: '10px 20px', background: `${C.purple}10`, borderRadius: 12,
              border: `1px solid ${C.purple}15`,
            }}>
              {tI('invitePopupFeatures')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <PrimaryBtn C={C} FONT={FONT} onClick={() => { setShowInvitePopup(false); setView('account'); setAuthStep('email'); }}
                style={{ flex: 1, fontSize: 13 }}>
                {tI('invitePopupCreateAccount')}
              </PrimaryBtn>
              <button style={{
                flex: 1, minHeight: 44, padding: '10px 14px', borderRadius: 14,
                border: `1px solid ${C.cardBorder}`, background: 'transparent',
                color: C.textPrimary, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
              }} onClick={() => setShowInvitePopup(false)}>
                {tI('invitePopupJoinNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes vtScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
