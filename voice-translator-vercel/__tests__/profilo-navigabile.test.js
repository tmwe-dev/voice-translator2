// ═══════════════════════════════════════════════════════════════
// GUARDIA SULLA SEZIONE PROFILO
//
// Nata da un collaudo dal vivo: entrando da Impostazioni, 4 pagine su 8
// riportavano alla Home invece che alle Impostazioni, una (AI Hub) non
// aveva NESSUN modo di uscire, e due mostravano uno schermo vuoto mentre
// caricavano — che sembrava una pagina che non si apre.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const pageSrc = leggi('page.js');

// Le pagine raggiungibili da Impostazioni.
const PAGINE = ['HelpView', 'ApiKeysView', 'ContactsView', 'VoiceTestView',
  'VoiceCloneView', 'CreditsView', 'AIView'];

describe('sezione profilo', () => {
  it('ogni pagina interna sa tornare alle Impostazioni', () => {
    const senzaRitorno = PAGINE.filter(nome => {
      const src = leggi(`components/${nome}.js`);
      return !src.includes("setView('settings')");
    });
    expect(senzaRitorno, `Queste non tornano a Impostazioni:\n  ${senzaRitorno.join('\n  ')}`).toEqual([]);
  });

  it('nessuna pagina interna scarica l\'utente sulla Home', () => {
    const colpevoli = PAGINE.filter(nome => leggi(`components/${nome}.js`).includes("setView('home')"));
    expect(colpevoli, `Si entra da Impostazioni, si deve tornare li:\n  ${colpevoli.join('\n  ')}`).toEqual([]);
  });

  it('nessuna vista mostra uno schermo vuoto mentre carica', () => {
    // Le pagine intere devono avere un indicatore. I pannelli a comparsa
    // (CreateRoomSheet) possono restare invisibili: non sono pagine.
    const vuoti = [...pageSrc.matchAll(/<Suspense fallback=\{null\}>\s*\n\s*<(\w+)/g)].map(m => m[1]);
    const pannelli = ['CreateRoomSheet', 'NewConversationSheet', 'TaxiDestinationPanel'];
    const pagineVuote = vuoti.filter(v => !pannelli.includes(v));
    expect(pagineVuote, `Usa <LazyFallback /> per queste:\n  ${pagineVuote.join('\n  ')}`).toEqual([]);
  });

  it('il glossario si salva E arriva alle traduzioni', () => {
    // b.95 — prima bastava che AIView scrivesse su localStorage. Non
    // basta piu: un glossario che nessuna traduzione legge e inutile.
    const modulo = leggi('lib/glossario.js');
    expect(modulo, 'il modulo deve salvare').toMatch(/localStorage\.setItem/);
    expect(leggi('components/AIView.js'), 'la pagina deve usare il modulo').toMatch(/salvaGlossario/);
    expect(leggi('api/translate/route.js'), 'la rotta deve accettarlo').toMatch(/glossario/);
    expect(leggi('lib/translatePrompt.js'), 'e deve finire nel prompt').toMatch(/GLOSSARY/);
    expect(leggi('components/SpeakerView.js'), 'il client deve mandarlo').toMatch(/glossarioPerTesto/);
  });

  it('un solo indirizzo di assistenza in tutta l\'app', () => {
    const impostazioni = leggi('components/SettingsView.js');
    expect(impostazioni, 'niente indirizzi scritti a mano').not.toMatch(/mailto:[a-z@.]+\?/);
    expect(impostazioni).toMatch(/EMAIL_ASSISTENZA/);
  });

  it('si possono provare le voci anche senza chiave ElevenLabs', () => {
    const src = leggi('components/VoiceTestView.js');
    expect(src, 'la pagina "Prova le voci" deve provare anche la voce gratuita').toMatch(/tts-edge/);
  });
});
