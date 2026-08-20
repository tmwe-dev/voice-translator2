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
import { IconQR, IconCar } from './Icons.js';
import Icon from './Icon.js';
import CarouselLingue from './CarouselLingue.js';
import { BatteryPillSlot } from './BatteryPill.js';
import PrimaProva, { riapriPrimaProva } from './PrimaProva.js'; // b.96 → b.356 "Parla ora"
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
  // b.356 — il traduttore "Parla ora" sta CHIUSO dietro la sua icona
  // (collaudo di Luca): niente piu apertura automatica al primo avvio.
  const [mostraPrimaProva, setMostraPrimaProva] = useState(false);

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

  // b.356 — la "luce che segue il mouse" di b.354 e stata tolta insieme
  // alle card: le voci sono icone nude, non hanno piu una superficie.

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

        {/* ═══ Header ═══
            b.356 — collaudo di Luca: «sposta nell'angolo in alto il numero
            versione, la batteria nell'angolo a destra e fai che non spinga
            in basso nessun elemento, elimina padding inutili». I due
            distintivi ora GALLEGGIANO agli angoli: non occupano una riga,
            il titolo sale, la descrizione gli sta subito sotto. */}
        <div style={{ marginBottom: 10, position: 'relative', width: '100%', flexShrink: 0 }}>
          {/* b.265 — numero di rilascio, nell'angolo in alto a sinistra */}
          <span
            aria-label={`rilascio numero ${PUSH}`}
            style={{
              position: 'absolute', top: 0, left: 0, zIndex: 3,
              fontFamily: FONT, fontSize: 11, fontWeight: 700, lineHeight: 1,
              color: C.accent, background: C.cardBg,
              border: `1px solid ${C.accent}40`, borderRadius: 8,
              padding: '5px 7px', letterSpacing: 0.3,
              userSelect: 'text',
            }}
          >#{PUSH}</span>
          {/* la batteria del credito, nell'angolo in alto a destra */}
          <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 3 }}>
            <BatteryPillSlot />
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.5,
            color: C.textPrimary, fontFamily: FONT,
            margin: 0, lineHeight: 1.2, textAlign: 'center',
            /* i due angoli sono occupati dai distintivi: il titolo non ci finisce sotto */
            padding: '0 56px',
          }}>
            {L('homeTitle')}
          </h1>

          {/* Striscia dei fatti: arricchisce senza appesantire */}
          <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
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

        {/* ── b.356 — "PARLA ORA" A PAGINA PIENA ──
            Aperto, il traduttore NASCONDE tutto il resto (collaudo di Luca:
            «nasconde le altre parti e i pulsanti e occupa la pagina per
            permettere la traduzione e la visualizzazione ampia»). La ✕
            riporta alla home normale. */}
        {mostraPrimaProva ? (
          <PrimaProva onChiudi={() => setMostraPrimaProva(false)} />
        ) : (<>

        {/* b.354 — IL CAROSELLO DELLE BANDIERE (Wueform) al posto della
            dropdown: la lingua si sceglie qui, sotto il titolo. */}
        <div style={{ margin: '18px 0 6px' }}>
          <CarouselLingue
            selezionata={prefs.lang}
            onScegli={scegliLingua}
            onLinguaMenu={() => { vibrate(); setView('settings'); }}
            C={C} L={L} />
        </div>

        {/* b.356 — l'icona "Parla ora": il traduttore sta chiuso qui
            dietro e quando si apre prende la pagina intera. */}
        {(
          <button
            onClick={() => { vibrate(); riapriPrimaProva(); setMostraPrimaProva(true); }}
            aria-label={L('speakNowTitle')}
            title={L('speakNowTitle')}
            style={{
              margin: '0 auto 12px', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{
              width: 42, height: 42, borderRadius: 21,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.cardBg, border: `1px solid ${C.cardBorder}`,
            }}>
              <Icon name="mic" size={18} color={C.accent} />
            </span>
            <span style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 700, color: C.textMuted }}>
              {L('speakNowTitle')}
            </span>
          </button>
        )}
        {/* ── FINE b.96 ── */}

        {/* ═══ b.356 — LE VOCI DELLA HOME COME ICONE ═══
            Collaudo di Luca: «tutti i tasti della home possono diventare
            icone con descrizione sotto, senza pulsante: cosi e piu pulita».
            Niente piu card una sotto l'altra: una griglia di icone nude,
            titolo e descrizione sotto, tutto centrato. */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '18px 10px', width: '100%', margin: '10px 0 20px', flexShrink: 0,
        }}>
          {[
            ...ACTIONS,
            { id: 'mondo', icon: 'globe', titleKey: 'worldNowTitle', descKey: 'worldNowDesc' },
            { id: 'life', icon: 'star', titleKey: 'lifeEntry', descKey: 'lifeEntryDesc' },
            { id: 'business', icon: 'credit', titleKey: 'businessEntry', descKey: 'businessEntryDesc' },
            GIFT,
          ].map((voce) => (
            <button
              key={voce.id}
              onClick={() => {
                if (voce.id === 'mondo') { vibrate(); setView('mondo'); return; }
                if (voce.id === 'life') { vibrate(); setView('life'); return; }
                if (voce.id === 'business') { vibrate(); setView('business'); return; }
                handleAction(voce.id);
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                background: 'none', border: 'none', padding: '4px 2px',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                minHeight: 96, opacity: 1,
              }}
            >
              <span style={{
                width: 54, height: 54, borderRadius: 16, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
                background: voce.primary ? `linear-gradient(145deg, ${C.accent}, ${C.accent2})` : C.cardBg,
                border: voce.primary ? 'none' : `1px solid ${C.cardBorder}`,
                color: voce.primary ? '#fff' : C.textSecondary,
                boxShadow: voce.primary ? `0 4px 14px -4px ${C.accent}70` : 'none',
              }}>
                {/* b.356 — icone parlanti (Luca): il QR per chi hai davanti,
                    l'invito che parte, il taxi GIALLO, le persone del gruppo. */}
                {voce.icon === 'qr' ? <IconQR size={26} />
                  : voce.icon === 'mail' ? <Icon name="share" size={26} color={C.accent} />
                  : voce.icon === 'car' ? <span style={{ color: '#ffc44d', lineHeight: 0 }}><IconCar size={26} /></span>
                  : voce.icon === 'chat' ? <Icon name="users" size={26} color={C.textPrimary} />
                  : voce.icon === 'globe' ? <Icon name="globe" size={26} color={C.accent} />
                  : voce.icon === 'star' ? <Icon name="star" size={26} color={C.accent} />
                  : voce.icon === 'credit' ? <Icon name="credit" size={26} color={C.accent} />
                  : <Icon name="gift" size={26} color={C.accent} />}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, fontFamily: FONT, textAlign: 'center', lineHeight: 1.2 }}>
                {voce.title || L(voce.titleKey)}
              </span>
              <span style={{ fontSize: 10.5, color: C.textMuted, fontFamily: FONT, textAlign: 'center', lineHeight: 1.35 }}>
                {L(voce.descKey)}
              </span>
            </button>
          ))}
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

        </>)}

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
