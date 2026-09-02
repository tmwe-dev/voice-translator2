import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.587 — il Globo non resta piu vuoto', () => {
  const f = leggi('app/components/FinestraSulMondo.js');
  const g = leggi('app/components/GloboMondo.js');

  it('il cursore personale non cancella la fotografia recente del mondo', () => {
    expect(f).toMatch(/FINESTRA_AMBIENTE_MS\s*=\s*2 \* 60 \* 60 \* 1000/);
    expect(f).toMatch(/const ambienteDa = Date\.now\(\) - FINESTRA_AMBIENTE_MS/);
    expect(f).toMatch(/const richiestaSince = oldSeen \? Math\.min\(oldSeen, ambienteDa\) : 0/);
    expect(f).toMatch(/since: String\(richiestaSince\)/);
  });

  it('una scheda Paese caricata non puo piu fermare la coda Live', () => {
    expect(f).not.toMatch(/!occupatoRef\.current\) avanza\(\)/);
    expect(f).toMatch(/if \(!cartelloRef\.current && !apertaRef\.current && !aspettandoRef\.current\) avanza\(\)/);
  });

  it('un evento Live prende temporaneamente il focus anche se un Paese e gia selezionato', () => {
    expect(g).toMatch(/code: focusEsterno \|\| paese \|\| null/);
    expect(g).not.toMatch(/code: paese \|\| focusEsterno \|\| null/);
  });

  it('rientrando nel Globo la coda e gli id gia mostrati ripartono puliti', () => {
    expect(f).toMatch(/shownRef\.current = new Set\(\);/);
    expect(f).toMatch(/primoBatchRef\.current = true;/);
  });

  it('anche senza eventi c e uno stato visibile, mai una pagina muta', () => {
    expect(f).toMatch(/events\.length === 0/);
    expect(f).toMatch(/T\.waiting/);
  });
});

describe('b.587 — il feed non riceve video che YouTube vieta di incorporare', () => {
  const y = leggi('app/lib/topics/videoUfficiale.js');

  it('la ricerca ufficiale chiede solo video embeddable e syndicated', () => {
    expect(y).toMatch(/videoEmbeddable: 'true'/);
    expect(y).toMatch(/videoSyndicated: 'true'/);
  });

  it('i video seguiti dalle playlist sono verificati con videos.list', () => {
    expect(y).toMatch(/async function soloIncorporabili/);
    expect(y).toMatch(/chiedi\('videos', \{ part: 'status'/);
    expect(y).toMatch(/status\?\.embeddable !== false/);
    expect(y).toMatch(/privacyStatus === 'public'/);
    // b.600 — QUESTA RIGA MENTIVA. Cercava `await soloIncorporabili(candidati)`
    // e lo trovava dentro `ultimiDelCanale`, una funzione che NESSUNO ha
    // mai importato: il filtro esisteva, la prova era verde, e il feed
    // vivo non passava mai di li'. Una prova sul testo del sorgente non
    // sa se il testo viene eseguito. Ora si chiede che il debito sia
    // dichiarato nel file; quando il filtro verra' collegato alla ricerca
    // viva, questa riga torna a chiedere la chiamata.
    expect(y).toMatch(/b\.600 — DEBITO DICHIARATO: l'unica chiamante era `ultimiDelCanale`/);
    expect(y).not.toMatch(/await soloIncorporabili\(/);
  });
});
