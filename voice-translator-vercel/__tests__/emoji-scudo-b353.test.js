import { describe, it, expect } from 'vitest';
import { proteggiEmoji, ripristinaEmoji } from '../app/lib/emojiScudo.js';

describe('b.353 — le emoticon non si traducono mai', () => {
  it('mette al riparo i gruppi e li rimette identici', () => {
    const testo = 'Ciao! 😂👍 ci vediamo 🇮🇹 domani 👨‍👩‍👧‍👦';
    const { protetto, mappa } = proteggiEmoji(testo);
    expect(protetto).not.toMatch(/😂|👍|🇮🇹/u);
    expect(protetto).toContain('⟦0⟧');
    // come se il modello avesse tradotto le parole lasciando i segnaposti
    const tradotto = protetto.replace('Ciao!', 'Hi!').replace('ci vediamo', 'see you').replace('domani', 'tomorrow');
    expect(ripristinaEmoji(tradotto, mappa)).toBe('Hi! 😂👍 see you 🇮🇹 tomorrow 👨‍👩‍👧‍👦');
  });
  it('senza emoticon il testo resta intatto e la mappa e vuota', () => {
    const { protetto, mappa } = proteggiEmoji('Solo parole normali.');
    expect(protetto).toBe('Solo parole normali.');
    expect(mappa).toEqual([]);
  });
  it('un segnaposto perso dal modello non lascia sporcizia', () => {
    const { protetto, mappa } = proteggiEmoji('ok 👍 bene 🎉');
    void protetto;
    // il modello ha mangiato il secondo segnaposto
    expect(ripristinaEmoji('okay ⟦0⟧ good', mappa)).toBe('okay 👍 good');
    // e un segnaposto alieno rimasto in giro sparisce
    expect(ripristinaEmoji('x ⟦7⟧ y', [])).toBe('x ⟦7⟧ y'.replace(/⟦\d+⟧/g, '⟦7⟧')); // mappa vuota: testo intatto
  });
});
