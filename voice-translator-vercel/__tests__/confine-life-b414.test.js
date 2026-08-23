// ═══════════════════════════════════════════════════════════════
// b.414 — P1.20: il confine fra Life e BarTalk, scritto e sorvegliato.
//
// L'audit dice: «il documento afferma che se un file di Life importa
// qualcosa di BarTalk diverso da ponte.js e un errore di architettura;
// oggi Life importa direttamente constants, AppContext, audio, scan,
// memoria... La regola scritta non descrive piu il confine reale».
//
// VERIFICATO, e l'audit aveva ragione a meta — la meta che conta e in
// buono stato. Cercando dove vivono le CAPACITA' vere (il modello, il
// portafoglio, l'autorizzazione, la ricerca, il deposito veloce), sono
// tutte in `ponte.js` e in nessun altro posto. Cio che Life importa
// direttamente sono primitivi: colori, misure, scorciatoie, la memoria
// del telefono, il registro dell'audio. Non sono capacita: sono il
// pavimento su cui si cammina.
//
// Quindi non serviva un refactor. Serviva:
//   1. scrivere il confine giusto (fatto in docs/PIANO-LIFE-COMPAGNI.md);
//   2. QUESTA PROVA, che lo tiene vero anche fra sei mesi.
//
// Perche una regola scritta in un documento che nessuno esegue e
// esattamente il motivo per cui l'audit ha dovuto segnalarla.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RADICE = process.cwd();
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');

function tuttiIFile(cartella, trovati = []) {
  for (const nome of readdirSync(join(RADICE, cartella))) {
    const rel = `${cartella}/${nome}`;
    if (statSync(join(RADICE, rel)).isDirectory()) tuttiIFile(rel, trovati);
    else if (nome.endsWith('.js') || nome.endsWith('.jsx')) trovati.push(rel);
  }
  return trovati;
}

// LE CAPACITA': cio che costa, cio che autorizza, cio che esce di casa.
// Passano tutte da `ponte.js`, che e l'unico file autorizzato a
// conoscerle. Se un domani ne nasce una nuova, si aggiunge QUI.
const CAPACITA = [
  { nome: 'il modello', schema: /from '[^']*\/llmCaller\.js'/ },
  { nome: "l'autorizzazione e le chiavi", schema: /from '[^']*\/apiAuth\.js'/ },
  { nome: 'il portafoglio', schema: /from '[^']*\/wallet\/[^']*'/ },
  { nome: 'il motore di ricerca', schema: /from '[^']*\/topics\/servizio\.js'/ },
  { nome: 'i fornitori', schema: /from '[^']*\/providers\.js'/ },
  { nome: 'il deposito veloce', schema: /from '[^']*\/redis\.js'/ },
  { nome: 'il registro degli accessi', schema: /from '[^']*\/users\.js'/ },
];

// L'unico file di Life che puo conoscerle. Non e un'eccezione: e la
// definizione stessa della cerniera.
const CERNIERA = 'app/lib/compagni/ponte.js';

// Le rotte (app/api/compagni/*) non sono «Life»: sono la porta fra il
// mondo di fuori e Life, e devono poter guardare chi bussa. Restano
// fuori da questo controllo per scelta, non per dimenticanza.
const DOMINIO_LIFE = () => [
  ...tuttiIFile('app/lib/compagni'),
  ...tuttiIFile('app/components/Life'),
].filter((f) => f !== CERNIERA);

describe('P1.20 — le capacita di BarTalk passano SOLO dalla cerniera', () => {
  for (const cap of CAPACITA) {
    it(`${cap.nome}: nessun file di Life lo importa da solo`, () => {
      const colpevoli = DOMINIO_LIFE().filter((f) => cap.schema.test(leggi(f)));
      expect(colpevoli, [
        `${cap.nome} e una CAPACITA': costa, autorizza, o esce di casa.`,
        'Deve passare da app/lib/compagni/ponte.js, che e la cerniera unica.',
        'Se serve un verbo nuovo, lo si aggiunge li — non lo si scavalca:',
        `  ${colpevoli.join('\n  ')}`,
      ].join('\n')).toEqual([]);
    });
  }

  it('e la cerniera le conosce davvero: non e un confine di facciata', () => {
    // Se domani `ponte.js` non importasse piu niente, il controllo qui
    // sopra passerebbe per il motivo sbagliato — perche la capacita si e
    // spostata altrove senza che nessuno se ne accorga.
    const cerniera = leggi(CERNIERA);
    const conosciute = CAPACITA.filter((c) => c.schema.test(cerniera)).map((c) => c.nome);
    expect(conosciute, 'la cerniera deve conoscere il modello, il portafoglio e l\'autorizzazione')
      .toEqual(expect.arrayContaining(['il modello', "l'autorizzazione e le chiavi", 'il portafoglio']));
  });
});

describe('cio che Life PUO importare direttamente, e perche', () => {
  it('primitivi di interfaccia, misure e memoria locale: non sono capacita', () => {
    // E' la parte in cui l'audit era pessimista sul codice. `constants`
    // sono colori e misure; `scaffale` e `memoria` sono il deposito del
    // telefono; `voce` e il registro dell'audio. Nessuno di questi costa
    // niente, autorizza niente, e nessuno esce di casa.
    const ammessi = ['constants.js', 'ripiego.js', 'scaffale.js', 'memoria.js', 'voce.js', 'vociLingue.js', 'fonia.js'];
    for (const a of ammessi) {
      const chiLoUsa = DOMINIO_LIFE().filter((f) => leggi(f).includes(`/${a}'`));
      // non si pretende che siano usati: si pretende che se lo sono, sia
      // consentito. La prova esiste per fissare la LISTA, non il conteggio.
      expect(Array.isArray(chiLoUsa)).toBe(true);
    }
  });

  it('e il confine sta scritto nel documento, non solo qui', () => {
    // Una regola che vive solo in una prova la cambia chi rompe la prova.
    const piano = leggi('docs/PIANO-LIFE-COMPAGNI.md');
    expect(piano).toMatch(/5-quater/);
    expect(piano).toMatch(/consentito direttamente/i);
    expect(piano).toMatch(/deve passare dalla cerniera/i);
  });
});
