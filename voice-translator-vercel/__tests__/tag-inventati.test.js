import { describe, it, expect } from 'vitest';
import { testoVisibile, segmentiPerVoce, pezziLezione } from '../app/lib/compagni/corsi/lingua.js';

// ═══════════════════════════════════════════════════════════════
// I TAG CHE IL MODELLO SI INVENTA — non a schermo, non nelle orecchie.
//
// b.377. Luca ha aperto la prima lezione di inglese e ha trovato scritto
// «A significa [IT: A].» per ventisei lettere. Poi l'ha ASCOLTATA: la
// voce inglese diceva «J», e subito dopo quella italiana scandiva
// «significa parentesi IT due punti J».
//
// Il tag [IT:] non esiste in nessuna nostra istruzione: se l'e inventato
// il modello per dare la traduzione. E siccome il sistema conosceva solo
// [L2:], quello passava intatto — sullo schermo con le parentesi, e alla
// voce lettera per lettera.
//
// LA LEZIONE VERA di questo difetto: schermo e voce leggono LO STESSO
// testo per DUE STRADE DIVERSE. Ho riparato la prima e la seconda e
// rimasta rotta, e Luca l'ha trovata ascoltando. Questa prova tiene
// ferme tutte e due insieme: se un domani qualcuno ne sistema una sola,
// diventa rossa.
// ═══════════════════════════════════════════════════════════════

const CASI = [
  ['la traduzione inventata',   'A significa [IT: A].'],
  ['con dentro una frase',      'Prova a dire [L2: thank you] [IT: grazie].'],
  ['codice diverso',            'Si dice [L2: hola] [ES: ciao].'],
  ['maiuscolo',                 'Ecco [L2: yes] [It: sì].'],
];

describe('i tag inventati non arrivano a schermo', () => {
  for (const [nome, testo] of CASI) {
    it(nome, () => {
      const fuori = testoVisibile(testo);
      expect(fuori, nome).not.toMatch(/\[[a-zA-Z]{2}:/);
      expect(fuori, nome).not.toContain(']');
    });
  }
});

describe('e nemmeno nelle orecchie', () => {
  for (const [nome, testo] of CASI) {
    it(nome, () => {
      for (const p of segmentiPerVoce(testo, { linguaParlata: 'it', linguaStudiata: 'en' })) {
        expect(p.testo, `${nome} / ${p.lingua}`).not.toMatch(/\[[a-zA-Z]{2}:/);
        expect(p.testo, `${nome} / ${p.lingua}`).not.toContain(']');
      }
    });
  }

  it('la parte in lingua studiata resta INTATTA: e quella da imitare', () => {
    const pezzi = segmentiPerVoce('Prova [L2: How are you?] [IT: come stai?]', { linguaParlata: 'it', linguaStudiata: 'en' });
    expect(pezzi.find((p) => p.lingua === 'en')?.testo).toBe('How are you?');
  });

  it('la traduzione si sente ancora, senza il tag intorno', () => {
    const it = segmentiPerVoce('Prova [L2: thank you] [IT: grazie].', { linguaParlata: 'it', linguaStudiata: 'en' })
      .filter((p) => p.lingua === 'it').map((p) => p.testo).join(' ');
    expect(it).toContain('grazie');
  });
});

describe('i pezzi da toccare', () => {
  it('sa quali parti sono nella lingua che si studia', () => {
    const pezzi = pezziLezione('Si dice [L2: hello] e poi [L2: goodbye].');
    expect(pezzi.filter((p) => p.l2).map((p) => p.testo)).toEqual(['hello', 'goodbye']);
  });

  it('e nei pezzi da leggere non restano tag inventati', () => {
    for (const p of pezziLezione('A significa [IT: A]. Dì [L2: apple].')) {
      expect(p.testo).not.toMatch(/\[[a-zA-Z]{2}:/);
    }
  });
});
