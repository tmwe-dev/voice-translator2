import { describe, it, expect, vi, beforeEach } from 'vitest';

// La rotta del podcast: si prova mockando la CERNIERA (ponte.generaTesto),
// così non servono provider AI né wallet veri. Catalogo e orchestratore
// restano reali.

const mockGenera = vi.fn();
vi.mock('../../app/lib/compagni/ponte.js', () => ({
  generaTesto: (...a) => mockGenera(...a),
}));
vi.mock('../../app/lib/apiGuard.js', () => ({ withApiGuard: (fn) => fn }));
vi.mock('../../app/lib/logger.js', () => ({
  createLogger: () => ({ error: () => {}, warn: () => {}, info: () => {} }),
}));

const { POST } = await import('../../app/api/compagni/podcast/route.js');

function makeReq(body) {
  return { json: async () => body, headers: new Headers() };
}

beforeEach(() => {
  vi.clearAllMocks();
  let n = 0;
  mockGenera.mockImplementation(async ({ prompt }) => ({ ok: true, testo: `intervento#${++n}`, caratteri: 12, _prompt: prompt }));
});

describe('POST /api/compagni/podcast', () => {
  it('rifiuta senza argomento', async () => {
    const res = await POST(makeReq({ compagni: ['archimede', 'analista'], argomento: '' }));
    expect(res.status).toBe(400);
  });

  it('rifiuta con meno di due Compagni', async () => {
    const res = await POST(makeReq({ compagni: ['archimede'], argomento: 'AI e lavoro' }));
    expect(res.status).toBe(400);
  });

  it('genera un copione con due Compagni per due round (quattro turni)', async () => {
    const res = await POST(makeReq({ compagni: ['archimede', 'analista'], argomento: 'AI e lavoro', round: 2 }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.copioni.length).toBe(4);
    // ogni turno porta la voce ElevenLabs del Compagno e il testo
    expect(d.copioni[0].voceId).toBeTruthy();
    expect(d.copioni[0].nome).toBeTruthy();
    expect(d.copioni[0].testo).toContain('intervento#');
    expect(mockGenera).toHaveBeenCalledTimes(4);
  });

  it('porta avanti gli interventi precedenti (threading)', async () => {
    await POST(makeReq({ compagni: ['archimede', 'analista'], argomento: 'AI e lavoro', round: 2 }));
    // il terzo turno (round 2) deve vedere nel prompt cosa è stato detto prima
    const terzoPrompt = mockGenera.mock.calls[2][0].prompt;
    expect(terzoPrompt).toContain('hanno detto finora');
    expect(terzoPrompt).toContain('intervento#1');
  });

  it('si ferma con 402 se il credito è insufficiente', async () => {
    mockGenera.mockResolvedValueOnce({ ok: false, status: 402, motivo: 'credito-insufficiente' });
    const res = await POST(makeReq({ compagni: ['archimede', 'analista'], argomento: 'AI e lavoro', round: 1 }));
    expect(res.status).toBe(402);
  });

  it('un id inesistente viene ignorato, non rompe', async () => {
    const res = await POST(makeReq({ compagni: ['archimede', 'inesistente', 'analista'], argomento: 'x', round: 1 }));
    expect(res.status).toBe(200);
    const d = await res.json();
    // due Compagni validi × 1 round = 2 turni
    expect(d.copioni.length).toBe(2);
  });
});
