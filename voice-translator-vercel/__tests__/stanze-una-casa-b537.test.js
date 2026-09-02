import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.537 — «riguardiamo insieme la logica. stanze per prima» (Luca)
// Tre difetti di logica, tre decisioni sue. Le regole vere si provano
// sui RISULTATI; il cablaggio con la lettura del codice.

describe('b.537 — 1. le Stanze hanno una casa: il tasto «Chat»', () => {
  it('«Chat» porta alle stanze VIVE, non piu all\'archivio', () => {
    const b = leggi('app/components/BottomNav.js');
    // la prima vista dell'elenco e' quella che il tocco apre
    expect(b).toMatch(/id: 'conversations'[^\n]*views: \['stanze'/);
    // e l'archivio resta raggiungibile, non cancellato
    expect(b).toMatch(/'stanze', 'history'/);
  });
  it('la vista esiste davvero, e monta StanzeView', () => {
    const p = leggi('app/page.js');
    expect(p).toMatch(/if \(view === 'stanze'\) return wrap\(/);
    expect(leggi('app/viste/registro.js')).toMatch(/export const StanzeView = lazy/);   // b.605 — registro delle schermate
    expect(p).toMatch(/<StanzeView[\s\S]{0,240}onJoinRoom=/);
  });
  it('il foglio «crea stanza» NON viene rimontato: vive nell\'imbuto comune (b.326)', () => {
    const p = leggi('app/page.js');
    const vista = p.slice(p.indexOf("if (view === 'stanze')"), p.indexOf("if (view === 'mondo')"));
    expect(vista).not.toMatch(/<CreateRoomSheet/);
  });
  it('il Mondo non ha piu il tab Stanze: la porta e il tasto «Chat»', () => {
    // b.540 — AGGIORNATA: b.537 aveva lasciato nel Mondo una riga-ponte
    // verso le Stanze, per accompagnare chi le cercava li. Luca l'ha
    // bocciata al collaudo — «il tasto stanze non funziona e occupa
    // tutta la riga, non va bene» — e aveva ragione: una riga intera
    // per una porta secondaria, mentre la porta vera (il tasto «Chat»
    // della barra) c'era gia. Il ponte e' uscito; cio che questa prova
    // difende resta: il tab non c'e piu, si atterra sul giornale, e alle
    // Stanze si arriva.
    const m = leggi('app/components/MondoView.js');
    expect(m).not.toMatch(/\{ id: 'stanze', parola: L\('tabRooms'\)/);
    expect(m).toMatch(/useState\('news'\)/);
    expect(leggi('app/components/BottomNav.js'), 'la porta vera').toMatch(/views: \['stanze'/);
  });
});

describe('b.537 — 2. la card dice DI COSA SI PARLA (regola vera)', () => {
  it('l\'argomento si legge nella lingua di chi guarda, se la traduzione c\'e gia', async () => {
    const { argomentoNellaMiaLingua } = await import('../app/components/StanzeView.js');
    const ultimo = { testo: 'Wer gewinnt heute?', traduzioni: { 'it-IT': 'Chi vince oggi?', en: 'Who wins today?' } };
    expect(argomentoNellaMiaLingua(ultimo, 'it')).toBe('Chi vince oggi?');   // radice it == it-IT
    expect(argomentoNellaMiaLingua(ultimo, 'en-US')).toBe('Who wins today?');
    // lingua che nessuno ha tradotto: si mostra l'originale, non si inventa
    expect(argomentoNellaMiaLingua(ultimo, 'ja')).toBe('Wer gewinnt heute?');
    // niente messaggi: niente argomento (la card dira il nome)
    expect(argomentoNellaMiaLingua(null, 'it')).toBe('');
    expect(argomentoNellaMiaLingua({ testo: '' }, 'it')).toBe('');
    // traduzione presente ma vuota: non si spaccia per traduzione
    expect(argomentoNellaMiaLingua({ testo: 'ciao', traduzioni: { it: '   ' } }, 'it')).toBe('ciao');
  });
  it('il server manda l\'ultimo messaggio, senza chiedere niente a un modello', () => {
    const r = leggi('app/api/mondo/route.js');
    expect(r).toMatch(/redis\('LINDEX', `msgs:\$\{String\(r\.roomId \|\| ''\)\.toUpperCase\(\)\}`, -1\)/);
    expect(r).toMatch(/daMostrare\[i\]\.ultimo = \{/);
    expect(r).toMatch(/traduzioni: m\.translations/);
    // e un guasto qui non deve togliere le stanze dall'elenco
    expect(r).toMatch(/catch \(e\) \{[\s\S]{0,220}argomento vivo non letto/);
  });
  it('e la card lo mette in grande, col resto di servizio sotto', () => {
    const v = leggi('app/components/StanzeView.js');
    const card = v.slice(v.indexOf('const argomento = argomentoNellaMiaLingua'));
    // b.551 — l'argomento resta il titolo della card, ma il grassetto no:
    // ordine tassativo di Luca in b.549 («non voglio grassetto da nessuna
    // parte»). A distinguerlo dal resto bastano la misura e il colore
    // pieno — ed e' cosi che il resto dell'applicazione fa gerarchia.
    expect(card).toMatch(/fontSize: 15, fontWeight: 500/);        // l'argomento e il titolo
    expect(card, 'niente grassetto nella card').not.toMatch(/fontWeight: (6|7|8|9)00/);
    expect(card).toMatch(/\{argomento \|\| s\.nome \|\| s\.roomId\}/); // e se manca, il nome
    expect(card).toMatch(/L\('roomNoWordsYet'\)/);                 // stanza muta: si dice
  });
});

describe('b.537 — 3. «le tue stanze»: la continuita (regole vere)', () => {
  beforeEach(() => localStorage.clear());
  it('entrare mette la stanza in cima, senza doppioni e senza badare alle maiuscole', async () => {
    const { segnaVisita, mieStanze, dimenticaStanza } = await import('../app/lib/mieStanze.js');
    expect(mieStanze()).toEqual([]);
    segnaVisita({ roomId: 'abc12345', nome: 'Calcio', host: 'Luca' });
    segnaVisita({ roomId: 'ZZ99', nome: 'Cucina' });
    expect(mieStanze().map((v) => v.roomId)).toEqual(['ZZ99', 'ABC12345']);
    segnaVisita({ roomId: 'AbC12345' });                    // la stessa, rientrata
    expect(mieStanze()).toHaveLength(2);
    expect(mieStanze()[0].roomId).toBe('ABC12345');          // e risale in cima
    expect(dimenticaStanza('zz99').map((v) => v.roomId)).toEqual(['ABC12345']);
  });
  it('una stanza dove non torni da un giorno esce da sola', async () => {
    const { mieStanze } = await import('../app/lib/mieStanze.js');
    const vecchia = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem('vt-mie-stanze', JSON.stringify([
      { roomId: 'VECCHIA1', quando: vecchia },
      { roomId: 'FRESCA1', quando: Date.now() },
    ]));
    expect(mieStanze().map((v) => v.roomId)).toEqual(['FRESCA1']);
  });
  it('una memoria illeggibile vale come vuota, non rompe la schermata', async () => {
    const { mieStanze } = await import('../app/lib/mieStanze.js');
    localStorage.setItem('vt-mie-stanze', '{non json');
    expect(mieStanze()).toEqual([]);
  });
  it('e l\'ingresso in stanza la segna davvero (le due strade: nuovo e rientro)', () => {
    const p = leggi('app/page.js');
    expect((p.match(/segnaVisita\(\{ roomId:/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(p).toMatch(/import \{ segnaVisita \} from '\.\/lib\/mieStanze\.js'/);
  });
});

describe('b.537 — 4. la stanza vuota e un annuncio, non un vicolo cieco', () => {
  it('chi e solo lo legge, e sa che il messaggio resta', () => {
    const m = leggi('app/components/MessageList.js');
    expect(m).toMatch(/solo = false/);
    expect(m).toMatch(/\{solo && \(/);
    expect(m).toMatch(/L\('firstHereTitle'\)/);
    expect(m).toMatch(/L\('firstHereDesc'\)/);
  });
  it('e la stanza sa dire se sei solo', () => {
    expect(leggi('app/components/RoomView.js')).toMatch(/solo=\{otherMembers\.length === 0\}/);
  });
  it('le parole nuove ci sono in italiano e in inglese', async () => {
    for (const lang of ['it', 'en']) {
      const o = (await import(`../app/lib/locales/${lang}.js`)).default;
      for (const k of ['yourRoomsWord', 'inside', 'tapToReenter', 'roomClosedNow', 'roomNoWordsYet', 'firstHereTitle', 'firstHereDesc']) {
        expect(typeof o[k], `${lang}:${k}`).toBe('string');
      }
    }
    // b.552 — questa prova apre a uno a uno TUTTI e 38 i pacchetti di
    // lingua: mezzo megabyte di traduzioni. Sul portatile mentre lavora
    // i cinque secondi di prammatica non bastano, e un rosso per
    // stanchezza della macchina e' peggio di nessun rosso.
  }, 30000);
});
