'use client';
import { useEffect } from 'react';
import { LANGS, AVATARS } from '../lib/constants.js';
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
      const roomParam = urlParams.get('room');
      const paymentStatus = urlParams.get('payment');
      const paymentCredits = urlParams.get('credits');

      // 1. Load saved preferences
      if (saved) {
        let p; try { p = JSON.parse(saved); } catch { p = null; }
        if (p) {
          if (!p.avatar || !p.avatar.startsWith('/avatars/') || !p.avatar.endsWith('.png')) p.avatar = AVATARS[0];
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
            ...(effectiveLang ? { lang: effectiveLang } : {}),
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
          const updated = { ...p, lang: langParam };
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
      const autoJoin = urlParams.get('auto') === '1';
      if (roomParam) {
        setJoinCode(roomParam.toUpperCase());
        window.history.replaceState({}, '', window.location.pathname);

        if (autoJoin) {
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
              autoPlay: true,
              avatar: p?.avatar || AVATARS[0],
            };
            try { localStorage.setItem('vt-prefs', JSON.stringify(provvisorie)); } catch { /* privato */ }
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
      const pickView = (hasSaved) => {
        if (taxiId) return 'taxi-driver';
        if (roomParam) return 'join';
        if (!hasSaved) {
          const testMode = typeof window !== 'undefined' && window.__VT_TESTING_MODE;
          if (testMode) return 'home';
          return 'welcome';
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
              if (data.user?.apiKeys) {
                auth.setApiKeyInputs({
                  openai: data.user.apiKeys.openai || '',
                  anthropic: data.user.apiKeys.anthropic || '',
                  gemini: data.user.apiKeys.gemini || '',
                  elevenlabs: data.user.apiKeys.elevenlabs || '',
                });
              }
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
            if (data.user.useOwnKeys && data.user.apiKeys) {
              auth.setApiKeyInputs({
                openai: data.user.apiKeys.openai || '',
                anthropic: data.user.apiKeys.anthropic || '',
                gemini: data.user.apiKeys.gemini || '',
                elevenlabs: data.user.apiKeys.elevenlabs || ''
              });
              if (data.user.apiKeys.elevenlabs) auth.setIsTopPro(true);
            }
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
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.update().catch(() => {});
      }).catch(err => console.error('SW registration failed:', err));
    }
    try { initMonitoring(); } catch {}
  }, []);
}
