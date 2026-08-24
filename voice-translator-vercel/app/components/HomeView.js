'use client';
import { memo, useState, useMemo, useEffect } from 'react';
import { FONT, getLang, vibrate, PUSH, metaScelta } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
// b.363 — `t` serviva solo all'avviso del cambio lingua, che e stato tolto:
// restava importato senza che nessuno lo chiamasse. Restano `mapLang` — la
// lingua dei menu esiste in 15 lingue, non nelle 44 in cui si traduce — e
// `preloadLang`, che porta avanti il pacchetto nuovo appena si conferma.
import Icon from './Icon.js';
import { vesteMicrofono } from './ui/Microfono.js';
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
// b.442 — le porte per connettersi (faccia-a-faccia, invito, TaxiTalk,
// stanza video) NON stanno piu in Home: il template non le mostra, e sono
// passate nel tasto «+» della barra, che le apre a tutta pagina col
// barcode. Il gestore in page.js le instradava gia da b.93.

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
  const mic = vesteMicrofono({ misura: 168, C: S.colors });
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
    // b.448 — qui c'erano ancora i casi 'face-to-face', 'invite',
    // 'taxitalk' e 'stanza-video': erano CODICE MORTO da b.442, quando
    // quelle quattro porte sono passate al tasto «+». Nessuno poteva piu
    // chiamarli — apriSezione manda qui solo cio che non e mondo, life o
    // business, cioe soltanto 'regala' — e restare li faceva credere che
    // la Home sapesse ancora aprirle. Le instrada page.js, in
    // handleNewConversationSelect.
    switch (actionId) {
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
  // ═══════════════════════════════════════════════════════════════
  // b.459 — IL CAROSELLO SCEGLIE LA LINGUA 2, NON LA TUA.
  //
  // Luca, dopo che l'ho rotto piu volte: «hai la lingua utente che e una
  // cosa, e la lingua da tradurre (lingua 2) che va gestita da carosello e
  // selettore hamburger».
  //
  // Ecco l'errore che ripetevo. Il carosello scriveva su prefs.lang, cioe
  // sulla TUA lingua — quella con cui entri nelle stanze e con cui parli.
  // Quindi ogni volta che sceglievi una bandiera cambiavi te stesso invece
  // della meta, e la coppia in alto finiva per mostrare due volte la stessa
  // cosa. Non era un difetto di disegno: era il filo attaccato al posto
  // sbagliato, e finche restava li lo riattaccavo storto ogni volta.
  //
  // Sono due cose separate, e adesso lo sono anche nel codice:
  //   prefs.lang  = la TUA lingua. Si cambia dalle impostazioni.
  //   prefs.meta  = la LINGUA 2, quella verso cui si traduce. La scelgono
  //                 il carosello e il suo elenco completo (l'hamburger),
  //                 qui e dentro «Parla ora»: lo stesso valore, un posto solo.
  //
  // E la lingua dei MENU non segue piu questa scelta: seguiva la lingua
  // parlata (regola b.254) e continua a farlo, ma la lingua parlata non e
  // piu quello che il carosello tocca.
  // ═══════════════════════════════════════════════════════════════
  const scegliLingua = (l) => {
    vibrate();
    savePrefs({ ...prefs, meta: l.code });
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
        paddingBottom: 76,
        // b.442 — A TUTTA LARGHEZZA come nel template. La Home non ha la
        // linguetta laterale, quindi non deve tenere i 66px liberi per lato
        // che il righello riserva a quella: stringevano tutto per niente.
        // Su desktop il tetto largo, centrato, tiene il contenuto in mezzo.
        // b.451, collaudo di Luca: «hai modificato i margini dei pulsanti dal
        // bordo laterale, cosi risultano troppo vicini». Vero, e l'avevo
        // stretto io: quando Luca aveva detto «troppo stretto, usa la
        // larghezza dello schermo» ho tolto sia la colonna centrata SIA il
        // margine, portandolo da 20 a 12. Ma a stringere era la colonna, che
        // teneva 66 punti liberi per lato per una linguetta che qui non
        // c'e: il margine non c'entrava niente.
        // Il template da 12 su una cornice da 340, piu 2 della riga: sono
        // 14 su 340, cioe il 4,1% — su un telefono vero da 390 fanno 16.
        // Qui restano 20 (piu i 2 della riga: 22), un filo piu larghi del
        // template: dopo un «troppo vicini» si sbaglia dalla parte del
        // respiro, non da quella del bordo.
        paddingLeft: 20, paddingRight: 20,
        width: '100%', maxWidth: 900, marginLeft: 'auto', marginRight: 'auto',
      }}>

        {/* ═══ Header ═══
            b.360 — «elimina il titolo e porta tutto piu in alto» (Luca): il
            titolo "Con chi vuoi parlare?" e stato tolto. Resta il numero di
            rilascio nell'angolo, e la striscia dei fatti sale in cima. */}
        <div style={{ marginBottom: 8, position: 'relative', width: '100%', flexShrink: 0 }}>
          {/* b.265 — numero di rilascio, nell'angolo in alto a sinistra */}

          {/* b.457 — LE BANDIERE TORNANO IN ALTO (ordine di Luca), e stavolta
              dicono una cosa vera: da che lingua parli tu, a quale ti
              sentono. Prima ci avevo messo «myLang -> prefs.lang», che sono
              LA STESSA COSA, e mostrava due volte la stessa bandiera: e per
              quello l'avevo tolta. Adesso la lingua di arrivo e una
              preferenza vera, condivisa con «Parla ora», e non coincide mai
              con la tua. Toccandola si apre «Parla ora», che e il posto dove
              quella coppia si cambia. */}
          <button
            onClick={() => { vibrate(); riapriPrimaProva(); setMostraPrimaProva(true); }}
            aria-label={`${getLang(prefs.lang)?.name || prefs.lang} → ${getLang(metaScelta(prefs))?.name || metaScelta(prefs)}`}
            style={{
              position: 'absolute', top: 0, left: 0, zIndex: 3,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 44, padding: '0 14px', borderRadius: 999,
              border: `1px solid ${C.cardBorder}`, background: 'rgba(255,255,255,0.04)',
              fontFamily: FONT, fontSize: 24, color: C.textPrimary, whiteSpace: 'nowrap',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}>
            <span>{getLang(prefs.lang)?.flag || String(prefs.lang).toUpperCase()}</span>
            <span style={{ color: C.textMuted, fontSize: 18 }}>&rarr;</span>
            <span>{getLang(metaScelta(prefs))?.flag || String(metaScelta(prefs)).toUpperCase()}</span>
          </button>
          {/* b.444 — LA PILLOLA DELLE LINGUE E' STATA TOLTA, ed era un mio
              difetto (collaudo di Luca: «i selettori della lingua associano a
              tutti e due gli utenti la stessa lingua»). Aveva ragione:
              mostrava «myLang -> prefs.lang» come se fossero due lingue
              diverse, ma useInitializeApp fa setMyLang(p.lang) — sono LA
              STESSA COSA, e la pillola disegnava due volte la stessa
              bandiera. Al livello Home una seconda lingua NON esiste: la
              destinazione vive dentro «Parla ora» (lo stato meta) e non
              esce di li. Inventarla qui era un'informazione falsa; e in piu
              ripeteva la lingua che il carosello dice gia due righe sotto. */}
          {/* b.442 — IL MARCHIO, centrato in testata come nel template.
              «Talk» in accent1: il blu e l'applicazione. Niente grassetto. */}
          {/* b.458, ordine di Luca: «sposta il numero versione esattamente
              sotto il logo BarTalk e metti in posizione nell'angolo le
              bandiere delle lingue». Prima stavano tutti e due in alto a
              sinistra, uno sopra l'altro, e si contendevano l'angolo.
              Adesso: le bandiere nell'angolo, il numero centrato sotto il
              marchio — dove serve a Luca per sapere in un colpo d'occhio
              quale versione ha in mano. */}
          <div style={{
            textAlign: 'center', fontFamily: FONT, fontSize: 30, lineHeight: 1,
            letterSpacing: 0.2, color: C.textPrimary, padding: '3px 0',
          }}>
            Bar<span style={{ color: C.accent }}>Talk</span>
          </div>
          <div
            aria-label={`rilascio numero ${PUSH}`}
            style={{
              textAlign: 'center', fontFamily: FONT, fontSize: 11, lineHeight: 1,
              color: C.textMuted, letterSpacing: 0.6, marginTop: 5, userSelect: 'text',
            }}
          >#{PUSH}</div>
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

        {/* b.354 — IL CAROSELLO DELLE BANDIERE (Wueform) al posto della
            dropdown: la lingua si sceglie qui, sotto il titolo. */}
        <div style={{ margin: '18px 0 0' }}>
          <CarouselLingue
            selezionata={metaScelta(prefs)}
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
              margin: '26px auto 26px', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* b.442 — IL MICROFONO DEL TEMPLATE: cerchio 132 con l'alone,
                e dentro l'icona BIANCA da 20 (la misura base .ic del
                template). Non azzurra e non da 44: quelle erano mie
                deviazioni. L'alone prende l'accent1 del tema. */}
            {/* b.467 — il microfono viene dal disegno COMUNE: e lo stesso in
                Home, in «Parla ora» e nella chat. Cambia la misura, non la
                forma. */}
            <span style={mic.cerchio}>
              <Icon name="mic" size={mic.icona} color={mic.coloreIcona} />
            </span>
            <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: C.textPrimary }}>
              {L('speakNowTitle')}
            </span>
          </button>
        )}
        {/* ── FINE b.96 ── */}

        {/* b.442 — IL BARCODE NON STA PIU IN HOME (template): le porte per
            connettersi vivono nel tasto «+» della barra, che le apre tutte
            insieme. La Home resta il microfono e le sezioni. */}

        {/* ═══ b.358 — LE SEZIONI TORNANO PULSANTI LARGHI ═══
            Collaudo di Luca: «fai ritornare pulsanti queste icone, allargali
            come prima per differenziarli dai pulsanti della barra».
            Erano icone quadrate come quelle della barra in basso e ci si
            confondeva: qui tornano righe larghe, che occupano tutta la
            colonna e non somigliano a nulla della barra. */}
        {/* b.442 — RIGHE NUDE, come nel template: niente card di vetro
            attorno. Le voci sono separate solo da una linea, e prendono
            tutta la larghezza dello schermo. La larghezza e fissa al 100%,
            cosi non si stringe cambiando lingua (il contenitore centra i
            figli, e senza larghezza la card si adattava al testo). */}
        <div style={{
          width: '100%', boxSizing: 'border-box',
          marginBottom: 20, flexShrink: 0,
        }}>
          {SEZIONI.map((voce, idx) => (
            <button
              key={voce.id}
              onClick={() => apriSezione(voce.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                minHeight: 88, opacity: 1,
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
                width: 72, height: 72, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
              }}>
                {voce.img
                  ? <img src={voce.img} alt="" aria-hidden width={108} height={108}
                      // b.455, ordine di Luca: «dietro tutte le immagini c'e
                      // un'ombra scura, eliminala». Era uno stacco nero
                      // PIENO, messo per staccare il metallo dal fondo
                      // scuro. Sul tema chiaro non stacca niente: e una
                      // macchia dietro l'oggetto. Queste immagini hanno gia
                      // il loro rilievo dipinto dentro.
                      style={{ width: 66, height: 66, objectFit: 'contain', display: 'block' }} />
                  : <Icon name={voce.icon} size={25} color={C.accent} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 18, fontWeight: 500, color: C.textPrimary, fontFamily: FONT }}>
                  {L(voce.titleKey)}
                </span>
                <span style={{ display: 'block', fontSize: 14, color: C.textMuted, fontFamily: FONT, marginTop: 3 }}>
                  {L(voce.descKey)}
                </span>
              </span>
              <span style={{ color: C.textMuted, fontSize: 17, flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>

        {/* ═══ Active Rooms ═══ */}
        {activeRooms.length > 0 && (
          <div style={{ marginBottom: 20, width: '100%', boxSizing: 'border-box' }}>
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
