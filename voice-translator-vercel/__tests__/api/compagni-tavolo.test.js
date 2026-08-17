import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn();
const mockRisolvi = vi.fn();
const mockGenera = vi.fn();

vi.mock('../../app/lib/users.js', () => ({ getSession: (...a) => mockGetSession(...a) }));
vi.mock('../../app/lib/compagni/persistenza.js', () => ({ risolviCompagni: (...a) => mockRisolvi(...a) }));
vi.mock('../../app/lib/compagni/ponte.js', () => ({ generaTesto: (...a) => mockGenera(...a) }));
vi.mock('../../app/lib/apiGuard.js', () => ({ withApiGuard: (fn) => fn }));
vi.mock('../../app/lib/logger.js', () => ({ createLogger: () => ({ error: () => {} }) }));

const { POST } = await import('../../app/api/compagni/tavolo/route.js');
const makeReq = (body) => ({ json: async () => body, headers: new Headers() });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ email: 'luca@x.it' });
  mockRisolvi.mockResolvedValue([
    { id: 'a', nome: 'Archimede', personalita: 'p', provider: 'openai', modello: 'gpt-4o-mini', voce: { id: 'v1' } },
    { id: 'b', nome: 'Alex', personalita: 'p', provider: 'openai', modello: 'gpt-4o-mini', voce: { id: 'v2' } },
  ]);
  let n = 0;
  mockGenera.mockImplementation(async () => ({ ok: true, testo: `risposta#${++n}` }));
});

describe('POST /api/compagni/tavolo', () => {
  it('serve un messaggio', async () => {
    const res = await POST(makeReq({ compagni: ['a', 'b'], messaggi: [], userToken: 't' }));
    expect(res.status).toBe(400);
  });

  it('servono almeno due Compagni', async () => {
    mockRisolvi.mockResolvedValue([{ id: 'a', nome: 'A', voce: {} }]);
    const res = await POST(makeReq({ compagni: ['a'], messaggi: [{ ruolo: 'persona', testo: 'ciao' }], userToken: 't' }));
    expect(res.status).toBe(400);
  });

  it('ogni Compagno risponde, con la sua voce', async () => {
    const res = await POST(makeReq({ compagni: ['a', 'b'], messaggi: [{ ruolo: 'persona', testo: 'che dite?' }], userToken: 't' }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.risposte.length).toBe(2);
    expect(d.risposte[0].voceId).toBe('v1');
    expect(d.risposte[1].nome).toBe('Alex');
    expect(mockGenera).toHaveBeenCalledTimes(2);
  });

  it('il secondo vede cosa ha detto il primo (stesso giro)', async () => {
    await POST(makeReq({ compagni: ['a', 'b'], messaggi: [{ ruolo: 'persona', testo: 'x' }], userToken: 't' }));
    const promptSecondo = mockGenera.mock.calls[1][0].prompt;
    expect(promptSecondo).toContain('hanno già detto');
    expect(promptSecondo).toContain('risposta#1');
  });

  it('si ferma con 402 se manca credito', async () => {
    mockGenera.mockResolvedValueOnce({ ok: false, status: 402 });
    const res = await POST(makeReq({ compagni: ['a', 'b'], messaggi: [{ ruolo: 'persona', testo: 'x' }], userToken: 't' }));
    expect(res.status).toBe(402);
  });
});
