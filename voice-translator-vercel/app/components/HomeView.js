'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { FONT, getLang, LANGS, vibrate, PUSH } from '../lib/constants.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
// b.254 — `t` e `mapLang` servono all'avviso della lingua: il messaggio si
// scrive nella lingua NUOVA, altrimenti annuncerebbe il cambio in quella
// vecchia. `toast` e la coda avvisi (lib/avvisi.js), non il disegno.
import { t, mapLang, preloadLang } from '../lib/i18n.js';
import { toast } from '../lib/avvisi.js';
import { IconQR, IconMail, IconVideoCall, IconCar } from './Icons.js';
import Icon from './Icon.js';
import CarouselLingue from './CarouselLingue.js';
import { BatteryPillSlot } from './BatteryPill.js';
import PrimaProva, { primaProvaGiaFatta, riapriPrimaProva } from './PrimaProva.js'; // b.96
import { memGet, memSet } from '../lib/memoria.js';

// ═══════════════════════════════════════
// Theme palette (multi-theme support)
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// Action card data
// ═══════════════════════════════════════
// ── b.138 · le sei porte non erano piu in italiano per tutti ──
//
// Qui c'erano titoli e descrizioni scritti a mano ("Parla con chi hai
// davanti", "Invia un link via WhatsApp, SMS o email"...). Un cinese o
// un tedesco che apriva l'app trovava la schermata principale — quella
// da cui passa TUTTO — in italiano, anche dopo aver scelto la propria
// lingua dell'interfaccia. Ora l'elenco porta solo i nomi delle chiavi
// e il testo lo mette L() al momento del disegno.
// ── b.183 — la home aveva troppe porte ──
// Via la videochiamata come voce a se: non si lancia dalla home, si
// chiama da dentro la chat/contatti. Il regalo esce dall'elenco e va in
// fondo, staccato, col fiocco (vedi GIFT sotto). Restano le porte che
// servono davvero all'inizio: parlare con chi hai davanti, invitare,
// TaxiTalk, e la stanza.
const ACTIONS = [
  {
    id: 'face-to-face',
    icon: 'qr',
    titleKey: 'actFaceTitle',
    descKey: 'actFaceDesc',
    primary: true,
  },
  {
    id: 'invite',
    icon: 'mail',
    titleKey: 'actInviteTitle',
    descKey: 'actInviteDesc',
  },
  {
    id: 'taxitalk',
    icon: 'car',
    // TaxiTalk e un nome proprio: non si traduce, e infatti non e una chiave.
    title: 'TaxiTalk',
    descKey: 'actTaxiDesc',
  },
  {
    // b.102 — porta separata dalla videochiamata a due, che resta com'e.
    // b.194 — non e piu una "stanza video": e una chat di gruppo che
    // dentro puo diventare video (icona a fumetto, copy aggiornata).
    id: 'stanza-video',
    icon: 'chat',
    titleKey: 'actRoomTitle',
    descKey: 'actRoomDesc',
  },
];

// b.183 — il regalo, in fondo e col fiocco. Resta una voce della Home
// (id 'regala', porta a 'credits' dove i minuti si scalano), ma staccato
// dalle azioni principali: e un pensiero per qualcun altro, non una
// funzione che usi per te.
const GIFT = {
  id: 'regala',
  icon: 'gift',
  titleKey: 'actGiftTitle',
  descKey: 'actGiftDesc',
};



const HomeView = memo(function HomeView({ selectedMode, setSelectedMode,
  selectedContext, setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom,
  contacts, fetchContacts, rejoinRoom, startChatWithContact, unlockAudio }) {
  const { L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, setView, theme, setTheme } = useApp();

  const [activeRooms, setActiveRooms] = useState([]);
  // b.96 — la prima prova si mostra una volta sola, e solo al primo avvio
  const [mostraPrimaProva, setMostraPrimaProva] = useState(false);
  useEffect(() => { setMostraPrimaProva(!primaProvaGiaFatta()); }, []);

  // I colori vengono dal tema attivo: un'unica verità, sei temi coerenti
  const C = useMemo(() => ({
    accent: S.colors.accent1, accent2: S.colors.accent2, accent3: S.colors.accent3,
    textPrimary: S.colors.textPrimary, textSecondary: S.colors.textSecondary,
    textMuted: S.colors.textMuted, cardBg: S.colors.cardBg, cardBorder: S.colors.cardBorder,
  }), [S]);

  // Check active rooms on mount
  useEffect(() => {
    async function checkActiveRooms() {
      try {
        let saved; try { saved = JSON.parse(memGet('vt-active-rooms') || '[]'); } catch { saved = []; }
        if (saved.length === 0) { setActiveRooms([]); return; }
        // ── b.116 · una stanza si toglie solo se il server LO DICE ──
        //
        // Prima bastava che il controllo fallisse — rete incerta, 401,
        // limite di frequenza — perche la riga sparisse: il `catch { /* risposta illeggibile: la stanza si conserva, non si cancella nel dubbio */ }`
        // si mangiava l'errore, la stanza non finiva in `checked`, e
        // subito dopo `checked` veniva SCRITTO SOPRA l'elenco salvato.
        // Un singhiozzo di rete e la conversazione lasciata a meta era
        // persa per sempre, senza un avviso.
        //
        // Ora il dubbio conserva. Si toglie una stanza solo quando la
        // risposta arriva davvero e dice "non esiste" o "e finita".
        const rimaste = [];
        for (const room of saved) {
          try {
            const res = await fetch('/api/room', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'check', roomId: room.roomId })
            });
            if (!res.ok) { rimaste.push(room); continue; }   // non si sa: si tiene
            const data = await res.json();
            const spenta = data && (data.exists === false || data.ended === true);
            if (!spenta) rimaste.push(room);
          } catch {
            rimaste.push(room);   // rete incerta: si tiene
          }
        }
        memSet('vt-active-rooms', JSON.stringify(rimaste));
        setActiveRooms(rimaste);
      } catch { /* memoria del browser piena o navigazione privata: si prosegue senza salvare */ }
    }
    checkActiveRooms();
  }, []);

  // Handle action card clicks
  function handleAction(actionId) {
    vibrate();
    if (unlockAudio) unlockAudio();
    switch (actionId) {
      case 'face-to-face':
        handleCreateRoom();
        break;
      case 'invite':
        setView('quickinvite');
        break;
      case 'taxitalk':
        setView('speaker');
        break;
      case 'stanza-video':
        // Serve una stanza prima di poterci stare in video: si crea, e
        // dalla sala d'attesa si entra col codice da condividere.
        handleCreateRoom();
        break;
      case 'regala':
        // La pagina del credito e gia il posto giusto: c'e il saldo, e i
        // minuti regalati si scalano da li. Non serve una schermata nuova.
        setView('credits');
        break;
    }
  }

  // b.354 — la scelta lingua (con la regola b.254: i menu seguono la
  // lingua parlata finche l'utente non li ha scelti a mano) e diventata
  // una funzione: la usa il carosello, non piu la dropdown demolita.
  const scegliLingua = (l) => {
    vibrate();
    const prima = prefs.uiLang || mapLang(prefs.lang || 'en');
    const dopo = mapLang(l.code);
    const nuove = prefs.uiLangScelta
      ? { ...prefs, lang: l.code }
      : { ...prefs, lang: l.code, uiLang: dopo };
    savePrefs(nuove);
    if (!prefs.uiLangScelta && dopo !== prima) {
      const nomePrima = getLang(prima)?.name || prima;
      preloadLang(dopo).finally(() =>
        toast.info(`${t(dopo, 'uiLanguage')}: ${getLang(dopo)?.name || dopo}`, {
          duration: 8000,
          action: {
            label: `${t(dopo, 'cancelWord')} (${nomePrima})`,
            onClick: () => savePrefs({ ...nuove, uiLang: prima, uiLangScelta: true }),
          },
        }));
    }
  };

  // b.354 — LA LUCE CHE SEGUE IL MOUSE (Wueform, tema scuro): un'area
  // illuminata al centro dei tasti che si muove col puntatore. Handler
  // condivisi: si appoggiano a variabili CSS sul contenitore.
  const luce = {
    onMouseMove: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--lx', `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty('--ly', `${e.clientY - r.top}px`);
    },
    onMouseEnter: (e) => e.currentTarget.style.setProperty('--lo', '1'),
    onMouseLeave: (e) => e.currentTarget.style.setProperty('--lo', '0'),
  };
  const veloLuce = (
    <span aria-hidden style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
      opacity: 'var(--lo, 0)', transition: 'opacity .35s',
      background: `radial-gradient(200px circle at var(--lx, 50%) var(--ly, 50%), ${C.accent}1f, transparent 70%)`,
    }} />
  );

  return (
    <main style={S.page} aria-label={L('homeAria')}>
      <div style={{
        ...S.scrollCenter,
        display: 'flex', flexDirection: 'column',
        // ── b.218 — la home non scrollava ──
        // S.scrollCenter è già `height:100%` (del genitore fisso S.page) con
        // overflowY:auto: il pattern che scorre. Qui sopra c'era
        // `minHeight:100dvh`, che FORZAVA il contenitore a crescere col
        // contenuto oltre il viewport: così overflow:auto non si attivava mai
        // e S.page (overflow:hidden) tagliava il resto — pagina bloccata.
        // Tolto il minHeight. E il `padding:'0 20px'` shorthand cancellava il
        // fondo (88px per la BottomNav): ora solo left/right, il fondo resta.
        boxSizing: 'border-box',
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 100,
        paddingLeft: 20, paddingRight: 20,
        /* Colonna unica allineata: su desktop niente card che dilagano */
        width: '100%', maxWidth: 680, margin: '0 auto',
      }}>

        {/* ═══ Header ═══ */}
        <div style={{ paddingTop: 'max(24px, env(safe-area-inset-top))', marginBottom: 24 }}>
          {/* Language selector + batteria credito */}
          <div style={{ position: 'relative', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* b.191 — icona in alto a sinistra che porta al Mondo (Luca) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* b.265 — numero di rilascio: si vede subito se la pagina
                  davanti agli occhi e gia quella nuova. Aumenta di uno a
                  ogni push (PUSH in constants.js). */}
              <span
                aria-label={`rilascio numero ${PUSH}`}
                style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 700, lineHeight: 1,
                  color: C.accent, background: C.cardBg,
                  border: `1px solid ${C.accent}40`, borderRadius: 8,
                  padding: '5px 7px', flexShrink: 0, letterSpacing: 0.3,
                  userSelect: 'text',
                }}
              >#{PUSH}</span>
{/* b.354 — il mondo NON sta piu qui in alto (Luca: «non c'e nelle
                  altre pagine»): la sua icona vive nella carta "Il mondo ora". */}
              <BatteryPillSlot />
            </div>
{/* b.354 — la dropdown e stata sostituita dal CAROSELLO delle
                bandiere copiato da Wueform: vive sotto il titolo. */}

          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.5,
            color: C.textPrimary, fontFamily: FONT,
            margin: 0, lineHeight: 1.2,
          }}>
            {L('homeTitle')}
          </h1>

          {/* Striscia dei fatti: arricchisce senza appesantire */}
          <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
            {/* Il numero si conta, non si scrive: diceva 32 quando erano 44.
                b.138 — le tre etichette erano in italiano fisso: chi aveva
                l'interfaccia in inglese leggeva "44 lingue · Crittografia
                E2E · Voce naturale" sotto un titolo tradotto. */}
            {[`${LANGS.length} ${L('landingStatLangs')}`, L('e2eTitle'), L('homeFactVoice')].map(f => (
              <span key={f} style={{
                fontSize: 11, fontWeight: 650, color: C.textMuted, fontFamily: FONT,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: C.accent2, display: 'inline-block' }} />
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* b.354 — IL CAROSELLO DELLE BANDIERE (Wueform) al posto della
            dropdown: la lingua si sceglie qui, sotto il titolo. */}
        <div style={{ margin: '18px 0 6px' }}>
          <CarouselLingue
            selezionata={prefs.lang}
            onScegli={scegliLingua}
            onLinguaMenu={() => { vibrate(); setView('settings'); }}
            C={C} L={L} />
        </div>

        {/* ── INIZIO b.96 — la prima traduzione, entro dieci secondi ──
            Il primo avvio era: benvenuto, sei dentro, arrangiati. Chi non
            prova nei primi secondi non torna. Questa scheda fa SENTIRE
            l'app invece di spiegarla, e poi sparisce per sempre. */}
        {mostraPrimaProva ? (
          <PrimaProva
            onChiudi={() => setMostraPrimaProva(false)}
            onIniziaDavvero={() => handleAction('face-to-face')}
          />
        ) : (
          /* b.266 — quando il blocco e chiuso resta questa riga: e la prova
             audio immediata, e senza di lei l'unico modo di riaverla era
             svuotare la memoria del browser. */
          <button
            onClick={() => { vibrate(); riapriPrimaProva(); setMostraPrimaProva(true); }}
            style={{
              width: '100%', margin: '0 0 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'none', border: `1px dashed ${C.accent}35`, borderRadius: 14,
              padding: '9px 12px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.accent,
            }}
          >
            <Icon name="speaker" size={14} color={C.accent} />
            {L('hearItWork')}
          </button>
        )}
        {/* ── FINE b.96 ── */}

        {/* ═══ Le 4 azioni: righe in UNA card (spec sciame) ═══
            Tile gradiente solo sulla primaria; le altre tenui.
            Compatta, leggibile, zero card che dilagano. */}
        <div {...luce} style={{
          background: C.cardBg, border: `1px solid ${C.cardBorder}`,
          borderRadius: 18, padding: '2px 14px', marginBottom: 12,
          position: 'relative', overflow: 'hidden',
        }}>
          {veloLuce}
          {ACTIONS.map((action, idx) => {
            const tilePieno = !!action.primary;
            // b.354 — ogni azione ha il SUO colore: tessere grandi, gradiente
            // acceso, riflesso in alto e ombra portata — l'effetto 3D chiesto.
            const TINTE = {
              qr: ['#5b8cff', '#38e1ff'], mail: ['#a855f7', '#ec4899'],
              video: ['#f97316', '#ffc44d'], chat: ['#3ddc84', '#38e1ff'],
              gift: ['#ec4899', '#ffc44d'], taxi: ['#ffc44d', '#f97316'],
            };
            const [t1, t2] = TINTE[action.icon] || [C.accent, C.accent2];
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '13px 2px', background: 'none', textAlign: 'left',
                  border: 'none', cursor: 'pointer',
                  borderBottom: idx < ACTIONS.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                  transition: 'opacity 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = 0.82}
                onMouseOut={(e) => e.currentTarget.style.opacity = 1}
              >
                <span style={{
                  width: 52, height: 52, borderRadius: 15, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
                  background: `linear-gradient(150deg, ${t1}, ${t2})`,
                  border: 'none', color: '#fff', position: 'relative',
                  boxShadow: `0 6px 16px -5px ${t1}90, inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.25)`,
                }}>
                  {action.icon === 'qr' ? <IconQR size={26} />
                    : action.icon === 'mail' ? <IconMail size={26} />
                    : action.icon === 'video' ? <IconVideoCall size={26} />
                    : action.icon === 'gift' ? <Icon name="gift" size={26} color="#fff" />
                    : action.icon === 'chat' ? <Icon name="chat" size={26} color="#fff" />
                    : <IconCar size={26} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
                    {action.title || L(action.titleKey)}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
                    {L(action.descKey)}
                  </span>
                </span>
                <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>›</span>
              </button>
            );
          })}
        </div>

        {/* ═══ Il mondo ora — la Community come riga viva ═══ */}
        <div {...luce} style={{
          background: C.cardBg, border: `1px solid ${C.cardBorder}`,
          borderRadius: 18, padding: '2px 14px', marginBottom: 20,
          position: 'relative', overflow: 'hidden',
        }}>
          {veloLuce}
          <button
            onClick={() => { vibrate(); setView('mondo'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '13px 2px', background: 'none', textAlign: 'left',
              border: 'none', cursor: 'pointer',
            }}
          >
            {/* b.354 — il MONDO, sceso dalla testata: la sua icona vive qui,
                in tessera colorata come le azioni in alto. */}
            <span style={{
              width: 52, height: 52, borderRadius: 15, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(150deg, #38e1ff, #5b8cff)`, color: '#fff',
              boxShadow: '0 6px 16px -5px #38e1ff90, inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.25)',
            }}>
              <Icon name="globe" size={26} color="#fff" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
                {L('worldNowTitle')}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
                {L('worldNowDesc')}
              </span>
            </span>
            <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>›</span>
          </button>
        </div>

        {/* ═══ b.198 · Life — Podcast, tutor e corsi coi Compagni ═══ */}
        <div {...luce} style={{
          background: C.cardBg, border: `1px solid ${C.cardBorder}`,
          borderRadius: 18, padding: '2px 14px', marginBottom: 20,
          position: 'relative', overflow: 'hidden',
        }}>
          {veloLuce}
          <button
            onClick={() => { vibrate(); setView('life'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '13px 2px', background: 'none', textAlign: 'left',
              border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0, width: 40, justifyContent: 'center' }}>
              <Icon name="star" size={20} color={C.accent1 || C.accent} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
                {L('lifeEntry')}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
                {L('lifeEntryDesc')}
              </span>
            </span>
            <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>›</span>
          </button>
        </div>

        {/* ═══ b.346 · Business — sezione parallela per gli strumenti di
            lavoro (primo: il BizCard Scanner intero, copiato verbatim) ═══ */}
        <div {...luce} style={{
          background: C.cardBg, border: `1px solid ${C.cardBorder}`,
          borderRadius: 18, padding: '2px 14px', marginBottom: 20,
          position: 'relative', overflow: 'hidden',
        }}>
          {veloLuce}
          <button
            onClick={() => { vibrate(); setView('business'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '13px 2px', background: 'none', textAlign: 'left',
              border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0, width: 40, justifyContent: 'center' }}>
              <Icon name="credit" size={20} color={C.accent2 || C.accent} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
                {L('businessEntry')}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
                {L('businessEntryDesc')}
              </span>
            </span>
            <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>›</span>
          </button>
        </div>

        {/* ═══ Active Rooms ═══ */}
        {activeRooms.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.textMuted,
              letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT, marginBottom: 10,
            }}>
              {L('activeChats')}
            </div>
            {activeRooms.map((room) => {
              const timeAgo = Math.floor((Date.now() - room.leftAt) / 60000);
              const timeStr = timeAgo < 1 ? L('timeNow') : timeAgo < 60 ? `${timeAgo}m` : `${Math.floor(timeAgo / 60)}h`;
              return (
                <div key={room.roomId}
                  onClick={() => { vibrate(); if (rejoinRoom) rejoinRoom(room.roomId); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    marginBottom: 8, borderRadius: 14,
                    background: C.cardBg, border: `1px solid ${C.cardBorder}`,
                    cursor: 'pointer', fontFamily: FONT,
                    transition: 'background-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, fontSize: 16 }}>
                    {[...new Set(room.members?.map(m => getLang(m.lang).flag) || [])].map((flag, i) => (
                      <span key={i}>{flag}</span>
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: C.textPrimary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {room.members?.map(m => m.name).join(', ') || room.roomId}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{timeStr}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ b.183 — Il regalo, in fondo, col fiocco ═══ */}
        <button
          onClick={() => handleAction(GIFT.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            padding: '13px 16px', marginTop: 'auto', marginBottom: 8,
            background: `linear-gradient(135deg, ${C.accent}0F, ${C.accent2}0A)`,
            border: `1px solid ${C.accent}25`, borderRadius: 16,
            cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
            transition: 'opacity 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = 0.85}
          onMouseOut={(e) => e.currentTarget.style.opacity = 1}
        >
          <span style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
            background: `${C.accent}18`, border: `1px solid ${C.accent}30`,
          }}>
            {/* il fiocco: l'icona regalo */}
            <Icon name="gift" size={20} color={C.accent} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
              {L(GIFT.titleKey)}
            </span>
            <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
              {L(GIFT.descKey)}
            </span>
          </span>
          <span style={{ color: C.accent, fontSize: 14, flexShrink: 0 }}>›</span>
        </button>

      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </main>
  );
});

export default HomeView;
