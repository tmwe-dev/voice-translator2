import { describe, it, expect } from 'vitest';

const { estraiAgente } = await import('../app/lib/compagni/genera.js');

// b.308 — un profilo agente in JSON che si interrompe a meta (risposta del
// modello tagliata dal tetto di token) non deve piu dare "Profilo illeggibile"
// (502): si recupera l'oggetto chiudendolo dopo l'ultima proprieta completa.
describe('estraiAgente — recupero da troncamento (b.308)', () => {
  it('legge un profilo JSON completo', () => {
    const a = estraiAgente('{"nome":"Ada","ruolo":"matematica","personalita":"precisa","genere":"female"}');
    expect(a).toBeTruthy();
    expect(a.nome).toBe('Ada');
    expect(a.genere).toBe('female');
  });

  it('recupera i campi da un oggetto TRONCATO a meta', () => {
    // manca la chiusura: personalita tagliata, niente } finale
    const troncato = '{"nome":"Marco","ruolo":"avvocato","personalita":"ragiona per norme e responsabi';
    const a = estraiAgente(troncato);
    expect(a).toBeTruthy();
    expect(a.nome).toBe('Marco');
    expect(a.ruolo).toBe('avvocato');
  });

  it('tollera le staccionate ```json e testo di cortesia', () => {
    const a = estraiAgente('Ecco:\n```json\n{"nome":"Yuki","ruolo":"guida"}\n```');
    expect(a).toBeTruthy();
    expect(a.nome).toBe('Yuki');
  });

  it('ritorna null se non c\'e proprio JSON', () => {
    expect(estraiAgente('nessun oggetto qui')).toBe(null);
  });
});
