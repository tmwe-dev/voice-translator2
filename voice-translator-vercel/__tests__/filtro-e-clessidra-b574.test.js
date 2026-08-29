// ═══════════════════════════════════════════════════════════════
// b.574 — DUE COLLAUDI DAL VIVO, DUE DIFETTI DIVERSI
//
// ① «Ho appena usato il filtro ed e sparito tutto per un minuto e senza
//    clessidra» (Luca).
//    La causa e' un ragionamento sbagliato mio, non una svista: `visto`
//    diceva «ormai ho mostrato qualcosa» e restava acceso fino alla
//    chiusura del feed. Serviva a non rimettere in attesa chi guarda
//    mentre il giardino cresce dietro (b.552), e per quello va bene. Ma
//    cambiando filtro l'elenco diventa un ALTRO elenco, e puo essere
//    vuoto: la certezza restava accesa su una lista che non esisteva
//    piu — niente diapositive, e nemmeno l'anello, perche' l'anello si
//    disegnava solo con `!pronto`. Schermo nero.
//    Il nero non e' uno stato: e' un'assenza di stato.
//
// ② «Continua a presentarmi la stessa lista di video» (Luca).
//    Il giornale di ieri (b.564) ti veniva rimesso in mano tale e
//    quale, quindi rientrando la prima cosa che vedevi era l'ultima che
//    avevi gia guardato. La memoria del «gia visto» (b.558) c'era e
//    funzionava, ma si applicava solo ai risultati NUOVI — troppo tardi
//    per contare. Ora passa dal setaccio anche il salvato.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { primaIlNuovo } from '../app/lib/visti.js';
import { chiaveContenuto } from '../app/lib/gradimento.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const feed = leggi('app/components/FeedNotizieMondo.js');
const news = leggi('app/components/MondoNews.js');

describe('b.574 — niente schermo nero, mai', () => {
  it('la certezza si spegne quando cambia il filtro', () => {
    expect(feed).toMatch(/useEffect\(\(\) => \{ setVisto\(false\); \}, \[filtro\]\);/);
  });

  it('se non c e niente da guardare c e l anello', () => {
    expect(feed).toMatch(/\{\(!pronto \|\| !elementi\.length\) && \(/);
  });

  it('e le diapositive si disegnano solo quando ce ne sono', () => {
    expect(feed).toMatch(/\{pronto && !!elementi\.length && elementi\.map/);
  });

  it('la certezza resta pero immune alla crescita in sottofondo (regola di b.552)', () => {
    // non deve tornare l'attesa mentre il giardino cresce: `visto` si
    // spegne solo alla chiusura e al cambio di filtro, non su `elementi`
    expect(feed).not.toMatch(/setVisto\(false\); \}, \[elementi\]/);
    expect(feed).toMatch(/const pronto = visto \|\| \(aperto && !caricando && elementi\.length > 0\);/);
  });
});

describe('b.574 — il filtro e una richiesta, non solo una preferenza', () => {
  it('se manca quel tipo di contenuto, si va a cercarlo subito', () => {
    expect(news).toMatch(/const manca = \(id === 'video' && !\(video \|\| \[\]\)\.length\)/);
    expect(news).toMatch(/if \(manca && !cercandoRef\.current\) cresci\(\);/);
  });

  it('e la scelta si salva lo stesso', () => {
    expect(news).toMatch(/savePrefs\(\{ \.\.\.prefs, mondoFeedFiltro: id \}\);/);
  });
});

describe('b.574 — rientrare non e rivedere', () => {
  it('il giornale di ieri passa dal setaccio del gia visto', () => {
    expect(news).toMatch(/setArgomenti\(primaIlNuovo\(ieri\.argomenti, gia\)\)/);
    expect(news).toMatch(/setVideo\(primaIlNuovo\(ieri\.video, gia\)\)/);
  });

  it('cio che hai guardato scende in fondo, ma non sparisce', () => {
    const lista = [{ url: 'a' }, { url: 'b' }, { url: 'c' }];
    const gia = new Set([chiaveContenuto('a')]);   // primaIlNuovo vuole le chiavi, non la mappa
    const dopo = primaIlNuovo(lista, gia);
    expect(dopo.length).toBe(3);                    // nessuno sparisce
    expect(dopo[dopo.length - 1].url).toBe('a');    // il gia visto in coda
  });
});
