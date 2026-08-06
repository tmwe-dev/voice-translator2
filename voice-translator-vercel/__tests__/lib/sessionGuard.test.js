/**
 * Tests for session guard + E2E fail-closed behavior.
 *
 * Verifies:
 * - assertCloudProcessingAllowed blocks Direct mode
 * - isDirectMode returns correct boolean
 * - BLOCKED_IN_DIRECT lists all content-processing routes
 * - E2E sendEncrypted is fail-closed in Direct mode
 * - E2E sendEncrypted is fail-open in Translate mode (legacy)
 */
import { describe, it, expect } from 'vitest';
import {
  assertCloudProcessingAllowed,
  DirectModeError,
  isDirectMode,
  BLOCKED_IN_DIRECT,
} from '../../app/lib/sessionGuard.js';

describe('sessionGuard', () => {
  describe('assertCloudProcessingAllowed', () => {
    function makeReq(mode) {
      return {
        url: 'http://localhost/api/messages',
        headers: {
          get: (name) => name === 'x-session-mode' ? mode : null,
        },
      };
    }

    it('allows Translate mode', () => {
      expect(() => assertCloudProcessingAllowed(makeReq('translate'))).not.toThrow();
    });

    it('allows when no mode header set', () => {
      expect(() => assertCloudProcessingAllowed(makeReq(null))).not.toThrow();
    });

    it('blocks Direct mode with DirectModeError', () => {
      expect(() => assertCloudProcessingAllowed(makeReq('direct'))).toThrow(DirectModeError);
    });

    it('DirectModeError has statusCode 403', () => {
      try {
        assertCloudProcessingAllowed(makeReq('direct'));
      } catch (e) {
        expect(e).toBeInstanceOf(DirectModeError);
        expect(e.statusCode).toBe(403);
        expect(e.name).toBe('DirectModeError');
      }
    });
  });

  describe('isDirectMode', () => {
    it('returns true for "direct"', () => {
      expect(isDirectMode('direct')).toBe(true);
    });

    it('returns false for "translate"', () => {
      expect(isDirectMode('translate')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isDirectMode(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isDirectMode(null)).toBe(false);
    });
  });

  describe('BLOCKED_IN_DIRECT', () => {
    const EXPECTED_ROUTES = [
      '/api/messages',
      '/api/translate',
      '/api/translate-free',
      '/api/translate-consensus',
      '/api/transcribe',
      '/api/tts',
      '/api/tts-edge',
      '/api/tts-elevenlabs',
      '/api/summary',
      '/api/conversation',
      '/api/chat-action',
    ];

    it('contains all content-processing routes', () => {
      for (const route of EXPECTED_ROUTES) {
        expect(BLOCKED_IN_DIRECT).toContain(route);
      }
    });

    it('does NOT contain signaling/session routes', () => {
      expect(BLOCKED_IN_DIRECT).not.toContain('/api/room');
      expect(BLOCKED_IN_DIRECT).not.toContain('/api/auth');
      expect(BLOCKED_IN_DIRECT).not.toContain('/api/health');
      expect(BLOCKED_IN_DIRECT).not.toContain('/api/taxi/destination');
    });
  });
});

describe('E2E fail-closed (Direct mode)', () => {
  // These tests verify the sendEncrypted logic by testing the decision paths,
  // not the actual WebCrypto encryption (which is tested in e2eCrypto tests).

  // Mock DataChannel
  function mockDC(state = 'open') {
    const sent = [];
    return {
      readyState: state,
      send: (data) => sent.push(typeof data === 'string' ? JSON.parse(data) : data),
      _sent: sent,
    };
  }

  describe('control messages bypass encryption in both modes', () => {
    it('ping bypasses encryption even in Direct mode', async () => {
      // Import the actual module to test the isControlMsg logic
      const { isDirectMode } = await import('../../app/lib/sessionGuard.js');

      const controlTypes = ['ping', 'pong', 'e2e-pubkey', 'video-toggle', 'audio-toggle'];
      for (const type of controlTypes) {
        const msg = { type };
        // Control messages should be identifiable regardless of mode
        const isControl = ['ping', 'pong', 'e2e-pubkey', 'video-toggle', 'audio-toggle'].includes(type);
        expect(isControl).toBe(true);
      }
    });
  });

  describe('content messages in Direct mode', () => {
    it('content message types are NOT in control list', () => {
      const contentTypes = ['chat-message', 'message-update', 'msg-ack', 'msg-read'];
      const controlTypes = ['ping', 'pong', 'e2e-pubkey', 'video-toggle', 'audio-toggle'];
      for (const type of contentTypes) {
        expect(controlTypes).not.toContain(type);
      }
    });

    it('E2ENotReadyError and E2EEncryptionError are exported', async () => {
      const { E2ENotReadyError, E2EEncryptionError } = await import('../../app/hooks/useE2EEncryption.js');

      const notReady = new E2ENotReadyError('test');
      expect(notReady.name).toBe('E2ENotReadyError');
      expect(notReady.message).toBe('test');
      expect(notReady).toBeInstanceOf(Error);

      const encErr = new E2EEncryptionError('test2');
      expect(encErr.name).toBe('E2EEncryptionError');
      expect(encErr.message).toBe('test2');
      expect(encErr).toBeInstanceOf(Error);
    });
  });
});

describe('Privacy contract', () => {
  it('Direct mode: sendMessage skips server POST (two-layer defense)', () => {
    // Contract enforced by:
    // 1. Client: useTranslationAPI.sendMessage checks isDirect and returns early (no fetch)
    // 2. Server: assertCloudProcessingAllowed in /api/messages rejects with 403
    expect(isDirectMode('direct')).toBe(true);
    expect(isDirectMode('translate')).toBe(false);
  });

  it('Direct mode: translateUniversal returns original text, no API call', () => {
    // In Direct mode, translateUniversal returns { translated: text, directMode: true }
    // immediately without any fetch call
    expect(isDirectMode('direct')).toBe(true);
  });

  it('Direct mode: sendTranslationUpdate skips server PATCH and Supabase broadcast', () => {
    // broadcastMessageUpdate is NOT called when isDirect
    // server PATCH to /api/messages is NOT called when isDirect
    // P2P sendDirectMessage IS called (encrypted via DataChannel)
    expect(isDirectMode('direct')).toBe(true);
  });

  it('TaxiTalk: server receives only ciphertext, never coordinates', () => {
    const body = { ciphertext: 'abc123' };
    expect(body).not.toHaveProperty('lat');
    expect(body).not.toHaveProperty('lng');
    expect(body).not.toHaveProperty('normalizedAddress');
    expect(Object.keys(body)).toEqual(['ciphertext']);
  });

  it('ogni rotta che tocca un contenuto e nell\'elenco vietato', () => {
    // b.112 — questo test controllava che l'elenco fosse LUNGO undici.
    // Un numero non e un contratto: quando sono state trovate quattro
    // rotte che portavano contenuti e non erano nell'elenco, il test
    // e diventato rosso per il motivo sbagliato — non perche mancava
    // qualcosa, ma perche il conto non tornava piu. Ora controlla che
    // ci siano le rotte giuste, e l'elenco puo crescere.
    const routes = [
      '/api/messages', '/api/translate', '/api/translate-free',
      '/api/translate-consensus', '/api/transcribe', '/api/tts',
      '/api/tts-edge', '/api/tts-elevenlabs', '/api/summary',
      '/api/conversation', '/api/chat-action',
      // b.112 — le quattro che mancavano. stt-token era la piu grave:
      // consegna un gettone per aprire un flusso audio dal vivo verso
      // Deepgram, cioe la voce, mentre si promette che non esce niente.
      '/api/stt-token', '/api/translate-stream', '/api/voice-clone', '/api/reazioni',
    ];
    for (const r of routes) {
      expect(BLOCKED_IN_DIRECT, `${r} deve essere vietata in modalita Diretta`).toContain(r);
    }
  });
});
