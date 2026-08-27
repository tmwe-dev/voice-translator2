import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COMPAGNI_PREDEFINITI, MODELLI, getCompagnoPredefinito } from '../app/lib/compagni/catalogo.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.528 — Luca: «le icone e le gif animate le hai raccolte? sono
// connessi albert etc?? l'utente e in grado attraverso la sidebar di
// vedere e modificare il setting??»

describe('b.528 — il cast di RadioChat e connesso', () => {
  it('Albert, Pitagora e Newton esistono fra i predefiniti', () => {
    for (const id of ['albert', 'pitagora', 'newton']) {
      const c = getCompagnoPredefinito(id);
      expect(c, id).toBeTruthy();
      expect(c.predefinito).toBe(true);
      expect(c.personalita.length).toBeGreaterThan(100);
      expect(c.regolaDibattito.length).toBeGreaterThan(30);
    }
  });
  it('ognuno sulla SUA mente, come in RadioChat', () => {
    expect(getCompagnoPredefinito('albert').provider).toBe('openai');
    expect(getCompagnoPredefinito('albert').modello).toBe('gpt-4o');
    expect(getCompagnoPredefinito('pitagora').provider).toBe('gemini');
    // b.534 — ordine di Luca: Grok disattivato, la quarta mente e Qwen
    // (Alibaba/DashScope, gia in casa per la traduzione asiatica).
    expect(getCompagnoPredefinito('newton').provider).toBe('qwen');
    expect(getCompagnoPredefinito('archimede').provider).toBe('anthropic');
  });
  it('ognuno con la SUA voce originale di RadioChat', () => {
    expect(getCompagnoPredefinito('albert').voce.id).toBe('pNInz6obpgDQGcFmaJgB');
    expect(getCompagnoPredefinito('pitagora').voce.id).toBe('VR6AewLTigWG4xSOukaG');
    expect(getCompagnoPredefinito('newton').voce.id).toBe('onwK4e9ZLuTAKqWW03F9');
  });
  it('ritratti e GIF del parlato: dichiarati E presenti su disco', () => {
    for (const id of ['albert', 'pitagora', 'newton', 'archimede']) {
      const c = getCompagnoPredefinito(id);
      expect(c.avatar, id).toBe(`/compagni/${id}.png`);
      expect(c.avatarParla, id).toBe(`/compagni/${id}-parla.gif`);
      expect(existsSync(join(process.cwd(), 'public', c.avatar)), c.avatar).toBe(true);
      expect(existsSync(join(process.cwd(), 'public', c.avatarParla)), c.avatarParla).toBe(true);
    }
  });
});

describe('b.528 — vedere e scegliere la mente dalla sidebar', () => {
  it('la tendina dei modelli copre TUTTI i modelli usati dai predefiniti', () => {
    const offerti = new Set(MODELLI.map((m) => m.modello));
    for (const c of COMPAGNI_PREDEFINITI) {
      expect(offerti.has(c.modello), `${c.nome} usa ${c.modello}`).toBe(true);
    }
  });
  it('la lista dei Compagni mostra la mente di ognuno', () => {
    const f = leggi('app/components/Life/GestioneCompagni.js');
    expect(f).toMatch(/MODELLI\.find\(\(m\) => m\.modello === c\.modello\)/);
  });
  it('nel podcast chi parla anima il suo ritratto (GIF), gli altri fermi', () => {
    const f = leggi('app/components/Life/LifeView.js');
    expect(f).toMatch(/i === attuale \? \(chi\?\.avatarParla \|\| chi\?\.avatar\) : chi\?\.avatar/);
  });
});
