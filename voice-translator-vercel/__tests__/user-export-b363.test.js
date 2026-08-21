// ═══════════════════════════════════════════════════════════════
// b.363 — LA PORTA CHE CONSEGNA TUTTI I DATI DI UNA PERSONA
//
// /api/user/export e l'articolo 20 del GDPR: chi lo chiede si porta via
// tutto quello che sappiamo di lui — nome, lingua, abbonamento, spese,
// cronologia delle traduzioni. E la richiesta piu pericolosa che
// l'applicazione accetti, perche se risponde alla persona sbagliata
// consegna un dossier completo in un colpo solo.
//
// Nessun test la nominava. Il codice fa la cosa giusta (identita dal
// gettone, chiavi API escluse a mano), ma nessuno lo pretendeva: era
// una promessa scritta in un commento. Da qui in avanti e una regola.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.fn();
const getUser = vi.fn();
vi.mock('../app/lib/users.js', () => ({
  getSession: (...a) => getSession(...a),
  getUser: (...a) => getUser(...a),
}));

// Senza Supabase configurato la rotta ripiega sui soli dati di Redis:
// e la strada che si vuole provare qui, e non serve un database vero.
vi.mock('../app/lib/supabase.js', () => ({
  getSupabaseAdmin: () => null,
}));

const { GET } = await import('../app/api/user/export/route.js');

const richiesta = (intestazioneAuth) =>
  new Request('http://localhost/api/user/export', {
    method: 'GET',
    headers: intestazioneAuth ? { Authorization: intestazioneAuth } : {},
  });

const SCHEDA_ANNA = {
  email: 'anna@esempio.it',
  name: 'Anna',
  lang: 'it',
  tier: 'pro',
  credits: 4200,
  // Le chiavi dei fornitori vivono sulla stessa scheda: non devono
  // uscire nemmeno quando e la persona stessa a chiedere i suoi dati.
  apiKeys: { openai: 'sk-SEGRETISSIMO-123' },
  useOwnKeys: true,
};

beforeEach(() => {
  getSession.mockReset();
  getUser.mockReset();
});

describe('b.363 — nessuno scarica il dossier di un altro', () => {
  it('senza intestazione di autorizzazione si esce con 401', async () => {
    const res = await GET(richiesta(null));
    expect(res.status).toBe(401);
    expect(getUser, 'non si deve nemmeno cercare la persona').not.toHaveBeenCalled();
  });

  it('un\'autorizzazione che non e un Bearer non vale', async () => {
    const res = await GET(richiesta('Basic YW5uYTpzZWdyZXRv'));
    expect(res.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('un gettone scaduto non apre niente', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(richiesta('Bearer gettone-scaduto'));
    expect(res.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('la persona cercata e quella del gettone, non una qualsiasi', async () => {
    getSession.mockResolvedValue({ email: 'anna@esempio.it' });
    getUser.mockResolvedValue(SCHEDA_ANNA);

    const dati = await (await GET(richiesta('Bearer gettone-di-anna'))).json();

    expect(getUser).toHaveBeenCalledWith('anna@esempio.it');
    expect(dati.data_subject_email).toBe('anna@esempio.it');
  });

  it('una sessione valida di qualcuno che non esiste piu da 404', async () => {
    getSession.mockResolvedValue({ email: 'fantasma@esempio.it' });
    getUser.mockResolvedValue(null);

    const res = await GET(richiesta('Bearer gettone-buono'));
    expect(res.status).toBe(404);
  });
});

describe('b.363 — cosa esce e cosa non deve uscire', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ email: 'anna@esempio.it' });
    getUser.mockResolvedValue(SCHEDA_ANNA);
  });

  it('le chiavi dei fornitori NON finiscono nell\'esportazione', async () => {
    // La rotta compila i campi uno per uno proprio per questo. Se un
    // domani qualcuno la semplificasse in `...userProfile`, le chiavi
    // partirebbero dentro un file scaricabile.
    const res = await GET(richiesta('Bearer gettone-di-anna'));
    const testo = JSON.stringify(await res.json());

    expect(testo).not.toContain('sk-SEGRETISSIMO-123');
    expect(testo).not.toContain('apiKeys');
  });

  it('ma esce tutto cio che la persona ha diritto di riavere', async () => {
    const dati = await (await GET(richiesta('Bearer gettone-di-anna'))).json();

    expect(dati.user).toMatchObject({
      email: 'anna@esempio.it',
      name: 'Anna',
      language_preference: 'it',
      subscription_tier: 'pro',
      credits_balance: 4200,
      use_own_api_keys: true,
    });
    expect(dati.export_format, 'deve dire sotto quale diritto viene consegnato')
      .toContain('GDPR');
  });
});
