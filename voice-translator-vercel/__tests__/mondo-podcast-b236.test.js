// ═══════════════════════════════════════════════════════════════
// b.236 — tre difetti confermati dall'audit strategico, chiusi insieme.
//
// 1. PODCAST: MAX_ROUND era 10 → con 4 Compagni, 40 turni sequenziali
//    dentro una rotta con maxDuration=60s. Timeout a metà, costi già
//    addebitati. Finché l'orchestrazione non è asincrona, il tetto è 4.
//
// 2. MONDO/DISCUSSIONI: il commento prometteva "non si mostra il nome
//    vero" e la riga sotto faceva `nick || session.name` — cioè, senza
//    nickname, mostrava il nome vero. Il ripiego è stato tolto.
//
// 3. MONDO (vetrina e feed): un guasto Redis/Supabase diventava
//    200 + lista vuota. Piazza vuota e piazza rotta erano
//    indistinguibili. Ora un guasto risponde 503.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PODCAST_LIMITI, ordineTurni } from '../app/lib/compagni/podcast.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('podcast — il tetto dei turni regge dentro i 60 secondi', () => {
  it('MAX_ROUND non supera 4 finché la rotta è sincrona', () => {
    expect(PODCAST_LIMITI.MAX_ROUND).toBeLessThanOrEqual(4);
  });

  it('nel caso peggiore i turni totali restano ≤ 16', () => {
    const compagni = ['a', 'b', 'c', 'd'].map(id => ({ id }));
    const turni = ordineTurni(compagni, 999); // chiede 999 round: viene stretto
    expect(turni.length).toBeLessThanOrEqual(
      PODCAST_LIMITI.MAX_COMPAGNI * PODCAST_LIMITI.MAX_ROUND
    );
    expect(turni.length).toBeLessThanOrEqual(16);
  });
});

describe('mondo — il nome vero non entra nella piazza pubblica', () => {
  it('authorName è SOLO il nickname: niente ripiego su session.name', () => {
    const s = senzaCommenti(leggi('app/api/mondo/discussioni/route.js'));
    expect(s, 'il ripiego sul nome dell\'account era la promessa disattesa')
      .not.toMatch(/nick \|\| session\.name/);
    expect(s).toMatch(/const authorName = nick;/);
  });
});

describe('mondo — un guasto non si traveste da piazza vuota', () => {
  it('la vetrina (/api/mondo) su errore risponde 503, non rooms:[]', () => {
    const s = senzaCommenti(leggi('app/api/mondo/route.js'));
    const iCatch = s.indexOf("log.error('GET error:'");
    const corpo = s.slice(iCatch, iCatch + 300);
    expect(corpo).toMatch(/status: 503/);
    expect(corpo).not.toMatch(/rooms: \[\]/);
  });

  it('il feed (/api/mondo/discussioni) su errore risponde 503, non discussioni:[]', () => {
    const s = senzaCommenti(leggi('app/api/mondo/discussioni/route.js'));
    const iCatch = s.indexOf("log.error('GET:'");
    const corpo = s.slice(iCatch, iCatch + 300);
    expect(corpo).toMatch(/status: 503/);
    expect(corpo).not.toMatch(/discussioni: \[\]/);
  });

  it('ma il percorso felice della vetrina resta un 200 con rooms', () => {
    const s = senzaCommenti(leggi('app/api/mondo/route.js'));
    expect(s).toMatch(/NextResponse\.json\(\{ rooms: active \}\)/);
  });
});
