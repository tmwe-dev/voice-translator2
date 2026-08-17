import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn();
const mockElenca = vi.fn();
const mockSalva = vi.fn();
const mockCancella = vi.fn();

vi.mock('../../app/lib/users.js', () => ({ getSession: (...a) => mockGetSession(...a) }));
vi.mock('../../app/lib/compagni/persistenza.js', () => ({
  elencaCompagni: (...a) => mockElenca(...a),
  salvaCompagno: (...a) => mockSalva(...a),
  cancellaCompagno: (...a) => mockCancella(...a),
}));
vi.mock('../../app/lib/apiGuard.js', () => ({ withApiGuard: (fn) => fn }));
vi.mock('../../app/lib/logger.js', () => ({ createLogger: () => ({ error: () => {}, warn: () => {} }) }));

const { POST } = await import('../../app/api/compagni/mie/route.js');
const makeReq = (body) => ({ json: async () => body, headers: new Headers() });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ email: 'luca@x.it', name: 'Luca' });
});

describe('POST /api/compagni/mie', () => {
  it('senza sessione valida → 401', async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeReq({ azione: 'elenco', userToken: 'x' }));
    expect(res.status).toBe(401);
  });

  it('elenco ritorna i Compagni dell\'utente', async () => {
    mockElenca.mockResolvedValue([{ id: 'u_1_mio', nome: 'Mio' }]);
    const res = await POST(makeReq({ azione: 'elenco', userToken: 't' }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.compagni[0].nome).toBe('Mio');
    expect(mockElenca).toHaveBeenCalledWith('luca@x.it');
  });

  it('salva senza nome → 400', async () => {
    const res = await POST(makeReq({ azione: 'salva', userToken: 't', compagno: { nome: '  ' } }));
    expect(res.status).toBe(400);
  });

  it('salva ok ritorna il Compagno', async () => {
    mockSalva.mockResolvedValue({ id: 'u_1_socrate', nome: 'Socrate' });
    const res = await POST(makeReq({ azione: 'salva', userToken: 't', compagno: { nome: 'Socrate', personalita: 'p' } }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.compagno.nome).toBe('Socrate');
    expect(mockSalva).toHaveBeenCalledWith('luca@x.it', expect.objectContaining({ nome: 'Socrate' }));
  });

  it('cancella richiede id, poi ok', async () => {
    const senza = await POST(makeReq({ azione: 'cancella', userToken: 't' }));
    expect(senza.status).toBe(400);
    mockCancella.mockResolvedValue(true);
    const res = await POST(makeReq({ azione: 'cancella', userToken: 't', id: 'u_1_socrate' }));
    expect((await res.json()).ok).toBe(true);
  });
});
