// ═══════════════════════════════════════════════════════════════
// b.486 — «Traduzione...» PER SEMPRE: la bolla che prometteva una
// traduzione che non sarebbe mai arrivata.
//
// TROVATO NEL COLLAUDO FISICO del 25/08, due schede nella stessa stanza:
// un messaggio mandato quando in stanza c'era una persona sola restava
// con «Traduzione...» in corsivo sotto, per sempre — anche dopo
// l'ingresso del partner. La prima cosa che il partner vedeva entrando
// era un messaggio rotto.
//
// LA CAUSA NON E' UN GUASTO MA UNA REGOLA GIUSTA SENZA ETICHETTA:
// b.289 dice «nessuno per cui tradurre = niente traduzione, niente
// spesa» — sacrosanto. Ma il messaggio partiva IDENTICO a uno in attesa
// di traduzione, e la bolla non aveva modo di distinguere «sta
// arrivando» da «non arrivera mai».
//
// La cura: il messaggio nato senza destinatari lo DICHIARA
// (`soloOriginale`), e la bolla del mittente non scrive «Traduzione...»
// su di lui. Il ricevente non cambia: il suo tasto «Traduci» (b.326)
// resta, perche lui una traduzione la puo ancora chiedere.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('il segno nasce dove si decide di non tradurre', () => {
  const src = senzaCommenti(leggi('app/hooks/useTranslation.js'));

  it('il percorso testo dichiara quando parte senza destinatari', () => {
    expect(src).toMatch(/sendMessage\(text[^)]*soloOriginale:\s*targetLangs\.length === 0/);
  });

  it('e anche il percorso audio, che manda la fase 1 per conto suo', () => {
    expect(src).toMatch(/sendMessage\(original[^)]*soloOriginale:\s*targetLangs\.length === 0/);
  });
});

describe('il segno sale sul messaggio, ma NON va al server', () => {
  const src = senzaCommenti(leggi('app/hooks/useTranslationAPI.js'));

  it('il messaggio locale porta il segno', () => {
    const i = src.indexOf('const instantMsg');
    const blocco = src.slice(i, i + 700);
    expect(blocco).toMatch(/soloOriginale/);
  });

  it('il corpo verso /api/messages resta quello di prima', () => {
    // il segno e presentazione, non dato: il server non deve vederlo,
    // e uno schema severo non deve poterlo rifiutare.
    const i = src.indexOf("fetch('/api/messages'");
    const corpo = src.slice(i, src.indexOf('})', i));
    expect(corpo).not.toMatch(/soloOriginale/);
  });
});

describe('la bolla del mittente non mente piu', () => {
  const src = senzaCommenti(leggi('app/components/MessageList.js'));

  it('con «soloOriginale» niente etichetta eterna', () => {
    expect(src).toMatch(/m\.soloOriginale && !m\._translationError \? null/);
  });

  it("ma un ERRORE di traduzione si mostra comunque", () => {
    // un fallimento vero non va nascosto dietro il segno: se la fase 2 e
    // partita ed e morta, si dice.
    expect(src).toMatch(/_translationError \? L\('translationFailedShort'\)/);
  });

  it('e il tasto «Traduci» del ricevente (b.326) e ancora al suo posto', () => {
    expect(src).toMatch(/traduciQui\(m\)/);
  });
});
