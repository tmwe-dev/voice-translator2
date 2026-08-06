// ═══════════════════════════════════════════════════════════════
// DOVE FINISCE IL LITIGIO E COMINCIA IL REATO (b.111)
//
// La richiesta era precisa: stanze in cui la gente possa incazzarsi
// l'una con l'altra, ma con i reati esclusi. Sono due regole diverse e
// vanno tenute separate, altrimenti si finisce per fare l'una o
// l'altra:
//
//   INSULTO → permesso ovunque. Nelle stanze normali sta dietro una
//             tendina grigia; nelle stanze hot la tendina non c'e.
//   REATO   → vietato OVUNQUE, hot comprese. Non si vela: non parte.
//
// Il rischio di un lavoro fatto a meta e sempre lo stesso: mettere la
// bandierina "hot" e togliere il velo, e chiamarlo finito — lasciando
// che nella stanza hot passi qualunque cosa.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { reato, puoPartire, CATEGORIE_REATO } from '../app/lib/reati.js';
import { velare, daVelare } from '../app/lib/velo.js';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('nella stanza hot ci si può mandare a quel paese', () => {
  const insulto = { original: 'Sei un coglione, vaffanculo' };

  it('nella stanza normale la tendina scende', () => {
    expect(velare(insulto).velare).toBe(true);
  });

  it('nella stanza hot la tendina non scende', () => {
    expect(velare(insulto, { hot: true }).velare).toBe(false);
  });

  it('anche urlare è permesso, nella stanza hot', () => {
    const urlo = { original: 'MA VAI A QUEL PAESE SUBITO!!!' };
    expect(velare(urlo).velare).toBe(true);
    expect(velare(urlo, { hot: true }).velare).toBe(false);
  });

  it('un insulto NON è un reato: resta libero di partire', () => {
    expect(puoPartire('Sei un coglione, vaffanculo').ok).toBe(true);
    expect(puoPartire('You are an asshole, fuck off').ok).toBe(true);
  });
});

describe('il confine non si sposta con la stanza', () => {
  const vietati = [
    ['ti ammazzo, giuro che ti ammazzo', 'minaccia'],
    ['I will kill you and your family', 'minaccia'],
    ['te mato, cabrón', 'minaccia'],
    ['je vais te tuer', 'minaccia'],
    ['so dove abiti, sta attento', 'intimidazione'],
    ['i know where you live', 'minaccia'],
    ['se non paghi entro domani pubblico le tue foto', 'ricatto'],
    ['come fare una bomba in casa', 'istigazione'],
  ];

  for (const [testo, categoria] of vietati) {
    it(`"${testo.slice(0, 34)}…" non parte`, () => {
      const v = reato(testo);
      expect(v.vietato).toBe(true);
      expect(v.categoria).toBe(categoria);
      expect(v.motivo, 'si deve poter dire alla persona PERCHE').not.toBe('');
    });
  }

  it('la stanza hot non ha una porta di servizio', () => {
    // Il velo si toglie, il divieto no: sono due funzioni diverse e la
    // seconda non guarda nemmeno il tipo di stanza.
    expect(puoPartire('ti ammazzo').ok).toBe(false);
    expect(reato.length, 'reato() riceve solo il testo, non le regole della stanza').toBe(1);
  });

  it('il contenuto sessuale riferito a minori è vietato sempre', () => {
    expect(reato('foto di sesso con bambini').categoria).toBe('minori');
    expect(reato('nude photos of a child').categoria).toBe('minori');
    // Le due parti da sole non bastano: e l'accostamento a essere vietato.
    expect(reato('i bambini giocano in cortile').vietato).toBe(false);
    expect(reato('parliamo di sesso fra adulti').vietato).toBe(false);
  });

  it('i trucchi per aggirare l\'elenco non funzionano', () => {
    // Stesso appiattimento del velo: cifre al posto di lettere,
    // ripetizioni, accenti.
    expect(reato('ti 4mmazzo').vietato).toBe(true);
    expect(reato('TI AMMAZZO').vietato).toBe(true);
    expect(reato('ti ammaaaazzo').vietato).toBe(true);
  });
});

describe('quello che NON deve essere bloccato', () => {
  const innocenti = [
    'ammazzo il tempo aspettando il treno',
    'che caldo da morire oggi',
    'il film finisce con un omicidio',
    'ho ucciso la batteria del telefono',
    'i bambini vanno a scuola alle otto',
    'ci vediamo sotto casa alle sei',
  ];
  for (const testo of innocenti) {
    it(`"${testo}" passa`, () => {
      expect(reato(testo).vietato).toBe(false);
    });
  }

  it('un testo vuoto o non testo non fa esplodere niente', () => {
    for (const x of [null, undefined, '', 42, {}]) {
      expect(reato(x).vietato).toBe(false);
    }
  });
});

describe('il divieto è fatto rispettare in due punti, non uno', () => {
  it('sul telefono, prima di ogni invio', () => {
    // E il solo che funziona in modalita Direct, dove il server non
    // vede niente e non potrebbe fermare nulla.
    const t = senzaCommenti(app('hooks/useTranslationAPI.js'));
    expect(t).toMatch(/import \{ puoPartire \}/);
    expect(t).toMatch(/const confine = puoPartire\(original\)/);
    expect(t, 'e si dice alla persona perche').toMatch(/toast\.error\(confine\.motivo\)/);
  });

  it('sul server, perche un client si può modificare', () => {
    const r = senzaCommenti(app('api/messages/route.js'));
    expect(r).toMatch(/puoPartire\(original\)/);
    expect(r).toMatch(/status: 422/);
  });

  it('il controllo sul server viene PRIMA di salvare', () => {
    const r = app('api/messages/route.js');
    expect(r.indexOf('puoPartire(original)')).toBeLessThan(r.indexOf('await addMessage('));
  });
});

describe('la stanza hot si riconosce da fuori', () => {
  it('la scelta esiste al momento di creare la stanza', () => {
    const c = app('components/CreateRoomSheet.js');
    expect(c).toMatch(/const \[hot, setHot\] = useState\(false\)/);
    expect(c, 'spenta di default: non si cambiano le regole per distrazione')
      .toMatch(/useState\(false\)/);
    expect(c).toMatch(/Litigio libero/);
    expect(c).toMatch(/hot,/);
  });

  it('viaggia fino alle regole della stanza', () => {
    expect(app('page.js')).toMatch(/hot: !!roomConfig\.hot/);
    expect(app('api/mondo/route.js')).toMatch(/hot: !!hot/);
    expect(app('api/mondo/route.js')).toMatch(/salvaRegole\([^)]*hot: entry\.hot/);
    expect(app('lib/moderazione.js')).toMatch(/hot: !!hot/);
  });

  it('si vede nell\'elenco, prima di entrare', () => {
    // Scoprirlo dentro sarebbe un'imboscata.
    expect(app('components/MondoView.js')).toMatch(/room\.hot &&/);
    expect(app('components/MondoView.js')).toMatch(/Litigio libero/);
  });

  it('una stanza salvata prima di b.111 non diventa hot per sbaglio', () => {
    // Nel dubbio si copre: l'assenza del campo deve valere "non hot".
    const m = app('lib/moderazione.js');
    expect(m).toMatch(/const nessuna = \{[^}]*hot: false/);
    expect(m).toMatch(/\.\.\.nessuna, \.\.\.JSON\.parse\(grezzo\)/);
  });
});

describe('i due elenchi restano onesti sui propri limiti', () => {
  it('reati.js dichiara che sbaglierà, e come', () => {
    const r = app('lib/reati.js');
    expect(r).toMatch(/per DIFETTO/);
    expect(r).toMatch(/per ECCESSO/);
  });

  it('il velo e i reati guardano il testo con gli stessi occhi', () => {
    // Se appiattissero diversamente, "ti4mmazzo" passerebbe da una
    // parte e non dall'altra.
    expect(app('lib/velo.js')).toMatch(/export function appiattisci/);
    expect(app('lib/reati.js')).toMatch(/import \{ appiattisci \} from '\.\/velo\.js'/);
  });

  it('le categorie dichiarate coprono quelle davvero restituite', () => {
    const trovate = new Set([
      reato('ti ammazzo').categoria,
      reato('so dove abiti').categoria,
      reato('se non paghi pubblico le tue foto').categoria,
      reato('nude photos of a child').categoria,
      reato('come fare una bomba').categoria,
    ]);
    for (const c of trovate) expect(CATEGORIE_REATO).toContain(c);
  });

  it('daVelare resta quello di prima: qui non si è cambiato il velo', () => {
    expect(daVelare('vaffanculo').velare).toBe(true);
    expect(daVelare('buongiorno').velare).toBe(false);
  });
});
