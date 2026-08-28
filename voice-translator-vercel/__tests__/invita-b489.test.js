// ═══════════════════════════════════════════════════════════════
// b.489 — TAVOLA 16 DEL TEMPLATE: invita una persona.
//
// «Un link, e i modi per mandarlo. Niente altro su cui pensare.»
//
//  1. IL LINK SI VEDE PER INTERO prima di mandarlo: nessuno manda una
//     cosa che non ha letto. Prima la pagina mostrava un QR senza mai
//     dire a cosa portasse.
//  2. I canali per nome: WhatsApp, SMS, Email — nomi propri, non si
//     traducono. Il testo dentro parte NELLA LINGUA DI CHI LEGGERA'.
//  3. La lingua dell'invito e una scelta esplicita, etichettata «In che
//     lingua lo leggera» (le 44 lingue stanno in tendina: e la forma
//     del kit per una scelta lunga, le pillole della tavola erano due
//     lingue d'esempio).
//  4. Via i gradienti da titolo e codice: colore scritto a mano
//     (regola 06), decorazione che rendeva la testata diversa da tutte
//     le altre senza dire niente.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { t, preloadLang } from '../app/lib/i18n.js';

const src = readFileSync(join(process.cwd(), 'app/components/QuickInvite.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('tavola 16 — il link si legge prima di partire', () => {
  it('il link intero e a schermo, con la copia accanto', () => {
    expect(src).toMatch(/\{getUrl\(\)\}<\/span>/);
    expect(src).toMatch(/onClick=\{copyLink\}/);
  });

  it('e sopra si dice cosa succede a chi lo apre', () => {
    expect(src).toMatch(/inviteExplain/);
  });
});

describe('tavola 16 — i canali, per nome', () => {
  it('WhatsApp, SMS ed Email ci sono tutti e tre', () => {
    expect(src).toMatch(/wa\.me\/\?text=/);
    expect(src).toMatch(/sms:\?&body=/);
    expect(src).toMatch(/mailto:\?subject=BarTalk/);
  });

  it('il testo parte nella lingua di chi lo leggera, non nella mia', () => {
    expect(src).toMatch(/t\(mapLang\(guestLang\), 'inviteText'\)/);
    expect(src, 'e il pacchetto si scalda quando si sceglie la lingua')
      .toMatch(/preloadLang\(mapLang\(guestLang\)\)/);
  });

  it('e la scelta della lingua e etichettata per quello che e', () => {
    expect(src).toMatch(/inviteReadLang/);
  });
});

describe('tavola 16 — niente colori scritti a mano', () => {
  it('il titolo e il codice sono testo pieno, senza gradiente', () => {
    const daTitolo = src.indexOf("L('inviteShort')");
    const zona = src.slice(daTitolo - 600, daTitolo);
    expect(zona).not.toMatch(/linear-gradient/);
    const daCodice = src.indexOf('{createdRoomId}\n            </div>');
    expect(src.slice(daCodice - 500, daCodice)).not.toMatch(/WebkitBackgroundClip/);
  });
});

describe("b.490 — l'invito e raggiungibile dal logo", () => {
  // Ordine di Luca (25/08): «viene attivato dal logo». Col ridisegno
  // della Home la voce «Invita una persona» era sparita e QuickInvite —
  // rifatta sulla tavola 16 — era una pagina ORFANA: nessun punto
  // dell'interfaccia la apriva piu. Ora il marchio in testata la apre.
  it('il marchio BarTalk apre QuickInvite', () => {
    const home = readFileSync(join(process.cwd(), 'app/components/HomeView.js'), 'utf8');
    expect(home).toMatch(/onClick=\{\(\) => \{ vibrate\(\); setView\('quickinvite'\); \}\}/);
  });

  it("e il marchio dice cos'e a chi non vede", () => {
    const home = readFileSync(join(process.cwd(), 'app/components/HomeView.js'), 'utf8');
    expect(home).toMatch(/aria-label=\{L\('optInviteTitle'\)\}[\s\S]{0,600}Bar<span/);
  });
});

describe('le chiavi nuove esistono in tutte le lingue', () => {
  it('nessuna lingua di serie B', async () => {
    const LINGUE = readdirSync(join(process.cwd(), 'app/lib/locales'))
      .filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''));
    for (const l of LINGUE) {
      await preloadLang(l);
      for (const k of ['inviteExplain', 'inviteReadLang', 'optInviteTitle']) {
        expect(t(l, k), `${l}/${k}`).not.toBe(k);
      }
    }
    // b.552 — questa prova apre a uno a uno TUTTI e 38 i pacchetti di
    // lingua: mezzo megabyte di traduzioni. Sul portatile mentre lavora
    // i cinque secondi di prammatica non bastano, e un rosso per
    // stanchezza della macchina e' peggio di nessun rosso.
  }, 30000);
});
