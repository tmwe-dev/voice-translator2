'use client';
import { useEffect } from 'react';
import { LANGS, AVATARS } from '../lib/constants.js';

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
  setAutoJoinTriggered, auth, initMonitoring,
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

      // 2. URL language override
      const langParam = urlParams.get('lang');
      if (langParam && LANGS.find(l => l.code === langParam)) {
        setInviteMsgLang(langParam);
        setMyLang(langParam);
        setPrefs(p => {
          const updated = { ...p, lang: langParam };
          localStorage.setItem('vt-prefs', JSON.stringify(updated));
          return updated;
        });
      }

      // 3. Guest pre-fill from QR invite (gn=name, gg=gender, gl=language)
      const guestNameParam = urlParams.get('gn');
      const guestGenderParam = urlParams.get('gg');
      const guestLangParam = urlParams.get('gl');
      if (guestNameParam || guestGenderParam || guestLangParam) {
        setPrefs(p => {
          const updated = {
            ...p,
            autoPlay: true, // Ensure guests always have audio enabled
            ...(guestNameParam ? { name: decodeURIComponent(guestNameParam) } : {}),
            ...(guestGenderParam ? { gender: guestGenderParam } : {}),
            ...(guestLangParam ? { lang: guestLangParam } : {}),
          };
          localStorage.setItem('vt-prefs', JSON.stringify(updated));
          return updated;
        });
        if (guestLangParam && LANGS.find(l => l.code === guestLangParam)) {
          setMyLang(guestLangParam);
          setInviteMsgLang(guestLangParam);
        }
        if (typeof window !== 'undefined') window.__VT_GUEST_PREFILLED = true;
      }

      // 4. Capture referral code
      const refParam = urlParams.get('ref');
      if (refParam) auth.setPendingReferralCode(refParam);

      // 5. Capture invite code (contacts system)
      const inviteParam = urlParams.get('invite');
      if (inviteParam) {
        localStorage.setItem('vt-pending-invite', inviteParam);
        window.history.replaceState({}, '', window.location.pathname);
      }

      // 6. Room join from URL
      const autoJoin = urlParams.get('auto') === '1';
      if (roomParam) {
        setJoinCode(roomParam.toUpperCase());
        window.history.replaceState({}, '', window.location.pathname);

        if (autoJoin && saved) {
          let p; try { p = JSON.parse(saved); } catch { p = null; }
          if (p && p.name && p.lang) {
            if (langParam) { p.lang = langParam; setPrefs(p); setMyLang(langParam); }
            setTimeout(() => setAutoJoinTriggered(true), 500);
          }
        }

        const canAutoJoinFromQR = autoJoin && guestNameParam && (guestLangParam || langParam);
        if (canAutoJoinFromQR) {
          setTimeout(() => setAutoJoinTriggered(true), 800);
        }
      }

      if (paymentStatus === 'success' && paymentCredits) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      // 7. Determine initial view
      const pickView = (hasSaved) => {
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
        console.log('[TESTING_MODE] Auto-login with test account...');
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
              console.log('[TESTING_MODE] Logged in as test@bartalk.dev');
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
