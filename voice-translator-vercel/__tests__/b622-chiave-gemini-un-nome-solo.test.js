import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// b.622 — La chiave di Gemini si chiama GEMINI_API_KEY (e' il nome in
// .env.example ed e' quello che legge apiAuth.js, cioe' la traduzione vera).
// /api/test-login ne leggeva un secondo, GOOGLE_GEMINI_KEY, che non esiste
// da nessun'altra parte: la condizione era sempre falsa e la chiave non
// arrivava mai fra quelle di collaudo. Questa prova vede l'assenza: se il
// nome sbagliato torna, fallisce.

const RADICE = path.join(process.cwd(), 'app');

function tuttiIFile(dir) {
  const fuori = [];
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) fuori.push(...tuttiIFile(p));
    else if (/\.jsx?$/.test(voce.name)) fuori.push(p);
  }
  return fuori;
}

describe('b.622 — la chiave Gemini ha un nome solo', () => {
  it('nessun file di app/ legge il nome sbagliato dall_ambiente', () => {
    // si cerca la LETTURA (process.env.<nome>), non la stringa nuda: il nome
    // sbagliato resta citato qui e in un commento, come memoria del difetto.
    const sbagliato = ['process', 'env', 'GOOGLE_GEMINI_KEY'].join('.');
    const colpevoli = tuttiIFile(RADICE).filter((f) =>
      fs.readFileSync(f, 'utf8').includes(sbagliato),
    );
    expect(colpevoli).toEqual([]);
  });

  it('/api/test-login mette fra le chiavi di collaudo GEMINI_API_KEY', () => {
    const t = fs.readFileSync(path.join(RADICE, 'api/test-login/route.js'), 'utf8');
    expect(t).toContain('process.env.GEMINI_API_KEY');
    expect(t).toContain('testKeys.gemini = process.env.GEMINI_API_KEY');
  });
});
