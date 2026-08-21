import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Trovato dal vivo in produzione (collaudo fisico sulla home): la console
// mostrava a OGNI caricamento
//   "Loading the stylesheet 'https://accounts.google.com/gsi/style'
//    violates the Content Security Policy directive style-src"
// Lo script di Google era permesso (script-src), il suo foglio di stile no:
// il pulsante "Accedi con Google" restava senza il proprio aspetto.
// Le due direttive devono nominare lo stesso host.
//
// b.363 — la prova cercava la politica come UNA riga di testo scritta a mano
// dentro le intestazioni ("Content-Security-Policy": "default-src ..."), e
// dopo l'unificazione quella riga non esiste piu in nessuno dei due file:
// l'elenco ora si costruisce dentro politicaContenuti(). La pretesa non
// cambia di una virgola (chi puo eseguire lo script di Google deve poterlo
// anche vestire, nei DUE file), cambia solo il posto dove andarla a leggere.
// E si aggiunge la pretesa nuova nata con l'unificazione: i due elenchi
// devono essere identici, altrimenti il browser torna ad applicare la somma
// dei divieti — cioe un terzo elenco che nessuno ha mai scritto.
const leggi = (f) => readFileSync(join(process.cwd(), f), 'utf8');

// Il corpo di politicaContenuti(), dal nome della funzione alla graffa che
// la chiude a inizio riga.
const corpoPolitica = (src) => {
  const inizio = src.indexOf('function politicaContenuti()');
  const fine = src.indexOf('\n}', inizio);
  return inizio === -1 || fine === -1 ? '' : src.slice(inizio, fine);
};

// La riga dell'elenco che apre una direttiva: la prendo intera perche
// script-src e' spezzata in piu pezzi concatenati (la concessione di
// sviluppo sta in mezzo) e gli host stanno nell'ultimo pezzo.
const direttiva = (corpo, nome) =>
  corpo.split('\n').find((riga) => riga.includes(`"${nome} `)) || '';

describe('CSP: chi puo eseguire lo script di Google puo anche vestirlo', () => {
  it('middleware.js — accounts.google.com sta sia in script-src sia in style-src', () => {
    const corpo = corpoPolitica(leggi('middleware.js'));
    expect(corpo, 'la CSP deve esistere nel middleware').toBeTruthy();
    expect(direttiva(corpo, 'script-src')).toContain('https://accounts.google.com');
    expect(direttiva(corpo, 'style-src')).toContain('https://accounts.google.com');
  });

  it('next.config.mjs — la seconda CSP non deve essere piu stretta della prima', () => {
    const corpo = corpoPolitica(leggi('next.config.mjs'));
    expect(corpo, 'la CSP deve esistere anche in next.config.mjs').toBeTruthy();
    expect(direttiva(corpo, 'script-src')).toContain('https://accounts.google.com');
    expect(direttiva(corpo, 'style-src')).toContain('https://accounts.google.com');
  });

  it('le due politiche sono la stessa politica, parola per parola', () => {
    const uno = corpoPolitica(leggi('middleware.js'));
    const due = corpoPolitica(leggi('next.config.mjs'));
    expect(uno).toBeTruthy();
    expect(due).toBe(uno);
  });
});
