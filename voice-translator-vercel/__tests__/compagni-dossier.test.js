import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenera = vi.fn();
const mockCerca = vi.fn();
vi.mock('../app/lib/compagni/ponte.js', () => ({
  generaTesto: (...a) => mockGenera(...a),
  cerca: (...a) => mockCerca(...a),
}));

const { promptBriefing, promptReport, preparaBriefing, sintetizzaReport } = await import('../app/lib/compagni/dossier.js');

beforeEach(() => vi.clearAllMocks());

describe('costruttori di prompt (puri)', () => {
  it('briefing: JSON con articolo/punti/domande, e le fonti se presenti', () => {
    const { prompt } = promptBriefing({ argomento: 'Nucleare', fonti: [{ titolo: 'IEA', sintesi: 's' }], lingua: 'en' });
    expect(prompt).toContain('Nucleare');
    expect(prompt).toContain('articolo');
    expect(prompt).toContain('FONTI');
    expect(prompt).toContain('IEA');
  });
  it('report: contiene le sezioni chiave', () => {
    const { prompt } = promptReport({ argomento: 'X', discussione: 'tizio: ...' });
    expect(prompt).toContain('Sintesi');
    expect(prompt).toContain('accordo');
    expect(prompt).toContain('disaccordo');
    expect(prompt).toContain('Conclusione');
  });
});

describe('preparaBriefing', () => {
  it('cerca le fonti e sintetizza l\'articolo', async () => {
    mockCerca.mockResolvedValue([{ titolo: 'Fonte', sintesi: 's', url: 'u' }]);
    mockGenera.mockResolvedValue({ ok: true, testo: '{"articolo":"testo neutro","punti":["a","b"],"domande":["d1"]}' });
    const r = await preparaBriefing({ argomento: 'Nucleare pulito' });
    expect(mockCerca).toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.articolo).toBe('testo neutro');
    expect(r.punti).toEqual(['a', 'b']);
    expect(r.domande).toEqual(['d1']);
    expect(r.fonti.length).toBe(1);
  });
  it('senza argomento fallisce', async () => {
    const r = await preparaBriefing({ argomento: '  ' });
    expect(r.ok).toBe(false);
  });
});

describe('sintetizzaReport', () => {
  it('scrive il report dalla discussione', async () => {
    mockGenera.mockResolvedValue({ ok: true, testo: 'REPORT: ...' });
    const r = await sintetizzaReport({ argomento: 'X', discussione: 'a: uno\nb: due' });
    expect(r.ok).toBe(true);
    expect(r.report).toContain('REPORT');
  });
  it('senza discussione fallisce', async () => {
    const r = await sintetizzaReport({ argomento: 'X', discussione: '' });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('discussione-mancante');
  });
});
