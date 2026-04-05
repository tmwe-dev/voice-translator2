'use client';
import { useEffect } from 'react';

/**
 * useElevenLabsSync — Auto-loads ElevenLabs voices and syncs selection to localStorage.
 */
export default function useElevenLabsSync(auth) {
  // Auto-load voices when EL access is available
  useEffect(() => {
    if (auth.canUseElevenLabs && auth.elevenLabsVoices.length === 0) {
      const token = auth.userTokenRef.current || '';
      fetch(`/api/tts-elevenlabs?action=voices&token=${token}`)
        .then(r => r.json())
        .then(data => { if (data.voices) auth.setElevenLabsVoices(data.voices); })
        .catch(() => {});
    }
  }, [auth.canUseElevenLabs]);

  // Load saved voice from localStorage
  useEffect(() => {
    try {
      const savedVoice = localStorage.getItem('vt-elvoice');
      if (savedVoice) auth.setSelectedELVoice(savedVoice);
    } catch {}
  }, []);

  // Persist voice selection
  useEffect(() => {
    if (auth.selectedELVoice) {
      try { localStorage.setItem('vt-elvoice', auth.selectedELVoice); } catch {}
    }
  }, [auth.selectedELVoice]);

  // Auto-select cloned voice
  useEffect(() => {
    if (auth.clonedVoiceId && !auth.selectedELVoice && auth.canUseElevenLabs) {
      auth.setSelectedELVoice(auth.clonedVoiceId);
    }
  }, [auth.clonedVoiceId, auth.canUseElevenLabs]);
}
