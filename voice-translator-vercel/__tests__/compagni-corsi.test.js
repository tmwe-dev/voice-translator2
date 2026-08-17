import { describe, it, expect, vi, beforeEach } from 'vitest';

// La cerniera è mockata: niente provider/wallet veri.
const mockGenera = vi.fn();
const mockCerca = vi.fn();
vi.mock('../app/lib/compagni/ponte.js', () => ({
  generaTesto: (...a) => mockGenera(...a),
  cerca: (...a) => mockCerca(...a),
}));

const {
  estraiJSON, promptSyllabus, promptLezione, promptQuiz,
  generaSyllabus, generaLezione, generaQuiz,
} = await import('../app/lib/compagni/corsi/generatore.js');
const { categoriaCertificata } = await import('../app/lib/compagni/corsi/catalogo.js');

beforeEach(() => { vi.clearAllMocks(); });

describe('estraiJSON — tollerante', () => {
  it('toglie le staccionate ```json e il testo di cortesia', () => {
    const out = estraiJSON('Ecco il corso:\n```json\n[{"titolo":"Uno","obiettivi":["a"]}]\n```');
    expect(Array.isArray(out)).toBe(true);
    expect(out[0].titolo).toBe('Uno');
  });
  it('ritorna null se non c\'è JSON', () => {
    expect(estraiJSON('nessun json qui')).toBe(null);
  });
});

describe('costruttori di prompt (puri)', () => {
  it('syllabus: chiede N lezioni in JSON, nella lingua', () => {
    const { system, prompt } = promptSyllabus({ argomento: 'Vela', nLezioni: 6, lingua: 'en' });
    expect(prompt).toContain('Vela');
    expect(prompt).toContain('6 lezioni');
    expect(prompt).toContain('JSON');
    expect(system).toContain('en');
  });
  it('lezione: include le FONTI quando presenti', () => {
    const { prompt } = promptLezione({
      argomento: 'Anatomia', lezione: { titolo: 'Il cuore', obiettivi: ['camere'] },
      fonti: [{ titolo: 'Fonte A', sintesi: 'il cuore ha quattro camere' }],
    });
    expect(prompt).toContain('Il cuore');
    expect(prompt).toContain('FONTI');
    expect(prompt).toContain('Fonte A');
  });
  it('quiz: formato JSON con indice corretto', () => {
    const { prompt } = promptQuiz({ lezione: { titolo: 'X' }, nDomande: 2 });
    expect(prompt).toContain('2 domande');
    expect(prompt).toContain('corretta');
  });
});

describe('generaSyllabus', () => {
  it('parsa le lezioni e sblocca solo la prima', async () => {
    mockGenera.mockResolvedValue({ ok: true, testo: '[{"titolo":"L1","obiettivi":["a"]},{"titolo":"L2","obiettivi":[]}]' });
    const r = await generaSyllabus({ argomento: 'Python', nLezioni: 2 });
    expect(r.ok).toBe(true);
    expect(r.lezioni.length).toBe(2);
    expect(r.lezioni[0].stato).toBe('disponibile');
    expect(r.lezioni[1].stato).toBe('bloccata');
  });
  it('fallisce con grazia se il JSON è illeggibile', async () => {
    mockGenera.mockResolvedValue({ ok: true, testo: 'scusa non ho capito' });
    const r = await generaSyllabus({ argomento: 'X' });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('syllabus-illeggibile');
  });
});

describe('generaLezione — fonti solo per materie certificate', () => {
  it('medicina: cerca le fonti PRIMA di scrivere', async () => {
    expect(categoriaCertificata('medicina')).toBe(true);
    mockCerca.mockResolvedValue([{ titolo: 'PubMed', sintesi: 's', url: 'u' }]);
    mockGenera.mockResolvedValue({ ok: true, testo: 'Lezione sul cuore...' });
    const r = await generaLezione({ argomento: 'Anatomia', categoria: 'medicina', lezione: { titolo: 'Il cuore' } });
    expect(mockCerca).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    expect(r.fonti.length).toBe(1);
  });
  it('filosofia (non certificata): NON cerca fonti', async () => {
    expect(categoriaCertificata('filosofia')).toBe(false);
    mockGenera.mockResolvedValue({ ok: true, testo: 'Lezione...' });
    const r = await generaLezione({ argomento: 'Kant', categoria: 'filosofia', lezione: { titolo: 'Critica' } });
    expect(mockCerca).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.fonti.length).toBe(0);
  });
});

describe('generaQuiz', () => {
  it('parsa le domande e stringe l\'indice corretto', async () => {
    mockGenera.mockResolvedValue({ ok: true, testo: '[{"domanda":"?","opzioni":["a","b","c","d"],"corretta":9,"spiegazione":"x"}]' });
    const r = await generaQuiz({ titolo: 'L1' });
    expect(r.ok).toBe(true);
    expect(r.domande[0].corretta).toBe(3); // 9 stretto a 3
    expect(r.domande[0].opzioni.length).toBe(4);
  });
});
