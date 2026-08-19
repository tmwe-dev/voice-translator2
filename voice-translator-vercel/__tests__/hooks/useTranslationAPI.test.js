import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock constants
vi.mock('../../app/lib/constants.js', () => ({
  getLang: (code) => {
    const langs = {
      en: { code: 'en', name: 'English', speech: 'en-US' },
      it: { code: 'it', name: 'Italian', speech: 'it-IT' },
      th: { code: 'th', name: 'Thai', speech: 'th-TH' },
    };
    return langs[code] || langs.en;
  },
  FREE_DAILY_LIMIT: 5000,
}));

import useTranslationAPI from '../../app/hooks/useTranslationAPI.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function defaultProps() {
  return {
    myLangRef: { current: 'en' },
    roomInfoRef: { current: { members: [{ name: 'Alice', lang: 'en' }, { name: 'Bob', lang: 'it' }] } },
    prefsRef: { current: { name: 'Alice', aiModel: 'gpt-4o-mini' } },
    roomId: 'test-room',
    roomContextRef: { current: { contextPrompt: null, description: null } },
    isTrialRef: { current: false },
    freeCharsRef: { current: 0 },
    useOwnKeys: false,
    getEffectiveToken: () => 'test-token',
    refreshBalance: vi.fn(),
    trackFreeChars: vi.fn(),
    userEmail: 'test@example.com',
    sentByMeRef: { current: new Set() },
    roomSessionTokenRef: { current: 'rst-123' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTranslationAPI', () => {
  describe('sendMessage', () => {
    it('sends message with instant delivery and fire-and-forget server save', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { id: 'msg-1' } }),
      });

      const { result } = renderHook(() => useTranslationAPI(defaultProps()));

      let response;
      await act(async () => {
        response = await result.current.sendMessage('Hello', 'Ciao', 'en', 'it', { it: 'Ciao' });
      });

      // Now returns instant message + server save promise
      expect(response.message).toBeTruthy();
      // b.120 — era 'sent', ed era una bugia: lo stato veniva messo
      // alla creazione, prima che qualunque cosa fosse partita. Un
      // messaggio parcheggiato in attesa di rete mostrava la stessa
      // spunta di uno arrivato dall'altra parte.
      //
      // Ora nasce 'in-coda' e diventa 'inviato' solo quando il server o
      // il canale diretto lo hanno preso davvero in carico.
      expect(response.message._status).toBe('in-coda');
      expect(response.message.original).toBe('Hello');
      expect(response.message.translated).toBe('Ciao');
      expect(response.serverSave).toBeInstanceOf(Promise);

      expect(mockFetch).toHaveBeenCalledWith('/api/messages', expect.objectContaining({
        method: 'POST',
      }));

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.roomSessionToken).toBe('rst-123');
      expect(body.translations).toEqual({ it: 'Ciao' });
    });

    it('returns null when no roomId', async () => {
      const props = defaultProps();
      props.roomId = null;
      const { result } = renderHook(() => useTranslationAPI(props));

      let response;
      await act(async () => {
        response = await result.current.sendMessage('Hi', 'Ciao', 'en', 'it');
      });

      expect(response).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('tracks sent message IDs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { id: 'msg-42' } }),
      });

      const props = defaultProps();
      const { result } = renderHook(() => useTranslationAPI(props));

      await act(async () => {
        await result.current.sendMessage('Test', 'Test tradotto', 'en', 'it');
      });

      expect(props.sentByMeRef.current.has('msg-42')).toBe(true);
    });
  });

  describe('translateUniversal', () => {
    it('calls paid translation API for non-trial users', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ translated: 'Ciao', confidence: 0.95 }),
      });

      const { result } = renderHook(() => useTranslationAPI(defaultProps()));

      let data;
      await act(async () => {
        data = await result.current.translateUniversal('Hello', 'en', 'it', 'English', 'Italian');
      });

      expect(data.translated).toBe('Ciao');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.userToken).toBe('test-token');
      expect(body.text).toBe('Hello');
    });

    it('uses cache for repeated translations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ translated: 'Ciao' }),
      });

      const { result } = renderHook(() => useTranslationAPI(defaultProps()));

      // First call — hits API
      await act(async () => {
        await result.current.translateUniversal('Hello', 'en', 'it', 'English', 'Italian');
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call — should use cache
      let cached;
      await act(async () => {
        cached = await result.current.translateUniversal('Hello', 'en', 'it', 'English', 'Italian');
      });
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional call
      expect(cached.translated).toBe('Ciao');
      expect(cached.cached).toBe(true);
    });

    it('calls free translation API for trial users', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ translated: 'Ciao', charsUsed: 5 }),
      });

      const props = defaultProps();
      props.isTrialRef = { current: true };
      const { result } = renderHook(() => useTranslationAPI(props));

      await act(async () => {
        await result.current.translateUniversal('Hello', 'en', 'it', 'English', 'Italian');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/translate-free', expect.anything());
    });

    it('uses consensus endpoint for guaranteed mode', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ translated: 'Ciao', charsUsed: 5 }),
      });

      const props = defaultProps();
      props.isTrialRef = { current: true };
      props.prefsRef = { current: { name: 'Alice', translationMode: 'guaranteed' } };
      const { result } = renderHook(() => useTranslationAPI(props));

      await act(async () => {
        await result.current.translateUniversal('Hello', 'en', 'it', 'English', 'Italian');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/translate-consensus', expect.anything());
    });

    it('trial users translate without daily limit (FREE FOR ALL)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ translated: 'Ciao', charsUsed: 5 }),
      });

      const props = defaultProps();
      props.isTrialRef = { current: true };
      props.freeCharsRef = { current: 6000 }; // Even over old limit — no cap anymore
      const { result } = renderHook(() => useTranslationAPI(props));

      let data;
      await act(async () => {
        data = await result.current.translateUniversal('Hello', 'en', 'it', 'English', 'Italian');
      });

      expect(data.translated).toBe('Ciao'); // Translates normally, no limit
    });

    it('falls back to free translation on 402 payment error', async () => {
      // First call (paid) returns 402, second call (free fallback) succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          json: () => Promise.resolve({ error: 'Insufficient credits' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ translated: 'Ciao' }),
        });

      const { result } = renderHook(() => useTranslationAPI(defaultProps()));

      let data;
      await act(async () => {
        data = await result.current.translateUniversal('Hello', 'en', 'it', 'English', 'Italian');
      });

      expect(data.translated).toBe('Ciao'); // Falls back to free, doesn't throw
    });
  });

  describe('getAllTargetLangs', () => {
    it('returns unique target languages from room members', () => {
      const { result } = renderHook(() => useTranslationAPI(defaultProps()));
      const { myL, targetLangs } = result.current.getAllTargetLangs();

      expect(myL.code).toBe('en');
      expect(targetLangs).toHaveLength(1);
      expect(targetLangs[0].code).toBe('it');
    });

    it('senza membri non si traduce verso nessuno (b.289)', () => {
      // Prima ripiegava su it/en "a caso": si pagava una traduzione che
      // nessuno nella stanza avrebbe letto.
      const props = defaultProps();
      props.roomInfoRef = { current: null };
      const { result } = renderHook(() => useTranslationAPI(props));

      const { targetLangs } = result.current.getAllTargetLangs();
      expect(targetLangs).toHaveLength(0);
    });

    it('deduplicates languages from multiple members', () => {
      const props = defaultProps();
      props.roomInfoRef = { current: {
        members: [
          { name: 'Alice', lang: 'en' },
          { name: 'Bob', lang: 'it' },
          { name: 'Carlo', lang: 'it' }, // Same as Bob
          { name: 'Daisuke', lang: 'th' },
        ]
      }};
      const { result } = renderHook(() => useTranslationAPI(props));

      const { targetLangs } = result.current.getAllTargetLangs();
      expect(targetLangs).toHaveLength(2); // it + th, not 3
    });
  });

  describe('translateToAllTargets', () => {
    it('translates to all targets in parallel', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        const translated = callCount === 1 ? 'Ciao' : 'สวัสดี';
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ translated }),
        });
      });

      const { result } = renderHook(() => useTranslationAPI(defaultProps()));
      const myL = { code: 'en', name: 'English' };
      const targets = [
        { code: 'it', name: 'Italian' },
        { code: 'th', name: 'Thai' },
      ];

      let output;
      await act(async () => {
        output = await result.current.translateToAllTargets('Hello', myL, targets);
      });

      expect(output.translations).toHaveProperty('it');
      expect(output.translations).toHaveProperty('th');
      expect(output.primaryTranslated).toBeTruthy();
    });
  });
});
