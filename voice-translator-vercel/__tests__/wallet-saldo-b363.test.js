// ═══════════════════════════════════════════════════════════════
// b.363 — IL SALDO DI UN ALTRO NON SI LEGGE, E NESSUNO LO CONTROLLAVA
//
// /api/wallet/saldo dice quanti soldi ha in cassa una persona, e cosa
// ha comprato negli ultimi giorni. Sono soldi e sono abitudini: due
// cose che riguardano una persona sola. Il codice lo sa — l'identita la
// prende dalla sessione, non da un parametro — ma nessun test lo
// pretendeva, quindi era una buona intenzione scritta in un commento,
// non una regola sorvegliata.
//
// Qui si chiama la rotta VERA e le si chiede di sbagliare: si manda un
// gettone di Anna e le si chiede il saldo di Bruno.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../app/lib/apiGuard.js', () => ({
  withApiGuard: (handler) => handler,
}));

const getSession = vi.fn();
vi.mock('../app/lib/users.js', () => ({
  getSession: (...a) => getSession(...a),
}));

const saldo = vi.fn();
const usoOggiEMese = vi.fn();
const storicoAcquisti = vi.fn();
vi.mock('../app/wallet/contabilita.js', () => ({
  saldo: (...a) => saldo(...a),
  usoOggiEMese: (...a) => usoOggiEMese(...a),
  storicoAcquisti: (...a) => storicoAcquisti(...a),
}));

const { GET } = await import('../app/api/wallet/saldo/route.js');

const richiesta = (gettone, coda = '') =>
  new Request(`http://localhost/api/wallet/saldo${coda}`, {
    method: 'GET',
    headers: gettone ? { Authorization: `Bearer ${gettone}` } : {},
  });

beforeEach(() => {
  getSession.mockReset();
  saldo.mockReset().mockResolvedValue(7200);
  usoOggiEMese.mockReset().mockResolvedValue({ oggi: 600, mese: 5400 });
  storicoAcquisti.mockReset().mockResolvedValue([]);
});

describe('b.363 — la cassa si apre solo col proprio gettone', () => {
  it('senza gettone non si legge niente', async () => {
    const res = await GET(richiesta(null));
    expect(res.status).toBe(401);
    expect(saldo, 'non si deve nemmeno interrogare la contabilita').not.toHaveBeenCalled();
  });

  it('un gettone che non apre nessuna sessione non vale', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(richiesta('gettone-scaduto'));
    expect(res.status).toBe(401);
    expect(saldo).not.toHaveBeenCalled();
  });
});

describe('b.363 — il saldo letto e sempre quello di chi ha il gettone', () => {
  it('chiedere il saldo di un altro non serve a niente', async () => {
    getSession.mockResolvedValue({ email: 'Anna@Esempio.it' });

    await GET(richiesta('gettone-di-anna', '?email=bruno@esempio.it&utente=bruno@esempio.it'));

    // Tutte e tre le domande vanno fatte su Anna, non su Bruno.
    expect(saldo).toHaveBeenCalledWith('anna@esempio.it');
    expect(usoOggiEMese).toHaveBeenCalledWith('anna@esempio.it');
    expect(storicoAcquisti).toHaveBeenCalledWith('anna@esempio.it', 10);
  });

  it('e i numeri tornano indietro gia leggibili da una persona', async () => {
    getSession.mockResolvedValue({ email: 'anna@esempio.it' });

    const dati = await (await GET(richiesta('gettone-di-anna'))).json();

    expect(dati.secondi).toBe(7200);
    expect(dati.testo).toBe('2h 0m');
    expect(dati.oggi).toBe('10m');
    expect(dati.mese).toBe('1h 30m');
  });

  it('lo storico non lascia trapelare le colonne grezze del database', async () => {
    // Se un domani la contabilita aggiungesse una colonna con dentro
    // qualcosa di sensibile, un `...r` la spedirebbe al browser senza
    // che nessuno lo decida. Qui si pretende che passino solo i quattro
    // campi voluti.
    getSession.mockResolvedValue({ email: 'anna@esempio.it' });
    storicoAcquisti.mockResolvedValue([
      {
        created_at: '2026-08-01T10:00:00Z',
        tipo: 'voucher',
        secondi: 3600,
        dettaglio: { euro: 9.9 },
        note_interne: 'NON DEVE USCIRE',
      },
    ]);

    const dati = await (await GET(richiesta('gettone-di-anna'))).json();

    expect(dati.storico).toEqual([
      { quando: '2026-08-01', tipo: 'voucher', testo: '+1h 0m', euro: '€9,90' },
    ]);
  });
});
