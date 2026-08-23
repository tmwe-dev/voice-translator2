// ═══════════════════════════════════════════════════════════════
// b.418 — LA TELEFONATA DAL VIVO SI PAGA TUTTA, E SE NE APRE UNA SOLA.
//
// DUE FALLE, sommate, tutte e due mie (b.407):
//
//  1. `creditoDalVivo` faceva `Math.min(TETTO, ...)` e nessuno fermava
//     la telefonata al quindicesimo minuto: dal sedicesimo in poi si
//     parlava gratis e il fornitore lo pagavamo noi.
//  2. PEGGIO, e non era nell'audit esterno: una riserva viva da piu di
//     DIECI minuti la rilascia il cron delle riserve scadute
//     (migrazione 011, in agenda ogni ora a :15). Il tetto da quindici
//     minuti era gia oltre la vita massima di una riserva: se il cron
//     passava durante la telefonata, alla chiusura non c'era piu niente
//     da scalare. Non «meno»: zero, tutta la telefonata.
//
// E una terza cosa, che l'audit chiamava P2: «una telefonata sola» era
// scritto in un commento e non lo imponeva nessuno.
//
// Qui si fanno girare i verbi veri con un finto portafoglio e un finto
// deposito che sa fare `SET NX`. Non si legge nessun sorgente.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';

// b.420 — IL FINTO PORTAFOGLIO ADESSO SA DIRE DI NO, come quello vero.
// `wallet_commit` rifiuta una riserva inesistente o gia chiusa, e da
// b.420 `commit()` lo riporta al chiamante. Un finto che diceva sempre
// di si non poteva accorgersi di un tratto contato e mai incassato:
// e' esattamente il difetto numero 3 segnalato oggi.
// `scaduta(id)` imita il cron delle riserve scadute.
const portafoglio = { riserve: [], commit: [], release: [], credito: Infinity };
const stato = new Map();   // riservaId -> 'attiva' | 'confermata' | 'rilasciata'
const scaduta = (id) => stato.set(id, 'rilasciata');
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

// Il deposito con `SET NX` vero: senza, il paletto passerebbe sempre e
// la prova della doppia apertura non proverebbe niente.
const deposito = new Map();
vi.mock('../app/lib/redis.js', () => ({
  redis: async (comando, chiave, valore, ...resto) => {
    if (comando === 'SET') {
      // b.420 — il finto conosce NX e XX, perche adesso il codice ci
      // conta: NX e il paletto e il lucchetto, XX e la riga che impedisce
      // a un battito di resuscitare una telefonata gia chiusa.
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
const { LIVE_TRATTO_SECONDI, LIVE_TRATTO_MINUTI, MOLTIPLICATORE_DAL_VIVO, creditoDalVivo } = await import('../app/wallet/tariffe.js');

const T0 = 1_000_000;
const COMPAGNO = { id: 'archimede', nome: 'Archimede', voce: { id: 'v' } };
const EMAIL = 'luca@esempio.it';

beforeEach(() => {
  portafoglio.riserve.length = 0; portafoglio.commit.length = 0; portafoglio.release.length = 0;
  portafoglio.credito = Infinity;
  stato.clear();
  deposito.clear();
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ signed_url: 'wss://firmato/x' }), text: async () => '' });
});

const apri = (email = EMAIL) => apriLineaDalVivo({
  compagno: COMPAGNO, email, userToken: 'gettone', nomeLingua: 'Italiano', contesto: '', adesso: T0,
});

const scalatoTotale = () => portafoglio.commit.reduce((t, m) => t + m.secondi, 0);

// Una telefonata vera: si apre, il telefono batte ogni minuto, si chiude.
async function telefonata(minuti) {
  const a = await apri();
  for (let m = 1; m <= minuti; m++) {
    const r = await rinnovaLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + m * 60_000 });
    if (!r.ok) return { a, interrotta: r, minutiFatti: m };
  }
  const c = await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + minuti * 60_000 });
  return { a, c, minutiFatti: minuti };
}

describe('il tetto non e piu un condono', () => {
  it('la tariffa non taglia piu niente: un ora parlata vale un ora', () => {
    expect(creditoDalVivo(3600)).toBe(3600 * MOLTIPLICATORE_DAL_VIVO);
    expect(creditoDalVivo(3600), 'era qui il regalo').toBeGreaterThan(LIVE_TRATTO_SECONDI);
  });

  it('quattro minuti si pagano quattro minuti', async () => {
    const { c } = await telefonata(4);
    expect(c.secondiParlati).toBe(240);
    expect(c.creditoScalato).toBe(creditoDalVivo(240));
    expect(scalatoTotale()).toBe(creditoDalVivo(240));
  });

  it('quattordici minuti si pagano quattordici minuti', async () => {
    const { c } = await telefonata(14);
    expect(c.creditoScalato).toBe(creditoDalVivo(14 * 60));
    expect(scalatoTotale()).toBe(creditoDalVivo(14 * 60));
  });

  it('SEDICI minuti: prima era il punto in cui si smetteva di pagare', async () => {
    const { c } = await telefonata(16);
    expect(c.creditoScalato).toBe(creditoDalVivo(16 * 60));
    expect(c.creditoScalato, 'oltre il vecchio tetto, e giusto cosi').toBeGreaterThan(15 * 60 * MOLTIPLICATORE_DAL_VIVO);
  });

  it('trentuno minuti: piu rinnovi, e il conto torna lo stesso', async () => {
    const { c } = await telefonata(31);
    expect(c.creditoScalato).toBe(creditoDalVivo(31 * 60));
    expect(portafoglio.riserve.length, 'tanti tratti, non un blocco solo').toBeGreaterThan(5);
  });
});

describe('nessuna riserva invecchia: e questo che salvava la telefonata dal cron', () => {
  it('ogni riserva vive meno del quarto d ora del cron', async () => {
    // il cron rilascia cio che e attivo da piu di dieci minuti.
    await telefonata(31);
    for (const r of portafoglio.riserve) {
      expect(r.secondi, 'un tratto corto si conferma prima di invecchiare').toBeLessThanOrEqual(LIVE_TRATTO_SECONDI);
    }
    expect(LIVE_TRATTO_MINUTI, 'e il tratto sta comodamente sotto i dieci minuti').toBeLessThan(10);
  });

  it('non ci sono mai due riserve aperte insieme', async () => {
    // ogni tratto si CONFERMA prima che il successivo si apra: due
    // riserve vive vorrebbero dire credito bloccato due volte.
    const a = await apri();
    for (let m = 1; m <= 20; m++) {
      await rinnovaLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + m * 60_000 });
      const chiuse = portafoglio.commit.length + portafoglio.release.length;
      expect(portafoglio.riserve.length - chiuse, `al minuto ${m}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('il credito che finisce a meta telefonata', () => {
  it('la linea si chiude, e cio che hai parlato resta pagato', async () => {
    portafoglio.credito = LIVE_TRATTO_SECONDI * 2;   // due tratti e basta
    const esito = await telefonata(30);
    expect(esito.interrotta, 'la telefonata non prosegue gratis').toBeTruthy();
    expect(esito.interrotta.motivo).toBe('credito-finito');
    expect(esito.interrotta.status).toBe(402);
    expect(scalatoTotale(), 'quello che si e detto e stato pagato').toBeGreaterThan(0);
  });

  it('e non resta niente appeso: la sessione sparisce', async () => {
    portafoglio.credito = LIVE_TRATTO_SECONDI * 2;
    const esito = await telefonata(30);
    const dopo = await chiudiLineaDalVivo({ sessioneId: esito.a.sessioneId, email: EMAIL, adesso: T0 + 3_600_000 });
    expect(dopo.gia, 'era gia chiusa').toBe(true);
    expect(dopo.creditoScalato).toBe(0);
  });
});

describe('chiudere due volte non paga due volte', () => {
  it('il tasto e la chiusura della pagina arrivano insieme', async () => {
    const a = await apri();
    const uno = await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 120_000 });
    const due = await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 120_000 });
    expect(uno.creditoScalato).toBe(creditoDalVivo(120));
    expect(due.gia).toBe(true);
    expect(scalatoTotale(), 'un addebito solo').toBe(creditoDalVivo(120));
  });
});

describe('il telefono che non batte: si paga lo stesso', () => {
  it('dieci minuti senza un solo battito si pagano dieci minuti', async () => {
    // succede: un telefono vecchio, una rete che mangia le richieste, la
    // pagina chiusa di colpo. Prima si sarebbe pagato un tratto solo.
    const a = await apri();
    const c = await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 600_000 });
    expect(c.creditoScalato).toBe(creditoDalVivo(600));
    expect(scalatoTotale()).toBe(creditoDalVivo(600));
  });

  it('e se il credito non basta si scala il possibile, non si insegue nessuno', async () => {
    portafoglio.credito = LIVE_TRATTO_SECONDI;   // un tratto solo
    const a = await apri();
    const c = await chiudiLineaDalVivo({ sessioneId: a.sessioneId, email: EMAIL, adesso: T0 + 600_000 });
    expect(c.creditoScalato, 'quello che c era').toBe(LIVE_TRATTO_SECONDI);
    expect(c.creditoScalato, 'e non piu di quello').toBeLessThan(creditoDalVivo(600));
  });
});

describe('P2 — una telefonata sola per persona', () => {
  it('la seconda apertura non passa, e non blocca credito', async () => {
    const uno = await apri();
    expect(uno.ok).toBe(true);
    const riserveDopoLaPrima = portafoglio.riserve.length;
    const due = await apri();
    expect(due.ok).toBe(false);
    expect(due.motivo).toBe('gia-in-corso');
    expect(due.status).toBe(409);
    expect(portafoglio.riserve.length, 'la seconda non ha bloccato niente').toBe(riserveDopoLaPrima);
  });

  it('ma un altra persona apre tranquillamente', async () => {
    await apri();
    const altra = await apri('anna@esempio.it');
    expect(altra.ok).toBe(true);
  });

  it('e dopo aver chiuso si puo richiamare', async () => {
    const uno = await apri();
    await chiudiLineaDalVivo({ sessioneId: uno.sessioneId, email: EMAIL, adesso: T0 + 60_000 });
    const due = await apri();
    expect(due.ok, 'il paletto e stato tolto').toBe(true);
  });

  it("un paletto rimasto in piedi da una linea morta non blocca per sempre", async () => {
    const uno = await apri();
    // la linea sparisce (Redis scaduto, server riavviato) ma il paletto resta
    deposito.delete(`live:sessione:${uno.sessioneId}`);
    const due = await apri();
    expect(due.ok, 'il fantasma non chiude fuori la persona').toBe(true);
  });

  it('e chiudere non toglie MAI il paletto di un altro', async () => {
    const uno = await apri();
    await chiudiLineaDalVivo({ sessioneId: uno.sessioneId, email: EMAIL, adesso: T0 + 1000 });
    const due = await apri();
    // una chiusura in ritardo della PRIMA non deve scoperchiare la seconda
    await chiudiLineaDalVivo({ sessioneId: uno.sessioneId, email: EMAIL, adesso: T0 + 2000 });
    expect(deposito.get('live:utente:luca@esempio.it'), 'il paletto e ancora della seconda').toBe(due.sessioneId);
  });
});

describe('il battito e di chi ha aperto la linea', () => {
  it('un altro non puo tenere viva (ne pagare) la tua telefonata', async () => {
    const a = await apri();
    const r = await rinnovaLineaDalVivo({ sessioneId: a.sessioneId, email: 'ladro@esempio.it', adesso: T0 + 60_000 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('e battere su una sessione che non esiste lo dice, invece di far finta', async () => {
    const r = await rinnovaLineaDalVivo({ sessioneId: 'mai-esistita', email: EMAIL, adesso: T0 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('sessione-chiusa');
    expect(r.status).toBe(410);
  });
});
