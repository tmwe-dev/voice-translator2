// ═══════════════════════════════════════════════════════════════
// b.639 — UN AUDIO CHE NON SI PUO USARE NON E UN GUASTO NOSTRO
//
// Trovato dal collaudo fisico del 05/09 mandando a /api/transcribe un
// file che Whisper non digerisce: il fornitore risponde «400 Audio file
// might be corrupted or unsupported» e la rotta rispondeva 500
// «Internal error» (verificato nei registri Vercel, due volte su due).
//
// Sbagliato in tre modi: la risposta giusta e 400; ogni 500 finisce su
// Sentry come guasto interno e nel conto degli errori di ogni audit; e
// a chi chiama non arriva nessun motivo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('b.639 — l\'audio che il fornitore rifiuta e un 400, non un 500', () => {
  const src = leggi('app/api/transcribe/route.js');

  it('un 400 del fornitore diventa un 400 con motivo, non un rilancio', () => {
    const i = src.indexOf("if (riservaId) { await release(riservaId, 'whisper_fallito')");
    expect(i).toBeGreaterThan(-1);
    const dopo = src.slice(i, i + 2200);
    expect(dopo).toMatch(/if \(e\?\.status === 400\)/);
    expect(dopo).toMatch(/motivo: 'audio_non_supportato'/);
    expect(dopo).toMatch(/status: 400/);
  });

  it('il credito torna PRIMA di rispondere: un audio rifiutato non si paga', () => {
    const iRelease = src.indexOf("release(riservaId, 'whisper_fallito')");
    const i400 = src.indexOf("motivo: 'audio_non_supportato'");
    expect(iRelease).toBeGreaterThan(-1);
    expect(i400, 'prima si rende, poi si risponde').toBeGreaterThan(iRelease);
  });

  it('la diagnostica di b.626 resta, ed e sempre a livello error', () => {
    expect(src).toMatch(/log\.error\('Whisper ha rifiutato l\\'audio:'/);
    expect(src).toMatch(/tipoDichiarato: audioFile\.type/);
  });

  it('gli altri guasti del fornitore (rete, quota, timeout) risalgono come prima', () => {
    const i = src.indexOf("if (e?.status === 400)");
    const dopo = src.slice(i, i + 400);
    expect(dopo, 'fuori dal ramo 400 si rilancia').toMatch(/\}\s*throw e;/);
  });
});

