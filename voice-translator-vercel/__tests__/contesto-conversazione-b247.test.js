// ═══════════════════════════════════════════════════════════════
// b.247 — il contesto di conversazione tradiva la propria struttura.
//
// La promessa documentata è: prime 10 integre + centro riassunto +
// ultime 10 integre. Due difetti, verificati riga per riga, la rompevano:
//
//  1. `batchStart = summarizedUpToRef.current` con il ref che parte da 0:
//     il PRIMO lotto di riassunto prendeva i messaggi 0..4, cioè proprio
//     le prime 10 che la struttura promette verbatim. `middleStart` veniva
//     calcolato e mai usato. Risultato: i primi messaggi comparivano DUE
//     volte nel contesto (integri E riassunti), sprecando budget di righe.
//
//  2. Il buffer viene troncato con slice(-500), ma `summarizedUpToRef` era
//     un indice riferito all'array VECCHIO e non veniva riallineato: al
//     tetto, middleEnd resta fisso a 490 e l'indice non scende mai, quindi
//     "unsummarized" non tornava più ≥ 5 e il riassunto smetteva di
//     avanzare per sempre, mentre il contenuto del buffer scorreva.
//
// Questi test usano l'hook VERO via renderHook: sono stati visti rossi col
// codice difettoso (rimesso temporaneamente) e verdi con la correzione.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useConversationContext from '@/app/hooks/useConversationContext.js';

// Ogni messaggio porta un segnale unico "segnaleN" nella prima frase: così
// possiamo riconoscere ESATTAMENTE quali messaggi sono finiti nel riassunto
// (summarizeBatch mette la prima frase di ogni messaggio nel blocco).
const messaggio = (n) => ({
  sender: n % 2 === 0 ? 'Anna' : 'Boris',
  original: `Parliamo del punto segnale${n} della riunione`,
  translated: null,
  sourceLang: 'it',
  targetLang: 'en',
});

// Estrae SOLO la sezione riassunto del contesto (fra le due intestazioni),
// per non confondersi con le prime 10 mostrate integre più sopra.
function sezioneRiassunto(contesto) {
  const inizio = contesto.indexOf('--- Conversation summary ---');
  if (inizio === -1) return '';
  const fine = contesto.indexOf('--- Recent messages ---', inizio);
  return fine === -1 ? contesto.slice(inizio) : contesto.slice(inizio, fine);
}

describe('il riassunto non mangia le prime 10 (difetto 1)', () => {
  let hook;
  beforeEach(() => {
    hook = renderHook(() => useConversationContext()).result.current;
  });

  it('con 25 messaggi il primo lotto riassunto parte dal centro, non da 0', () => {
    // A 25 messaggi il centro riassumibile è 10..14 (25 - 10 recenti = 15).
    // Col difetto: batchStart = 0 → il riassunto conteneva segnale0..4.
    for (let n = 0; n < 25; n++) hook.addMessage(messaggio(n));

    const riassunto = sezioneRiassunto(hook.getContext());
    expect(riassunto, 'a 25 messaggi un riassunto deve esserci').not.toBe('');

    // Le prime 10 NON devono comparire nel riassunto…
    for (let n = 0; n < 10; n++) {
      expect(riassunto).not.toContain(`segnale${n} `);
    }
    // …il centro sì: il primo lotto è 10..14.
    expect(riassunto).toContain('segnale10 ');
  });

  it('e le prime 10 restano comunque integre in testa al contesto', () => {
    for (let n = 0; n < 25; n++) hook.addMessage(messaggio(n));

    const contesto = hook.getContext();
    const inizio = contesto.indexOf('--- Conversation start ---');
    const fine = contesto.indexOf('--- Conversation summary ---');
    const testa = contesto.slice(inizio, fine);
    for (let n = 0; n < 10; n++) {
      expect(testa).toContain(`segnale${n} `);
    }
  });

  it('i lotti successivi avanzano nel centro senza tornare indietro', () => {
    for (let n = 0; n < 32; n++) hook.addMessage(messaggio(n));
    // A 32 messaggi il centro è 10..21: lotti 10..14 e 15..19 riassunti.
    const riassunto = sezioneRiassunto(hook.getContext());
    expect(riassunto).toContain('segnale10 ');
    expect(riassunto).toContain('segnale15 ');
    expect(riassunto).not.toContain('segnale0 ');
  });
});

describe('dopo il taglio a 500 il riassunto continua ad avanzare (difetto 2)', () => {
  it('oltre il tetto i lotti nuovi coprono messaggi nuovi, non si fermano a ~490', () => {
    const hook = renderHook(() => useConversationContext()).result.current;
    // 560 messaggi: gli ultimi 60 fanno scattare il taglio a 500 sessanta
    // volte. Col difetto, summarizedUpToRef restava inchiodato a 490
    // (indice del VECCHIO array): "unsummarized" non tornava più ≥ 5 e
    // nessun lotto oltre segnale489 veniva mai riassunto.
    for (let n = 0; n < 560; n++) hook.addMessage(messaggio(n));

    const riassunto = sezioneRiassunto(hook.getContext());
    expect(riassunto, 'il riassunto deve esistere').not.toBe('');

    // Con l'indice riallineato, i blocchi più recenti coprono messaggi
    // oltre il 500: col difetto questo match era impossibile.
    expect(riassunto).toMatch(/segnale5[0-4][0-9] /);
  });

  it('resetContext azzera davvero anche il segnaposto del riassunto', () => {
    const hook = renderHook(() => useConversationContext()).result.current;
    for (let n = 0; n < 40; n++) hook.addMessage(messaggio(n));
    hook.resetContext();
    expect(hook.getMessageCount()).toBe(0);
    expect(hook.getContext()).toBeNull();

    // Dopo il reset la storia ricomincia da capo: il primo riassunto della
    // nuova conversazione parte di nuovo dal centro, non da un indice
    // residuo della conversazione precedente.
    for (let n = 0; n < 25; n++) hook.addMessage(messaggio(n));
    const riassunto = sezioneRiassunto(hook.getContext());
    expect(riassunto).toContain('segnale10 ');
    expect(riassunto).not.toContain('segnale0 ');
  });
});
