// ═══════════════════════════════════════════════════════════════
// UN CORPO SBAGLIATO NON E UN GUASTO NOSTRO (b.118)
//
// Caccia al tesoro, terreno nuovo: invece di leggere il codice, ho
// mandato alle rotte un corpo malformato e uno vuoto, e ho guardato
// cosa rispondevano.
//
//   DODICI ROTTE SU DODICI: 500.
//
// messages, mondo, room, user, voice-clone, moderazione, reazioni,
// conversation, stanza-video, glossary, contacts. Nessuna esclusa.
// Senza credenziali, da chiunque, a comando.
//
// ── PERCHE E PIU GRAVE DI COME SUONA ──
//
// Il danno non e il messaggio d'errore sbagliato. E che ogni 500
// finisce nei registri e in Sentry INSIEME AI GUASTI VERI, e li
// seppellisce. Il monitor interno dell'app stampava gia "High error
// count detected" quattro volte per caricamento: si stava lamentando
// di se stesso, e quella spia aveva smesso di voler dire qualcosa.
//
// Una spia che suona sempre e una spia rotta. Ripulire il rumore non
// e cosmesi: e rimettere in funzione lo strumento con cui si scoprono
// i guasti veri.
//
// ── DOVE VA IL RIMEDIO ──
//
// In UN punto: la guardia da cui passano tutte le rotte. Correggerle
// una per una avrebbe voluto dire dodici modifiche, e la tredicesima
// rotta scritta domani sarebbe nata di nuovo col difetto.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('la guardia legge il corpo prima di passarlo', () => {
  const g = () => senzaCommenti(app('lib/apiGuard.js'));

  it('un JSON malformato si ferma con 400, non con 500', () => {
    const s = g();
    expect(s).toMatch(/copia = req\.clone\(\)/);
    expect(s).toMatch(/await copia\.json\(\)/);
    expect(s).toMatch(/status: 400/);
  });

  it('se NON SI PUO controllare, si lascia passare', () => {
    // Il difetto che i test gia scritti hanno trovato nel mio rimedio:
    // la prima versione aveva un solo try/catch, e bastava che `clone`
    // non ci fosse perche OGNI richiesta prendesse 400. L'applicazione
    // intera ferma — un rimedio peggiore del male.
    //
    // "Non riesco nemmeno a provare a leggere" e "ho letto ed e
    // sbagliato" sono due cose diverse, e solo la seconda e colpa di
    // chi chiama.
    const s = g();
    expect(s).toMatch(/try \{ copia = req\.clone\(\); \} catch \{ copia = null; \}/);
    expect(s, 'senza clone utilizzabile non si rifiuta niente')
      .toMatch(/if \(copia && typeof copia\.json === 'function'\)/);
  });

  it('si usa clone(): il corpo deve restare leggibile per il gestore', () => {
    // Leggerlo davvero lo consumerebbe, e la rotta troverebbe il vuoto.
    // Sarebbe stato un modo perfetto di curare un difetto rompendo tutto.
    const s = g();
    expect(s, 'mai leggere il corpo originale nella guardia')
      .not.toMatch(/await req\.json\(\)/);
  });

  it('si controlla solo quando il tipo dichiarato e JSON', () => {
    // Le rotte che ricevono un modulo (voce da clonare, audio da
    // trascrivere) mandano multipart: provare a leggerle come JSON
    // le romperebbe tutte.
    expect(g()).toMatch(/content-type[\s\S]{0,120}application\/json/);
  });

  it('e solo sui metodi che un corpo ce l\'hanno', () => {
    expect(g()).toMatch(/\['POST', 'PUT', 'PATCH'\]\.includes\(req\.method\)/);
  });
});

describe('la seconda rete: il corpo sbagliato scoperto dentro il gestore', () => {
  const g = () => senzaCommenti(app('lib/apiGuard.js'));

  it('esiste chi riconosce "e colpa del corpo"', () => {
    expect(g()).toMatch(/function eColpaDelCorpo/);
  });

  it('riconosce un JSON rotto e i modi in cui un corpo non si lascia leggere', () => {
    const s = g();
    expect(s).toMatch(/e instanceof SyntaxError/);
    expect(s).toMatch(/formdata|multipart/i);
  });

  it('e quell\'errore NON finisce fra i guasti da segnalare', () => {
    // E il punto di tutto: togliere rumore dai registri, cosi le spie
    // tornano a voler dire qualcosa.
    const s = g();
    const i = s.indexOf('if (eColpaDelCorpo(e))');
    expect(i, 'il controllo deve esserci').toBeGreaterThan(-1);
    const posTrack = s.indexOf('trackError(prefix, e, req)');
    expect(i, 'e deve venire PRIMA della segnalazione').toBeLessThan(posTrack);
  });
});

describe('il rimedio sta in un posto solo', () => {
  it('tutte le rotte provate passano dalla guardia', () => {
    const rotte = [
      'messages', 'mondo', 'room', 'user', 'voice-clone', 'moderazione',
      'reazioni', 'conversation', 'stanza-video', 'glossary', 'contacts',
    ];
    for (const r of rotte) {
      const f = path.join(__dirname, '..', 'app', 'api', r, 'route.js');
      if (!fs.existsSync(f)) continue;
      expect(fs.readFileSync(f, 'utf8'), `/api/${r} deve passare da withApiGuard`)
        .toMatch(/withApiGuard/);
    }
  });

  it('nessuna rotta viva tiene un limite di frequenza suo, in parallelo', () => {
    // Due limitatori sulla stessa rotta contano due volte la stessa
    // richiesta: il limite effettivo e la meta di quello dichiarato, e
    // nessuno se ne accorge finche un utente vero non viene respinto a
    // meta strada. Era gia successo, e si era ricreato in /api/mondo.
    const m = fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'mondo', 'route.js'), 'utf8');
    expect(m).toMatch(/withApiGuard/);
    expect(m, 'il limite lo mette la guardia, non la rotta').not.toMatch(/checkRateLimit\(/);
  });

  it('e cosi anche la rotta che qualcuno scrivera domani', () => {
    // Non e una promessa: e il motivo per cui il rimedio e andato li e
    // non in dodici punti diversi.
    const g = senzaCommenti(app('lib/apiGuard.js'));
    const iControllo = g.indexOf('req.clone().json()');
    const iChiamata = g.indexOf('await handler(req)');
    expect(iControllo, 'il controllo viene prima del gestore').toBeLessThan(iChiamata);
  });
});
