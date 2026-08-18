import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn();
const mockRisolvi = vi.fn();
const mockRicordi = vi.fn();
const mockEstrai = vi.fn();
const mockAggiungi = vi.fn();
const mockGenera = vi.fn();

vi.mock('../../app/lib/users.js', () => ({ getSession: (...a) => mockGetSession(...a) }));
vi.mock('../../app/lib/compagni/persistenza.js', () => ({ risolviCompagno: (...a) => mockRisolvi(...a) }));
vi.mock('../../app/lib/compagni/memoria.js', () => ({
  ricordiPerContesto: (...a) => mockRicordi(...a),
  contestoMemoria: () => '\n\nricordi...',
  estraiRicordi: (...a) => mockEstrai(...a),
  aggiungiRicordi: (...a) => mockAggiungi(...a),
  tagsDalTesto: () => [],
}));
vi.mock('../../app/lib/compagni/ponte.js', () => ({ generaTesto: (...a) => mockGenera(...a) }));
vi.mock('../../app/lib/apiGuard.js', () => ({ withApiGuard: (fn) => fn }));
vi.mock('../../app/lib/logger.js', () => ({ createLogger: () => ({ error: () => {} }) }));

const { POST } = await import('../../app/api/compagni/amico/route.js');
const makeReq = (body) => ({ json: async () => body, headers: new Headers() });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ email: 'luca@x.it' });
  mockRisolvi.mockResolvedValue({ id: 'c1', nome: 'Aisha', personalita: 'coach', memoria: true, provider: 'openai', modello: 'gpt-4o-mini', voce: { id: 'v1' } });
  mockGenera.mockResolvedValue({ ok: true, testo: 'Ti ascolto.' });
  mockRicordi.mockResolvedValue([{ summary: 'ha due figli' }]);
});

describe('POST /api/compagni/amico', () => {
  it('401 senza sessione', async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeReq({ compagnoId: 'c1', messaggi: [{ ruolo: 'persona', testo: 'ciao' }], userToken: 'x' }));
    expect(res.status).toBe(401);
  });

  it('404 se il Compagno non esiste', async () => {
    mockRisolvi.mockResolvedValue(null);
    const res = await POST(makeReq({ compagnoId: 'ignoto', messaggi: [{ ruolo: 'persona', testo: 'ciao' }], userToken: 't' }));
    expect(res.status).toBe(404);
  });

  it('400 senza messaggio', async () => {
    const res = await POST(makeReq({ compagnoId: 'c1', messaggi: [], userToken: 't' }));
    expect(res.status).toBe(400);
  });

  it('risponde e, con memoria, carica i ricordi nel prompt', async () => {
    const res = await POST(makeReq({ compagnoId: 'c1', messaggi: [{ ruolo: 'persona', testo: 'come stai?' }], userToken: 't' }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.risposta).toBe('Ti ascolto.');
    expect(mockRicordi).toHaveBeenCalled();
    // il system passato al modello contiene il blocco memoria
    expect(mockGenera.mock.calls[0][0].system).toContain('ricordi...');
  });

  it('senza memoria non carica ricordi', async () => {
    mockRisolvi.mockResolvedValue({ id: 'c2', nome: 'Alex', personalita: 'p', memoria: false, provider: 'openai', modello: 'gpt-4o-mini', voce: {} });
    const res = await POST(makeReq({ compagnoId: 'c2', messaggi: [{ ruolo: 'persona', testo: 'ciao' }], userToken: 't' }));
    expect(res.status).toBe(200);
    expect(mockRicordi).not.toHaveBeenCalled();
  });

  it('estrae i ricordi al terzo giro (throttle)', async () => {
    mockEstrai.mockResolvedValue([{ content: 'x', tags: [], importance: 3 }]);
    // 5 messaggi in ingresso → con la risposta diventano 6 → 6 % 3 === 0 → estrae
    const messaggi = [1, 2, 3, 4, 5].map((n) => ({ ruolo: n % 2 ? 'persona' : 'compagno', testo: 't' + n }));
    await POST(makeReq({ compagnoId: 'c1', messaggi, userToken: 't' }));
    // b.244 — l'estrazione ora e rimandata a dopo la risposta (`dopo()`):
    // fuori da una richiesta parte subito, ma va lasciata finire.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockEstrai).toHaveBeenCalled();
    expect(mockAggiungi).toHaveBeenCalled();
  });
});
