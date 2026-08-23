// ═══════════════════════════════════════════════════════════════
// b.409 — DUE FUNZIONI CHE C'ERANO NEL CODICE E NON HANNO MAI DATO
// UN RISULTATO, e un tetto dimensionato per un'architettura morta.
//
// P0.5 dell'audit: `/api/topics/search` risponde A RIGHE (una per
// stadio del lavoro). Mondo lo sapeva, e aveva il suo lettore scritto a
// mano dentro il componente. Life no: faceva `await r.json()` su un
// corpo di piu righe, che non e JSON valido. La lettura lanciava, il
// catch restituiva null, e in Impara i contenuti «link» e «foto» non
// hanno MAI prodotto niente. Non ogni tanto: mai.
//
// P0.2: il tetto di frequenza del Podcast era dieci al minuto — giusto
// per quando il podcast era UNA richiesta sola, sbagliato da quando (in
// b.244) e diventato una richiesta PER TURNO.
//
// Qui si fa girare il lettore vero contro un flusso finto e si guarda
// cosa esce. Il primo caso e quello che prima restituiva null.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import { leggiARighe, cercaTopics } from '../app/lib/topics/cliente.js';
import { arricchisciLezione } from '../app/lib/compagni/cliente.js';
import { PODCAST_LIMITI, PODCAST_RICHIESTE_MAX, ordineTurni } from '../app/lib/compagni/podcast.js';

// Una risposta a righe finta: si puo spezzare dove si vuole, per
// riprodurre il fatto che i pezzi arrivano a blocchi e una riga puo
// restare tagliata a meta fra due letture.
function rispostaARighe(pezzi, { ok = true, status = 200 } = {}) {
  const codifica = new TextEncoder();
  let i = 0;
  return {
    ok, status,
    body: {
      getReader: () => ({
        read: async () => (i < pezzi.length
          ? { done: false, value: codifica.encode(pezzi[i++]) }
          : { done: true, value: undefined }),
      }),
    },
  };
}

const RIGHE_VERE = [
  '{"stadio":"stanze"}\n',
  '{"stadio":"cerca","query":"betabloccanti"}\n',
  '{"stadio":"fonti","quante":3}\n',
  '{"stadio":"fine","argomenti":[{"titolo":"uno","immagine":"a.jpg"},{"titolo":"due"},{"titolo":"tre"}],"stanze":[],"daCache":false}\n',
];

describe('il lettore a righe: quello che prima restituiva null', () => {
  it('arriva a «fine» e restituisce cio che serve', async () => {
    const fine = await leggiARighe(rispostaARighe(RIGHE_VERE));
    expect(fine, 'prima qui usciva null').toBeTruthy();
    expect(fine.argomenti.length).toBe(3);
    expect(fine.stadio).toBe('fine');
  });

  it('e `JSON.parse` sullo stesso corpo NON ci arriva: ecco il difetto', () => {
    // La prova che il difetto era reale e non teorico: il corpo intero,
    // dato in pasto al lettore di prima, lancia.
    const corpo = RIGHE_VERE.join('');
    expect(() => JSON.parse(corpo)).toThrow();
  });

  it('racconta gli stadi mentre succedono, e non racconta «fine»', async () => {
    const raccontati = [];
    await leggiARighe(rispostaARighe(RIGHE_VERE), (r) => raccontati.push(r.stadio));
    expect(raccontati).toEqual(['stanze', 'cerca', 'fonti']);
  });

  it('regge una riga spezzata a meta fra due letture', async () => {
    // e il caso vero: i pezzi arrivano dalla rete come capita.
    const intero = RIGHE_VERE.join('');
    const meta = Math.floor(intero.length / 2);
    const fine = await leggiARighe(rispostaARighe([intero.slice(0, meta), intero.slice(meta)]));
    expect(fine.argomenti.length).toBe(3);
  });

  it("e non perde l'ultima riga se manca l'a-capo finale", async () => {
    const senzaACapo = RIGHE_VERE.slice(0, -1).join('') + RIGHE_VERE[3].trimEnd();
    const fine = await leggiARighe(rispostaARighe([senzaACapo]));
    expect(fine, 'la riga che conta e proprio l\'ultima').toBeTruthy();
    expect(fine.argomenti.length).toBe(3);
  });

  it('una riga rotta si salta, il resto si legge lo stesso', async () => {
    const fine = await leggiARighe(rispostaARighe([
      '{"stadio":"cerca"}\n', 'questa non e JSON\n', RIGHE_VERE[3],
    ]));
    expect(fine.argomenti.length).toBe(3);
  });

  it('se il servizio dichiara errore e non arriva a «fine», si sa', async () => {
    await expect(leggiARighe(rispostaARighe(['{"stadio":"errore","motivo":"ricerca fallita"}\n'])))
      .rejects.toThrow(/ricerca fallita/);
  });

  it('e chi racconta non puo fermare chi legge', async () => {
    const fine = await leggiARighe(rispostaARighe(RIGHE_VERE), () => { throw new Error('io esplodo'); });
    expect(fine.argomenti.length, 'il risultato arriva comunque').toBe(3);
  });
});

describe('l\'indirizzo lo compone un posto solo', () => {
  let chiamate;
  beforeEach(() => {
    chiamate = [];
    global.fetch = async (url) => { chiamate.push(String(url)); return rispostaARighe(RIGHE_VERE); };
  });

  it('la ricerca normale non chiede ne fresco ne profondo', async () => {
    await cercaTopics({ q: 'betabloccanti', lingua: 'it', cat: 'notizie' });
    expect(chiamate[0]).toContain('q=betabloccanti');
    expect(chiamate[0]).toContain('lang=it');
    expect(chiamate[0]).not.toContain('deep=');
    expect(chiamate[0]).not.toContain('fresh=');
  });

  it('la ricerca profonda porta con se quante fonti vuole', async () => {
    await cercaTopics({ q: 'x', profonda: true, fonti: 9 });
    expect(chiamate[0]).toContain('deep=1');
    expect(chiamate[0]).toContain('fonti=9');
  });

  it('una domanda vuota non parte nemmeno', async () => {
    expect(await cercaTopics({ q: '   ' })).toBe(null);
    expect(chiamate.length).toBe(0);
  });
});

describe('P0.5 — i contenuti «link» e «foto» di Impara, che non davano mai niente', () => {
  beforeEach(() => { global.fetch = async () => rispostaARighe(RIGHE_VERE); });

  it('ora arrivano quattro fonti invece di null', async () => {
    const r = await arricchisciLezione({ modalita: 'link', titolo: 'I betabloccanti', argomento: 'Farmacologia' });
    expect(r, 'prima era null, sempre').toBeTruthy();
    expect(r.link.length).toBe(3);
    expect(r.link[0].titolo).toBe('uno');
  });

  it('e per le foto e la stessa strada: la lezione legge `immagine`', async () => {
    const r = await arricchisciLezione({ modalita: 'foto', titolo: 'I betabloccanti', argomento: 'Farmacologia' });
    expect(r.link.filter((l) => l.immagine).length).toBeGreaterThan(0);
  });

  it('se la ricerca va storta la lezione resta valida: null, ma senza rumore', async () => {
    global.fetch = async () => { throw new Error('rete giu'); };
    expect(await arricchisciLezione({ modalita: 'link', titolo: 'x', argomento: 'y' })).toBe(null);
  });
});

describe('P0.2 — il tetto del Podcast era sotto il suo stesso flusso', () => {
  it('il contratto permette piu turni di quante richieste il tetto vecchio lasciava passare', () => {
    const compagni = Array.from({ length: PODCAST_LIMITI.MAX_COMPAGNI }, (_, i) => ({ id: `c${i}` }));
    const turni = ordineTurni(compagni, PODCAST_LIMITI.MAX_ROUND);
    expect(turni.length, 'quaranta turni sono permessi dalla rotta').toBe(40);
    expect(turni.length + 1, 'piu la richiesta che chiude').toBeGreaterThan(10);
  });

  it('e anche il massimo che offre la schermata (4 x 4) superava il vecchio dieci', () => {
    const compagni = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}` }));
    expect(ordineTurni(compagni, 4).length + 1).toBe(17);
  });

  it('il tetto nuovo sta SOPRA il flusso legittimo, non sotto', () => {
    const massimo = PODCAST_LIMITI.MAX_COMPAGNI * PODCAST_LIMITI.MAX_ROUND + 1;
    expect(PODCAST_RICHIESTE_MAX).toBeGreaterThan(massimo);
  });

  it('e si RICAVA dal contratto: alzare i round lo alza da solo', () => {
    // e la parte che conta. Un numero scritto a mano tornerebbe sbagliato
    // il giorno in cui qualcuno cambia i limiti, e nessuno se ne accorgerebbe.
    const atteso = PODCAST_LIMITI.MAX_COMPAGNI * PODCAST_LIMITI.MAX_ROUND + 1 + 8;
    expect(PODCAST_RICHIESTE_MAX).toBe(atteso);
  });

  it('e la rotta usa QUEL numero, non piu una costante scritta a mano', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const rotta = readFileSync(join(process.cwd(), 'app/api/compagni/podcast/route.js'), 'utf8');
    // TRAPPOLA NUMERO 6 del CLAUDE.md, e ci sono appena cascato scrivendo
    // questa prova: il commento che SPIEGA il difetto contiene la stringa
    // del difetto, e la prova leggeva la propria spiegazione. Si toglie la
    // citazione, non la spiegazione: qui i commenti si scartano prima.
    const codice = rotta.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(codice).toMatch(/maxRequests: PODCAST_RICHIESTE_MAX/);
    expect(codice, 'il dieci non c\'e piu nel codice vero').not.toMatch(/maxRequests: 10/);
  });
});

describe('di lettori a righe ne resta UNO', () => {
  it('nessun componente si scrive il suo', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const radice = process.cwd();
    const trova = (cartella, out = []) => {
      for (const n of readdirSync(join(radice, cartella))) {
        const rel = `${cartella}/${n}`;
        if (statSync(join(radice, rel)).isDirectory()) trova(rel, out);
        else if (n.endsWith('.js')) out.push(rel);
      }
      return out;
    };
    const colpevoli = trova('app/components')
      .filter((f) => /body\.getReader\(\)/.test(readFileSync(join(radice, f), 'utf8')));
    expect(colpevoli, 'il lettore vive in lib/topics/cliente.js e basta').toEqual([]);
  });
});
