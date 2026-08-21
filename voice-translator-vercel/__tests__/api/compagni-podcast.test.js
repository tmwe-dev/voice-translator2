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

  // b.363 — QUESTE PROVE PROVAVANO CODICE CHE NON ESISTE PIU. Chiedevano
  // alla rotta di generare TUTTO il podcast in una richiesta sola e di
  // restituire "copioni". Quel percorso e stato tolto perche era morto: il
  // programma manda SEMPRE un turno per volta (azione "turno" con l indice)
  // e li incatena da se, cosi nessun turno puo scadere a meta lasciando
  // l addebito fatto e il podcast monco. Riscritte sul contratto vivo,
  // stessa severita: si prova che il turno esce completo, che porta con se
  // cosa e stato detto prima, che il credito finito ferma tutto, e che un
  // nome sbagliato non fa cadere niente.

  it('un turno alla volta: esce completo, con voce, nome e testo', async () => {
    const res = await POST(makeReq({
      azione: 'turno', compagni: ['archimede', 'analista'],
      argomento: 'AI e lavoro', round: 2, indice: 0,
    }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.indice).toBe(0);
    // due Compagni per due round = quattro turni in tutto
    expect(d.totale).toBe(4);
    expect(d.turno.voceId).toBeTruthy();
    expect(d.turno.nome).toBeTruthy();
    expect(d.turno.testo).toContain('intervento#');
    expect(mockGenera).toHaveBeenCalledTimes(1);
  });

  it('finito l ultimo turno lo dice, invece di generarne uno in piu', async () => {
    const res = await POST(makeReq({
      azione: 'turno', compagni: ['archimede', 'analista'],
      argomento: 'AI e lavoro', round: 2, indice: 4,
    }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.fine).toBe(true);
    expect(d.totale).toBe(4);
    // e soprattutto: non ha speso una chiamata per un turno che non esiste
    expect(mockGenera).not.toHaveBeenCalled();
  });

  it('porta avanti gli interventi precedenti (threading)', async () => {
    await POST(makeReq({
      azione: 'turno', compagni: ['archimede', 'analista'],
      argomento: 'AI e lavoro', round: 2, indice: 2,
      precedenti: [
        { nome: 'Archimede', testo: 'intervento#1' },
        { nome: 'Alex', testo: 'intervento#2' },
      ],
    }));
    const prompt = mockGenera.mock.calls[0][0].prompt;
    expect(prompt).toContain('hanno detto finora');
    expect(prompt).toContain('intervento#1');
  });

  it('si ferma con 402 se il credito e insufficiente', async () => {
    mockGenera.mockResolvedValueOnce({ ok: false, status: 402, motivo: 'credito-insufficiente' });
    const res = await POST(makeReq({
      azione: 'turno', compagni: ['archimede', 'analista'],
      argomento: 'AI e lavoro', round: 1, indice: 0,
    }));
    expect(res.status).toBe(402);
  });

  it('chi non ha nulla da dire passa, e il suo turno non va in onda', async () => {
    // b.362 — il marcatore di esito: chi marca "passo" viene saltato.
    // il marcatore sta in CODA al testo, e li che il programma lo cerca
    mockGenera.mockResolvedValueOnce({ ok: true, testo: 'non ho elementi [esito: passo]', caratteri: 12 });
    const res = await POST(makeReq({
      azione: 'turno', compagni: ['archimede', 'analista'],
      argomento: 'AI e lavoro', round: 1, indice: 0,
    }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.saltato).toBe(true);
    expect(d.turno).toBeUndefined();
  });

  it('un id inesistente viene ignorato, non rompe', async () => {
    const res = await POST(makeReq({
      azione: 'turno', compagni: ['archimede', 'inesistente', 'analista'],
      argomento: 'x', round: 1, indice: 0,
    }));
    expect(res.status).toBe(200);
    const d = await res.json();
    // due Compagni validi x 1 round = due turni, il nome sbagliato sparisce
    expect(d.totale).toBe(2);
    expect(d.turno.testo).toContain('intervento#');
  });

  it('senza l azione "turno" rifiuta: il vecchio percorso non esiste piu', async () => {
    const res = await POST(makeReq({ compagni: ['archimede', 'analista'], argomento: 'AI e lavoro', round: 2 }));
    expect(res.status).toBe(400);
  });
});
