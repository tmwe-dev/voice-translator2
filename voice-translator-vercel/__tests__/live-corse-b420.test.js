// ═══════════════════════════════════════════════════════════════
// b.420 — LE TRE CORSE DEL DAL-VIVO, nate con b.418.
//
// Non erano in nessuno dei due audit precedenti: sono difetti MIEI di
// ieri, trovati leggendo il codice nuovo. Tutti e tre veri.
//
// 1. FRA IL PALETTO E LA SESSIONE C'ERA UNA CHIAMATA HTTP. Il paletto
//    si prendeva con SET NX (atomico, giusto), ma la riga che dice «la
//    linea esiste» veniva scritta solo DOPO aver chiesto la firma a
//    ElevenLabs. In quel buco — centinaia di millisecondi — una seconda
//    richiesta trovava il paletto occupato, cercava la linea che lo
//    teneva, non la trovava, e concludeva che fosse il fantasma di una
//    linea morta. Lo sovrascriveva. Due telefonate.
//    E la prova di b.418 non poteva accorgersene: apriva una linea DOPO
//    l'altra, mai INSIEME.
//
// 2. BATTITO E CHIUSURA LEGGEVANO LO STESSO STATO SENZA NIENTE IN MEZZO.
//    Un battito partito un istante prima poteva riscrivere una sessione
//    appena cancellata: sessione fantasma e riserva che nessuno chiude.
//
// 3. `commit()` NON DICEVA SE ERA RIUSCITO. La chiusura contava i minuti
//    come pagati anche quando il portafoglio rifiutava — per esempio
//    perche il cron aveva gia rilasciato la riserva. Minuti mai
//    incassati, dati per incassati.
//
// Qui le corse si fanno succedere DAVVERO: `Promise.all` sulle aperture,
// e un fornitore che si puo tenere in attesa a comando.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';

const portafoglio = { riserve: [], commit: [], release: [], credito: Infinity };
const stato = new Map();
const scaduta = (id) => stato.set(id, 'rilasciata');   // come il cron delle riserve scadute
vi.mock('../app/wallet/riserva.js', () => ({
  riserva: async (utente, secondi, dettaglio) => {
    if (secondi > portafoglio.credito) return { ok: false, motivo: 'credito-insufficiente' };
    portafoglio.credito -= secondi;
    const id = portafoglio.riserve.length + 1;
    portafoglio.riserve.push({ id, utente, secondi, dettaglio });
    stato.set(id, 'attiva');
    return { ok: true, riservaId: id };
  },
  commit: async (id, secondi, dettaglio) => {
    if (stato.get(id) !== 'attiva') return { ok: false, motivo: `riserva gia chiusa (${stato.get(id) || 'inesistente'})` };
    stato.set(id, 'confermata');
    portafoglio.commit.push({ id, secondi, dettaglio });
    return { ok: true };
  },
  release: async (id, motivo) => {
    if (stato.get(id) === 'attiva') stato.set(id, 'rilasciata');
    portafoglio.release.push({ id, motivo });
  },
}));

vi.mock('../app/lib/apiAuth.js', () => ({
  resolveAuth: async () => ({ apiKey: 'chiave', isOwnKey: false, billingEmail: 'luca@esempio.it' }),
}));

const deposito = new Map();
vi.mock('../app/lib/redis.js', () => ({
  redis: async (comando, chiave, valore, ...resto) => {
    if (comando === 'SET') {
      if (resto.includes('NX') && deposito.has(chiave)) return null;
      if (resto.includes('XX') && !deposito.has(chiave)) return null;
      deposito.set(chiave, valore); return 'OK';
    }
    if (comando === 'GET') return deposito.get(chiave) ?? null;
    if (comando === 'DEL') { deposito.delete(chiave); return 1; }
    if (comando === 'EXPIRE') return 1;
    return null;
  },
}));

vi.mock('../app/lib/llmCaller.js', () => ({ callLLMWithFallback: async () => ({}) }));
vi.mock('../app/lib/topics/servizio.js', () => ({ cercaArgomenti: async () => [] }));
vi.mock('openai', () => ({ default: class { }, toFile: async () => ({}) }));

process.env.ELEVENLABS_AMICO_AGENT_ID = 'agent_di_prova';

const { apriLineaDalVivo, rinnovaLineaDalVivo, chiudiLineaDalVivo } = await import('../app/lib/compagni/ponte.js');
const { LIVE_TRATTO_SECONDI, creditoDalVivo } = await import('../app/wallet/tariffe.js');

const T0 = 1_000_000;
const EMAIL = 'luca@esempio.it';
const COMPAGNO = { id: 'archimede', nome: 'Archimede', voce: { id: 'v' } };

// Il fornitore che si puo tenere in attesa: e la finestra dentro cui
// viveva la corsa numero 1.
let trattieni = null;

beforeEach(() => {
  portafoglio.riserve.length = 0; portafoglio.commit.length = 0; portafoglio.release.length = 0;
  portafoglio.credito = Infinity;
  stato.clear(); deposito.clear();
  trattieni = null;
  global.fetch = async () => {
    if (trattieni) await trattieni;
    return { ok: true, status: 200, json: async () => ({ signed_url: 'wss://firmato/x' }), text: async () => '' };
  };
});

const apri = (email = EMAIL) => apriLineaDalVivo({
  compagno: COMPAGNO, email, userToken: 'gettone', nomeLingua: 'Italiano', contesto: '', adesso: T0,
});

const sessioniVive = () => [...deposito.keys()].filter((k) => k.startsWith('live:sessione:'));

describe('1 — due aperture NELLO STESSO ISTANTE, non una dopo l altra', () => {
  it('ne passa una sola anche mentre il fornitore sta ancora firmando', async () => {
    // E' il difetto vero: la seconda arrivava mentre la prima era in
    // attesa di ElevenLabs, non trovava la linea, e la dichiarava morta.
    let sblocca;
    trattieni = new Promise((r) => { sblocca = r; });

    const a = apri();
    const b = apri();
    await new Promise((r) => setTimeout(r, 10));   // tutte e due dentro la finestra
    sblocca();
    const [uno, due] = await Promise.all([a, b]);

    const passate = [uno, due].filter((r) => r.ok);
    expect(passate.length, 'una sola telefonata').toBe(1);
    const respinta = [uno, due].find((r) => !r.ok);
    expect(respinta.motivo).toBe('gia-in-corso');
    expect(respinta.status).toBe(409);
  });

  it('e la respinta non lascia credito bloccato ne linee appese', async () => {
    let sblocca;
    trattieni = new Promise((r) => { sblocca = r; });
    const a = apri(); const b = apri();
    await new Promise((r) => setTimeout(r, 10));
    sblocca();
    await Promise.all([a, b]);
    expect(sessioniVive().length, 'una linea sola in piedi').toBe(1);
    const bloccate = portafoglio.riserve.filter((r) => stato.get(r.id) === 'attiva');
    expect(bloccate.length, 'una riserva sola viva').toBe(1);
  });

  it('dieci insieme: ne passa comunque una', async () => {
    let sblocca;
    trattieni = new Promise((r) => { sblocca = r; });
    const tutte = Array.from({ length: 10 }, () => apri());
    await new Promise((r) => setTimeout(r, 10));
    sblocca();
    const esiti = await Promise.all(tutte);
    expect(esiti.filter((r) => r.ok).length).toBe(1);
    expect(sessioniVive().length).toBe(1);
  });

  it("e se il fornitore non firma, il paletto NON resta a bloccare la persona", async () => {
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'no' });
    const primo = await apri();
    expect(primo.ok).toBe(false);
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ signed_url: 'wss://x' }), text: async () => '' });
    expect((await apri()).ok, 'si puo riprovare subito').toBe(true);
  });
});

describe('2 — un battito non puo resuscitare una telefonata gia chiusa', () => {
  it('la sessione non torna in vita, e il tratto aperto per sbaglio torna indietro', async () => {
    const a = await apri();
    // il battito legge lo stato...
    const battito = rinnovaLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 170_000 });
    // ...e nel frattempo la telefonata viene chiusa
    await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 170_000 });
    await battito;

    expect(sessioniVive(), 'nessuna sessione fantasma').toEqual([]);
    const appese = portafoglio.riserve.filter((r) => stato.get(r.id) === 'attiva');
    expect(appese, 'nessuna riserva che nessuno chiudera mai').toEqual([]);
  });

  it('e il paletto della persona si libera davvero', async () => {
    const a = await apri();
    const battito = rinnovaLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 170_000 });
    await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 170_000 });
    await battito;
    expect((await apri()).ok, 'si puo richiamare').toBe(true);
  });

  it('due chiusure insieme non addebitano due volte', async () => {
    const a = await apri();
    const [uno, due] = await Promise.all([
      chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 120_000 }),
      chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 120_000 }),
    ]);
    const totale = portafoglio.commit.reduce((t, m) => t + m.secondi, 0);
    expect(totale, 'un addebito solo').toBe(creditoDalVivo(120));
    expect([uno.creditoScalato, due.creditoScalato].filter((n) => n > 0).length, 'un conto solo').toBe(1);
  });
});

describe('3 — non si dichiara scalato cio che il portafoglio ha rifiutato', () => {
  it('se il cron ha gia liberato la riserva, la chiusura NON regala il tratto', async () => {
    // Lo scenario esatto: il battito non arriva, passano piu di dieci
    // minuti, il cron rilascia, l'utente chiude. Prima quei minuti
    // risultavano incassati e non lo erano.
    const a = await apri();
    scaduta(portafoglio.riserve[0].id);
    const c = await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 120_000 });

    expect(c.creditoScalato, 'il conto e vero').toBe(creditoDalVivo(120));
    const incassato = portafoglio.commit.reduce((t, m) => t + m.secondi, 0);
    expect(incassato, 'e corrisponde a cio che il portafoglio ha davvero confermato').toBe(c.creditoScalato);
    expect(portafoglio.commit.every((m) => m.dettaglio.recupero), 'recuperato con una riserva nuova').toBe(true);
  });

  it('e se non c e piu credito per recuperare, si dichiara meno, non di piu', async () => {
    const a = await apri();
    scaduta(portafoglio.riserve[0].id);
    portafoglio.credito = 0;                       // niente da bloccare
    const c = await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 120_000 });
    expect(c.creditoScalato, 'zero incassato, zero dichiarato').toBe(0);
    expect(portafoglio.commit.length).toBe(0);
  });

  it('anche il battito conta solo i tratti confermati davvero', async () => {
    const a = await apri();
    scaduta(portafoglio.riserve[0].id);
    const r = await rinnovaLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 170_000 });
    expect(r.ok).toBe(true);
    expect(r.scalato, 'quel tratto non e stato incassato').toBe(0);
    // e alla chiusura il dovuto e ancora tutto li, e si recupera
    const c = await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 180_000 });
    const incassato = portafoglio.commit.reduce((t, m) => t + m.secondi, 0);
    expect(c.creditoScalato).toBe(incassato);
    expect(c.creditoScalato).toBe(creditoDalVivo(180));
  });
});

describe('il battito che trova occupato salta il giro, non rompe niente', () => {
  it('due battiti insieme: uno lavora, l altro passa oltre', async () => {
    const a = await apri();
    const [uno, due] = await Promise.all([
      rinnovaLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 170_000 }),
      rinnovaLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 170_000 }),
    ]);
    expect(uno.ok && due.ok, 'nessuno dei due e un errore').toBe(true);
    expect([uno.rinnovato, due.rinnovato].filter(Boolean).length, 'una rotazione sola').toBe(1);
    const attive = portafoglio.riserve.filter((r) => stato.get(r.id) === 'attiva');
    expect(attive.length, 'una riserva viva sola').toBe(1);
    expect(attive[0].secondi).toBe(LIVE_TRATTO_SECONDI);
  });
});
