'use client';
import { useState, useRef, useEffect } from 'react';
import { TESTING_MODE } from '../lib/config.js';
import { memDel, memSet } from '../lib/memoria.js';

export default function useAuth() {
  // Auth state
  const [userToken, setUserToken] = useState(null);
  const [userAccount, setUserAccount] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authStep, setAuthStep] = useState('email');
  const [authLoading, setAuthLoading] = useState(false);
  const [apiKeyInputs, setApiKeyInputs] = useState({
    openai: '',
    anthropic: '',
    gemini: '',
    elevenlabs: ''
  });
  const [useOwnKeys, setUseOwnKeys] = useState(false);

  // Credits state
  const [creditBalance, setCreditBalance] = useState(0);
  const [referralCode, setReferralCode] = useState(null);
  const [pendingReferralCode, setPendingReferralCode] = useState(null);

  // Tier state
  const [isTrial, setIsTrial] = useState(true);
  const [isTopPro, setIsTopPro] = useState(false);
  const [canUseElevenLabs, setCanUseElevenLabs] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
  const [selectedELVoice, setSelectedELVoice] = useState('');
  const [platformHasEL, setPlatformHasEL] = useState(false);
  // ═══ b.263 — il tier della STANZA come stato, non solo come ref ═══
  // TROVATO DAL VIVO ("l'ospite non ha ElevenLabs tra i servizi"):
  // entrando in una stanza con host PRO l'ospite eredita il tier
  // (page.js), ma canUseElevenLabs restava quello del login — che un
  // ospite non ha mai fatto. Il ref non fa girare l'effetto qui sotto:
  // serve uno stato, cosi i diritti si ricalcolano a ogni entrata/uscita.
  const [tierStanza, setTierStanza] = useState(null);
  const [clonedVoiceId, setClonedVoiceId] = useState(null);
  const [clonedVoiceName, setClonedVoiceName] = useState('');

  // Refs
  const userTokenRef = useRef(null);
  const isTrialRef = useRef(true);
  const isTopProRef = useRef(false);
  const canUseElevenLabsRef = useRef(false);
  const roomTierOverrideRef = useRef(null);

  // Sync refs
  useEffect(() => {
    userTokenRef.current = userToken;
  }, [userToken]);

  useEffect(() => {
    isTrialRef.current = isTrial;
  }, [isTrial]);

  useEffect(() => {
    isTopProRef.current = isTopPro;
  }, [isTopPro]);

  useEffect(() => {
    canUseElevenLabsRef.current = canUseElevenLabs;
  }, [canUseElevenLabs]);

  // ═══ Tier controls ═══
  // TESTING_MODE: all features unlocked, no restrictions
  // Production: set based on user account tier
  useEffect(() => {
    if (TESTING_MODE) {
      setIsTrial(false);
      setIsTopPro(true);
      setCanUseElevenLabs(true);
      return;
    }
    // b.263 — dentro una stanza valgono i diritti dell'HOST: e gia cosi
    // per il tier (page.js) e per l'addebito (hostEmail, b.107): la voce
    // premium era l'unico pezzo rimasto indietro. L'addebito della voce
    // resta sull'host: e il percorso stanza di tts-elevenlabs (b.161/167).
    const ereditaDallaStanza = !!tierStanza && tierStanza !== 'FREE';
    if (!userAccount) {
      setIsTrial(!ereditaDallaStanza);
      setIsTopPro(tierStanza === 'TOP PRO');
      setCanUseElevenLabs(ereditaDallaStanza);
      return;
    }
    const tier = userAccount.tier || userAccount.subscription_plan || 'free';
    // ── Unificazione crediti: chi è LOGGATO non è mai "trial" ──
    // Il suo credito vive nel wallet (secondi): è il server a decidere
    // con il saldo (402 se finito, con ripiego sui provider gratuiti).
    // "Trial" resta solo per chi non ha un account.
    setIsTrial(false);
    setIsTopPro(tier === 'business' || tier === 'top_pro' || tierStanza === 'TOP PRO');
    const hasOwnEL = userAccount.apiKeys?.elevenlabs?.trim?.();
    // ElevenLabs: disponibile se la piattaforma ha la chiave (il saldo
    // wallet lo verifica il server a ogni sintesi) o se ha la chiave sua.
    setCanUseElevenLabs(platformHasEL || !!hasOwnEL || ereditaDallaStanza);
  }, [userAccount, platformHasEL, tierStanza]);

  function getEffectiveToken() {
    if (roomTierOverrideRef.current && roomTierOverrideRef.current !== 'FREE') return undefined;
    return userTokenRef.current || undefined;
  }

  async function sendAuthCode() {
    if (!authEmail.trim() || !authEmail.includes('@')) {
      return false;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-code', email: authEmail.trim() })
      });
      const data = await res.json();
      if (data.ok) {
        setAuthStep('code');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[useAuth] sendAuthCode failed:', e?.message || e);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyAuthCodeFn(pendingRef) {
    if (!authCode.trim()) return false;
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: authEmail.trim(),
          code: authCode.trim(),
          referralCode: pendingRef
        })
      });
      const data = await res.json();
      if (data.ok && data.token) {
        setUserToken(data.token);
        userTokenRef.current = data.token;
        memSet('vt-token', data.token);
        setUserAccount(data.user);
        setCreditBalance(data.user.credits || 0);
        setUseOwnKeys(data.user.useOwnKeys || false);
        if (data.referralCode) setReferralCode(data.referralCode);
        if (data.platformHasElevenLabs) setPlatformHasEL(true);
        if (data.referralInfo?.applied) {
          // referral bonus applied
        }
        setPendingReferralCode(null);
        setAuthStep('choose');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[useAuth] verifyAuthCode failed:', e?.message || e);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function refreshBalance() {
    const token = userTokenRef.current;
    if (!token) return;
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credits', token })
      });
      const data = await res.json();
      if (data.credits !== undefined) {
        setCreditBalance(data.credits);
        setUseOwnKeys(data.useOwnKeys || false);
      }
    } catch (e) { console.warn('[useAuth] refreshBalance failed:', e?.message || e); }
  }

  async function buyCredits(packageId) {
    const token = userTokenRef.current;
    if (!token) {
      return false;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', packageId, token })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[useAuth] buyCredits failed:', e?.message || e);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function saveUserApiKeys(onResult) {
    const token = userTokenRef.current;
    if (!token) { onResult?.('error', 'Not authenticated'); return false; }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-keys',
          token,
          apiKeys: apiKeyInputs,
          useOwnKeys: true
        })
      });
      const data = await res.json();
      if (data.ok) {
        setUseOwnKeys(true);
        if (apiKeyInputs.elevenlabs?.trim()) setIsTopPro(true);
        onResult?.('ok');
        return true;
      }
      console.error('[Auth] save-keys failed:', data.error);
      onResult?.('error', data.error || 'Save failed');
      return false;
    } catch (e) {
      console.warn('[useAuth] saveUserApiKeys failed:', e?.message || e);
      onResult?.('error', e.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  // OAuth: handle Google/Apple sign-in response
  async function handleOAuthLogin(data, provider) {
    if (data.ok && data.token) {
      setUserToken(data.token);
      userTokenRef.current = data.token;
      memSet('vt-token', data.token);
      setUserAccount(data.user);
      setCreditBalance(data.user.credits || 0);
      setUseOwnKeys(data.user.useOwnKeys || false);
      if (data.referralCode) setReferralCode(data.referralCode);
      if (data.platformHasElevenLabs) setPlatformHasEL(true);
      if (data.referralInfo?.applied) {
        // referral bonus applied
      }
      setPendingReferralCode(null);
      // b.166 — CONFERMATO (caccia al tesoro): il server ora manda le
      // apiKeys MASCHERATE ("sk-proj12...abcd"), non piu il valore vero —
      // prefillare il campo modificabile con quella stringa e rischioso
      // (un "Salva" senza toccare il campo sovrascriverebbe la chiave vera
      // con la maschera). Si tiene solo il segnale non sensibile "esiste
      // una chiave elevenlabs" per lo stato TOP PRO; il campo di editing
      // resta vuoto finche l'utente non incolla una chiave nuova.
      if (data.user.useOwnKeys && data.user.apiKeys?.elevenlabs) setIsTopPro(true);
      setAuthStep('choose');
      return true;
    }
    return false;
  }

  async function loginWithGoogle(credential, pendingRef) {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, referralCode: pendingRef })
      });
      const data = await res.json();
      return handleOAuthLogin(data, 'google');
    } catch (e) {
      console.warn('[useAuth] loginWithGoogle failed:', e?.message || e);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  // Listen for Google OAuth popup callback
  useEffect(() => {
    function handleOAuthMessage(event) {
      if (event.data?.type === 'google-oauth-result' && event.data?.data) {
        handleOAuthLogin(event.data.data, 'google');
      }
    }
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  async function loginWithApple(authResponse, pendingRef) {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: authResponse.authorization?.id_token,
          user: authResponse.user,
          referralCode: pendingRef
        })
      });
      const data = await res.json();
      return handleOAuthLogin(data, 'apple');
    } catch (e) {
      console.warn('[useAuth] loginWithApple failed:', e?.message || e);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  function logout(opts = {}) {
    // b.167 — CONFERMATO (audit esterno 15/8): prima si puliva solo lo
    // stato locale, mai la sessione sul server. Un token copiato prima
    // del logout restava valido per i 7 giorni interi. Il DELETE parte
    // per primo (fire-and-forget, non blocca l'uscita: se la rete cade
    // l'utente deve poter uscire comunque), la pulizia locale segue
    // subito come prima.
    const tokenUscente = userTokenRef.current;
    if (tokenUscente) {
      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', token: tokenUscente }),
      }).catch(() => {});
    }
    memDel('vt-token');
    if (opts.clearPrefs) {
      memDel('vt-prefs');
      memDel('vt-tutorial-done');
      memDel('vt-free-usage');
    }
    setUserToken(null);
    setUserAccount(null);
    setCreditBalance(0);
    setUseOwnKeys(false);
    setIsTrial(true);
    setIsTopPro(false);
    setReferralCode(null);
  }

  return {
    // State
    userToken,
    setUserToken,
    userAccount,
    setUserAccount,
    authEmail,
    setAuthEmail,
    authCode,
    setAuthCode,
    authStep,
    setAuthStep,
    authLoading,
    setAuthLoading,
    apiKeyInputs,
    setApiKeyInputs,
    useOwnKeys,
    setUseOwnKeys,
    creditBalance,
    setCreditBalance,
    referralCode,
    setReferralCode,
    pendingReferralCode,
    setPendingReferralCode,
    isTrial,
    setIsTrial,
    isTopPro,
    setIsTopPro,
    canUseElevenLabs,
    setCanUseElevenLabs,
    tierStanza, setTierStanza,
    elevenLabsVoices,
    setElevenLabsVoices,
    selectedELVoice,
    setSelectedELVoice,
    platformHasEL,
    setPlatformHasEL,
    clonedVoiceId,
    setClonedVoiceId,
    clonedVoiceName,
    setClonedVoiceName,
    // Refs
    userTokenRef,
    isTrialRef,
    isTopProRef,
    canUseElevenLabsRef,
    roomTierOverrideRef,
    // Functions
    getEffectiveToken,
    sendAuthCode,
    verifyAuthCodeFn,
    loginWithGoogle,
    loginWithApple,
    refreshBalance,
    buyCredits,
    saveUserApiKeys,
    logout
  };
}
