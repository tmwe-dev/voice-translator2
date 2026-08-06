'use client';
import { useRef, useCallback, useState } from 'react';
import {
  generateKeyPair, exportPublicKey, importPublicKey,
  deriveSharedKey, encryptMessage, decryptMessage, isE2EAvailable,
} from '../lib/e2eCrypto.js';
import { sendViaDataChannel } from '../lib/webrtc.js';
import { isDirectMode } from '../lib/sessionGuard.js';
import { createLogger } from '../lib/logger.js';
import { numeroDiSicurezza } from '../lib/improntaChiavi.js';
const dbg = createLogger('e2e');

/**
 * useE2EEncryption — Manages E2E encryption for WebRTC DataChannel.
 *
 * Handles:
 * - ECDH key pair generation
 * - Public key exchange via DataChannel
 * - Shared secret derivation
 * - Message encryption/decryption
 *
 * In Direct mode: FAIL-CLOSED — content messages are BLOCKED if E2E
 * is not ready or encryption fails. No cleartext fallback ever.
 * Control messages (ping/pong/toggle/pubkey) bypass encryption in all modes.
 *
 * In Translate mode: fail-open (legacy behavior) — if E2E not ready,
 * messages are sent in cleartext (server handles translation anyway).
 *
 * @param {Object} opts
 * @param {React.MutableRefObject<string>} opts.sessionModeRef - 'direct' | 'translate'
 */
export default function useE2EEncryption({ sessionModeRef, roomIdRef } = {}) {
  const keyPairRef = useRef(null);
  // b.113 — le due chiavi pubbliche servono anche DOPO lo scambio, per
  // calcolare il numero di sicurezza che le due persone si confrontano.
  const miaChiaveRef = useRef(null);
  const suaChiaveRef = useRef(null);
  const [numeroSicurezza, setNumeroSicurezza] = useState('');
  const sharedKeyRef = useRef(null);
  const readyRef = useRef(false);

  /** Generate key pair and send public key via DataChannel */
  const initiateKeyExchange = useCallback(async (dc) => {
    if (!isE2EAvailable()) { readyRef.current = false; return; }
    try {
      const keyPair = await generateKeyPair();
      keyPairRef.current = keyPair;
      const pubKeyStr = await exportPublicKey(keyPair.publicKey);
      miaChiaveRef.current = pubKeyStr;
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

      // ── b.113 · il numero di sicurezza ──
      // Da qui in poi i messaggi sono cifrati. Ma cifrati CON CHI? La
      // matematica non lo sa: sa solo che la chiave ricevuta e valida,
      // non a chi appartiene. Questo numero e l'unico modo che hanno le
      // due persone di scoprire se qualcuno si e messo in mezzo — e
      // devono confrontarlo per una strada che l'attacco non controlla:
      // a voce, di persona, al telefono.
      suaChiaveRef.current = partnerKeyStr;
      try {
        const n = await numeroDiSicurezza(
          miaChiaveRef.current, partnerKeyStr, roomIdRef?.current || ''
        );
        setNumeroSicurezza(n);
      } catch (e) {
        // Senza numero non si blocca la conversazione, ma non si puo
        // nemmeno dire che sia verificata: la schermata lo dira.
        dbg.warn('[E2E] numero di sicurezza non calcolabile:', e?.message);
        setNumeroSicurezza('');
      }

      dbg.debug('[E2E] Shared key derived — messages are now encrypted');
    } catch (e) {
      console.warn('[E2E] Key derivation failed:', e);
      readyRef.current = false;
    }
  }, []);

  /**
   * Send message via DataChannel with E2E encryption.
   *
   * FAIL-CLOSED in Direct mode:
   * - Content messages BLOCKED if E2E not ready → throws E2ENotReadyError
   * - Encryption failure → throws, message NOT sent in cleartext
   *
   * FAIL-OPEN in Translate mode (legacy):
   * - Messages sent in cleartext if E2E not ready
   */
  const sendEncrypted = useCallback(async (dc, msg) => {
    if (!dc || dc.readyState !== 'open') return false;

    const isDirect = isDirectMode(sessionModeRef?.current);

    // Control messages bypass encryption for low latency (both modes)
    const isControlMsg = msg?.type === 'ping' || msg?.type === 'pong' || msg?.type === 'e2e-pubkey'
      || msg?.type === 'video-toggle' || msg?.type === 'audio-toggle';

    if (isControlMsg) {
      return sendViaDataChannel(dc, msg);
    }

    // ── Content message: encrypt or block ──
    if (readyRef.current && sharedKeyRef.current) {
      try {
        const plaintext = JSON.stringify(msg);
        const encrypted = await encryptMessage(sharedKeyRef.current, plaintext);
        return sendViaDataChannel(dc, { type: 'e2e-encrypted', data: encrypted });
      } catch (e) {
        // FAIL-CLOSED in Direct mode: encryption failed → block message
        if (isDirect) {
          console.error('[E2E] Encryption failed in Direct mode — message BLOCKED:', e);
          throw new E2EEncryptionError('Encryption failed — message not sent');
        }
        // Translate mode: fall back to cleartext (server processes anyway)
        console.warn('[E2E] Encryption failed, falling back to cleartext:', e);
        return sendViaDataChannel(dc, msg);
      }
    }

    // E2E not ready (no shared key yet)
    if (isDirect) {
      // FAIL-CLOSED: block the message entirely
      console.error('[E2E] E2E not ready in Direct mode — message BLOCKED');
      throw new E2ENotReadyError('E2E encryption not ready — message not sent');
    }

    // Translate mode: send cleartext (legacy behavior)
    return sendViaDataChannel(dc, msg);
  }, [sessionModeRef]);

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
    // b.113 — anche le chiavi e il numero. Un numero di sicurezza
    // rimasto da una conversazione precedente e peggio di nessun
    // numero: qualcuno lo guarderebbe credendo che valga per questa.
    miaChiaveRef.current = null;
    suaChiaveRef.current = null;
    setNumeroSicurezza('');
  }, []);

  return {
    readyRef,
    sharedKeyRef,
    initiateKeyExchange,
    handlePartnerKey,
    sendEncrypted,
    decryptMsg,
    reset,
    // b.113 — vuoto finche le chiavi non si sono scambiate. Chi lo
    // mostra deve dire la differenza fra "non ancora" e "verificato".
    numeroSicurezza,
  };
}

/**
 * Error thrown when E2E encryption is not yet established.
 * UI should show "waiting for encryption" and block sending.
 */
export class E2ENotReadyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'E2ENotReadyError';
  }
}

/**
 * Error thrown when E2E encryption fails mid-send.
 * In Direct mode, the message is NOT sent.
 */
export class E2EEncryptionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'E2EEncryptionError';
  }
}
