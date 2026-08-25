// ═══════════════════════════════════════════════════════════════
// b.490 — TAVOLE 19 e 20 DEL TEMPLATE: il menu ⋯ e il numero di
// sicurezza.
//
// Tavola 19: «Ogni voce dice cosa fa, non solo come si chiama.» E il
// numero di sicurezza entra nel menu, col suo scopo scritto sotto
// («Controlla che nessuno ascolti»).
//
// Tavola 20: «Due schermi, lo stesso numero.» Il numero e LA COSA
// GRANDE — a gruppi, tabulare — e quando combacia lo si legge col
// pallino verde, non da un bordo.
//
// SCOSTAMENTI DICHIARATI (tavola 19):
//  - «Chi puo entrare»: non esiste oggi un controllo della politica da
//    dentro la stanza — una voce che apre il nulla e un tasto finto.
//  - «Rapporto tecnico» e «Chiudi la stanza» vivono nel pannello
//    laterale: regola 11 del template, e b.482 — un comando rosso a un
//    dito dalla chiamata e una trappola.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { t, preloadLang } from '../app/lib/i18n.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('tavola 19 — le voci del menu dicono cosa fanno', () => {
  const src = leggi('app/components/RoomHeader.js');

  it('la chiamata vocale ha la sua spiegazione', () => {
    expect(src).toMatch(/voiceCallDesc/);
  });

  it('le azioni AI hanno la loro', () => {
    expect(src).toMatch(/aiActionsDesc/);
  });

  it('il numero di sicurezza e nel menu, con lo scopo scritto sotto', () => {
    expect(src).toMatch(/securityNumberWord/);
    expect(src).toMatch(/securityNumberDesc/);
  });

  it('ma solo quando il collegamento diretto esiste: niente tasti finti', () => {
    expect(src).toMatch(/webrtc\?\.webrtcConnected && webrtc\?\.numeroSicurezza &&/);
  });

  it("e la voce apre l'overlay col componente VERO, non una copia", () => {
    expect(src).toMatch(/setMostraNumero\(true\)/);
    expect(src).toMatch(/<NumeroSicurezza numero=\{webrtc\?\.numeroSicurezza\}/);
  });
});

describe('tavola 20 — il numero e la cosa grande', () => {
  const src = leggi('app/components/NumeroSicurezza.js');

  it('ventotto punti, tabulare, va a capo senza perdere i gruppi', () => {
    expect(src).toMatch(/fontSize: 28[\s\S]{0,400}tabular-nums/);
  });

  it('e «combaciano» e uno stato che si legge, col pallino verde', () => {
    expect(src).toMatch(/verificato && \(/);
    expect(src).toMatch(/width: 8, height: 8, borderRadius: 999, background: verde/);
  });

  it('il numero arriva gia a gruppi da improntaChiavi: qui non si rifa', () => {
    const impronta = leggi('app/lib/improntaChiavi.js');
    expect(impronta).toMatch(/\.join\(' '\)/);
  });
});

describe('le chiavi nuove esistono in tutte le lingue', () => {
  it('nessuna lingua di serie B', async () => {
    const LINGUE = readdirSync(join(process.cwd(), 'app/lib/locales'))
      .filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''));
    for (const l of LINGUE) {
      await preloadLang(l);
      for (const k of ['securityNumberWord', 'securityNumberDesc', 'voiceCallDesc', 'aiActionsDesc']) {
        expect(t(l, k), `${l}/${k}`).not.toBe(k);
      }
    }
  });
});
