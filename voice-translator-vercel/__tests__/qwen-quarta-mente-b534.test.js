import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMPAGNI_PREDEFINITI, MODELLI, getCompagnoPredefinito } from '../app/lib/compagni/catalogo.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.534 — Luca: «lascia attivi solo tre agenti anthropic, chatgpt e
// gemini, grok disattivalo e attiva qwen alibaba come aggiunto».

describe('b.534 — Grok fuori, Qwen dentro', () => {
  it('la tendina offre openai, anthropic, gemini e qwen — niente grok', () => {
    const provider = new Set(MODELLI.map((m) => m.provider));
    expect(provider.has('qwen')).toBe(true);
    expect(provider.has('grok')).toBe(false);
    expect(provider.has('openai')).toBe(true);
    expect(provider.has('anthropic')).toBe(true);
    expect(provider.has('gemini')).toBe(true);
  });
  it('nessun predefinito resta su grok; Omar e Newton parlano Qwen', () => {
    expect(COMPAGNI_PREDEFINITI.some((c) => c.provider === 'grok')).toBe(false);
    expect(getCompagnoPredefinito('omar')?.provider ?? getCompagnoPredefinito('ricercatore').provider).toBe('qwen');
    expect(getCompagnoPredefinito('newton').provider).toBe('qwen');
  });
  it('ogni modello dei predefiniti resta offerto dalla tendina', () => {
    const offerti = new Set(MODELLI.map((m) => m.modello));
    for (const c of COMPAGNI_PREDEFINITI) expect(offerti.has(c.modello), c.nome).toBe(true);
  });
  it('llmCaller sa parlare con DashScope (endpoint gia di casa)', () => {
    const f = leggi('app/lib/llmCaller.js');
    expect(f).toMatch(/provider === 'qwen'/);
    expect(f).toMatch(/DASHSCOPE_BASE_URL/);
  });
  it('la piattaforma risolve la chiave qwen (stessa del percorso asiatico)', () => {
    expect(leggi('app/lib/apiAuth.js')).toMatch(/qwen: process\.env\.DASHSCOPE_API_KEY/);
  });
  it('il ramo grok resta vivo per chi lo aveva gia salvato', () => {
    expect(leggi('app/lib/llmCaller.js')).toMatch(/provider === 'grok' \|\| provider === 'xai'/);
  });
});
