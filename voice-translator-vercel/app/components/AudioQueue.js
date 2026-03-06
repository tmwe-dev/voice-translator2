'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Production-grade audio queue with sequence counters
 * Ensures audio plays in order even if synthesis completes out of order
 *
 * Features:
 * - Sequence counter for ordered playback
 * - Async synthesis + sequential playback
 * - Memory management with URL.revokeObjectURL
 * - Pause/resume/skip controls
 * - Rate adjustment
 */
export function useAudioQueue() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSeq, setCurrentSeq] = useState(0);
  const [queueLength, setQueueLength] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const nextSeqRef = useRef(0);
  const queueRef = useRef(new Map()); // seq → { blob, url, text }
  const audioRef = useRef(null);
  const isProcessingRef = useRef(false);

  /**
   * Add audio to the queue
   * @param {Blob} blob - Audio blob
   * @param {string} text - Original text (for display)
   * @returns {number} Sequence number
   */
  const enqueue = useCallback((blob, text = '') => {
    const seq = nextSeqRef.current++;
    const url = URL.createObjectURL(blob);
    queueRef.current.set(seq, { blob, url, text });
    setQueueLength(queueRef.current.size);

    // Start processing if not already
    if (!isProcessingRef.current) {
      processQueue();
    }

    return seq;
  }, []);

  /**
   * Process the queue — play items in sequence order
   */
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (true) {
      const item = queueRef.current.get(currentSeq);
      if (!item) {
        // Wait for the next item (might be synthesizing)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check again — if still nothing and queue is empty, stop
        if (!queueRef.current.has(currentSeq) && queueRef.current.size === 0) {
          break;
        }
        if (!queueRef.current.has(currentSeq)) {
          // Item might come later, keep waiting (max 10s)
          let waited = 0;
          while (!queueRef.current.has(currentSeq) && waited < 10000) {
            await new Promise(r => setTimeout(r, 100));
            waited += 100;
          }
          if (!queueRef.current.has(currentSeq)) break; // Timeout
        }
        continue;
      }

      // Play this item
      setIsPlaying(true);
      setCurrentSeq(prev => prev);

      try {
        await playAudio(item.url);
      } catch (e) {
        console.warn('[AudioQueue] Playback error:', e.message);
      }

      // Clean up
      URL.revokeObjectURL(item.url);
      queueRef.current.delete(currentSeq);
      setCurrentSeq(prev => prev + 1);
      setQueueLength(queueRef.current.size);
    }

    setIsPlaying(false);
    isProcessingRef.current = false;
  }, [currentSeq]);

  /**
   * Play a single audio URL
   */
  const playAudio = useCallback((url) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;

      audio.onended = () => {
        audioRef.current = null;
        resolve();
      };
      audio.onerror = (e) => {
        audioRef.current = null;
        reject(e);
      };

      audio.play().catch(reject);
    });
  }, [playbackRate]);

  /**
   * Pause current playback
   */
  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  /**
   * Resume playback
   */
  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setIsPaused(false);
    }
  }, []);

  /**
   * Skip current audio
   */
  const skip = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = audioRef.current.duration;
      audioRef.current.dispatchEvent(new Event('ended'));
    }
  }, []);

  /**
   * Clear entire queue
   */
  const clear = useCallback(() => {
    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Revoke all URLs
    for (const [, item] of queueRef.current) {
      URL.revokeObjectURL(item.url);
    }
    queueRef.current.clear();

    setIsPlaying(false);
    setIsPaused(false);
    setQueueLength(0);
    nextSeqRef.current = 0;
    setCurrentSeq(0);
    isProcessingRef.current = false;
  }, []);

  /**
   * Update playback rate
   */
  const setRate = useCallback((rate) => {
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    setPlaybackRate(clamped);
    if (audioRef.current) {
      audioRef.current.playbackRate = clamped;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  return {
    enqueue,
    pause,
    resume,
    skip,
    clear,
    setRate,
    isPlaying,
    isPaused,
    currentSeq,
    queueLength,
    playbackRate,
  };
}
