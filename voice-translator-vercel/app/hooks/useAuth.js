'use client';
import { useState, useRef, useEffect } from 'react';
import { TESTING_MODE } from '../lib/config.js';

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
    if (!userAccount) {
      setIsTrial(true);
      setIsTopPro(false);
      setCanUseElevenLabs(false);
      return;
    }
    const tier = userAccount.tier || userAccount.subscription_plan || 'free';
    setIsTrial(tier === 'free');
    setIsTopPro(tier === 'business' || tier === 'top_pro');
    const hasOwnEL = userAccount.apiKeys?.elevenlabs?.trim?.();
    setCanUseElevenLabs(tier !== 'free' || !!hasOwnEL || platformHasEL);
  }, [userAccount, platformHasEL]);

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
        localStorage.setItem('vt-token', data.token);
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
    } catch {}
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
      console.error('[Auth] save-keys error:', e.message);
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
      localStorage.setItem('vt-token', data.token);
      setUserAccount(data.user);
      setCreditBalance(data.user.credits || 0);
      setUseOwnKeys(data.user.useOwnKeys || false);
      if (data.referralCode) setReferralCode(data.referralCode);
      if (data.platformHasElevenLabs) setPlatformHasEL(true);
      if (data.referralInfo?.applied) {
        // referral bonus applied
      }
      setPendingReferralCode(null);
      // Restore API keys if available
      if (data.user.useOwnKeys && data.user.apiKeys) {
        setApiKeyInputs({
          openai: data.user.apiKeys.openai || '',
          anthropic: data.user.apiKeys.anthropic || '',
          gemini: data.user.apiKeys.gemini || '',
          elevenlabs: data.user.apiKeys.elevenlabs || ''
        });
        if (data.user.apiKeys.elevenlabs) setIsTopPro(true);
      }
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
      console.error('Google login error:', e);
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
      console.error('Apple login error:', e);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  function logout(opts = {}) {
    localStorage.removeItem('vt-token');
    if (opts.clearPrefs) {
      localStorage.removeItem('vt-prefs');
      localStorage.removeItem('vt-tutorial-done');
      localStorage.removeItem('vt-free-usage');
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
