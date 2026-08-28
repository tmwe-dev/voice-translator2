import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cercaPaesi, PAESI } from '../app/lib/paesi.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const codici = (q, l) => cercaPaesi(q, l).map((p) => p.codice);

// ───────────────────────────────────────────────────────────────
// Giro di collaudo automatico orario, secondo passaggio: le zone che
// il giro precedente aveva dichiarato NON COPERTE (Notizie, globo,
// discussioni) viste a 769 di larghezza. Due difetti riprodotti.
// ───────────────────────────────────────────────────────────────

describe('b.519/1 — dalle Notizie la sintesi dell’articolo esiste davvero', () => {
  // PROVA DAL VIVO su #806: scheda Notizie -> «Leggi» su un articolo di
  // nature.com. L'editore rifiuta l'iframe, il lettore lo dice bene
  // («Questo sito non si lascia aprire dentro un'altra applicazione»),
  // ma nella pagina NON c'e nessun comando Sintesi/Genera: vicolo
  // cieco proprio dove la sintesi sarebbe l'unica via d'uscita.
  // Causa: le due facce di b.517 si disegnano solo se `dati?.titolo`,
  // e i due punti che aprono il lettore DALLE NOTIZIE non passavano
  // `dati`. Gli ARGOMENTI lo passavano gia: mezza funzione consegnata.
  const lettore = () => leggi('app/components/ui/LettoreArticolo.js');
  const news = () => leggi('app/components/MondoNews.js');

  it('le due facce del lettore dipendono da `dati.titolo` (la causa)', () => {
    expect(lettore()).toContain('{dati?.titolo && (');
  });

  it('le Notizie ora costruiscono `dati` per il lettore', () => {
    const s = news();
    expect(s).toContain('const perLettore = leggibile ? {');
    expect(s).toMatch(/dati: \{ titolo: d\.title/);
  });

  it('tutti e due i punti delle Notizie usano lo stesso oggetto', () => {
    const s = news();
    expect(s).toContain('if (perLettore) setLettura(perLettore);');
    expect(s).toContain('setLettura(perLettore); }}');
    // il difetto: si passava solo url/titolo/fonte, senza `dati`
    expect(s).not.toContain("setLettura({ url: d.media.url, titolo: d.title, fonte })");
  });

  it('`fonti` viaggia col titolo, come gia fanno gli Argomenti', () => {
    expect(news()).toMatch(/fonti: fonte \? \[\{ fonte, titolo: d\.title \}\] : \[\]/);
  });
});

describe('b.519/2 — i paesi si trovano col loro nome, non solo con l’endonimo', () => {
  // PROVA (dal diario di b.516, rimasta aperta due giri): con
  // interfaccia italiana «germania» -> «Nessun paese trovato», mentre
  // «germany» trovava Deutschland.
  it('i casi rotti ora rispondono, in italiano', () => {
    expect(codici('germania', 'it')).toContain('DE');
    expect(codici('giappone', 'it')).toContain('JP');
    expect(codici('grecia', 'it')).toContain('GR');
    expect(codici('spagna', 'it')).toContain('ES');
    expect(codici('paesi bassi', 'it')).toContain('NL');
  });

  it('vale per tutte le lingue dell’interfaccia, non solo per l’italiano', () => {
    expect(codici('alemania', 'es')).toContain('DE');
    expect(codici('allemagne', 'fr')).toContain('DE');
    expect(codici('griechenland', 'de')).toContain('GR');
  });

  it('quello che funzionava prima funziona ancora', () => {
    expect(codici('germany')).toContain('DE');
    expect(codici('Deutschland')).toContain('DE');
    expect(codici('italia')).toContain('IT');
    expect(codici('de').length).toBeGreaterThan(1); // la sigla resta un prefisso
  });

  it('query vuota = tutti; roba inesistente = nessuno', () => {
    expect(cercaPaesi('').length).toBe(PAESI.length);
    expect(codici('zzzzz', 'it')).toEqual([]);
  });

  it('un ambiente senza Intl.DisplayNames non rompe la ricerca', () => {
    const vero = Intl.DisplayNames;
    try {
      // eslint-disable-next-line no-global-assign
      Intl.DisplayNames = function () { throw new Error('non disponibile'); };
      // lingua mai vista prima: il dizionario si costruisce ora, e fallisce
      expect(codici('germany', 'xx-XX')).toContain('DE');
      expect(codici('Deutschland', 'xx-XX')).toContain('DE');
    } finally {
      Intl.DisplayNames = vero;
    }
  });

  it('la schermata passa la lingua dell’interfaccia alla ricerca', () => {
    const s = leggi('app/components/SceltaPaeseView.js');
    expect(s).toContain('cercaPaesi(ricerca, prefs?.uiLang)');
  });
});
