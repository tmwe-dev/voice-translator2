'use client';
import { useState, useRef, useEffect } from 'react';

export default function useAuth() {
  // Auth state
  const [userToken, setUserToken] = useState(null);
  const [userAccount, setUserAccount] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authStep, setAuthStep] = useState('email');
  const [authLoading, setAuthLoading] = useState(false);
  const [authTestCode, setAuthTestCode] = useState('');
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
  const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
  const [selectedELVoice, setSelectedELVoice] = useState('');
  const [platformHasEL, setPlatformHasEL] = useState(false);

  // Refs
  const userTokenRef = useRef(null);
  const isTrialRef = useRef(true);
  const isTopProRef = useRef(false);
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

  // Update tier based on account status
  useEffect(() => {
    if (roomTierOverrideRef.current) return;
    if (userToken && (creditBalance > 0 || useOwnKeys)) {
      setIsTrial(false);
    } else {
      setIsTrial(true);
      if (!(useOwnKeys && apiKeyInputs.elevenlabs?.trim())) {
        setIsTopPro(false);
      }
    }
  }, [userToken, creditBalance, useOwnKeys, apiKeyInputs.elevenlabs]);

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
        if (data.testCode) setAuthTestCode(data.testCode);
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

  async function saveUserApiKeys() {
    const token = userTokenRef.current;
    if (!token) return false;
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
        return true;
      }
      return false;
    } catch (e) {
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
    authTestCode,
    setAuthTestCode,
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
    elevenLabsVoices,
    setElevenLabsVoices,
    selectedELVoice,
    setSelectedELVoice,
    platformHasEL,
    setPlatformHasEL,
    // Refs
    userTokenRef,
    isTrialRef,
    isTopProRef,
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
