import { describe, it, expect, vi, beforeEach } from 'vitest';

// b.235 — verifica del CONTRATTO Asia: quando arriva il systemPrompt completo
// (glossario/dominio/contesto) si usa il Qwen LLM con quel prompt; quando la
// traduzione è semplice si usa Qwen-MT; se Qwen-MT fallisce si ripiega su LLM;
// senza chiave si lancia l'errore (così /api/translate ricade sul Global).

const mockMT = vi.fn();
const mockCallQwen = vi.fn();
const mockAvail = vi.fn();

vi.mock('../../app/lib/llmAsia.js', () => ({
  translateQwenMT: (...a) => mockMT(...a),
  callQwen: (...a) => mockCallQwen(...a),
  isDashScopeAvailable: (...a) => mockAvail(...a),
}));
vi.mock('../../app/lib/asiaConstants.js', () => ({ QWEN_MODELS: { flash: 'qwen-flash' } }));
vi.mock('../../app/lib/logger.js', () => ({ createLogger: () => ({ warn: () => {}, error: () => {} }) }));

const { translateAsia } = await import('../../app/lib/translateAsia.js');

beforeEach(() => {
  vi.clearAllMocks();
  mockAvail.mockReturnValue(true);
  mockMT.mockResolvedValue({ translated: 'MT結果', cost: 0.001 });
  mockCallQwen.mockResolvedValue({ translated: 'LLM結果', usage: { prompt_tokens: 10, completion_tokens: 5 } });
});

describe('translateAsia — contratto Asia/Global', () => {
  it('CONTESTO RICCO (systemPrompt) → usa Qwen LLM con quel prompt, NON Qwen-MT', async () => {
    const r = await translateAsia('ciao', 'it', 'ja', { systemPrompt: 'GLOSSARIO: porta→catetere' });
    expect(mockCallQwen).toHaveBeenCalledTimes(1);
    expect(mockCallQwen.mock.calls[0][0].systemPrompt).toContain('catetere');
    expect(mockMT).not.toHaveBeenCalled();
    expect(r.provider).toBe('qwen-llm');
    expect(r.translated).toBe('LLM結果');
  });

  it('SEMPLICE (nessun systemPrompt) → usa Qwen-MT veloce', async () => {
    const r = await translateAsia('ciao', 'it', 'ja', {});
    expect(mockMT).toHaveBeenCalledTimes(1);
    expect(mockCallQwen).not.toHaveBeenCalled();
    expect(r.provider).toBe('qwen-mt');
    expect(r.translated).toBe('MT結果');
  });

  it('Qwen-MT fallisce → ripiega su Qwen LLM', async () => {
    mockMT.mockRejectedValueOnce(new Error('MT down'));
    const r = await translateAsia('ciao', 'it', 'ja', {});
    expect(mockMT).toHaveBeenCalledTimes(1);
    expect(mockCallQwen).toHaveBeenCalledTimes(1);
    expect(r.provider).toBe('qwen-llm');
  });

  it('nessuna chiave (né piattaforma né utente) → lancia (così il route ricade sul Global)', async () => {
    mockAvail.mockReturnValue(false);
    await expect(translateAsia('ciao', 'it', 'ja', {})).rejects.toThrow();
  });

  it('con chiave utente (opts.apiKey) procede anche senza chiave piattaforma', async () => {
    mockAvail.mockReturnValue(false);
    const r = await translateAsia('ciao', 'it', 'ja', { apiKey: 'sk-utente' });
    expect(r.provider).toBe('qwen-mt');
  });
});
