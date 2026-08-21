// ═══════════════════════════════════════════════════════════════
// b.363 — LA PORTA DEI VOUCHER NON ERA SORVEGLIATA DA NESSUNO
//
// /api/wallet/voucher regala secondi di credito: e una porta che vale
// soldi veri. Fino a oggi nessun test di tutto il progetto la nominava
// nemmeno. Se qualcuno avesse tolto il controllo della sessione, o
// avesse fatto accreditare il voucher all'email scritta dentro la
// richiesta invece che a quella di chi ha il gettone, tutte le prove
// sarebbero rimaste verdi e nessuno se ne sarebbe accorto.
//
// Questo file chiama la rotta VERA — non una sua riscrittura — e le
// chiede le due cose che contano: chi entra, e a chi finiscono i soldi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';

// La guardia comune (limite di frequenza) parla con Redis: qui non e
// cio che si sta provando, quindi la si lascia passare.
vi.mock('../app/lib/apiGuard.js', () => ({
  withApiGuard: (handler) => handler,
}));

const getSession = vi.fn();
vi.mock('../app/lib/users.js', () => ({
  getSession: (...a) => getSession(...a),
}));

const riscattaVoucher = vi.fn();
vi.mock('../app/wallet/voucher.js', () => ({
  riscattaVoucher: (...a) => riscattaVoucher(...a),
}));

const { POST } = await import('../app/api/wallet/voucher/route.js');

const richiesta = (corpo, gettone) =>
  new Request('http://localhost/api/wallet/voucher', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(gettone ? { Authorization: `Bearer ${gettone}` } : {}),
    },
    body: JSON.stringify(corpo),
  });

beforeEach(() => {
  getSession.mockReset();
  riscattaVoucher.mockReset();
});

describe('b.363 — chi puo riscattare un voucher', () => {
  it('senza gettone non si entra, e nessun credito si muove', async () => {
    const res = await POST(richiesta({ codice: 'REGALO10' }));
    expect(res.status).toBe(401);
    expect(riscattaVoucher, 'nessuno deve essere accreditato').not.toHaveBeenCalled();
  });

  it('un gettone che non apre nessuna sessione vale come nessun gettone', async () => {
    getSession.mockResolvedValue(null);
    const res = await POST(richiesta({ codice: 'REGALO10' }, 'gettone-scaduto'));
    expect(res.status).toBe(401);
    expect(riscattaVoucher).not.toHaveBeenCalled();
  });

  it('senza codice si risponde 400, non si tenta il riscatto', async () => {
    getSession.mockResolvedValue({ email: 'anna@esempio.it' });
    const res = await POST(richiesta({}, 'gettone-buono'));
    expect(res.status).toBe(400);
    expect(riscattaVoucher).not.toHaveBeenCalled();
  });
});

describe('b.363 — a chi finiscono i secondi', () => {
  it('al proprietario del gettone, MAI all\'email scritta nella richiesta', async () => {
    // E il difetto classico delle rotte a soldi: leggere l'identita dal
    // corpo della richiesta, cioe da chi la manda. Qui si prova che il
    // corpo viene ignorato.
    getSession.mockResolvedValue({ email: 'Anna@Esempio.it' });
    riscattaVoucher.mockResolvedValue({ ok: true, secondi: 3600 });

    const res = await POST(
      richiesta({ codice: 'REGALO10', email: 'ladro@altrove.it' }, 'gettone-buono')
    );

    expect(res.status).toBe(200);
    expect(riscattaVoucher).toHaveBeenCalledWith('anna@esempio.it', 'REGALO10');
  });

  it('e il credito accreditato viene detto all\'utente in ore e minuti', async () => {
    getSession.mockResolvedValue({ email: 'anna@esempio.it' });
    riscattaVoucher.mockResolvedValue({ ok: true, secondi: 3600 });

    const res = await POST(richiesta({ codice: 'REGALO10' }, 'gettone-buono'));
    expect(await res.json()).toEqual({ ok: true, testo: '+1h 0m' });
  });

  it('un voucher rifiutato non e un guasto: 422 col motivo, non 500', async () => {
    // Un codice gia usato o inventato e una cosa normale. Se rispondesse
    // 500 finirebbe fra i guasti veri nei registri e li seppellirebbe.
    getSession.mockResolvedValue({ email: 'anna@esempio.it' });
    riscattaVoucher.mockResolvedValue({ ok: false, motivo: 'gia usato' });

    const res = await POST(richiesta({ codice: 'VECCHIO' }, 'gettone-buono'));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, motivo: 'gia usato' });
  });
});
