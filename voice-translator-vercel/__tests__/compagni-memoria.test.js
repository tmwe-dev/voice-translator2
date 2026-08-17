import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenera = vi.fn();
vi.mock('../app/lib/compagni/ponte.js', () => ({ generaTesto: (...a) => mockGenera(...a) }));
// persistenza importa supabase/catalogo: qui basta idUtente, lo stubbiamo leggero.
vi.mock('../app/lib/supabase.js', () => ({ getSupabaseAdmin: () => null }));

const { contestoMemoria, estraiRicordi, TAG_MEMORIA, PROMPT_ESTRAZIONE } = await import('../app/lib/compagni/memoria.js');

beforeEach(() => vi.clearAllMocks());

describe('tassonomia e prompt (ripresi da RadioChat)', () => {
  it('16 tag di memoria', () => {
    expect(TAG_MEMORIA.length).toBe(16);
    expect(TAG_MEMORIA).toContain('famiglia');
    expect(TAG_MEMORIA).toContain('obiettivi');
  });
  it('il prompt di estrazione chiede JSON con memories', () => {
    expect(PROMPT_ESTRAZIONE).toContain('memories');
    expect(PROMPT_ESTRAZIONE).toContain('importance');
  });
});

describe('contestoMemoria', () => {
  it('vuoto senza ricordi', () => {
    expect(contestoMemoria([])).toBe('');
    expect(contestoMemoria(null)).toBe('');
  });
  it('elenca i riassunti in un blocco', () => {
    const b = contestoMemoria([{ summary: 'Ha due figli' }, { content: 'Ama la vela' }]);
    expect(b).toContain('Ha due figli');
    expect(b).toContain('Ama la vela');
    expect(b).toContain('ricordi');
  });
});

describe('estraiRicordi', () => {
  it('parsa i ricordi dal JSON del modello', async () => {
    mockGenera.mockResolvedValue({ ok: true, testo: 'Ecco: {"memories":[{"content":"Ha un cane","tags":["hobby"],"importance":2}]}' });
    const r = await estraiRicordi([{ ruolo: 'persona', testo: 'ho preso un cane' }], {});
    expect(r.length).toBe(1);
    expect(r[0].content).toBe('Ha un cane');
  });
  it('ritorna [] se il modello non dà JSON valido', async () => {
    mockGenera.mockResolvedValue({ ok: true, testo: 'nessun ricordo' });
    expect(await estraiRicordi([{ ruolo: 'persona', testo: 'ciao' }], {})).toEqual([]);
  });
  it('ritorna [] se la generazione fallisce', async () => {
    mockGenera.mockResolvedValue({ ok: false, motivo: 'x' });
    expect(await estraiRicordi([{ ruolo: 'persona', testo: 'ciao' }], {})).toEqual([]);
  });
  it('non estrae da una conversazione vuota', async () => {
    expect(await estraiRicordi([], {})).toEqual([]);
    expect(mockGenera).not.toHaveBeenCalled();
  });
});
