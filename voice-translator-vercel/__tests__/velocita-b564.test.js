// ═══════════════════════════════════════════════════════════════
// b.564 — LA VELOCITA', che e' la prima cosa che si sente
//
// Misurato in produzione col cronometro: una ricerca impiega fra otto e
// quindici secondi. Nessuna regola di regia compensa un'attesa cosi —
// un feed lento e' un feed che non si apre. Tre mosse, in ordine di
// quanto si sentono:
//
// ① IL GIORNALE DI IERI E' GIA IN MANO. Riaprire dev'essere come non
//    essere mai usciti: l'ultima pagina vista compare subito, con
//    dentro i «perche'» e l'ordine deciso dalla regia, e quella nuova
//    si stampa dietro.
// ② CIO CHE C'E' GIA SI MANDA SUBITO. Le fonti che seguiamo rispondono
//    in uno o due secondi — sono flussi, non ricerche — e non c'e'
//    motivo di farle aspettare il motore.
// ③ PIU FONTI PER GIRO, e due mai provate. Dal deposito: 71 fonti
//    scoperte, 9 con flusso, **49 mai nemmeno interrogate**. Il
//    registro cresceva e restava spento.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { salvaGiornale, giornaleSalvato, etaGiornale, VITA_GIORNALE, QUANTE } from '../app/lib/giornaleSalvato.js';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const scheda = (n) => ({ id: `v${n}`, titolo: `T${n}`, url: `https://a${n}.it/x`, motivo: 'perSeme', seme: 'tema', immagine: 'i.jpg', roba: 'da buttare' });

describe('① il giornale di ieri', () => {
  it('si salva e si ritrova, coi «perche» dentro', () => {
    salvaGiornale([scheda(1), scheda(2)], [scheda(3)]);
    const ieri = giornaleSalvato();
    expect(ieri.argomenti).toHaveLength(2);
    expect(ieri.video).toHaveLength(1);
    expect(ieri.argomenti[0].motivo, 'riaprire e come non essere mai usciti').toBe('perSeme');
  });

  it('si tiene solo cio che serve a ridisegnare: il resto si butta', () => {
    salvaGiornale([scheda(1)], []);
    expect(giornaleSalvato().argomenti[0].roba).toBeUndefined();
  });

  it('non si salva un giornale vuoto', () => {
    localStorage.removeItem('vt-giornale');
    salvaGiornale([], []);
    expect(giornaleSalvato()).toBe(null);
  });

  it('dopo sei ore non vale piu: meglio l anello che una notizia di ieri', () => {
    expect(VITA_GIORNALE).toBe(6 * 3600 * 1000);
    salvaGiornale([scheda(1)], [], Date.now() - 7 * 3600 * 1000);
    expect(giornaleSalvato()).toBe(null);
  });

  it('non si salvano trecento schede: due schermate bastano', () => {
    salvaGiornale(Array.from({ length: 200 }, (_, i) => scheda(i)), []);
    expect(giornaleSalvato().argomenti).toHaveLength(QUANTE);
  });

  it('l eta si sa, in minuti', () => {
    expect(etaGiornale({ quando: Date.now() - 30 * 60000 })).toBe(30);
    expect(etaGiornale(null)).toBe(Infinity);
  });

  it('e il Mondo lo mostra prima di cercare, senza rinunciare a cercare', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/const ieri = giornaleSalvato\(\);/);
    expect(n).toMatch(/setArgomenti\(ieri\.argomenti\)/);
    const dopo = n.slice(n.indexOf('const ieri = giornaleSalvato()'));
    expect(dopo, 'la ricerca parte lo stesso, subito sotto').toMatch(/semiUtente|ricerchePredefinite/);
  });

  it('e si salva con calma, non ad ogni scorrimento', () => {
    expect(leggi('app/components/MondoNews.js')).toMatch(/setTimeout\(\(\) => salvaGiornale\(argomenti, video\), 4000\)/);
  });
});

describe('② il primo mazzo arriva prima della fine', () => {
  it('il servizio manda avanti le fonti seguite', () => {
    const s = leggi('app/lib/topics/servizio.js');
    expect(s).toMatch(/if \(daSeguite\.length >= 3\) racconta\('parziale', \{ argomenti: daSeguite\.slice\(0, 10\) \}\)/);
  });

  it('e il feed le mostra subito, senza aspettare il motore', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/if \(r\.stadio === 'parziale' && Array\.isArray\(r\.argomenti\)/);
    expect(n, 'passano dalla regia come tutte le altre').toMatch(/componi\(primi, \[\], \{ gusti, miaLingua: lingua \}\)/);
    expect(n, 'e in sottofondo si accodano in silenzio').toMatch(/accoda \|\| dietro/);
  });
});

describe('③ il registro si accende', () => {
  const s = leggi('app/lib/topics/servizio.js');

  it('quattordici fonti per giro invece di otto', () => {
    expect(s).toMatch(/quante: 14, perFonte: 5/);
  });

  it('e due mai provate ad ogni giro: l esplorazione vale anche per le fonti', () => {
    expect(s).toMatch(/const nuove = await fontiDaProvare\(\{ quante: 2 \}\)/);
    expect(leggi('app/lib/topics/deposito.js')).toMatch(/\.is\('feed_provato_il', null\)/);
  });
});
