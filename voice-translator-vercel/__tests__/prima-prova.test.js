// La prima traduzione guidata: il momento che decide se una persona resta.
// Qui si verifica che non possa degradarsi in silenzio.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const src = leggi('components/PrimaProva.js');

describe('prima prova', () => {
  it('è montata nella Home, non nascosta in una pagina secondaria', () => {
    const home = leggi('components/HomeView.js');
    expect(home).toMatch(/<PrimaProva/);
    expect(home, 'solo al primo avvio').toMatch(/primaProvaGiaFatta/);
  });

  it('si mostra una volta sola e poi non torna', () => {
    expect(src).toMatch(/localStorage\.setItem\(FATTA, '1'\)/);
    expect(src, 'chiudendola non deve ricomparire').toMatch(/chiudiPerSempre/);
  });

  it('la frase esiste in tutte le lingue del selettore iniziale', () => {
    // Se manca, l'utente vedrebbe una frase in una lingua che non è la sua.
    const previste = ['it', 'en', 'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'th', 'tr', 'vi'];
    for (const codice of previste) {
      expect(src, `manca la frase per "${codice}"`).toMatch(new RegExp(`\\n\\s*${codice}:`));
    }
  });

  it('non propone come meta la lingua che già parli', () => {
    expect(src).toMatch(/METE\.filter\(m => m !== miaLingua\)/);
    expect(src).toMatch(/METE\.find\(m => m !== miaLingua\)/);
  });

  it('fa SENTIRE la traduzione, non solo leggerla', () => {
    expect(src, 'senza voce resta un esercizio di lettura').toMatch(/tts-edge/);
    expect(src).toMatch(/new Audio/);
  });

  it('se la voce fallisce, il testo resta comunque', () => {
    // La sintesi è un di più: non deve far fallire tutta la prova.
    const bloccoVoce = src.slice(src.indexOf('tts-edge') - 400, src.indexOf('tts-edge') + 800);
    expect(bloccoVoce).toMatch(/catch/);
  });

  it('dice cosa sta facendo e cosa è andato storto', () => {
    expect(src).toMatch(/Traduco/);
    expect(src).toMatch(/Non è riuscita/);
  });
});
