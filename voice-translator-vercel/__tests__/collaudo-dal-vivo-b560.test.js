// ═══════════════════════════════════════════════════════════════
// b.560 — DUE DIFETTI TROVATI APRENDO L'APPLICAZIONE VERA
//
// Luca ha chiesto un collaudo fisico e ho preso il comando del browser
// su voice-translator2.vercel.app. Le prove erano tutte verdi; questi
// due difetti erano a schermo lo stesso, e nessuna prova poteva
// vederli. Vale la pena scriverlo: un difetto che le prove non possono
// vedere si trova solo guardando.
//
// ① I TITOLI CON LE ENTITA' HTML. A schermo, in produzione:
//    «Garlasco, l&#39;intercettazione fra Stefania ed Ermanno Cappa».
//    L'API di YouTube consegna i titoli con le entita dentro. Finche' i
//    video li leggevamo dalla pagina passavano da `pulisciTestoWeb`, che
//    le scioglieva; passando alla porta ufficiale (b.553) quel
//    passaggio e' rimasto indietro. Le prove non se ne accorgevano
//    perche' i titoli finti li scriviamo noi, e le entita non ce
//    l'hanno.
//
// ② LA RICERCA LENTA E MUTA. Ho cercato «sciopero treni» dalla barra:
//    per quindici secondi non e' cambiato NIENTE — stesse diapositive,
//    nessun segnale. Avevo concluso che la ricerca fosse rotta. Era solo
//    lenta (otto-quindici secondi, misurati) e senza voce. Chi guarda
//    pensa la stessa cosa e tocca di nuovo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sciogli, daApi } from '../app/lib/topics/videoUfficiale.js';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('① i titoli si leggono, non si decifrano', () => {
  it('il caso vero, copiato dallo schermo', () => {
    expect(sciogli('Garlasco, l&#39;intercettazione fra Stefania ed Ermanno Cappa'))
      .toBe("Garlasco, l'intercettazione fra Stefania ed Ermanno Cappa");
  });

  it('e le altre entita che l API manda', () => {
    expect(sciogli('Roma &amp; Milano')).toBe('Roma & Milano');
    expect(sciogli('&quot;La Stampa&quot;')).toBe('"La Stampa"');
    expect(sciogli('&#x27;90')).toBe("'90");
  });

  it('un titolo pulito resta identico', () => {
    expect(sciogli('Le notizie del giorno')).toBe('Le notizie del giorno');
  });

  it('e passa da li anche il nome del canale', () => {
    const [v] = daApi([{ snippet: {
      title: 'L&#39;inchiesta', channelTitle: 'Rai News &amp; Co',
      resourceId: { videoId: 'abcdefghijk' },
    } }]);
    expect(v.titolo).toBe("L'inchiesta");
    expect(v.canale).toBe('Rai News & Co');
  });
});

describe('② una ricerca che dura quindici secondi deve dirlo', () => {
  const f = leggi('app/components/FeedNotizieMondo.js');

  it('a giornale gia pieno compare una fascia, non un anello a tutta pagina', () => {
    // l'anello grande vale solo quando non c'e' niente da mostrare:
    // coprire un giornale che c'e' gia sarebbe peggio del silenzio.
    expect(f).toMatch(/\{pronto && caricando && \(/);
    expect(f).toMatch(/\{!pronto && \(/);
  });

  it('la fascia non ruba tocchi e si fa leggere dai lettori di schermo', () => {
    const i = f.indexOf('{pronto && caricando && (');
    const blocco = f.slice(i, i + 1200);
    expect(blocco).toMatch(/aria-live="polite"/);
    expect(blocco).toMatch(/pointerEvents: 'none'/);
    expect(blocco, 'e gira, cosi si vede che sta lavorando').toMatch(/animation: 'vtGira/);
  });

  it('e il feed riceve davvero il segnale della ricerca in corso', () => {
    expect(leggi('app/components/MondoNews.js')).toMatch(/caricando=\{cercando\}/);
  });
});
