import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import jsx from 'acorn-jsx';

// b.379 — con il JSX dentro. Serve, perche il guasto che ha spento
// l'app stava PROPRIO in un componente: un controllo che legge solo i
// file senza JSX avrebbe lasciato scoperto l'unico posto che conta.
const Lettore = Parser.extend(jsx());

// ═══════════════════════════════════════════════════════════════
// MAI LETTO PRIMA DI NASCERE — la trappola che ha spento l'app intera.
//
// b.379. Luca: «nessuna stanza si apre, da nessun percorso». Non era una
// stanza rotta: era il componente che MORIVA a ogni montaggio, e i
// quattro percorsi diversi cadevano tutti nello stesso punto.
//
// La causa: un `const` letto centoventi righe PRIMA della sua riga. In
// JavaScript quello non vale "non definito" — e un errore che butta giu
// tutto. L'avevo introdotto io portando il carosello da RadioChat:
// spostando un calcolo piu in alto, gli ho fatto leggere un nome che
// ancora non esisteva.
//
// PERCHE' NESSUNA PROVA L'HA VISTO. Le prove qui guardano funzioni pure
// e regole; un componente React che muore al montaggio non lo vede
// nessuno finche qualcuno non apre l'app. E la compilazione non dice
// niente: e codice validissimo, sbagliato solo nell'ordine.
//
// Questa prova legge i file COME LI LEGGE IL BROWSER, con un parser
// vero, e cerca esattamente quel caso: un nome dichiarato con const o
// let, usato piu in alto, FUORI da una funzione annidata.
//
// La distinzione sulle funzioni annidate e tutta la sostanza: dentro
// un callback il nome si legge quando il callback GIRA — cioe dopo, ed
// e legittimo. Nell'elenco delle dipendenze di un effetto no: quello si
// valuta subito, ed e uno dei due punti che avevano ucciso la stanza.
// ═══════════════════════════════════════════════════════════════

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function tuttiIFile(dir, dentro = []) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (nome !== 'node_modules' && nome !== '.next') tuttiIFile(p, dentro); }
    else if (nome.endsWith('.js') && !nome.endsWith('.test.js')) dentro.push(p);
  }
  return dentro;
}

/** Cerca i nomi letti prima di essere dichiarati, fuori dalle funzioni annidate. */
function lettiTroppoPresto(sorgente) {
  let albero;
  try {
    albero = Lettore.parse(sorgente, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch { return []; }

  const guai = [];

  function esamina(corpo) {
    // 1. i nomi dichiarati con const/let a QUESTO livello, con la loro posizione
    const nati = new Map();
    for (const n of corpo) {
      if (n.type !== 'VariableDeclaration' || n.kind === 'var') continue;
      for (const d of n.declarations) {
        if (d.id?.type === 'Identifier') nati.set(d.id.name, n.start);
      }
    }
    // (se qui non nasce niente non si controlla nulla a QUESTO livello,
    //  ma si scende comunque: le funzioni annidate hanno il loro livello,
    //  ed e li dentro che vivono i componenti)

    // 2. si guardano gli usi, saltando quello che sta in un altro AMBITO.
    // b.379 — non bastano le funzioni: in JavaScript anche un blocco
    // graffa ha il suo ambito per const e let. Un `const x` dentro un
    // `if` e un altro x da quello fuori, e attraversare quel confine
    // produceva decine di allarmi a vuoto — che e il modo piu sicuro
    // per far spegnere un controllo.
    const salta = new Set([
      'FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration',
      'BlockStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement',
    ]);
    function cammina(nodo, dentroFunzione) {
      if (!nodo || typeof nodo.type !== 'string') return;
      if (nodo.type === 'Identifier' && !dentroFunzione) {
        const nascita = nati.get(nodo.name);
        if (nascita !== undefined && nodo.start < nascita) {
          guai.push({ nome: nodo.name, riga: nodo.loc.start.line });
        }
      }
      for (const k of Object.keys(nodo)) {
        if (k === 'loc' || k === 'start' || k === 'end') continue;
        // b.379 — NON TUTTI I NOMI SONO LETTURE. `{ apiKey: x }` e
        // `a.apiKey` scrivono la parola ma non leggono nessuna variabile:
        // contarli produceva decine di falsi allarmi, e un controllo che
        // grida a vuoto e peggio di nessun controllo, perche lo si
        // spegne.
        if (nodo.type === 'Property' && k === 'key' && !nodo.computed) continue;
        if (nodo.type === 'MemberExpression' && k === 'property' && !nodo.computed) continue;
        if (nodo.type === 'VariableDeclarator' && k === 'id') continue;
        if ((nodo.type === 'FunctionDeclaration' || nodo.type === 'ClassDeclaration') && k === 'id') continue;
        if (salta.has(nodo.type) && k === 'params') continue;
        const v = nodo[k];
        const giu = dentroFunzione || salta.has(nodo.type);
        if (Array.isArray(v)) v.forEach((x) => x && typeof x === 'object' && cammina(x, giu));
        else if (v && typeof v === 'object' && v.type) cammina(v, giu);
      }
    }
    if (nati.size) for (const n of corpo) cammina(n, false);

    // 3. e si scende dentro ogni ambito, che ha il suo livello
    function scendi(nodo) {
      if (!nodo || typeof nodo.type !== 'string') return;
      if (nodo.type === 'BlockStatement') esamina(nodo.body);
      else if (salta.has(nodo.type) && nodo.body?.type === 'BlockStatement') esamina(nodo.body.body);
      for (const k of Object.keys(nodo)) {
        if (k === 'loc' || k === 'start' || k === 'end') continue;
        const v = nodo[k];
        if (Array.isArray(v)) v.forEach((x) => x && typeof x === 'object' && scendi(x));
        else if (v && typeof v === 'object' && v.type) scendi(v);
      }
    }
    for (const n of corpo) scendi(n);
  }

  esamina(albero.body);
  return guai;
}

describe('nessun nome viene letto prima di nascere', () => {
  const file = [
    ...tuttiIFile(path.join(RADICE, 'app/lib')),
    ...tuttiIFile(path.join(RADICE, 'app/wallet')),
    ...tuttiIFile(path.join(RADICE, 'app/components')),
    ...tuttiIFile(path.join(RADICE, 'app/hooks')),
  ];

  it('ci sono file da controllare', () => {
    expect(file.length).toBeGreaterThan(100);
  });

  // b.384 — un minuto, non cinque secondi. Questa prova legge col
  // parser duecento file: da sola ci mette due secondi, ma quando la
  // macchina compila in parallelo arriva a diciotto — e andava in
  // TIMEOUT, cioe diventava rossa SENZA AVER TROVATO NIENTE. Una prova
  // che diventa rossa a caso e peggio di nessuna prova: si impara a
  // ignorarla, e il giorno che trova qualcosa di vero non le crede piu
  // nessuno.
  it('in tutta l app non c\'e un solo caso', { timeout: 60000 }, () => {
    const rotti = [];
    for (const f of file) {
      const guai = lettiTroppoPresto(fs.readFileSync(f, 'utf8'));
      for (const g of guai) rotti.push(`${path.relative(RADICE, f)}:${g.riga} legge "${g.nome}" prima che esista`);
    }
    expect(rotti, `Un const letto prima della sua riga uccide il modulo:\n  ${rotti.join('\n  ')}`).toEqual([]);
  });

  it('il controllo funziona davvero: riconosce il caso di b.379', () => {
    // com'era RoomView: il nome letto in un elenco di dipendenze, cento
    // righe sopra la sua dichiarazione
    const rotto = `
      function C() {
        const x = useMemo(() => f(myName), [myName]);
        const myName = 'a';
        return x;
      }`;
    expect(lettiTroppoPresto(rotto).map((g) => g.nome)).toContain('myName');
  });

  it('e NON grida quando il nome si legge dentro un callback, che gira dopo', () => {
    const giusto = `
      function C() {
        useEffect(() => { console.log(myName); });
        const myName = 'a';
      }`;
    expect(lettiTroppoPresto(giusto)).toEqual([]);
  });
});
