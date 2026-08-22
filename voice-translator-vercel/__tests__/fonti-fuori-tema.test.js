// b.393 — Michael Jackson in una discussione sul costo della vita.
// Il collaudo di Luca: "Parti da fonti reali", domanda sul costo della
// vita, e fra i documenti di partenza il cantante. La ricerca non aveva
// sbagliato: nessuno guardava cosa tornava.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paroleChiave, quantoCentra, filtraFontiPertinenti } from '../app/lib/compagni/pertinenza.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

const COSTO_DELLA_VITA = 'Come sta cambiando il costo della vita in Italia';
const TROVATE = [
  { titolo: 'Michael Jackson, il nuovo documentario', sintesi: 'La vita del cantante', url: 'https://x.it/mj' },
  { titolo: 'Costo della vita in Italia: i prezzi salgono', sintesi: 'Inflazione e affitti', url: 'https://x.it/1' },
  { titolo: 'Istat: il costo della vita sale del 6% in Italia', sintesi: 'I dati sui prezzi', url: 'https://x.it/2' },
  { titolo: 'Affitti e stipendi a Milano', sintesi: 'Il costo della vita cresce in citta', url: 'https://x.it/3' },
  { titolo: 'Calcio: la Juventus vince in trasferta', sintesi: 'Partita decisa nel finale', url: 'https://x.it/4' },
];

describe('le fonti devono parlare del tema', () => {
  it('il caso vero: il cantante resta fuori, le tre in tema restano dentro', () => {
    const { tenute, scartate } = filtraFontiPertinenti(TROVATE, COSTO_DELLA_VITA);
    const titoli = tenute.map((f) => f.titolo).join(' | ');
    expect(titoli, 'Michael Jackson non entra nel tavolo').not.toMatch(/Jackson/);
    expect(titoli, 'ne il calcio').not.toMatch(/Juventus/);
    expect(tenute).toHaveLength(3);
    expect(scartate).toHaveLength(2);
  });

  it('le migliori vanno per prime, perche a valle si tagliano le ultime', () => {
    const { tenute } = filtraFontiPertinenti(TROVATE, COSTO_DELLA_VITA);
    const punti = tenute.map((f) => quantoCentra(f, paroleChiave(COSTO_DELLA_VITA)));
    expect(punti, 'ordine decrescente').toEqual([...punti].sort((a, b) => b - a));
  });

  it('UNA parola in comune non basta quando c\'e di che scegliere', () => {
    // "vita" c'e davvero nella vita del cantante: e proprio quel caso.
    const chiavi = paroleChiave(COSTO_DELLA_VITA);
    expect(quantoCentra(TROVATE[0], chiavi), 'il cantante una parola ce l\'ha').toBe(1);
    expect(quantoCentra(TROVATE[1], chiavi)).toBeGreaterThanOrEqual(2);
  });

  it('quando le fonti sono poche la soglia si abbassa: meglio incerta che vuota', () => {
    const { tenute, soglia } = filtraFontiPertinenti([TROVATE[0], TROVATE[1]], COSTO_DELLA_VITA);
    expect(soglia).toBe(1);
    expect(tenute).toHaveLength(2);
  });

  it('se cade tutto si passa la mano invece di lasciare il tavolo vuoto', () => {
    const estranee = [{ titolo: 'Ricette di pesce', sintesi: 'Come cucinare il branzino' }];
    const { tenute, giudicato } = filtraFontiPertinenti(estranee, COSTO_DELLA_VITA);
    expect(giudicato, 'e dichiarato: non abbiamo giudicato').toBe(false);
    expect(tenute).toHaveLength(1);
  });

  it('senza abbastanza parole nel tema non si giudica affatto', () => {
    const { giudicato, tenute } = filtraFontiPertinenti(TROVATE, 'yen');
    expect(giudicato).toBe(false);
    expect(tenute).toHaveLength(TROVATE.length);
  });

  it('alfabeti senza spazi: non si estraggono parole, quindi passa tutto', () => {
    const { giudicato } = filtraFontiPertinenti(TROVATE, '日本の生活費');
    expect(giudicato, 'non si butta via meta del Giappone per un difetto nostro').toBe(false);
  });

  it('il filtro e DAVVERO attaccato al briefing del Tavolo', () => {
    const d = leggi('app/lib/compagni/dossier.js');
    expect(d).toMatch(/filtraFontiPertinenti/);
    expect(d, 'non si prendono piu le prime sei alla cieca')
      .not.toMatch(/esito\.risultati\.slice\(0, 6\)/);
  });

  it('e alle fonti delle lezioni, dove il buco era dichiarato per iscritto', () => {
    const g = leggi('app/lib/compagni/corsi/generatore.js');
    expect(g).toMatch(/filtraFontiPertinenti/);
    expect(g, 'il vaglio viene PRIMA del taglio').toMatch(/vaglio\.tenute\.slice/);
  });
});

describe('il Dossier non esiste piu: nessuno lo propone', () => {
  it('Omar non manda la gente in una scheda tolta in b.302', () => {
    const c = leggi('app/lib/compagni/catalogo.js');
    expect(c, 'la personalita di Omar non nomina il Dossier').not.toMatch(/aprire il Dossier/);
    const t = leggi('app/lib/compagni/contratto.js');
    expect(t, 'ne il blocco capacita').not.toMatch(/proponi di aprire il Dossier/);
  });
});

describe('le foto delle news non si caricavano nella lista', () => {
  it('una foto in chiaro dentro una pagina sicura viene rifiutata: si alza il protocollo', async () => {
    const { immagineSicura } = await import('../app/lib/topics/ricerca.js');
    expect(immagineSicura('http://www.bing.com/th?id=ONUT.x&w=1200'))
      .toBe('https://www.bing.com/th?id=ONUT.x&w=1200');
    expect(immagineSicura('https://gia.sicura.it/f.jpg'), 'chi e gia sicuro non si tocca')
      .toBe('https://gia.sicura.it/f.jpg');
    expect(immagineSicura(''), 'niente resta niente').toBe('');
    expect(immagineSicura(null)).toBe('');
    expect(immagineSicura('//rete.it/f.jpg'), 'gli URL senza protocollo restano come sono')
      .toBe('//rete.it/f.jpg');
  });

  it('e attaccato dove le foto ENTRANO, non dove si mostrano', () => {
    const r = leggi('app/lib/topics/ricerca.js');
    expect(r, 'il flusso RSS di Bing').toMatch(/immagineSicura\(ingrandisciMiniaturaBing/);
    const e = leggi('app/lib/topics/estrai.js');
    expect(e, "l'og:image letto dalla pagina").toMatch(/immagineSicura\(assolutizza/);
    const s = leggi('app/lib/topics/servizio.js');
    expect(s, 'i video').toMatch(/immagineSicura\(v\.immagine/);
    const w = leggi('app/lib/topics/wikipedia.js');
    expect(w, 'le voci enciclopediche').toMatch(/immagineSicura\(p\.thumbnail/);
  });
});
