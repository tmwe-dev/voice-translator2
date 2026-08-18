// ═══════════════════════════════════════════════════════════════
// b.247 — LA RICERCA GUASTA NON DEVE TRAVESTIRSI DA "NESSUNA FONTE"
//
// Il difetto: `ponte.cerca()` faceva try/catch e nel catch ritornava `[]`.
// Per chi chiamava, "ricerca riuscita senza risultati" e "ricerca
// completamente guasta" erano la STESSA COSA. Conseguenza concreta: una
// lezione di medicina (categoria `fontiCertificate`) veniva generata senza
// una sola fonte mentre il motore era rotto, con l'aria di essere fondata
// su fonti — e il modello riempiva il vuoto inventando, cioè esattamente
// ciò che il progetto vieta. Nessun errore, nessun log: difetto muto.
//
// Qui si controlla che i due casi siano di nuovo distinguibili e che sulle
// materie certificate il guasto sia FAIL-CLOSED (niente lezione), mentre
// dove le fonti sono un di più (dossier) si prosegua dichiarandolo.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Il motore Topics è mockato: niente rete vera.
const mockCercaArgomenti = vi.fn();
vi.mock('../app/lib/topics/servizio.js', () => ({
  cercaArgomenti: (...a) => mockCercaArgomenti(...a),
}));

// Il logger è mockato per poter PROVARE che il guasto viene registrato
// (in ambiente di test il logger vero è muto per scelta: vedi logger.js).
const mockWarn = vi.fn();
vi.mock('../app/lib/logger.js', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: (...a) => mockWarn(...a), error: () => {} }),
}));

// La cerniera è mockata per i CHIAMANTI (generatore, dossier): così si
// pilota l'esito della ricerca. La `cerca` VERA si prova più sotto con
// importActual, che scavalca questo mock ma tiene i mock delle dipendenze.
const mockGenera = vi.fn();
const mockCerca = vi.fn();
vi.mock('../app/lib/compagni/ponte.js', () => ({
  generaTesto: (...a) => mockGenera(...a),
  cerca: (...a) => mockCerca(...a),
}));

const { generaLezione, promptLezione } = await import('../app/lib/compagni/corsi/generatore.js');
const { categoriaCertificata } = await import('../app/lib/compagni/corsi/catalogo.js');
const { preparaBriefing, promptBriefing } = await import('../app/lib/compagni/dossier.js');

beforeEach(() => { vi.clearAllMocks(); });

// ── 1. La cerniera: zero risultati ≠ guasto ──
describe('ponte.cerca — i due casi non sono più la stessa cosa', () => {
  it('ricerca riuscita SENZA risultati → ok:true con lista vuota', async () => {
    const { cerca } = await vi.importActual('../app/lib/compagni/ponte.js');
    mockCercaArgomenti.mockResolvedValue({ argomenti: [] });
    const esito = await cerca('argomento senza notizie');
    expect(esito.ok).toBe(true);
    expect(esito.risultati).toEqual([]);
  });

  it('motore guasto (eccezione) → ok:false con il motivo, NON un array vuoto', async () => {
    const { cerca } = await vi.importActual('../app/lib/compagni/ponte.js');
    mockCercaArgomenti.mockRejectedValue(new Error('RSS irraggiungibile'));
    const esito = await cerca('qualcosa');
    // Prima di b.247 qui arrivava `[]`, identico al caso sopra.
    expect(esito.ok).toBe(false);
    expect(esito.risultati).toEqual([]);
    expect(String(esito.errore)).toContain('RSS irraggiungibile');
  });

  it('i due esiti sono distinguibili da chi chiama', async () => {
    const { cerca } = await vi.importActual('../app/lib/compagni/ponte.js');
    mockCercaArgomenti.mockResolvedValue({ argomenti: [] });
    const vuoto = await cerca('x');
    mockCercaArgomenti.mockRejectedValue(new Error('giù'));
    const guasto = await cerca('x');
    expect(vuoto.ok).not.toBe(guasto.ok);
  });

  it('il guasto viene REGISTRATO, non inghiottito nel catch vuoto', async () => {
    const { cerca } = await vi.importActual('../app/lib/compagni/ponte.js');
    mockCercaArgomenti.mockRejectedValue(new Error('rete giù'));
    await cerca('x');
    expect(mockWarn).toHaveBeenCalled();
  });

  it('risposta malformata (senza `argomenti`) vale guasto, non zero risultati', async () => {
    const { cerca } = await vi.importActual('../app/lib/compagni/ponte.js');
    mockCercaArgomenti.mockResolvedValue({ boh: true });
    const esito = await cerca('x');
    expect(esito.ok).toBe(false);
  });

  it('query vuota non è un guasto: non si è nemmeno cercato', async () => {
    const { cerca } = await vi.importActual('../app/lib/compagni/ponte.js');
    const esito = await cerca('');
    expect(esito.ok).toBe(true);
    expect(esito.risultati).toEqual([]);
    expect(mockCercaArgomenti).not.toHaveBeenCalled();
  });
});

// ── 2. Materie certificate: FAIL-CLOSED ──
describe('generaLezione — materia certificata + ricerca guasta = niente lezione', () => {
  it('medicina: col motore guasto NON si genera nulla', async () => {
    expect(categoriaCertificata('medicina')).toBe(true);
    mockCerca.mockResolvedValue({ ok: false, risultati: [], errore: 'rete giù' });
    mockGenera.mockResolvedValue({ ok: true, testo: 'Lezione inventata sul cuore...' });

    const r = await generaLezione({ argomento: 'Anatomia', categoria: 'medicina', lezione: { titolo: 'Il cuore' } });

    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('fonti-non-disponibili');
    // La prova che conta: il modello non è stato nemmeno interpellato, quindi
    // non esiste una lezione che finge di avere fonti.
    expect(mockGenera).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalled();
  });

  it('medicina: ricerca RIUSCITA con zero fonti → si genera, ma dicendo che fonti non ce ne sono', async () => {
    mockCerca.mockResolvedValue({ ok: true, risultati: [] });
    mockGenera.mockResolvedValue({ ok: true, testo: 'Lezione onesta.' });

    const r = await generaLezione({ argomento: 'Anatomia', categoria: 'medicina', lezione: { titolo: 'Il cuore' } });

    expect(r.ok).toBe(true);
    expect(mockGenera).toHaveBeenCalledTimes(1);
    const { prompt } = mockGenera.mock.calls[0][0];
    // Niente blocco fonti finto...
    expect(prompt).not.toContain('FONTI da cui attingere');
    // ...e istruzione esplicita a non citare riferimenti inventati.
    expect(prompt).toContain('NON hai fonti');
    expect(prompt).toContain('riferimenti bibliografici');
    expect(r.fontiNonTrovate).toBe(true);
  });

  it('medicina: con le fonti vere si genera come sempre (nessuna regressione)', async () => {
    mockCerca.mockResolvedValue({ ok: true, risultati: [{ titolo: 'PubMed', sintesi: 's', url: 'u' }] });
    mockGenera.mockResolvedValue({ ok: true, testo: 'Lezione fondata.' });

    const r = await generaLezione({ argomento: 'Anatomia', categoria: 'medicina', lezione: { titolo: 'Il cuore' } });

    expect(r.ok).toBe(true);
    expect(r.fonti.length).toBe(1);
    expect(r.fontiNonTrovate).toBe(false);
    const { prompt } = mockGenera.mock.calls[0][0];
    expect(prompt).toContain('PubMed');
    expect(prompt).not.toContain('NON hai fonti');
  });

  it('retrocompatibilità: un ARRAY nudo (vecchio contratto) vale ricerca riuscita', async () => {
    mockCerca.mockResolvedValue([{ titolo: 'Fonte', sintesi: 's', url: 'u' }]);
    mockGenera.mockResolvedValue({ ok: true, testo: 'Lezione.' });
    const r = await generaLezione({ argomento: 'Anatomia', categoria: 'medicina', lezione: { titolo: 'Il cuore' } });
    expect(r.ok).toBe(true);
    expect(r.fonti.length).toBe(1);
  });

  it('un esito di forma sconosciuta vale guasto: non si spaccia per riuscito', async () => {
    mockCerca.mockResolvedValue(undefined);
    mockGenera.mockResolvedValue({ ok: true, testo: 'Lezione.' });
    const r = await generaLezione({ argomento: 'Anatomia', categoria: 'medicina', lezione: { titolo: 'Il cuore' } });
    expect(r.ok).toBe(false);
    expect(mockGenera).not.toHaveBeenCalled();
  });

  it('filosofia (non certificata): non cerca fonti e non viene bloccata', async () => {
    expect(categoriaCertificata('filosofia')).toBe(false);
    mockGenera.mockResolvedValue({ ok: true, testo: 'Lezione su Kant.' });
    const r = await generaLezione({ argomento: 'Kant', categoria: 'filosofia', lezione: { titolo: 'Critica' } });
    expect(mockCerca).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });
});

// ── 3. Dove le fonti sono un di più: si prosegue, ma senza fingere ──
describe('preparaBriefing — il guasto non blocca il dossier ma non si nasconde', () => {
  it('ricerca guasta: il briefing si fa, il guasto esce fuori e finisce nel log', async () => {
    mockCerca.mockResolvedValue({ ok: false, risultati: [], errore: 'motore giù' });
    mockGenera.mockResolvedValue({ ok: true, testo: '{"articolo":"testo","punti":["a"],"domande":["d"]}' });

    const r = await preparaBriefing({ argomento: 'Nucleare pulito' });

    expect(r.ok).toBe(true);
    expect(r.fontiGuaste).toBe(true);
    expect(r.fonti).toEqual([]);
    expect(mockWarn).toHaveBeenCalled();
    // Al modello si dice che fonti non ne ha: senza questa riga scriverebbe
    // citando fatti che non ha letto da nessuna parte.
    const { prompt } = mockGenera.mock.calls[0][0];
    expect(prompt).toContain('NON hai fonti');
    expect(prompt).toContain('FALLITA');
  });

  it('ricerca riuscita a vuoto: si prosegue, ma NON si dichiara un guasto che non c\'è', async () => {
    mockCerca.mockResolvedValue({ ok: true, risultati: [] });
    mockGenera.mockResolvedValue({ ok: true, testo: '{"articolo":"testo","punti":[],"domande":[]}' });

    const r = await preparaBriefing({ argomento: 'Nucleare pulito' });

    expect(r.ok).toBe(true);
    expect(r.fontiGuaste).toBe(false);
    const { prompt } = mockGenera.mock.calls[0][0];
    expect(prompt).toContain('non ha restituito documenti');
  });

  it('con le fonti il briefing resta quello di prima', async () => {
    mockCerca.mockResolvedValue({ ok: true, risultati: [{ titolo: 'IEA', sintesi: 's', url: 'u' }] });
    mockGenera.mockResolvedValue({ ok: true, testo: '{"articolo":"testo","punti":[],"domande":[]}' });
    const r = await preparaBriefing({ argomento: 'Nucleare pulito' });
    expect(r.fonti.length).toBe(1);
    expect(r.fontiGuaste).toBe(false);
    const { prompt } = mockGenera.mock.calls[0][0];
    expect(prompt).toContain('IEA');
    expect(prompt).not.toContain('NON hai fonti');
  });
});

// ── 4. I costruttori di prompt, puri ──
describe('prompt puri — l\'avviso "senza fonti" compare solo quando serve', () => {
  it('promptLezione: con fonti niente avviso, senza fonti (attese) l\'avviso c\'è', () => {
    const conFonti = promptLezione({ argomento: 'A', lezione: { titolo: 'T' }, fonti: [{ titolo: 'F', sintesi: 's' }], fontiNonTrovate: true });
    expect(conFonti.prompt).toContain('FONTI da cui attingere');
    expect(conFonti.prompt).not.toContain('NON hai fonti');

    const senzaFonti = promptLezione({ argomento: 'A', lezione: { titolo: 'T' }, fonti: [], fontiNonTrovate: true });
    expect(senzaFonti.prompt).toContain('NON hai fonti');
  });

  it('promptLezione: materia non certificata (nessuna fonte attesa) → nessun avviso', () => {
    const { prompt } = promptLezione({ argomento: 'Kant', lezione: { titolo: 'Critica' } });
    expect(prompt).not.toContain('NON hai fonti');
  });

  it('promptBriefing: il testo dell\'avviso distingue guasto e ricerca a vuoto', () => {
    expect(promptBriefing({ argomento: 'X', fonti: [], ricercaGuasta: true }).prompt).toContain('FALLITA');
    expect(promptBriefing({ argomento: 'X', fonti: [], ricercaGuasta: false }).prompt).toContain('non ha restituito documenti');
  });
});
