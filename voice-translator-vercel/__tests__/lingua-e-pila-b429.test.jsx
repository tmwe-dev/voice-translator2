// b.429 — due difetti dal collaudo di Luca, piu uno trovato cercandoli.
//
// 1. «quando cambio la lingua non aggiorna il testo dei tasti in home page»
// 2. «hai nascosto dietro alla pila batteria il selettore dell'inversione
//    testo, spostala»
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
// b.409, trappola numero 6: i commenti si tolgono PRIMA di guardare il
// codice, o si finisce per leggere la propria spiegazione del difetto.
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('la lingua dei menu si aggiorna davvero', () => {
  it("anche la L di page.js si sveglia quando il pacchetto arriva", () => {
    // b.256 aveva chiuso questo difetto dentro AppContext. Ma page.js ha
    // una SUA L, passata a mano a tre schermate, e non ascoltava niente:
    // mezzo difetto chiuso e mezzo lasciato aperto.
    const p = senzaCommenti(leggi('app/page.js'));
    expect(p, 'si iscrive ai pacchetti che arrivano').toMatch(/ascoltaLingueCaricate/);
    expect(p, 'e si ridisegna solo per la lingua che sta mostrando')
      .toMatch(/codice === linguaInterfaccia/);
    expect(p, 'e L rinasce quando quello cambia')
      .toMatch(/useCallback\(\(key\) => t\(linguaInterfaccia, key\), \[linguaInterfaccia, versioneLingua\]\)/);
  });

  it('la porta a senso unico ha di nuovo una maniglia dall\'altra parte', () => {
    // Scegliere la lingua dei menu a mano metteva `uiLangScelta` a vero, e
    // NESSUNO in tutta l'applicazione lo rimetteva falso: da quel momento
    // la home non poteva piu cambiare i menu, e non c'era modo di capirlo.
    const s = senzaCommenti(leggi('app/components/SettingsView.js'));
    expect(s, 'la voce «segui la lingua che parlo» esiste').toMatch(/L\('followSpokenLang'\)/);
    expect(s, 'e riporta la scelta ad automatico').toMatch(/uiLangScelta: false/);
    expect(s, 'ed e accesa proprio quando non hai scelto a mano')
      .toMatch(/attiva=\{!prefs\.uiLangScelta\}/);
  });

  it('la parola nuova c\'e in tutti e trentotto i pacchetti', async () => {
    const { readdirSync } = await import('node:fs');
    const file = readdirSync(join(process.cwd(), 'app/lib/locales')).filter((f) => f.endsWith('.js'));
    expect(file.length).toBe(38);
    for (const f of file) {
      const pacco = await import(`../app/lib/locales/${f}`);
      const o = pacco.default || Object.values(pacco)[0];
      expect(typeof o.followSpokenLang, `${f}`).toBe('string');
      expect(o.followSpokenLang.length, `${f}: vuota`).toBeGreaterThan(0);
    }
  });
});

describe('a pagina piena non galleggia niente sopra i comandi', () => {
  it('«Parla ora» dice quando e a schermo, e page.js lo ascolta', () => {
    const pp = senzaCommenti(leggi('app/components/PrimaProva.js'));
    expect(pp, "l'interruttore esiste").toMatch(/export function ascoltaPrimaProva/);
    expect(pp, 'si accende quando la pagina nasce').toMatch(/aperta = true; annuncia\(\)/);
    expect(pp, 'e si spegne quando muore').toMatch(/aperta = false; annuncia\(\)/);
    const p = senzaCommenti(leggi('app/page.js'));
    expect(p, 'page.js lo ascolta').toMatch(/ascoltaPrimaProva\(setPrimaProvaSuSchermo\)/);
    expect(p, 'e la pila si toglie').toMatch(/!primaProvaSuSchermo && !\[/);
  });

  it('la pila resta dov\'e Luca l\'ha chiesta: in alto a destra', () => {
    // Non si sposta la pila per aggiustare una schermata: la si toglie
    // dove da fastidio. Le pagine piene la nascondono gia da sempre.
    const r = senzaCommenti(leggi('app/lib/righello.js'));
    expect(r, 'la colonna di destra parte dal bordo alto').toMatch(/primo: 'max\(14px/);
    const p = senzaCommenti(leggi('app/page.js'));
    // le altre pagine piene continuano a nasconderla
    for (const vista of ['room', 'speaker', 'lobby', 'join']) {
      expect(p, `${vista} continua a nasconderla`).toMatch(new RegExp(`'${vista}'`));
    }
  });
});

describe('l\'indirizzo e la mappa, che in «Parla ora» non c\'erano', () => {
  it('i pezzi sono COPIATI da TaxiTalk, non riscritti', () => {
    // Regola di casa: cio che esiste si copia, non si reimplementa.
    const p = senzaCommenti(leggi('app/components/PrimaProva.js'));
    const tt = senzaCommenti(leggi('app/components/TaxiTalk.js'));
    // la stessa ricerca, sullo stesso servizio, con lo stesso riquadro
    for (const pezzo of ['nominatim.openstreetmap.org/search', 'format=json&limit=5&addressdetails=1',
                         'api.qrserver.com/v1/create-qr-code', 'buildMapsUrl', '<TaxiMap']) {
      expect(p, `manca in «Parla ora»: ${pezzo}`).toContain(pezzo);
      expect(tt, `e doveva venire da TaxiTalk: ${pezzo}`).toContain(pezzo);
    }
  });

  it('cambiare il testo dopo aver scelto invalida la scelta', () => {
    // b.248 — campo, mappa e QR non possono dire due cose diverse.
    const p = senzaCommenti(leggi('app/components/PrimaProva.js'));
    expect(p).toMatch(/setDove\(v\); setMeta2\(null\)/);
  });

  it('la destinazione prende il posto della lettura, non la spinge giu', () => {
    const p = senzaCommenti(leggi('app/components/PrimaProva.js'));
    expect(p, 'una cosa per volta, stesso posto')
      .toMatch(/scegliLingua \? bloccoLingue : scegliDove \? bloccoDove : bloccoLettura/);
  });

  it('non costa niente e non passa dai nostri server', () => {
    // la ricerca va su OpenStreetMap e il QR su un servizio pubblico:
    // nessuna nostra rotta, nessun credito scalato.
    const p = senzaCommenti(leggi('app/components/PrimaProva.js'));
    const dentroDove = p.slice(p.indexOf('const cercaIndirizzo'), p.indexOf('const micDisponibile'));
    expect(dentroDove, 'nessuna chiamata a casa nostra').not.toMatch(/fetch\('\/api\//);
  });
});
