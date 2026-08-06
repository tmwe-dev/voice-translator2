// ═══════════════════════════════════════════════════════════════
// GUARDIA: IL LIVELLO DEL MICROFONO NON PASSA DA REACT
//
// Trovato nell'audit di b.105 come il singolo blocco piu grosso alla
// fluidita.
//
// Il livello del microfono cambia sessanta volte al secondo. Era uno
// useState aggiornato dentro il ciclo a fotogrammi, quindi ogni
// fotogramma faceva risalire un setState lungo la catena
//   useFreeTalkVAD -> useTranslation -> page -> RoomView -> MessageList
// e ridisegnava TUTTE le nuvolette a schermo: fino a trenta, ciascuna
// con avatar da 56px, barra reazioni e stili calcolati. Circa
// cinquecento elementi riconciliati, sessanta volte al secondo, per
// tutta la durata dell'ascolto.
//
// Serviva a una barretta alta quaranta pixel.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const senzaCommenti = (p) => leggi(p).split('\n')
  .filter(r => !r.trim().startsWith('//') && !r.trim().startsWith('*'))
  .join('\n');

describe('il ciclo del microfono non tocca lo stato React', () => {
  const vad = leggi('hooks/useFreeTalkVAD.js');

  it('il livello vive in un riferimento, non in uno stato', () => {
    expect(vad).toMatch(/const vadLivelloRef = useRef\(0\)/);
    expect(senzaCommenti('hooks/useFreeTalkVAD.js'), 'non deve tornare uno useState')
      .not.toMatch(/setVadAudioLevel/);
  });

  it('dentro il ciclo si scrive il riferimento', () => {
    const ciclo = vad.slice(vad.indexOf('function check()'), vad.indexOf('function check()') + 900);
    expect(ciclo).toMatch(/vadLivelloRef\.current = /);
    expect(ciclo, 'nessun setState dentro il ciclo a fotogrammi')
      .not.toMatch(/set[A-Z]\w*\(/);
  });

  it('il buffer si alloca una volta sola, non a ogni fotogramma', () => {
    // Erano 256 byte sessanta volte al secondo: 15 KB/s di spazzatura.
    const i = vad.indexOf('function check()');
    const dentro = vad.slice(i, i + 900);
    expect(dentro, 'new Uint8Array dentro check() significa una allocazione per fotogramma')
      .not.toMatch(/new Uint8Array/);
    expect(vad.slice(Math.max(0, i - 500), i), 'il buffer va creato prima del ciclo')
      .toMatch(/new Uint8Array\(analyser\.frequencyBinCount\)/);
  });
});

describe('la barretta si disegna da sola', () => {
  const barra = leggi('components/BarraLivelloMicrofono.js');

  it('legge il riferimento e scrive sul nodo, senza stato', () => {
    expect(barra).toMatch(/livelloRef\?\.current/);
    expect(barra).toMatch(/nodo\.style\.height/);
    expect(senzaCommenti('components/BarraLivelloMicrofono.js'), 'niente useState qui dentro')
      .not.toMatch(/useState/);
  });

  it('non ridisegna quando la differenza non si vede', () => {
    expect(barra).toMatch(/SOGLIA_VISIBILE/);
    expect(barra).toMatch(/Math\.abs\(livello - ultimoRef\.current\) > SOGLIA_VISIBILE/);
  });

  it('si ferma a scheda nascosta e quando si smette di ascoltare', () => {
    expect(barra).toMatch(/document\.hidden/);
    expect(barra).toMatch(/cancelAnimationFrame/);
  });
});

describe('la catena porta il riferimento, non il numero', () => {
  it('nessun file passa piu vadAudioLevel', () => {
    for (const f of ['hooks/useTranslation.js', 'page.js', 'components/RoomView.js',
                     'components/TalkControls.js', 'hooks/useFreeTalkVAD.js']) {
      expect(senzaCommenti(f), `${f} passa ancora il valore invece del riferimento`)
        .not.toMatch(/vadAudioLevel/);
    }
  });

  it('TalkControls usa il componente isolato', () => {
    const tc = leggi('components/TalkControls.js');
    expect(tc).toMatch(/import BarraLivelloMicrofono/);
    expect(tc).toMatch(/<BarraLivelloMicrofono livelloRef=\{vadLivelloRef\}/);
  });
});
