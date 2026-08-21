'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { FONT, getLang, vibrate, PUSH } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
// b.254 — `t` e `mapLang` servono all'avviso della lingua: il messaggio si
// scrive nella lingua NUOVA, altrimenti annuncerebbe il cambio in quella
import { t, mapLang, preloadLang } from '../lib/i18n.js';
import { IconQR, IconCar } from './Icons.js';
import Icon from './Icon.js';
import CarouselLingue from './CarouselLingue.js';
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
// fondo, staccato, col fiocco (ora e una riga di SEZIONI). Restano le porte che
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

// b.358 — LE SEZIONI: dove si va, non come si parla. Sono righe larghe in
// una sola card (Luca: «allargali come prima per differenziarli dai
// pulsanti della barra»). Le PORTE per parlare stanno invece dietro il
// barcode grande, tutte insieme.
// b.360 — le immagini metalliche di Luca al posto delle icone (globo per il
// Mondo, trofeo per Life, carta per Business, pacco per Regala). Hanno lo
// sfondo trasparente, quindi vivono sul tema scuro senza riquadro.
const SEZIONI = [
  { id: 'mondo', vista: 'mondo', img: '/sezioni/sez-mondo.webp', titleKey: 'worldNowTitle', descKey: 'worldNowDesc' },
  { id: 'life', vista: 'life', img: '/sezioni/sez-life.webp', titleKey: 'lifeEntry', descKey: 'lifeEntryDesc' },
  { id: 'business', vista: 'business', img: '/sezioni/sez-business.webp', titleKey: 'businessEntry', descKey: 'businessEntryDesc' },
  { id: 'regala', img: '/sezioni/sez-regala.webp', titleKey: 'actGiftTitle', descKey: 'actGiftDesc' },
];



const HomeView = memo(function HomeView({ selectedMode, setSelectedMode,
  selectedContext, setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom,
  contacts, fetchContacts, rejoinRoom, startChatWithContact, unlockAudio }) {
  const { L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, setView, theme, setTheme } = useApp();

  const [activeRooms, setActiveRooms] = useState([]);
  // b.356 — il traduttore "Parla ora" sta CHIUSO dietro la sua icona
  // (collaudo di Luca): niente piu apertura automatica al primo avvio.
  const [mostraPrimaProva, setMostraPrimaProva] = useState(false);
  // b.358 — la tendina con TUTTE le scelte di comunicazione, dietro il barcode
  const [mostraScelte, setMostraScelte] = useState(false);

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
            const res = await fetch('/api/room', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'check', roomId: room.roomId })
            });
            if (!res.ok) { rimaste.push(room); continue; }   // non si sa: si tiene
            // b.363 — prima la lettura non era protetta: una sola risposta
            // rotta buttava fuori dal ciclo e faceva sparire dall'elenco
            // TUTTE le stanze rimanenti, non solo quella in esame.
            const data = await res.json().catch(() => null);
            if (!data) { rimaste.push(room); continue; }   // non si sa: si tiene
            const spenta = data && (data.exists === false || data.ended === true);
            if (!spenta) rimaste.push(room);
          } catch (e) {
            // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
            // registro non compariva nulla, e il motivo vero (rete caduta, attesa
            // scaduta, credito finito, server rotto) restava irrecuperabile.
            if (e?.name !== 'AbortError') console.warn('[b.363] /api/room:', e?.message || e);
            rimaste.push(room);   // rete incerta: si tiene
          }
        }
        memSet('vt-active-rooms', JSON.stringify(rimaste));
        setActiveRooms(rimaste);
      } catch { /* memoria del browser piena o navigazione privata: si prosegue senza salvare */ }
    }
    checkActiveRooms();
  }, []);

  // b.358 — dove porta ogni sezione, scritto per esteso. La guardia sulle
  // viste irraggiungibili cerca `setView('nome')` alla lettera: un rimando
  // calcolato a runtime le nasconderebbe la strada, e domani nessuno si
  // accorgerebbe di una pagina rimasta senza porta.
  function apriSezione(id) {
    vibrate();
    if (id === 'mondo') return setView('mondo');
    if (id === 'life') return setView('life');
    if (id === 'business') return setView('business');
    return handleAction(id);
  }

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
    // b.363 — via l'avviso che annunciava il cambio di lingua con il tasto
    // per annullarlo: non serve a niente. Da quando il carosello chiede
    // conferma, la lingua cambia solo quando la si e scelta apposta — e
    // dire a qualcuno cosa ha appena scelto, coprendogli mezzo schermo per
    // otto secondi, e solo un disturbo. Il pacchetto si carica lo stesso.
    if (!prefs.uiLangScelta && dopo !== prima) preloadLang(dopo);
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
        // b.360 — «elimina il titolo e porta tutto piu in alto» (Luca): via
        // il margine morto in cima, il contenuto parte subito sotto la
        // sicurezza dello schermo.
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        paddingBottom: 100,
        paddingLeft: 20, paddingRight: 20,
        /* Colonna unica allineata: su desktop niente card che dilagano */
        width: '100%', maxWidth: 680, margin: '0 auto',
      }}>

        {/* ═══ Header ═══
            b.360 — «elimina il titolo e porta tutto piu in alto» (Luca): il
            titolo "Con chi vuoi parlare?" e stato tolto. Resta il numero di
            rilascio nell'angolo, e la striscia dei fatti sale in cima. */}
        <div style={{ marginBottom: 8, position: 'relative', width: '100%', flexShrink: 0 }}>
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
          {/* b.360 — la batteria e passata verticale sopra la linguetta a
              sinistra; il titolo e la striscia dei fatti («44 lingue ·
              Crittografia E2E · Voce naturale») sono stati tolti su richiesta
              di Luca: la home parte subito dal carosello delle lingue. */}
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

        {/* ═══ b.358 — IL BARCODE GRANDE ═══
            Collaudo di Luca: «se metti solo un barcode grande che tocchi e
            mostra tutte le scelte di comunicazione... alleggeriamo».
            Le quattro porte per parlare con qualcuno non occupano piu mezza
            home: stanno dietro questo, e si aprono tutte insieme. */}
        <button
          onClick={() => { vibrate(); setMostraScelte(true); }}
          aria-haspopup="dialog"
          style={{
            // b.358 — NIENTE CORNICE attorno ai telefoni (collaudo di Luca:
            // «togli il bottone intorno ai telefoni e qr code»): l'immagine
            // ha gia lo sfondo trasparente, la scatola la spegneva soltanto.
            width: '100%', flexShrink: 0, margin: '4px 0 18px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '6px 4px 10px', cursor: 'pointer',
            background: 'none', border: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* b.358 — l'immagine di Luca al posto dell'icona: due telefoni e
              un QR in mezzo. Dice da sola cosa succede qui, e ha lo sfondo
              trasparente, quindi vive sul tema scuro senza riquadri. */}
          <img
            src="/qr-faccia-a-faccia.webp"
            alt=""
            aria-hidden
            width={1200} height={619}
            style={{ width: '100%', maxWidth: 400, height: 'auto', display: 'block' }}
          />
          <span style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, fontFamily: FONT, textAlign: 'center' }}>
            {L('actFaceTitle')}
          </span>
          <span style={{ fontSize: 12, color: C.textMuted, fontFamily: FONT, textAlign: 'center', lineHeight: 1.4 }}>
            {L('homeAllWaysDesc')}
          </span>
        </button>

        {/* ═══ b.358 — LE SEZIONI TORNANO PULSANTI LARGHI ═══
            Collaudo di Luca: «fai ritornare pulsanti queste icone, allargali
            come prima per differenziarli dai pulsanti della barra».
            Erano icone quadrate come quelle della barra in basso e ci si
            confondeva: qui tornano righe larghe, che occupano tutta la
            colonna e non somigliano a nulla della barra. */}
        <div style={{
          // b.358 — EFFETTO VETRO (collaudo di Luca): sfondo quasi
          // trasparente, un filo di azzurro sul bordo, e l'ombra che cade a
          // sinistra e sotto sfumando nel neutro. La card si vede perche
          // rifrange, non perche e piu chiara.
          background: 'rgba(255,255,255,0.045)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${C.accent}38`,
          borderRadius: 18, padding: '2px 14px', marginBottom: 20, flexShrink: 0,
          // b.361 — VIA l'ombra azzurra offset (collaudo di Luca: «sono le
          // ombre dei tasti menu precedenti»): su fondo scuro appariva come
          // strisce. Niente ombra.
        }}>
          {SEZIONI.map((voce, idx) => (
            <button
              key={voce.id}
              onClick={() => apriSezione(voce.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                minHeight: 74, opacity: 1,
                padding: '14px 2px', background: 'none', textAlign: 'left',
                border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                borderBottom: idx < SEZIONI.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
              }}
            >
              {/* b.360 — le immagini metalliche di Luca al posto delle icone;
                  sfondo trasparente, nessun riquadro. Ridotte al 70% (Luca). */}
              <span style={{
                width: 40, height: 40, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
              }}>
                {voce.img
                  ? <img src={voce.img} alt="" aria-hidden width={72} height={72}
                      style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }} />
                  : <Icon name={voce.icon} size={25} color={C.accent} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
                  {L(voce.titleKey)}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
                  {L(voce.descKey)}
                </span>
              </span>
              <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>›</span>
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

      {/* ═══ b.358 — LA TENDINA DELLE SCELTE (stile Wueform) ═══
          Il barcode grande la apre: qui dentro ci sono TUTTE le porte per
          parlare con qualcuno, una sotto l'altra, larghe e leggibili.
          Fuori dalla tendina la home resta leggera. */}
      {mostraScelte && (
        <div
          role="dialog" aria-modal="true" aria-label={L('actFaceTitle')}
          onClick={() => setMostraScelte(false)}
          style={{
            // b.358 — sopra la barra in basso (che sta a 50): altrimenti
            // l'ultima scelta finiva nascosta sotto i tasti della barra.
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(0,0,0,0.62)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 680, margin: '0 auto',
              // b.358 — fondo PIENO: prima si vedeva la home attraverso la
              // tendina e le due scritte si sovrapponevano, illeggibili.
              background: S.colors.bg,
              borderTopLeftRadius: 22, borderTopRightRadius: 22,
              borderTop: `1px solid ${C.accent}38`,
              // b.358 — «ricordati di mostrare TUTTI i valori» (Luca): la
              // barra in basso viene disegnata sopra la tendina, quindi
              // l'ultima scelta ci finiva sotto. Qui si lascia in fondo
              // l'altezza della barra (77px) piu il margine del telefono:
              // cosi tutte e quattro le voci restano leggibili per intero.
              padding: '10px 16px calc(96px + env(safe-area-inset-bottom))',
              maxHeight: '86dvh', overflowY: 'auto',
              boxShadow: '0 -18px 50px -12px rgba(0,0,0,0.75)',
            }}
          >
            {/* la linguetta da tirare, come in Wueform */}
            <div aria-hidden style={{
              margin: '0 auto 12px', height: 4, width: 44, borderRadius: 2,
              background: C.textMuted, opacity: 0.5,
            }} />
            {ACTIONS.map((action, idx) => (
              <button
                key={action.id}
                onClick={() => { setMostraScelte(false); handleAction(action.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  minHeight: 74, opacity: 1,
                  padding: '14px 2px', background: 'none', textAlign: 'left',
                  border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  borderBottom: idx < ACTIONS.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                }}
              >
                {/* b.358 — niente fondo azzurro e niente riquadro: le icone
                    stanno nude anche qui dentro. */}
                <span style={{
                  width: 48, height: 48, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
                  color: C.textSecondary,
                }}>
                  {action.icon === 'qr' ? <span style={{ color: C.accent, lineHeight: 0 }}><IconQR size={26} /></span>
                    : action.icon === 'mail' ? <Icon name="share" size={26} color={C.accent} />
                    : action.icon === 'car' ? <span style={{ color: '#ffc44d', lineHeight: 0 }}><IconCar size={26} /></span>
                    : <Icon name="users" size={26} color={C.accent} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.textPrimary, fontFamily: FONT }}>
                    {action.title || L(action.titleKey)}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, fontFamily: FONT, marginTop: 2 }}>
                    {L(action.descKey)}
                  </span>
                </span>
                <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </main>
  );
});

export default HomeView;
