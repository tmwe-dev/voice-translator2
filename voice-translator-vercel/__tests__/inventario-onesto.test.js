// ═══════════════════════════════════════════════════════════════
// L'INVENTARIO CHE GRIDAVA AL LUPO (b.121)
//
// Avevo scritto un generatore che legge tutte le rotte e segnala i
// difetti, e nella sua intestazione avevo messo questa frase:
//
//     "una tabella che mente e peggio di nessuna tabella,
//      perche qualcuno ci si fida"
//
// Poi l'ho eseguito. Ha segnalato dieci cose. Ne ho verificate quattro
// a mano, una per una, e **erano false tutte e quattro**:
//
//   · /api/auth, /api/messages, /api/translate-free — "due limitatori
//     sovrapposti". Le chiavi sono diverse (`auth` / `auth-otp`,
//     `messages` / `messages-patch`, `translate-free` /
//     `free-translate`): sono due secchi distinti, cioe un limite piu
//     stretto annidato in uno piu largo. Voluto, e giusto.
//     In /api/auth c'era perfino il commento che documentava la
//     correzione di quel difetto: l'inventario segnalava come bug la
//     sua stessa cura.
//
//   · /api/room — "si fida di un'identita presa dal corpo".
//     `resolveRoomIdentity` scarta il nome e restituisce null senza un
//     gettone valido. Il parametro e un residuo che non decide niente.
//
// Quattro su quattro. Il difetto non era nelle rotte: era nello
// strumento che le giudicava. Cercava una stringa e chiamava difetto
// la sua presenza — che e la differenza fra un controllo e un sospetto.
//
// ── PERCHE E LO STESSO GUASTO DI b.118 ──
//
// La c'erano i 500 da corpo malformato che seppellivano i guasti veri
// nei registri. Qui ci sono le segnalazioni infondate che seppelliscono
// quelle fondate. In tutti e due i casi il danno non e il singolo
// errore: e che la spia smette di voler dire qualcosa. Alla decima
// segnalazione a vuoto si chiude l'elenco, e la volta che dice il vero
// non lo legge nessuno.
//
// Uno strumento di controllo ha un obbligo in piu del codice normale:
// deve avere ragione. Se sbaglia, non e neutro — fa danno.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { esamina, inventario } from '../scripts/inventario-api.mjs';

const RADICE = path.join(__dirname, '..');
const rotta = (n) => fs.readFileSync(path.join(RADICE, 'app', 'api', n, 'route.js'), 'utf8');

describe('i quattro falsi allarmi non tornano', () => {
  it('due limiti su chiavi DIVERSE non sono un difetto', () => {
    // E il caso vero, preso dal codice: guardia su `auth`, limite
    // proprio su `auth-otp`. Un limite piu stretto per il login.
    for (const n of ['auth', 'messages', 'translate-free']) {
      const r = esamina(n);
      expect(r, `/api/${n} deve esistere`).toBeTruthy();
      expect(r.chiaviProprie, `/api/${n} deve avere una chiave sua`).not.toBe('—');
      expect(r.doppioConteggio, `/api/${n} segnalata a torto: guardia '${r.prefisso}', propria '${r.chiaviProprie}'`)
        .toBe(false);
    }
  });

  it('ma due limiti sulla STESSA chiave lo sono ancora', () => {
    // Il controllo non deve essere diventato cieco per farlo tacere:
    // sarebbe il modo piu facile di avere zero segnalazioni.
    const finta = `
      import { withApiGuard } from '../../lib/apiGuard.js';
      async function h(req) {
        const rl = await checkRateLimit(getRateLimitKey(req, 'pippo'), 10);
        return rl;
      }
      export const POST = withApiGuard(h, { maxRequests: 20, prefix: 'pippo' });
    `;
    expect(esamina('finta', finta).doppioConteggio, 'stessa chiave = si conta due volte').toBe(true);
  });

  it('/api/room non si fida del nome: resolveRoomIdentity lo scarta', () => {
    expect(esamina('room').siFidaDelCorpo).toBe(false);
    const store = fs.readFileSync(path.join(RADICE, 'app', 'lib', 'store.js'), 'utf8');
    const i = store.indexOf('export async function resolveRoomIdentity');
    expect(store.slice(i, i + 120), 'senza gettone non si e nessuno').toMatch(/if \(!token\) return null;/);
  });

  it('un commento che CITA un difetto non e quel difetto', () => {
    // Ci sono gia cascato in `niente-silenzi`, con un test che
    // diventava rosso leggendo la propria spiegazione.
    const finta = `
      // Prima era checkRateLimit(getRateLimitKey(req, 'pippo')) e contava doppio
      export const POST = withApiGuard(h, { prefix: 'pippo' });
    `;
    expect(esamina('finta', finta).doppioConteggio).toBe(false);
  });
});

describe('cio che resta aperto lo dice, e dice perche', () => {
  it('una rotta aperta senza motivo scritto e un difetto', () => {
    const finta = `export async function GET() { return new Response('ciao'); }`;
    expect(esamina('finta', finta).scoperta).toBe(true);
  });

  it('con il motivo scritto accanto, no', () => {
    const finta = `
      // INVENTARIO: pubblica — la chiedono i crawler dei social senza credenziali
      export async function GET() { return new Response('ciao'); }
    `;
    const r = esamina('finta', finta);
    expect(r.scoperta).toBe(false);
    expect(r.motivoPubblica).toMatch(/crawler/);
  });

  it('e il motivo dev\'essere una frase, non una parola', () => {
    // Stessa regola dei catch spiegati: "ok" non spiega niente, e
    // permetterlo vorrebbe dire dare a chiunque il modo di zittire il
    // controllo senza pensarci.
    const pigri = [];
    for (const r of inventario()) {
      if (r.motivoPubblica && r.motivoPubblica.split(/\s+/).length < 6) {
        pigri.push(`${r.rotta}: "${r.motivoPubblica}"`);
      }
    }
    expect(pigri, `motivi troppo corti:\n  ${pigri.join('\n  ')}`).toEqual([]);
  });

  it('oggi nessuna rotta e aperta per distrazione', () => {
    const scoperte = inventario().filter((r) => r.stato === 'viva' && r.scoperta).map((r) => r.rotta);
    expect(scoperte, `senza protezione e senza motivo:\n  ${scoperte.join('\n  ')}`).toEqual([]);
  });
});

describe('lo stato del servizio non fa piu la spia', () => {
  const h = () => rotta('health');

  it('la risposta pubblica non elenca i fornitori', () => {
    // Interrogata dal vivo diceva a chiunque quali AI erano configurate
    // e quali no: la pianta del posto, e dove mirare.
    const s = h();
    const i = s.indexOf('const pubblica = {');
    const corpo = s.slice(i, s.indexOf('}', i));
    for (const vietato of ['services', 'devMode', 'version', 'circuitBreakers']) {
      expect(corpo, `"${vietato}" non deve uscire senza credenziali`).not.toMatch(new RegExp(vietato));
    }
    expect(corpo).toMatch(/status/);
  });

  it('e soprattutto non dice se l\'allarme e acceso', () => {
    // `sentry: not_configured` significa "nessuno sta guardando".
    // Detto a chi sta provando le porte, e un invito.
    const s = h();
    const iPubblica = s.indexOf('const pubblica = {');
    const iCorpo = s.indexOf('const corpo =');
    expect(s.slice(iPubblica, iCorpo)).not.toMatch(/sentry/);
    expect(s, 'il dettaglio esiste ancora, ma dietro il controllo').toMatch(/dettaglio\s*\?/);
  });

  it('il dettaglio richiede una sessione da amministratore, verificata dal server', () => {
    const s = h();
    expect(s).toMatch(/async function chiedeUnAmministratore/);
    expect(s, 'il gettone si verifica, non si crede').toMatch(/await getSession\(token\)/);
    expect(s).toMatch(/ADMIN_EMAILS\.includes/);
  });

  it('il gettone viaggia nell\'intestazione, mai nell\'indirizzo', () => {
    // Un indirizzo finisce nella cronologia del browser e nei registri
    // del server. E la regola gia adottata in b.104.
    const s = h();
    expect(s).toMatch(/headers\.get\('authorization'\)/);
    expect(s, 'niente gettoni nella query').not.toMatch(/searchParams\.get\(['"]token/);
  });

  it('un gettone illeggibile NON diventa un amministratore', () => {
    // Il fail-open e il modo classico di scrivere un controllo che non
    // controlla: era gia successo con Google/Apple in b.50.
    const s = h();
    const i = s.indexOf('async function chiedeUnAmministratore');
    const corpo = s.slice(i, s.indexOf('export async function GET'));
    expect(corpo).toMatch(/catch \(e\)[\s\S]{0,400}return false;/);
    expect(corpo, 'e non deve esistere un ramo che concede nel dubbio')
      .not.toMatch(/catch[\s\S]{0,400}return true;/);
    expect(corpo, 'senza gettone non si passa').toMatch(/if \(!token\) return false;/);
  });

  it('l\'indirizzo del database non esce da un messaggio d\'errore', () => {
    // `e.message` di una fetch verso Upstash contiene l'host. Restava
    // dentro `services`, che ora e riservato — ma va detto a voce.
    const s = h();
    const i = s.indexOf('redis.error = e.message');
    expect(i, 'il dato si conserva per chi ripara').toBeGreaterThan(-1);
    expect(s.slice(i - 300, i), 'ma con scritto perche e delicato').toMatch(/indirizzo del/i);
  });

  it('e getSession si importa da dove vive davvero', () => {
    // L'avevo importata da store.js, dove non c'e. La rotta sarebbe
    // esplosa al primo caricamento in produzione, e nessun test che
    // legge stringhe se ne sarebbe accorto.
    const s = h();
    expect(s).toMatch(/import \{ getSession \} from '\.\.\/\.\.\/lib\/users\.js'/);
    const users = fs.readFileSync(path.join(RADICE, 'app', 'lib', 'users.js'), 'utf8');
    expect(users, 'users.js deve davvero esportarla').toMatch(/export async function getSession/);
  });
});

describe('il documento generato non si scrive a mano', () => {
  it('e rigenerabile, e quello in archivio combacia col codice di oggi', () => {
    // Un inventario committato e poi lasciato indietro e di nuovo una
    // tabella che mente: dice com'era il programma, non com'e.
    const doc = fs.readFileSync(path.join(RADICE, 'INVENTARIO-API.md'), 'utf8');
    const vive = inventario().filter((r) => r.stato === 'viva');
    expect(doc).toMatch(new RegExp(`vive: \\*\\*${vive.length}\\*\\*`));
    for (const r of vive.slice(0, 8)) expect(doc, `manca ${r.rotta}`).toMatch(r.rotta);
  });
});
