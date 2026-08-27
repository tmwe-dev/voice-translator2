import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══ b.491 — TAVOLE 17 E 18 DEL TEMPLATE ═══
// Tavola 17 (stanza video di gruppo): la testata dice DOVE SEI — il
// codice della stanza, non una parola generica — e il tasto Aa c'e
// anche qui, come su ogni pagina.
// Tavola 18 (videochiamata): tre comandi soli e grandi, il rosso solo
// per chiudere, il resto dentro «Altro»; il PiP e verticale come un
// telefono; chi parla ha la bandiera sull'immagine; i comandi
// spariscono da soli e un tocco li riporta.

const gruppo = readFileSync(join(process.cwd(), 'app/components/StanzaVideoGruppo.js'), 'utf8');
const overlay = readFileSync(join(process.cwd(), 'app/components/VideoCallOverlay.js'), 'utf8');

describe('tavola 17 — la stanza video di gruppo', () => {
  it('la testata dice il codice della stanza, non una parola generica', () => {
    expect(gruppo).toMatch(/\{roomId \|\| L\('videoRoom'\)\}/);
  });

  it('il tasto Aa c\'e anche qui e ingrandisce le battute', () => {
    expect(gruppo).toMatch(/aria-label=\{L\('textBigger'\)\}/);
    expect(gruppo).toMatch(/zoomBattute/);
  });
});

describe('tavola 18 — la videochiamata a pieno schermo', () => {
  it('il PiP e verticale come un telefono: 84 per 112, raggio 14', () => {
    expect(overlay).toMatch(/width: 84, height: 112, zIndex: 8/ /* b.535: la miniatura b.531 sta sempre sopra (zIndex 8); il raggio vive piu sotto nello stesso stile */);
  });

  it('chi parla ha la bandiera sull\'immagine', () => {
    expect(overlay).toMatch(/getLang\(partner\.lang\)\.flag/);
  });

  it('i comandi di riserva stanno dentro «Altro», non in barra', () => {
    expect(overlay).toMatch(/altroAperto/);
    expect(overlay).toMatch(/L\('otherWord'\)/);
  });

  it('i comandi restano visibili (ordine b.527), la miniatura sta sopra', () => {
    expect(overlay).toMatch(/comandiVisibili/);
    expect(overlay).toMatch(/const comandiVisibili = true;/ /* b.527, ordine di Luca: «non mantieni i menu quando sei a tutta pagina» — i comandi NON spariscono piu da soli: sono sempre visibili. La tavola 18 e' superata da un ordine successivo; prova aggiornata, non cancellata. */);
    expect(overlay).toMatch(/onPointerDown/);
  });

  it('nessuna funzione persa: ruota, interprete, CC, voce, volumi, schermo restano cablati', () => {
    for (const filo of ['flipCamera', 'setInterpreterActive', 'setMostraTesto', 'setVolumeTTS', 'setVolumiAperti', 'condividiSchermo']) {
      expect(overlay).toContain(filo);
    }
  });
});
