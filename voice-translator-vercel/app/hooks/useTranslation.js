'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getLang, FREE_DAILY_LIMIT, SILENCE_DELAY, VAD_THRESHOLD, REVIEW_INTERVAL, CHUNK_MIN_WORDS, CHUNK_MAX_WORDS, LIVE_TEXT_THROTTLE, BROWSER_SPEAK_MIN_DURATION, BROWSER_SPEAK_CHAR_RATE } from '../lib/constants.js';
import { t } from '../lib/i18n.js';

// Languages that don't use spaces between words - need Intl.Segmenter or char-based counting
const NO_SPACE_LANGS = new Set(['th', 'zh', 'ja', 'km', 'lo', 'my']);

function countWords(text, langCode) {
  if (!text || !text.trim()) return 0;
  // For languages without word spaces, use Intl.Segmenter if available, else estimate by chars
  if (NO_SPACE_LANGS.has(langCode)) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter(langCode, { granularity: 'word' });
        return [...segmenter.segment(text)].filter(s => s.isWordLike).length;
      } catch {}
    }
    // Fallback: estimate ~2 chars per "word" for Thai/CJK (triggers chunking more often)
    return Math.ceil(text.trim().length / 2);
  }
  return text.split(/\s+/).filter(w => w).length;
}

export default function useTranslation({
  myLangRef,
  roomInfoRef,
  prefsRef,
  roomId,
  roomContextRef,
  isTrialRef,
  isTopProRef,
  freeCharsRef,
  useOwnKeys,
  getMicStream,
  unlockAudio,
  broadcastLiveText,
  setSpeakingState,
  getEffectiveToken,
  refreshBalance,
  trackFreeChars
}) {
  const [recording, setRecording] = useState(false);
  const [streamingMsg, setStreamingMsg] = useState(null);
  const [sendingText, setSendingText] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Streaming refs
  const speechRecRef = useRef(null);
  const wordBufferRef = useRef('');
  const allWordsRef = useRef('');
  const translatedChunksRef = useRef([]);
  const reviewTimerRef = useRef(null);
  const streamingModeRef = useRef(false);
  const chunkingActiveRef = useRef(false);
  const lastInterimRef = useRef('');
  const backupRecRef = useRef(null);
  const backupChunksRef = useRef([]);
  const backupStreamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const vadStreamRef = useRef(null);
  const vadRecRef = useRef(null);
  const vadTimerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const vadAnalyserRef = useRef(null);

  async function translateUniversal(text, sourceLang, targetLang, sourceLangName, targetLangName, options = {}) {
    if (isTrialRef.current) {
      if (freeCharsRef.current >= FREE_DAILY_LIMIT) {
        return { translated: text, fallback: true, limitExceeded: true };
      }
      const res = await fetch('/api/translate-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang })
      });
      if (!res.ok) return { translated: text };
      const data = await res.json();
      if (data.charsUsed > 0) trackFreeChars(data.charsUsed);
      return data;
    }
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        sourceLang,
        targetLang,
        sourceLangName,
        targetLangName,
        roomId,
        aiModel: prefsRef.current?.aiModel || undefined,
        ...options,
        userToken: getEffectiveToken()
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(errData.error || 'No credits');
      throw new Error('Translation error');
    }
    return await res.json();
  }

  function getTargetLangInfo() {
    const currentMyLang = myLangRef.current;
    const currentRoomInfo = roomInfoRef.current;
    const currentPrefs = prefsRef.current;
    const myL = getLang(currentMyLang);
    let otherLangCode = null;
    if (currentRoomInfo && currentRoomInfo.members) {
      const other = currentRoomInfo.members.find(m => m.name !== currentPrefs.name);
      if (other) otherLangCode = other.lang;
    }
    if (!otherLangCode) otherLangCode = currentMyLang === 'en' ? 'it' : 'en';
    return { myL, otherL: getLang(otherLangCode) };
  }

  async function startStreamingTranslation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      startClassicRecording();
      return;
    }

    unlockAudio();
    setRecording(true);
    if (roomId) setSpeakingState(roomId, true);

    wordBufferRef.current = '';
    allWordsRef.current = '';
    lastInterimRef.current = '';
    translatedChunksRef.current = [];
    chunkingActiveRef.current = false;
    streamingModeRef.current = true;
    backupChunksRef.current = [];
    setStreamingMsg({ original: '', translated: '', isStreaming: true });

    if (!isTrialRef.current) {
      try {
        const stream = await getMicStream();
        backupStreamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';
        const backup = new MediaRecorder(stream, { mimeType: mime });
        backup.ondataavailable = e => {
          if (e.data.size > 0) backupChunksRef.current.push(e.data);
        };
        backupRecRef.current = backup;
        backup.start(250);
      } catch (e) {
        setRecording(false);
        streamingModeRef.current = false;
        setStreamingMsg(null);
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getLang(myLangRef.current).speech;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    speechRecRef.current = recognition;

    let processedFinals = new Set();
    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          const key = i + ':' + text;
          if (text && !processedFinals.has(key)) {
            processedFinals.add(key);
            lastInterimRef.current = '';
            wordBufferRef.current = (wordBufferRef.current + ' ' + text).trim();
            allWordsRef.current = (allWordsRef.current + ' ' + text).trim();
            setStreamingMsg(prev => (prev ? { ...prev, original: allWordsRef.current } : null));
            broadcastLiveText(allWordsRef.current);
            const bufferWords = countWords(wordBufferRef.current, myLangRef.current);
            if (bufferWords >= CHUNK_MIN_WORDS) emitChunk();
          }
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (interimTranscript) {
        lastInterimRef.current = interimTranscript.trim();
        const preview = allWordsRef.current + ' ' + interimTranscript.trim();
        setStreamingMsg(prev => (prev ? { ...prev, original: preview } : null));
        broadcastLiveText(preview);
        const totalPending = (wordBufferRef.current + ' ' + interimTranscript.trim()).trim();
        if (countWords(totalPending, myLangRef.current) >= CHUNK_MAX_WORDS && wordBufferRef.current.trim())
          emitChunk();
      }
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      if (streamingModeRef.current) {
        processedFinals = new Set();
        try {
          recognition.start();
        } catch {}
      }
    };
    try {
      recognition.start();
    } catch {}
    reviewTimerRef.current = setInterval(() => postHocReview(), REVIEW_INTERVAL);
  }

  async function emitChunk() {
    const chunk = wordBufferRef.current.trim();
    if (!chunk || chunkingActiveRef.current) return;
    wordBufferRef.current = '';
    chunkingActiveRef.current = true;
    const { myL, otherL } = getTargetLangInfo();
    try {
      const prevContext = translatedChunksRef.current.slice(-2).join(' ');
      const data = await translateUniversal(chunk, myL.code, otherL.code, myL.name, otherL.name, {
        context: prevContext || undefined,
        domainContext: roomContextRef.current.contextPrompt || undefined,
        description: roomContextRef.current.description || undefined
      });
      if (data.translated) {
        translatedChunksRef.current.push(data.translated);
        const fullTranslation = translatedChunksRef.current.join(' ');
        setStreamingMsg(prev => (prev ? { ...prev, translated: fullTranslation } : null));
      }
    } catch (e) {
      console.error('[Chunk] Translation error:', e);
    }
    chunkingActiveRef.current = false;
    if (wordBufferRef.current.trim()) {
      const bufferWords = countWords(wordBufferRef.current, myLangRef.current);
      if (bufferWords >= CHUNK_MIN_WORDS) emitChunk();
    }
  }

  async function postHocReview() {
    const allOriginal = allWordsRef.current.trim();
    if (!allOriginal) return;
    const lang = myLangRef.current;
    const wordCount = countWords(allOriginal, lang);
    if (wordCount < 10) return;
    // For no-space languages, take last ~50 chars; for others, last 25 words
    let reviewText;
    if (NO_SPACE_LANGS.has(lang)) {
      reviewText = allOriginal.slice(-80);
    } else {
      const words = allOriginal.split(/\s+/).filter(w => w);
      reviewText = words.slice(-25).join(' ');
    }
    const { myL, otherL } = getTargetLangInfo();
    try {
      if (isTrialRef.current) return;
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: reviewText,
          sourceLang: myL.code,
          targetLang: otherL.code,
          sourceLangName: myL.name,
          targetLangName: otherL.name,
          roomId,
          isReview: true,
          aiModel: prefsRef.current?.aiModel || undefined,
          domainContext: roomContextRef.current.contextPrompt || undefined,
          description: roomContextRef.current.description || undefined,
          userToken: getEffectiveToken()
        })
      });
      if (res.ok) {
        const { translated } = await res.json();
        if (translated && translatedChunksRef.current.length > 0) {
          const reviewWordCount = countWords(reviewText, lang);
          const avgWordsPerChunk = Math.max(1, wordCount / translatedChunksRef.current.length);
          const chunksToReplace = Math.min(
            translatedChunksRef.current.length,
            Math.ceil(reviewWordCount / avgWordsPerChunk)
          );
          const keptChunks = translatedChunksRef.current.slice(0, -chunksToReplace);
          translatedChunksRef.current = [...keptChunks, translated];
          const fullTranslation = translatedChunksRef.current.join(' ');
          setStreamingMsg(prev => (prev ? { ...prev, translated: fullTranslation } : null));
        }
      }
    } catch (e) {
      console.error('[Review] Error:', e);
    }
  }

  async function stopStreamingTranslation() {
    streamingModeRef.current = false;
    setRecording(false);
    if (roomId) setSpeakingState(roomId, false);
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {}
      speechRecRef.current = null;
    }
    if (reviewTimerRef.current) {
      clearInterval(reviewTimerRef.current);
      reviewTimerRef.current = null;
    }

    let backupBlob = null;
    if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
      await new Promise(resolve => {
        backupRecRef.current.onstop = () => resolve();
        backupRecRef.current.stop();
      });
      if (backupChunksRef.current.length > 0)
        backupBlob = new Blob(backupChunksRef.current, { type: backupRecRef.current.mimeType });
    }
    backupRecRef.current = null;
    backupStreamRef.current = null;

    if (lastInterimRef.current) {
      const pending = lastInterimRef.current.trim();
      const existing = allWordsRef.current.trim();
      if (pending && !existing.endsWith(pending) && !existing.includes(pending)) {
        wordBufferRef.current = (wordBufferRef.current + ' ' + pending).trim();
        allWordsRef.current = (existing + ' ' + pending).trim();
      }
      lastInterimRef.current = '';
    }

    if (wordBufferRef.current.trim()) await emitChunk();

    const allOriginal = allWordsRef.current.trim();

    if (!allOriginal && backupBlob && backupBlob.size > 1000 && !isTrialRef.current) {
      setStreamingMsg(null);
      try {
        await processAndSendAudio(backupBlob);
      } catch (err) {}
      return;
    }

    if (!allOriginal) {
      setStreamingMsg(null);
      return;
    }

    const { myL, otherL } = getTargetLangInfo();
    let finalTranslation = translatedChunksRef.current.join(' ');
    try {
      if (isTrialRef.current) {
        const data = await translateUniversal(allOriginal, myL.code, otherL.code, myL.name, otherL.name);
        if (data.translated) finalTranslation = data.translated;
      } else {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: allOriginal,
            sourceLang: myL.code,
            targetLang: otherL.code,
            sourceLangName: myL.name,
            targetLangName: otherL.name,
            roomId,
            isReview: true,
            aiModel: prefsRef.current?.aiModel || undefined,
            domainContext: roomContextRef.current.contextPrompt || undefined,
            description: roomContextRef.current.description || undefined,
            userToken: getEffectiveToken()
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.translated) finalTranslation = data.translated;
        }
      }
    } catch (e) {
      console.error('[Final] Translation error:', e);
    }

    if (!finalTranslation && backupBlob && backupBlob.size > 1000 && !isTrialRef.current) {
      setStreamingMsg(null);
      try {
        await processAndSendAudio(backupBlob);
      } catch {}
      return;
    }

    if (finalTranslation && roomId) {
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            sender: prefsRef.current.name,
            original: allOriginal,
            translated: finalTranslation,
            sourceLang: myL.code,
            targetLang: otherL.code
          })
        });
      } catch (e) {
        console.error('[Final] Message save error:', e);
      }
    }
    setStreamingMsg(null);
    if (!isTrialRef.current && !useOwnKeys) refreshBalance();
  }

  async function startClassicRecording() {
    unlockAudio();
    setRecording(true);
    if (roomId) setSpeakingState(roomId, true);
    chunksRef.current = [];
    try {
      const stream = await getMicStream();
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      recRef.current = new MediaRecorder(stream, { mimeType: mime });
      recRef.current.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recRef.current.mimeType });
        if (blob.size < 1000) {
          setRecording(false);
          return;
        }
        try {
          await processAndSendAudio(blob);
        } catch (err) {}
        setRecording(false);
        if (!isTrialRef.current && !useOwnKeys) refreshBalance();
      };
      recRef.current.start(100);
    } catch (err) {
      setRecording(false);
      if (roomId) setSpeakingState(roomId, false);
    }
  }

  function stopClassicRecording() {
    if (recRef.current && recRef.current.state === 'recording') {
      if (roomId) setSpeakingState(roomId, false);
      recRef.current.stop();
    }
  }

  async function processAndSendAudio(blob) {
    const currentMyLang = myLangRef.current;
    const currentRoomInfo = roomInfoRef.current;
    const currentPrefs = prefsRef.current;
    const myL = getLang(currentMyLang);
    let otherLangCode = null;
    if (currentRoomInfo && currentRoomInfo.members) {
      const other = currentRoomInfo.members.find(m => m.name !== currentPrefs.name);
      if (other) otherLangCode = other.lang;
    }
    if (!otherLangCode) otherLangCode = currentMyLang === 'en' ? 'it' : 'en';
    const otherL = getLang(otherLangCode);

    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('sourceLang', myL.code);
    form.append('targetLang', otherL.code);
    form.append('sourceLangName', myL.name);
    form.append('targetLangName', otherL.name);
    if (roomId) form.append('roomId', roomId);
    if (roomContextRef.current.contextPrompt) form.append('domainContext', roomContextRef.current.contextPrompt);
    if (roomContextRef.current.description) form.append('description', roomContextRef.current.description);
    const effectiveToken = getEffectiveToken();
    if (effectiveToken) form.append('userToken', effectiveToken);
    if (prefsRef.current?.aiModel) form.append('aiModel', prefsRef.current.aiModel);

    const res = await fetch('/api/process', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Server error');
    const { original, translated, cost } = await res.json();
    if (original && roomId) {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          sender: currentPrefs.name,
          original,
          translated,
          sourceLang: myL.code,
          targetLang: otherL.code
        })
      });
    }
  }

  async function toggleRecording() {
    if (recording) {
      if (streamingModeRef.current) {
        stopStreamingTranslation();
      } else {
        stopClassicRecording();
      }
    } else {
      startStreamingTranslation();
    }
  }

  async function sendTextMessage() {
    if (!textInput.trim() || sendingText || !roomId) return;
    setSendingText(true);
    try {
      const myL = getLang(myLangRef.current);
      let otherLangCode = null;
      if (roomInfoRef.current && roomInfoRef.current.members) {
        const other = roomInfoRef.current.members.find(m => m.name !== prefsRef.current.name);
        if (other) otherLangCode = other.lang;
      }
      if (!otherLangCode) otherLangCode = myLangRef.current === 'en' ? 'it' : 'en';
      const otherL = getLang(otherLangCode);
      const data = await translateUniversal(
        textInput.trim(),
        myL.code,
        otherL.code,
        myL.name,
        otherL.name,
        {
          domainContext: roomContextRef.current.contextPrompt || undefined,
          description: roomContextRef.current.description || undefined
        }
      );
      if (data.translated) {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            sender: prefsRef.current.name,
            original: textInput.trim(),
            translated: data.translated,
            sourceLang: myL.code,
            targetLang: otherL.code
          })
        });
        setTextInput('');
        if (!isTrialRef.current && !useOwnKeys) refreshBalance();
      }
    } catch (err) {}
    setSendingText(false);
  }

  async function startFreeTalk() {
    if (isListening) return;
    unlockAudio();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const stream = await getMicStream();
      vadStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      vadAnalyserRef.current = analyser;
      setIsListening(true);

      let isRec = false;
      const threshold = VAD_THRESHOLD,
        silenceDelay = SILENCE_DELAY;

      if (SpeechRecognition) {
        wordBufferRef.current = '';
        allWordsRef.current = '';
        translatedChunksRef.current = [];
        streamingModeRef.current = true;
        chunkingActiveRef.current = false;

        const recognition = new SpeechRecognition();
        recognition.lang = getLang(myLangRef.current).speech;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        speechRecRef.current = recognition;

        let ftProcessedFinals = new Set();
        recognition.onresult = (event) => {
          let interimTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript.trim();
              const key = i + ':' + text;
              if (text && !ftProcessedFinals.has(key)) {
                ftProcessedFinals.add(key);
                lastInterimRef.current = '';
                wordBufferRef.current = (wordBufferRef.current + ' ' + text).trim();
                allWordsRef.current = (allWordsRef.current + ' ' + text).trim();
                setStreamingMsg(prev => (prev ? { ...prev, original: allWordsRef.current } : null));
                broadcastLiveText(allWordsRef.current);
                const bufferWords = countWords(wordBufferRef.current, myLangRef.current);
                if (bufferWords >= CHUNK_MIN_WORDS) emitChunk();
              }
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          if (interimTranscript) {
            lastInterimRef.current = interimTranscript.trim();
            const preview = allWordsRef.current + ' ' + interimTranscript.trim();
            setStreamingMsg(prev => (prev ? { ...prev, original: preview } : null));
            broadcastLiveText(preview);
            const totalPending = (wordBufferRef.current + ' ' + interimTranscript.trim()).trim();
            if (
              countWords(totalPending, myLangRef.current) >= CHUNK_MAX_WORDS &&
              wordBufferRef.current.trim()
            )
              emitChunk();
          }
        };
        recognition.onerror = () => {};
        recognition.onend = () => {
          if (streamingModeRef.current && isListening) {
            ftProcessedFinals = new Set();
            try {
              recognition.start();
            } catch {}
          }
        };
        recognition.start();
        reviewTimerRef.current = setInterval(() => postHocReview(), REVIEW_INTERVAL);
      }

      function check() {
        if (!vadAnalyserRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;

        if (avg > threshold && !isRec) {
          isRec = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (SpeechRecognition) {
            if (!streamingMsg) setStreamingMsg({ original: '', translated: '', isStreaming: true });
            setRecording(true);
            if (roomId) setSpeakingState(roomId, true);
          } else {
            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';
            const ch = [];
            const r = new MediaRecorder(stream, { mimeType: mime });
            r.ondataavailable = e => {
              if (e.data.size > 0) ch.push(e.data);
            };
            r.onstop = async () => {
              const blob = new Blob(ch, { type: r.mimeType });
              if (blob.size > 1000) await processAndSendAudio(blob).catch(console.error);
            };
            vadRecRef.current = r;
            r.start(100);
            setRecording(true);
            if (roomId) setSpeakingState(roomId, true);
          }
        } else if (avg <= threshold && isRec) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(async () => {
              if (SpeechRecognition) {
                isRec = false;
                setRecording(false);
                if (roomId) setSpeakingState(roomId, false);
                if (wordBufferRef.current.trim()) await emitChunk();
                const allOriginal = allWordsRef.current.trim();
                if (allOriginal && translatedChunksRef.current.length > 0) {
                  const { myL, otherL } = getTargetLangInfo();
                  const finalTranslation = translatedChunksRef.current.join(' ');
                  try {
                    await fetch('/api/messages', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        roomId,
                        sender: prefsRef.current.name,
                        original: allOriginal,
                        translated: finalTranslation,
                        sourceLang: myL.code,
                        targetLang: otherL.code
                      })
                    });
                  } catch {}
                  wordBufferRef.current = '';
                  allWordsRef.current = '';
                  translatedChunksRef.current = [];
                  setStreamingMsg({ original: '', translated: '', isStreaming: true });
                }
              } else {
                if (vadRecRef.current?.state === 'recording') vadRecRef.current.stop();
                isRec = false;
                setRecording(false);
                if (roomId) setSpeakingState(roomId, false);
              }
              silenceTimerRef.current = null;
            }, silenceDelay);
          }
        } else if (avg > threshold && isRec && silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        vadTimerRef.current = requestAnimationFrame(check);
      }
      check();
    } catch (err) {}
  }

  function stopFreeTalk() {
    setIsListening(false);
    setRecording(false);
    if (vadTimerRef.current) {
      cancelAnimationFrame(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (vadRecRef.current?.state === 'recording') vadRecRef.current.stop();
    vadStreamRef.current = null;
    vadAnalyserRef.current = null;
    if (streamingModeRef.current) {
      streamingModeRef.current = false;
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {}
        speechRecRef.current = null;
      }
      if (reviewTimerRef.current) {
        clearInterval(reviewTimerRef.current);
        reviewTimerRef.current = null;
      }
      setStreamingMsg(null);
    }
  }

  useEffect(() => {
    return () => {
      // Stop free talk and all active streams
      stopFreeTalk();

      // Clean up streaming mode
      streamingModeRef.current = false;
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {}
        speechRecRef.current = null;
      }

      // Clear all timers and intervals
      if (reviewTimerRef.current) {
        clearInterval(reviewTimerRef.current);
        reviewTimerRef.current = null;
      }

      // Clean up backup MediaRecorder and stream
      if (backupRecRef.current && backupRecRef.current.state !== 'inactive') {
        try {
          backupRecRef.current.stop();
        } catch {}
        backupRecRef.current = null;
      }
      if (backupStreamRef.current) {
        backupStreamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch {}
        });
        backupStreamRef.current = null;
      }
      backupChunksRef.current = [];

      // Clean up classic MediaRecorder
      if (recRef.current && recRef.current.state !== 'inactive') {
        try {
          recRef.current.stop();
        } catch {}
        recRef.current = null;
      }
      chunksRef.current = [];

      // Clean up VAD stream and timers
      if (vadStreamRef.current) {
        vadStreamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch {}
        });
        vadStreamRef.current = null;
      }
      if (vadTimerRef.current) {
        cancelAnimationFrame(vadTimerRef.current);
        vadTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      vadAnalyserRef.current = null;

      // Reset all refs
      wordBufferRef.current = '';
      allWordsRef.current = '';
      translatedChunksRef.current = [];
      lastInterimRef.current = '';
      chunkingActiveRef.current = false;
    };
  }, []);

  return {
    recording,
    streamingMsg,
    sendingText,
    textInput,
    setTextInput,
    toggleRecording,
    sendTextMessage,
    startFreeTalk,
    stopFreeTalk,
    startStreamingTranslation,
    stopStreamingTranslation,
    translateUniversal,
    startClassicRecording,
    stopClassicRecording,
    processAndSendAudio,
    isListening,
    streamingModeRef,
    speechRecRef,
    reviewTimerRef,
    backupRecRef,
    backupStreamRef,
    wordBufferRef,
    allWordsRef,
    translatedChunksRef
  };
}
