// ═══════════════════════════════════════════════════════════════
// GUARDIA: CHI PAGA LO DECIDE IL SERVER
//
// Due buchi trovati nell'audit di b.105, tutti e due con la stessa forma:
// una decisione economica presa sulla parola del client.
//
//  1. `hostEmail` arrivava nel corpo della richiesta di creazione stanza
//     e finiva dritto in apiAuth come `billingEmail`, cioe il portafoglio
//     da cui scalare tutti i consumi della stanza. Bastava scriverci
//     l'indirizzo di un altro per farlo pagare al posto proprio.
//
//  2. `giaAddebitato: true` nel corpo di /api/translate saltava
//     l'addebito. Una riga nel browser, e traduzioni gratis a vita.
//
// Regola che questo test tiene ferma: nessun campo che decide CHI PAGA o
// SE PAGARE puo arrivare dal client.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

// I commenti spiegano i difetti corretti e quindi CITANO il codice vecchio.
// Un test che cerca "il codice vecchio non c'e piu" deve guardare il
// codice, non le spiegazioni — altrimenti fallisce proprio perche il
// difetto e stato documentato bene.
const senzaCommenti = (p) => leggi(p).split('\n')
  .filter(r => !r.trim().startsWith('//') && !r.trim().startsWith('*'))
  .join('\n');

describe('chi paga: l\'email viene dalla sessione', () => {
  const rotta = leggi('api/room/route.js');

  it('la creazione stanza non prende piu l\'email dal corpo', () => {
    expect(senzaCommenti('api/room/route.js'), 'hostEmail non deve piu essere letto da body')
      .not.toMatch(/hostEmail:\s*body\.hostEmail/);
  });

  it('l\'email si ricava dal token di sessione', () => {
    expect(rotta).toMatch(/hostEmail: await emailDallaSessione\(body\.userToken\)/);
    expect(rotta, 'e la funzione deve passare da getSession').toMatch(/getSession\(userToken\)/);
  });

  it('senza sessione valida non c\'e nessun portafoglio da addebitare', () => {
    // Meglio nessun pagante che il pagante sbagliato.
    const blocco = rotta.slice(rotta.indexOf('async function emailDallaSessione'));
    expect(blocco).toMatch(/if \(!userToken.*\) return null;/);
    expect(blocco).toMatch(/sessione\?\.email \|\| null/);
  });

  it('il client manda il token, non l\'indirizzo', () => {
    const hook = leggi('hooks/useRoomPolling.js');
    expect(hook).toMatch(/userToken: getEffectiveToken\?\.\(\)/);
    expect(senzaCommenti('hooks/useRoomPolling.js'), 'non deve tornare a mandare l\'email')
      .not.toMatch(/hostEmail: userAccount/);
  });
});

describe('se pagare: lo dice una ricevuta, non il client', () => {
  it('il campo giaAddebitato non esiste piu nel contratto', () => {
    // Cerco l'uso vero, non le occorrenze nei commenti che spiegano il bug.
    for (const f of ['lib/schemas.js', 'api/translate/route.js', 'hooks/useTranslation.js']) {
      expect(senzaCommenti(f), `${f} usa ancora giaAddebitato`).not.toMatch(/giaAddebitato/);
    }
  });

  it('la trascrizione lascia la ricevuta dopo aver addebitato', () => {
    // b.161-bis: l'addebito vero e' il commit della riserva (vedi
    // wallet-sicurezza-b161-bis.test.js), non piu addebitaVoce.
    const t = leggi('api/transcribe/route.js');
    const posAddebito = t.indexOf('commit(riservaId, costoPrevisto');
    const posRicevuta = t.indexOf('ricevutaVoce(');
    expect(posAddebito).toBeGreaterThan(-1);
    expect(posRicevuta, 'la ricevuta si emette DOPO l\'addebito, non prima')
      .toBeGreaterThan(posAddebito);
  });

  it('la traduzione la strappa, e vale una volta sola', () => {
    const tr = leggi('api/translate/route.js');
    expect(tr).toMatch(/strappaRicevutaVoce\(billingEmail, text\)/);
    expect(tr, 'l\'addebito dipende dalla ricevuta, non dal client')
      .toMatch(/!giaPagatoDavvero/);

    const lib = leggi('lib/ricevute.js');
    // b.633 — la ricevuta non e piu un interruttore (SET/DEL) ma un
    // CONTATORE: due voci uguali pagate valgono due traduzioni gratis,
    // non una. La proprieta difesa qui resta la stessa — una ricevuta
    // vale una volta sola — ma adesso vale una volta sola CIASCUNA.
    expect(lib, 'strappare significa consumarne una: finite le ricevute, si paga')
      .toMatch(/redis\('DECR', k\)/);
    expect(lib, 'emetterne una in piu, non sovrascrivere quella che c\'era')
      .toMatch(/redis\('INCR', k\)/);
  });

  it('la ricevuta e legata a chi paga E al testo', () => {
    // Se fosse legata solo alla persona, coprirebbe qualunque frase.
    const lib = leggi('lib/ricevute.js');
    expect(lib).toMatch(/\$\{pagante\}\|\$\{\(testo \|\| ''\)/);
  });

  it('la ricevuta scade in fretta', () => {
    const lib = leggi('lib/ricevute.js');
    const vita = Number((lib.match(/const VITA = (\d+)/) || [])[1]);
    expect(vita).toBeGreaterThan(10);
    expect(vita, 'oltre un paio di minuti diventa riusabile').toBeLessThanOrEqual(120);
  });

  it('nel registro non finisce il testo in chiaro', () => {
    const lib = leggi('lib/ricevute.js');
    expect(lib).toMatch(/createHash\('sha256'\)/);
  });
});

describe('il contatore di spesa segue la spesa vera', () => {
  const auth = leggi('lib/apiAuth.js');

  it('non arrotonda piu per eccesso ogni addebito', () => {
    // Math.ceil(0.1) faceva 1: si scalava un decimo di centesimo e se ne
    // contava uno intero. Il tetto scattava dieci volte prima.
    expect(auth).not.toMatch(/INCRBY',\s*\w+,\s*Math\.ceil/);
    expect(auth).toMatch(/INCRBYFLOAT/);
  });

  it('chi legge il contatore non tronca i decimali', () => {
    // b.170 — CONFERMATO: non si legge piu il contatore con un GET a se
    // stante (vedi la riserva-budget atomica in apiAuth.js, sostituisce
    // il vecchio GET+confronto per chiudere una race concorrente) — ma
    // il valore che ne esce, dall'INCRBYFLOAT stesso, passa comunque da
    // parseFloat, mai da parseInt: l'intento (niente decimali troncati)
    // resta lo stesso, cambia solo dove avviene la lettura.
    expect(auth, 'parseInt("4.7") da 4').not.toMatch(/parseInt\(await redis\('(GET|INCRBYFLOAT)', dailyKey\)/);
    expect(auth).toMatch(/parseFloat\(await redis\('INCRBYFLOAT', dailyKey, BUDGET_RESERVE_CENTS\)\)/);
    expect(leggi('api/startrek/route.js'))
      .not.toMatch(/parseInt\(await redis\('GET', `daily:/);
  });

  it('l\'addebito minimo resta piu piccolo di un centesimo', () => {
    // Se qualcuno lo alzasse a 1, il difetto sparirebbe per il motivo
    // sbagliato: facendo pagare dieci volte tanto.
    const cfg = leggi('lib/config.js');
    const minimo = Number((cfg.match(/TRANSLATE:\s*([\d.]+)/) || [])[1]);
    expect(minimo).toBeLessThan(1);
    expect(minimo).toBeGreaterThan(0);
  });
});
