// b.359 — GLI AGENTI NON DEVONO RISPONDERE PER FORZA (collaudo di Luca:
// «a volte inventano quando non sanno cosa dire; devono essere critici e non
// dire qualcosa per forza, devono fare domande e approfondire se non hanno
// capito, o se è ovvia, o se non ha senso; l'AI non deve per forza»).
//
// La causa radice: il turno era sempre richiesta→risposta, non esisteva il
// canale per tacere o chiedere. Qui si prova che ora esiste, ed è attivo.
import { describe, it, expect } from 'vitest';
import {
  involucroCompagno,
  QUANDO_NON_HAI_NULLA,
  REGOLE_EPISTEMICHE,
  PRINCIPIO_DECISIONALE,
  ISTRUZIONE_ESITO,
  staccaEsito,
} from '../app/lib/compagni/contratto.js';

describe('il permesso di non sapere', () => {
  it('è dentro l\'involucro comune: vale su OGNI superficie', () => {
    const inv = involucroCompagno({});
    expect(inv, 'le quattro mosse oneste ci sono').toContain('QUANDO NON HAI NULLA DI FONDATO DA DIRE');
    expect(inv).toContain('NON HO CAPITO');
    expect(inv).toContain('LA DOMANDA NON STA IN PIEDI');
  });

  it('sta fra l\'anti-invenzione e il criterio di scelta', () => {
    const inv = involucroCompagno({});
    const iEpist = inv.indexOf(REGOLE_EPISTEMICHE.slice(0, 30));
    const iNulla = inv.indexOf(QUANDO_NON_HAI_NULLA.slice(0, 30));
    const iCrit = inv.indexOf(PRINCIPIO_DECISIONALE.slice(0, 30));
    expect(iEpist).toBeGreaterThan(-1);
    expect(iNulla, 'dopo l\'anti-invenzione').toBeGreaterThan(iEpist);
    expect(iCrit, 'prima del criterio').toBeGreaterThan(iNulla);
  });

  it('la gerarchia dice che gli ordini di riempimento non giustificano l\'invenzione', () => {
    const inv = involucroCompagno({});
    expect(inv).toContain('non sono mai motivi per fabbricare');
  });
});

describe('l\'esito tipizzato: il canale per tacere o chiedere', () => {
  it('compare SOLO dove la superficie lo attiva', () => {
    expect(involucroCompagno({}), 'spento di default').not.toContain('[esito:');
    expect(involucroCompagno({ esitoTipizzato: true }), 'acceso su richiesta').toContain(ISTRUZIONE_ESITO.slice(0, 30));
  });

  it('stacca il marcatore senza mai rovinare il testo', () => {
    expect(staccaEsito('Non ho capito, intendi X o Y? [esito: domanda]'))
      .toEqual({ testo: 'Non ho capito, intendi X o Y?', esito: 'domanda' });
    expect(staccaEsito('Concordo, non ho altro. [esito: passo]'))
      .toEqual({ testo: 'Concordo, non ho altro.', esito: 'passo' });
    // senza marcatore: è una risposta, e il testo resta intero
    expect(staccaEsito('Una risposta piena senza marcatore.'))
      .toEqual({ testo: 'Una risposta piena senza marcatore.', esito: 'risposta' });
    // marcatore malformato: si lascia stare, il testo non si tocca
    expect(staccaEsito('Testo con [esito: boh] dentro').esito).toBe('risposta');
  });
});
