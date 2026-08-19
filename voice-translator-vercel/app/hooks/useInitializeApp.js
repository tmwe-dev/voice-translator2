'use client';
import { useEffect } from 'react';
import { LANGS, AVATARS } from '../lib/constants.js';
import { mapLang } from '../lib/i18n.js';
import { indovinaPaese } from '../lib/paesi.js';
import { createLogger } from '../lib/logger.js';
const dbg = createLogger('init');

/**
 * useInitializeApp — Handles the complex app initialization:
 *   - Load saved prefs from localStorage
 *   - Parse URL parameters (room, lang, guest prefill, referral, invite, payment)
 *   - Auto-login in TESTING_MODE
 *   - Token validation (fast path + background check)
 *   - Service worker registration
 *   - Monitoring init
 */
export default function useInitializeApp({
  setView, setPrefs, setMyLang, setJoinCode, setInviteMsgLang,
  setAutoJoinTriggered, setTaxiDestId, setTaxiKey, auth, initMonitoring,
}) {
  // ── Main initialization ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vt-prefs');
      const savedToken = localStorage.getItem('vt-token');
      const urlParams = new URLSearchParams(window.location.search);
      // ═══ b.269 — L'INVITO SOPRAVVIVE ALLA PULIZIA DELL'INDIRIZZO ═══
      // Trovato dal vivo: chi apre un link di invito vede per un istante
      // "Sto entrando nella conversazione..." e finisce sulla home. Il
      // server accetta l'ingresso (l'host lo vede arrivare), ma lo
      // schermo dell'ospite torna indietro.
      // Il motivo: qui sotto l'indirizzo viene ripulito subito
      // (replaceState) per non lasciare il codice stanza nella barra. Se
      // questa inizializzazione riparte una seconda volta — e riparte —
      // il codice nell'indirizzo non c'e piu, le preferenze intanto sono
      // state salvate, e la scelta della schermata iniziale finisce
      // dritta sulla home, cancellando l'ingresso in corso.
      // Ora il codice dell'invito viene messo da parte per la sessione:
      // finche l'ingresso non e andato a buon fine, l'invito resta.
      const roomParam = urlParams.get('room') || (() => {
        try { return sessionStorage.getItem('vt-invito-in-corso'); } catch { return null; }
      })();
      const paymentStatus = urlParams.get('payment');
      const paymentCredits = urlParams.get('credits');

      // 1. Load saved preferences
      if (saved) {
        let p; try { p = JSON.parse(saved); } catch { p = null; }
        if (p) {
          if (!p.avatar || !p.avatar.startsWith('/avatars/') || !p.avatar.endsWith('.png')) p.avatar = AVATARS[0];
          // b.136 — chi era gia qui prima di questa versione ha salvato
          // solo `lang`. Se gli si lasciasse `uiLang` vuoto l'interfaccia
          // cadrebbe sull'inglese al primo caricamento e lui avrebbe
          // l'impressione di aver perso una impostazione che aveva fatto.
          // La si ricava dalla lingua parlata, che e cio che faceva
          // l'applicazione fino a ieri: nessuno vede un cambiamento.
          if (!p.uiLang) p.uiLang = mapLang(p.lang || 'en');
          if (!p.country) p.country = indovinaPaese({ lingua: p.lang })?.codice || '';
          setPrefs(p); setMyLang(p.lang);
        }
      }

      // 2. URL language params
      // b.115 — questo commento diceva "host's language, for invite
      // message display only" e ha tratto in inganno chi ha scritto il
      // blocco dell'ingresso automatico (me). Il selettore che riempie
      // questo parametro si chiama "Lingua dell'invitato": e la lingua
      // dell'OSPITE, e va applicata.
      const langParam = urlParams.get('lang');   // lingua scelta per l'invitato
      const guestLangParam = urlParams.get('gl'); // guest's language (what we should set)
      const guestNameParam = urlParams.get('gn');
      const guestGenderParam = urlParams.get('gg');

      // 3. Guest pre-fill from QR invite (gn=name, gg=gender, gl=language)
      // gl= is the guest's language and takes priority over lang=
      // lang= is only for invite message display, NOT for setting the guest's language
      if (guestNameParam || guestGenderParam || guestLangParam) {
        const effectiveLang = guestLangParam && LANGS.find(l => l.code === guestLangParam)
          ? guestLangParam : null;
        setPrefs(p => {
          const updated = {
            ...p,
            autoPlay: true,
            ...(guestNameParam ? { name: decodeURIComponent(guestNameParam) } : {}),
            ...(guestGenderParam ? { gender: guestGenderParam } : {}),
            // b.136 — l'invitato non passa dalla scelta del paese (e
            // giusto cosi: e stato invitato a parlare, non a iscriversi),
            // quindi la lingua dell'interfaccia gliela diamo qui. Senza
            // questa riga entrerebbe con i menu in inglese anche avendo
            // ricevuto un invito in italiano.
            ...(effectiveLang ? { lang: effectiveLang, uiLang: mapLang(effectiveLang) } : {}),
          };
          localStorage.setItem('vt-prefs', JSON.stringify(updated));
          return updated;
        });
        if (effectiveLang) {
          setMyLang(effectiveLang);
        }
        // Set invite message display language (gl if valid, else lang param, else host lang)
        setInviteMsgLang(effectiveLang || langParam || 'en');
        if (typeof window !== 'undefined') window.__VT_GUEST_PREFILLED = true;
      } else if (langParam && LANGS.find(l => l.code === langParam)) {
        // No guest params — this is a direct lang= override (non-QR link)
        setInviteMsgLang(langParam);
        setMyLang(langParam);
        setPrefs(p => {
          const updated = { ...p, lang: langParam, uiLang: mapLang(langParam) };
          localStorage.setItem('vt-prefs', JSON.stringify(updated));
          return updated;
        });
      }

      // 4. Capture referral code
      const refParam = urlParams.get('ref');
      if (refParam) auth.setPendingReferralCode(refParam);

      // 4-bis. Regalo di minuti ricevuto da un amico (?regalo=GIFT-XXXX).
      // Lo mettiamo nella stessa casella dei voucher: la batteria lo
      // riscatta da sola appena c'è una sessione valida.
      const regaloParam = urlParams.get('regalo');
      if (regaloParam) {
        localStorage.setItem('vt-voucher-pendente', regaloParam.toUpperCase());
        window.history.replaceState({}, '', window.location.pathname);
      }

      // 5. Capture invite code (contacts system)
      const inviteParam = urlParams.get('invite');
      if (inviteParam) {
        localStorage.setItem('vt-pending-invite', inviteParam);
        window.history.replaceState({}, '', window.location.pathname);
      }

      // 6. Room join from URL
      //
      // ── b.99 · CHI E INVITATO ENTRA, NON COMPILA UN MODULO ──
      // Prima l'ingresso automatico chiedeva `saved`: un ospite nuovo non
      // ha niente di salvato, quindi non scattava mai. Risultato: chi
      // riceveva il link si trovava davanti a nome, lingua e codice da
      // riempire — cioe un piccolo onboarding — invece che dentro la chat
      // dove lo stavano aspettando. E li molti chiudono.
      //
      // Ora chi arriva con un invito entra e basta. Se non ha un nome gli
      // se ne da uno provvisorio e la lingua la prende dal suo browser:
      // due cose che potra cambiare dopo, con la conversazione gia aperta.
      // b.133 — L'INGRESSO AUTOMATICO ERA RISERVATO A `auto=1`.
      //
      // Solo i QR generati da noi mettevano quel parametro. Un invito
      // condiviso a mano — il caso piu comune, il link incollato in una
      // chat — arrivava senza, e l'ospite si ritrovava davanti alle tre
      // schermate di presentazione: nome, lingua, audio. Tre schermate
      // prima di poter scrivere una parola, per una persona che era
      // stata invitata a parlare, non a iscriversi.
      //
      // Chi apre un codice stanza E' un invitato, punto: come ci sia
      // arrivato non cambia cosa vuole fare. Il parametro non decide
      // piu niente.
      if (roomParam) {
        setJoinCode(roomParam.toUpperCase());
        try { sessionStorage.setItem('vt-invito-in-corso', roomParam.toUpperCase()); } catch { /* niente memoria di sessione: si prosegue */ }
        window.history.replaceState({}, '', window.location.pathname);

        {
          let p = null;
          try { p = saved ? JSON.parse(saved) : null; } catch { p = null; }

          const linguaBrowser = (typeof navigator !== 'undefined'
            ? (navigator.language || 'en').split('-')[0] : 'en');
          // b.115 — QUI MANCAVA `langParam`, ed e il difetto per cui la
          // lingua scelta nell'invito non arrivava mai.
          //
          // Il selettore dell'invito si chiama "Lingua dell'invitato" e
          // finisce nel link come `lang=`. Ma questa riga guardava solo
          // `gl=`, le preferenze salvate e la lingua del browser. Il
          // blocco piu sopra leggeva `lang=` e impostava la lingua
          // giusta — poi arrivava questo, che gira PER ULTIMO (lo dice
          // il commento qui sotto, scritto da me) e la sovrascriveva
          // con quella del browser.
          //
          // Risultato provato dal vivo: chi apriva un invito
          // "?lang=en" entrava in italiano, e le due bandiere in cima
          // erano tutte e due italiane. Nessuna traduzione possibile,
          // perche sorgente e destinazione coincidevano.
          //
          // L'ordine giusto e questo, dal piu esplicito al piu generico:
          //   gl=      chi invita ha scelto la lingua dell'ospite in un QR
          //   lang=    chi invita l'ha scelta nel modulo di invito
          //   salvate  l'ospite era gia stato qui e aveva scelto
          //   browser  ultima risorsa
          const linguaValida = (c) => !!c && !!LANGS.find(l => l.code === c);
          const linguaOspite = (linguaValida(guestLangParam) && guestLangParam)
            || (linguaValida(langParam) && langParam)
            || (linguaValida(p?.lang) && p.lang)
            || (linguaValida(linguaBrowser) ? linguaBrowser : 'en');
          const nomeOspite = guestNameParam
            ? decodeURIComponent(guestNameParam)
            : (p?.name || 'Ospite');

          // ATTENZIONE ALL'ORDINE. Piu sopra, il ramo `lang=` fa un
          // setPrefs FUNZIONALE che scrive anche su localStorage. React
          // esegue quegli aggiornamenti DOPO, in coda, quindi una
          // scrittura diretta qui verrebbe sovrascritta da quella —
          // con il nome ancora vuoto. Il collaudo dal vivo lo ha mostrato:
          // l'ospite entrava come "Ospite" ma sul telefono restava senza
          // nome, e al primo ricaricamento non rientrava piu.
          //
          // Percio anche questo passa dalla coda: essendo l'ultimo, vince.
          setPrefs(p => {
            const provvisorie = {
              ...(p || {}),
              name: nomeOspite,
              lang: linguaOspite,
              // b.136 — per l'invitato la lingua dell'interfaccia si
              // DEDUCE, non si chiede: la stessa da cui si e dedotta
              // quella parlata, mappata sulle 15 che l'interfaccia ha.
              uiLang: mapLang(linguaOspite),
              country: p?.country || indovinaPaese({ lingua: linguaOspite })?.codice || '',
              // b.289 — P0: una preferenza ESPLICITA non si calpesta.
              // Prima l'invito forzava sempre true: chi aveva scelto di
              // non ascoltare se lo ritrovava riacceso.
              autoPlay: p?.autoPlay === false ? false : true,
              avatar: p?.avatar || AVATARS[0],
            };
            try { localStorage.setItem('vt-prefs', JSON.stringify(provvisorie)); } catch { /* navigazione privata o memoria piena: si prosegue senza salvare */ }
            return provvisorie;
          });
          setMyLang(linguaOspite);

          setTimeout(() => setAutoJoinTriggered(true), 600);
        }
      }

      if (paymentStatus === 'success' && paymentCredits) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      // 6b. Taxi destination from URL (/taxi/DEST_ID#k=KEY or ?taxi=DEST_ID)
      // The decryption key is in the URL fragment (#k=...) — never sent to server
      const taxiParam = urlParams.get('taxi');
      const pathMatch = window.location.pathname.match(/^\/taxi\/([a-z0-9]+)$/i);
      const taxiId = taxiParam || pathMatch?.[1];
      if (taxiId) {
        setTaxiDestId(taxiId);
        // Extract encryption key from fragment
        const hash = window.location.hash;
        const keyMatch = hash.match(/[#&]k=([A-Za-z0-9_-]+)/);
        if (keyMatch?.[1]) setTaxiKey(keyMatch[1]);
        // Clean URL — remove query params and fragment (key must not persist in history)
        window.history.replaceState({}, '', '/');
      }

      // 7. Determine initial view
      //
      // ── b.136 · LA LINGUA VIENE PRIMA DI TUTTO ──
      //
      // Al primo avvio si andava su 'welcome', che chiedeva la lingua
      // come seconda delle tre fasi, insieme al nome. Due conseguenze:
      // la prima schermata che una persona vedeva era gia scritta in
      // una lingua decisa da noi (l'italiano, o l'inglese di ripiego),
      // e la lingua scelta li faceva DUE mestieri — parlata e
      // interfaccia — che ora sono separati.
      //
      // Ora la prima schermata e la scelta del paese. Da li discendono
      // lingua parlata, lingua dell'interfaccia e bandiera, e solo dopo
      // si passa a 'welcome' per nome e avatar.
      //
      // L'ordine dei controlli qui sotto NON e casuale ed e la parte da
      // non rompere: taxi e invito vengono PRIMA, cosi chi arriva con
      // un link non vede ne il paese ne il benvenuto. Per lui la lingua
      // e gia stata dedotta al punto 3/6.
      const pickView = (hasSaved) => {
        if (taxiId) return 'taxi-driver';
        if (roomParam) return 'join';
        if (!hasSaved) {
          const testMode = typeof window !== 'undefined' && window.__VT_TESTING_MODE;
          if (testMode) return 'home';
          return 'paese';
        }
        return 'home';
      };

      // 8. TESTING_MODE auto-login
      if (typeof window !== 'undefined' && window.__VT_TESTING_MODE && !savedToken) {
        dbg.debug('[TESTING_MODE] Auto-login with test account...');
        fetch('/api/test-login', { method: 'POST' })
          .then(r => r.json())
          .then(data => {
            if (data.ok && data.token) {
              auth.setUserToken(data.token);
              auth.userTokenRef.current = data.token;
              localStorage.setItem('vt-token', data.token);
              auth.setUserAccount(data.user);
              auth.setIsTrial(false);
              auth.setIsTopPro(true);
              auth.setCanUseElevenLabs(true);
              auth.setCreditBalance(99999);
              auth.setPlatformHasEL(data.platformHasElevenLabs || false);
              auth.setUseOwnKeys(true);
              // b.166 — CONFERMATO (caccia al tesoro): data.user.apiKeys e
              // ora mascherato dal server, non va piu nel campo modificabile
              // (vedi useAuth.js, stesso motivo).
              dbg.debug('[TESTING_MODE] Logged in as test@bartalk.dev');
            }
          })
          .catch(e => console.warn('[TESTING_MODE] Auto-login failed:', e.message));
      } else if (typeof window !== 'undefined' && window.__VT_TESTING_MODE) {
        auth.setIsTrial(false);
        auth.setIsTopPro(true);
        auth.setCanUseElevenLabs(true);
        auth.setCreditBalance(99999);
        auth.setPlatformHasEL(true);
      }

      // 9. Token validation (fast path + background)
      if (savedToken) {
        auth.setUserToken(savedToken);
        auth.userTokenRef.current = savedToken;
        setView(pickView(!!saved));
        fetch('/api/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'me', token: savedToken })
        }).then(r => r.json()).then(data => {
          if (data.user) {
            auth.setUserAccount(data.user);
            auth.setCreditBalance(data.user.credits || 0);
            auth.setUseOwnKeys(data.user.useOwnKeys || false);
            if (data.referralCode) auth.setReferralCode(data.referralCode);
            if (data.platformHasElevenLabs) auth.setPlatformHasEL(true);
            // b.166 — CONFERMATO (caccia al tesoro): stesso motivo di
            // useAuth.js — le apiKeys tornano mascherate dal server, il
            // campo di editing NON va piu precompilato con quel valore.
            // Si tiene solo il segnale non sensibile "chiave elevenlabs
            // presente" per lo stato TOP PRO.
            if (data.user.useOwnKeys && data.user.apiKeys?.elevenlabs) auth.setIsTopPro(true);
            if (data.user.clonedVoiceId) {
              auth.setClonedVoiceId(data.user.clonedVoiceId);
              auth.setClonedVoiceName(data.user.clonedVoiceName || 'My Voice');
            }
          } else {
            localStorage.removeItem('vt-token');
            auth.setUserToken(null);
            auth.userTokenRef.current = null;
            auth.setUserAccount(null);
          }
        }).catch(() => {});
      } else {
        setView(pickView(!!saved));
      }
    } catch { setView('welcome'); }
  }, []);

  // ── Service worker registration ──
  // ═══ INIZIO b.259 — l'applicazione si accorge da sola dei rilasci ═══
  // TROVATO DAL VIVO, ed e costato UNA NOTTE: ogni correzione arrivava in
  // produzione ma la scheda di Luca continuava a eseguire il bundle
  // vecchio. Il controllo aggiornamenti girava UNA volta, al primo avvio:
  // una scheda tenuta aperta (o una PWA installata) non veniva mai piu a
  // sapere di un rilascio, e ogni collaudo inseguiva un fantasma di cache.
  // Ora: si ricontrolla a ogni ritorno in primo piano e ogni 5 minuti; e
  // quando il service worker nuovo prende il controllo, la pagina si
  // ricarica da sola — MA solo se non sei in una stanza, perche un
  // ricaricamento a meta conversazione butterebbe fuori dalla chiamata.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.update().catch(() => {});
        // Ritorno in primo piano: il momento tipico in cui si riprende in
        // mano un'app rimasta aperta da ore — e quello in cui il collaudo
        // di stanotte trovava sempre la versione vecchia.
        const ricontrolla = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); };
        document.addEventListener('visibilitychange', ricontrolla);
        setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000);
      }).catch(err => console.error('SW registration failed:', err));

      // Il service worker nuovo ha preso il controllo (skipWaiting e gia
      // in sw.js): da questo istante HTML e pagina appartengono a due
      // versioni diverse. Si ricarica subito, tranne in stanza.
      let ricaricato = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (ricaricato) return;
        ricaricato = true;
        const inStanza = /room|speaker|taxi/.test(window.location.hash || '') ||
          document.querySelector('[aria-label*="translation" i], [role="log"]');
        if (!inStanza) window.location.reload();
      });
    }
    try { initMonitoring(); } catch { /* il monitoraggio e un di piu: se non parte, l applicazione funziona uguale */ }
  }, []);
  // ═══ FINE b.259 ═══
}
