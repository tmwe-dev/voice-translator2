// b.433 — il layout portato nel programma, seconda e terza pagina.
// Si applica dove RIPARA qualcosa, non si restaura cio che funziona.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
// trappola numero 6: i commenti si tolgono PRIMA di guardare il codice.
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Mondo — l\'icona in acciaio con le frecce (era: due linguette)', () => {
  // b.540 — AGGIORNATA con spiegazione, non cancellata. b.433 aveva
  // messo due linguette al posto di una tendina, e la prova difendeva
  // proprio quelle: role="tablist", altezza 44, icona accanto alla
  // parola. Poi l'ordine di Luca: «voglio in alto in mezzo l'icona in
  // acciaio che c'era prima con le frecce per cambiare visuale, cosi
  // elimini anche le altre voci notizie e mondo ora».
  // Cio che b.433 difendeva NON era «due linguette»: era che la scelta
  // fosse VISIBILE e a UN TOCCO, invece di nascosta dentro una tendina
  // col coperchio. Quello vale ancora, e la prova lo segue: si vede in
  // che sezione sei (l'acciaio), si cambia con un tocco (le frecce), e
  // il bersaglio resta grande abbastanza per un dito.
  it('si vede dove sei e si cambia con un tocco, senza coperchi', () => {
    const v = senzaCommenti(leggi('app/components/MondoView.js'));
    expect(v, 'la tendina Stanze/Notizie non c\'e piu').not.toMatch(/valore=\{tab\}/);
    expect(v, 'la sezione si RICONOSCE dall\'acciaio').toMatch(/SCHEDE\[i\]\.acciaio/);
    expect(v, 'e si cambia con le frecce, un tocco per verso').toMatch(/freccia\(-1,/);
    expect(v).toMatch(/freccia\(1,/);
    expect(v, 'la freccia gira davvero la scheda').toMatch(/onClick=\{\(\) => gira\(verso\)\}/);
  });

  it('i bersagli restano da dito', () => {
    const v = senzaCommenti(leggi('app/components/MondoView.js'));
    const blocco = v.slice(v.indexOf('const SCHEDE = ['), v.indexOf('const SCHEDE = [') + 2200);
    expect(blocco, 'l\'icona centrale').toMatch(/width: 54, height: 54/);
    expect(blocco, 'le frecce').toMatch(/width: 38, height: 38/);
  });

  it("e la parola resta per chi legge con lo schermo", () => {
    // b.400: Luca aveva gia perso l'icona una volta in questo punto;
    // b.540: adesso e la PAROLA a non doversi perdere, perche a schermo
    // resta solo il disegno.
    const v = senzaCommenti(leggi('app/components/MondoView.js'));
    expect(v).toMatch(/aria-label=\{SCHEDE\[i\]\.parola\}/);
    expect(v).toMatch(/title=\{SCHEDE\[i\]\.parola\}/);
  });
});

describe("Chat — da che lingua a che lingua", () => {
  it("le lingue non vengono piu buttate quando si scrive la riga d'archivio", () => {
    const s = senzaCommenti(leggi('app/lib/store.js'));
    expect(s).toMatch(/lingue: \[\.\.\.new Set\(conv\.members\.map\(m => m\.lang\)\.filter\(Boolean\)\)\]/);
  });

  it('si AGGIUNGE un campo, non si cambia quello che c\'era', () => {
    // le righe scritte prima di oggi devono restare leggibili.
    const s = senzaCommenti(leggi('app/lib/store.js'));
    expect(s, "i nomi restano dov'erano").toMatch(/members: conv\.members\.map\(m => m\.name\)/);
  });

  it("l'archivio mostra le lingue, e per le righe vecchie ripiega su quella sola", () => {
    const h = senzaCommenti(leggi('app/components/HistoryView.js'));
    expect(h, 'le nuove').toMatch(/Array\.isArray\(c\.lingue\) && c\.lingue\.length > 0/);
    expect(h, 'le vecchie, che ne hanno una sola').toMatch(/\) : c\.lang \? \(/);
    expect(h, 'e se non ce ne sono, niente invece di un riquadro vuoto').toMatch(/\) : null\}/);
  });

  it('non si inventano bandiere che non ci sono', () => {
    const s = senzaCommenti(leggi('app/lib/store.js'));
    expect(s, 'le lingue vuote si scartano').toMatch(/\.filter\(Boolean\)/);
  });
});

describe('un archivio rotto non e un archivio vuoto', () => {
  it('un rifiuto del server non passa piu in silenzio', () => {
    // Prima: `if (res.ok) { ...si legge... }` e basta. Un 401, un 429, un
    // guasto del server: NIENTE. L'elenco restava a zero e la schermata
    // diceva «nessuna conversazione». A chi era caduta la rete si diceva
    // che i suoi dati non ci sono.
    const p = senzaCommenti(leggi('app/page.js'));
    const dentro = p.slice(p.indexOf('async function loadHistory'), p.indexOf('async function loadHistory') + 2000);
    expect(dentro, 'il ramo del rifiuto esiste').toMatch(/\} else \{\s*setArchivioGuasto\(true\);/);
    expect(dentro, 'e anche quello della rete caduta').toMatch(/catch \(e\) \{[\s\S]*setArchivioGuasto\(true\)/);
  });

  it('anche una risposta illeggibile e un guasto, non un vuoto', () => {
    const p = senzaCommenti(leggi('app/page.js'));
    expect(p).toMatch(/if \(!d\) \{ setArchivioGuasto\(true\); return; \}/);
  });

  it('quando riesce, il guasto si spegne', () => {
    // se restasse acceso, un solo singhiozzo lascerebbe la schermata
    // rotta per sempre — lo stesso difetto della firma anti-doppione.
    const p = senzaCommenti(leggi('app/page.js'));
    expect(p).toMatch(/setArchivioGuasto\(false\)/);
  });

  it('la schermata lo dice, e da un modo per riprovare', () => {
    const h = senzaCommenti(leggi('app/components/HistoryView.js'));
    expect(h, 'il guasto si controlla PRIMA del vuoto').toMatch(/\{guasto \? \([\s\S]{0,400}\) : convHistory\.length === 0 \? \(/);
    expect(h, 'e c\'e il tasto per riprovare').toMatch(/actionLabel=\{L\('retryWord'\)\}/);
    expect(h, 'che riprova davvero').toMatch(/onAction=\{\(\) => suRiprova\?\.\(\)\}/);
  });

  it('e chi riprova rilegge davvero l\'archivio', () => {
    const p = senzaCommenti(leggi('app/page.js'));
    expect(p).toMatch(/suRiprova=\{\(\) => \{ setArchivioGuasto\(false\); loadHistory\(\); \}\}/);
  });
});

describe('Impara — a che punto sei', () => {
  it('la lezione dice quale su quante', () => {
    // L'indice esisteva ed era gia calcolato in due punti — serviva a
    // sapere qual e la prossima e a registrare gli esiti — ma a schermo
    // non compariva: si apriva una lezione senza sapere se era la prima
    // di tre o l'ottava di venti.
    const v = senzaCommenti(leggi('app/components/Life/LifeView.js'));
    expect(v, 'si cerca il posto della lezione aperta')
      .toMatch(/const posto = lezioni\.findIndex\(\(l\) => l\.titolo === aperta\.lezione\?\.titolo\)/);
    expect(v, 'e si scrive a schermo').toMatch(/\{posto \+ 1\} \/ \{lezioni\.length\}/);
  });

  it('e lo dice coi soli numeri, che non hanno bisogno di traduzione', () => {
    const v = senzaCommenti(leggi('app/components/Life/LifeView.js'));
    const i = v.indexOf('const posto = lezioni.findIndex');
    const blocco = v.slice(i, i + 900);
    expect(blocco, 'nessuna parola cablata in mezzo ai numeri').not.toMatch(/'di '|" di "/);
    expect(blocco, 'cifre a larghezza fissa, o la riga balla').toMatch(/tabular-nums/);
  });

  it('se le lezioni non ci sono, non si disegna un vuoto', () => {
    const v = senzaCommenti(leggi('app/components/Life/LifeView.js'));
    expect(v).toMatch(/\{lezioni\.length > 0 && \(\(\) => \{/);
  });
});
