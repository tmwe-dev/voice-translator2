'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { ombraAcciaio } from '../lib/acciaio.js';
import { FONT, getLang, vibrate, PUSH } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
// b.363 — `t` serviva solo all'avviso del cambio lingua, che e stato tolto:
// restava importato senza che nessuno lo chiamasse. Restano `mapLang` — la
// lingua dei menu esiste in 15 lingue, non nelle 44 in cui si traduce — e
// `preloadLang`, che porta avanti il pacchetto nuovo appena si conferma.
import { mapLang, preloadLang } from '../lib/i18n.js';
import Icon from './Icon.js';
import CarouselLingue from './CarouselLingue.js';
// b.424 — IL RIBALTAMENTO CHE C'E GIA (ordine di Luca: «la pagina deve
// apparire con un ribaltamento a 180 gradi della home e una pagina intera
// con freccia in alto per tornare»). E lo stesso foglio che gira sulle
// news: non se ne scrive un secondo.
import Ribalta from './ui/Ribalta.js';
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
// b.436 — le porte per connettersi (faccia-a-faccia, invito, TaxiTalk,
// stanza video) NON stanno piu in Home: sono passate nel foglio del tasto
// «+» (NewConversationSheet.js), che le apre a tutta pagina col barcode.
// Ordine di Luca. Il gestore in page.js le instradava gia.

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
    <main style={{ ...S.page, display: 'flex', flexDirection: 'column' }} aria-label={L('homeAria')}>
      {/* b.424 — LA HOME GIRA SU SE STESSA. Prima «Parla ora» prendeva il
          posto del contenuto dentro la home: si apriva e basta, e sembrava
          di essere andati via. Adesso e il foglio intero che si volta, e
          dietro c'e il traduttore a pagina piena. Una schermata che si apre
          sopra dice «sei andato via»; un foglio che gira dice «e sempre la
          stessa cosa, vista dall'altra parte» — ed e vero, perche tornando
          la home e esattamente dov'era. */}
      <Ribalta girato={mostraPrimaProva}
        retro={<PrimaProva onChiudi={() => setMostraPrimaProva(false)} />}
        fronte={
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
        // b.437 — LA HOME A TUTTA LARGHEZZA (collaudo di Luca: «non hai
        // rispettato la larghezza dei contenitori del template, deve
        // sfruttare la larghezza dello schermo; via i margini laterali»).
        // La Home NON ha linguetta, quindi non deve tenere i 66px liberi
        // da ogni lato che il righello lascia per la linguetta: stringevano
        // il contenuto a meta schermo per niente. Ora va da bordo a bordo,
        // col solo respiro minimo; un tetto largo evita che su desktop
        // dilaghi.
        paddingLeft: 12, paddingRight: 12,
        width: '100%', maxWidth: 900, marginLeft: 'auto', marginRight: 'auto',
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
              fontFamily: FONT, fontSize: 11, fontWeight: 600, lineHeight: 1,
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
          {/* b.436 — il marchio BarTalk, centrato in cima (template). «Talk»
              in accent1: il blu e l'app. */}
          <div style={{
            textAlign: 'center', fontFamily: FONT, fontSize: 22,
            letterSpacing: 0.2, color: C.textPrimary, lineHeight: 1, padding: '3px 0',
          }}>
            Bar<span style={{ color: C.accent }}>Talk</span>
          </div>
        </div>

        {/* ── b.356 — "PARLA ORA" A PAGINA PIENA ──
            Aperto, il traduttore NASCONDE tutto il resto (collaudo di Luca:
            «nasconde le altre parti e i pulsanti e occupa la pagina per
            permettere la traduzione e la visualizzazione ampia»). La ✕
            riporta alla home normale. */}

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
              margin: '6px auto 24px', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* b.436 — il microfono e il protagonista della Home (template):
                un cerchio grande da 132 con l'alone. Il microfono dentro e
                BIANCO (textPrimary) e da 20 come nel template — non azzurro,
                non da 44: era una mia deriva. L'alone e l'accent1, il tratto no. */}
            <span style={{
              width: 132, height: 132, borderRadius: 66,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${C.accent}57`,
              background: `radial-gradient(circle at 50% 38%, ${C.accent}4d, ${C.accent}14 62%, transparent 74%)`,
              boxShadow: `0 0 0 10px ${C.accent}0d, 0 20px 60px -18px ${C.accent}8c`,
            }}>
              <Icon name="mic" size={20} color={C.textPrimary} />
            </span>
            <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: C.textPrimary }}>
              {L('speakNowTitle')}
            </span>
          </button>
        )}
        {/* ── FINE b.96 ── */}

        {/* b.436 — il barcode faccia-a-faccia NON e piu qui: e passato nel
            tasto «+» della barra (NewConversationSheet), che ora apre una
            lista a tutta pagina col barcode e tutti i modi per connettersi.
            Ordine di Luca. La Home resta il microfono e le sezioni. */}

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
                // b.363 — nella home le icone in acciaio crescono del 50%
                // (ordine di Luca): il riquadro da 40 passa a 60, l'acciaio
                // dentro da 36 a 54.
                width: 60, height: 60, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
              }}>
                {voce.img
                  ? <img src={voce.img} alt="" aria-hidden width={108} height={108}
                      style={{ width: 54, height: 54, objectFit: 'contain', display: 'block',
                        filter: ombraAcciaio(1.2) }} />
                  : <Icon name={voce.icon} size={25} color={C.accent} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: C.textPrimary, fontFamily: FONT }}>
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
              fontSize: 10, fontWeight: 600, color: C.textMuted,
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

      </div>
        } />


      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </main>
  );
});

export default HomeView;
