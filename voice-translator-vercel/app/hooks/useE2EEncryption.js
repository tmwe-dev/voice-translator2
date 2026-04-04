'use client';
import { useRef, useCallback } from 'react';
import {
  generateKeyPair, exportPublicKey, importPublicKey,
  deriveSharedKey, encryptMessage, decryptMessage, isE2EAvailable,
} from '../lib/e2eCrypto.js';
import { sendViaDataChannel } from '../lib/webrtc.js';

/**
 * useE2EEncryption — Manages E2E encryption for WebRTC DataChannel.
 *
 * Handles:
 * - ECDH key pair generation
 * - Public key exchange via DataChannel
 * - Shared secret derivation
 * - Message encryption/decryption
 *
 * Returns refs + handlers to integrate with useWebRTC.
 */
export default function useE2EEncryption() {
  const keyPairRef = useRef(null);
  const sharedKeyRef = useRef(null);
  const readyRef = useRef(false);

  /** Generate key pair and send public key via DataChannel */
  const initiateKeyExchange = useCallback(async (dc) => {
    if (!isE2EAvailable()) { readyRef.current = false; return; }
    try {
      const keyPair = await generateKeyPair();
      keyPairRef.current = keyPair;
      const pubKeyStr = await exportPublicKey(keyPair.publicKey);
      if (dc?.readyState === 'open') {
        dc.send(JSON.stringify({ type: 'e2e-pubkey', key: pubKeyStr }));
      }
    } catch (e) {
      console.warn('[E2E] Key generation failed:', e);
      readyRef.current = false;
    }
  }, []);

  /** Handle received partner public key → derive shared secret */
  const handlePartnerKey = useCallback(async (partnerKeyStr) => {
    if (!keyPairRef.current) return;
    try {
      const partnerPubKey = await importPublicKey(partnerKeyStr);
      const sharedKey = await deriveSharedKey(keyPairRef.current.privateKey, partnerPubKey);
      sharedKeyRef.current = sharedKey;
      readyRef.current = true;
      console.log('[E2E] Shared key derived — messages are now encrypted');
    } catch (e) {
      console.warn('[E2E] Key derivation failed:', e);
      readyRef.current = false;
    }
  }, []);

  /** Send message via DataChannel with E2E encryption if available */
  const sendEncrypted = useCallback(async (dc, msg) => {
    if (!dc || dc.readyState !== 'open') return false;
    // Control messages bypass encryption for low latency
    const isControlMsg = msg?.type === 'ping' || msg?.type === 'pong' || msg?.type === 'e2e-pubkey'
      || msg?.type === 'video-toggle' || msg?.type === 'audio-toggle';
    if (readyRef.current && sharedKeyRef.current && !isControlMsg) {
      try {
        const plaintext = JSON.stringify(msg);
        const encrypted = await encryptMessage(sharedKeyRef.current, plaintext);
        return sendViaDataChannel(dc, { type: 'e2e-encrypted', data: encrypted });
      } catch {
        return sendViaDataChannel(dc, msg);
      }
    }
    return sendViaDataChannel(dc, msg);
  }, []);

  /** Decrypt an E2E-encrypted message */
  const decryptMsg = useCallback(async (encryptedData) => {
    if (!sharedKeyRef.current) return null;
    try {
      const plaintext = await decryptMessage(sharedKeyRef.current, encryptedData);
      let msg; try { msg = JSON.parse(plaintext); } catch { console.warn('[E2E] JSON parse failed'); return null; }
      return msg;
    } catch (e) {
      console.warn('[E2E] Decryption failed:', e);
      return null;
    }
  }, []);

  /** Reset all keys (call on disconnect) */
  const reset = useCallback(() => {
    keyPairRef.current = null;
    sharedKeyRef.current = null;
    readyRef.current = false;
  }, []);

  return {
    readyRef,
    sharedKeyRef,
    initiateKeyExchange,
    handlePartnerKey,
    sendEncrypted,
    decryptMsg,
    reset,
  };
}
