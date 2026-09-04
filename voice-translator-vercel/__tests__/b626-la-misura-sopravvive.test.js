import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// b.626 — UNA MISURA CHE SPARISCE PRIMA DI ESSERE LETTA NON E' UNA MISURA.
//
// Su Vercel i registri normali durano un giorno; l'aggregato degli errori
// sette. Verificato sui dati veri: nei 28 gruppi degli ultimi sette
// giorni ci sono 65 righe, tutte di livello error, nessun warn.
//
// Le due righe che b.593 e b.598 avevano piantato apposta per capire due
// guasti ricorrenti erano `warn`: quando il guasto si e ripresentato, il
// dato per capirlo era gia stato buttato. Le due diagnosi restavano
// aperte non perche mancasse l'idea, ma perche mancava il numero.

const leggi = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

const senzaCommenti = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('b.626 — le diagnosi dei guasti ricorrenti durano quanto il guasto', () => {
  it('transcribe scrive a livello error cosa e arrivato quando Whisper rifiuta', () => {
    const rotta = senzaCommenti(leggi('app/api/transcribe/route.js'));
    expect(rotta).toMatch(/log\.error\('Whisper ha rifiutato/);
    expect(rotta).not.toMatch(/log\.warn\('Whisper ha rifiutato/);
    // e continua a dire le quattro cose che servono a capirlo
    for (const dato of ['byte:', 'tipoDichiarato:', 'durataSecDichiarata:', 'userAgent:']) {
      expect(rotta).toContain(dato);
    }
  });

  it('tts-edge registra ANCHE se il secondo tentativo ha salvato la sintesi', () => {
    const rotta = senzaCommenti(leggi('app/api/tts-edge/route.js'));
    expect(rotta).toMatch(/log\.error\('Edge TTS: primo tentativo muto/);
    expect(rotta).not.toMatch(/log\.warn\('primo tentativo muto/);
    // il dato che b.598 chiedeva e non aveva: com'e finita la seconda volta
    expect(rotta).toMatch(/log\.error\('Edge TTS: esito del secondo tentativo/);
    expect(rotta).toMatch(/riuscito:/);
  });
});
