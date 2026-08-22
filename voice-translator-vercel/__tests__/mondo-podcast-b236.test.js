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

describe('podcast — nessun turno puo scadere', () => {
  // b.244 — il tetto di 4 round era una TOPPA contro il timeout: tutti i
  // turni si generavano in una richiesta sola. Ora se ne genera uno per
  // volta, il timeout non esiste piu e il tetto e tornato a 10. Cio che
  // deve restare vero non e piu "quanti round", ma che la rotta offra il
  // percorso a turni — altrimenti il difetto rientra dalla finestra.
  it('la rotta genera UN turno per volta', () => {
    const s = senzaCommenti(leggi('app/api/compagni/podcast/route.js'));
    expect(s).toMatch(/body\.azione === 'turno'/);
    expect(s).toMatch(/indice/);
  });

  it('e il client li incatena, ascoltando mentre genera', () => {
    const s = senzaCommenti(leggi('app/components/Life/LifeView.js'));
    expect(s).toMatch(/generaTurnoPodcast\(/);
    expect(s).not.toMatch(/const d = await generaPodcast\(/);
  });

  it('i turni restano comunque limitati: MAX_COMPAGNI x MAX_ROUND', () => {
    const compagni = ['a', 'b', 'c', 'd'].map(id => ({ id }));
    const turni = ordineTurni(compagni, 999); // chiede 999 round: viene stretto
    expect(turni.length).toBe(PODCAST_LIMITI.MAX_COMPAGNI * PODCAST_LIMITI.MAX_ROUND);
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
    // b.397 — questa prova cercava una riga alla lettera («rooms: active»),
    // e si e fatta rossa il giorno che l'elenco ha cambiato nome perche le
    // stanze gia finite non si mostrano piu. La riga era giusta, il
    // comportamento non era cambiato: quello che conta e che il percorso
    // felice risponda con le stanze e senza stato d'errore.
    const s = senzaCommenti(leggi('app/api/mondo/route.js'));
    const felice = s.match(/return NextResponse\.json\(\{ rooms:[^)]*\)/g) || [];
    expect(felice.length, 'una sola uscita felice').toBe(1);
    expect(felice[0], 'nessuno stato d\'errore attaccato').not.toMatch(/status/);
  });
});
