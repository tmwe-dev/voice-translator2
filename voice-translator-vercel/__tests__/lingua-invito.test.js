// ═══════════════════════════════════════════════════════════════
// LA LINGUA DELL'INVITO CHE NON ARRIVAVA (b.115)
//
// Segnalato cosi: "non va piu la chat, non viene passata la lingua
// nell'invito". Sono la stessa cosa, e la catena e questa:
//
//   1. il modulo di invito ha un selettore "Lingua dell'invitato";
//   2. la scelta finisce nel link come `?lang=en`;
//   3. all'ingresso, il blocco dell'ingresso automatico calcolava la
//      lingua dell'ospite guardando `gl=`, le preferenze salvate e la
//      lingua del browser — MA NON `lang=`;
//   4. quel blocco gira per ULTIMO e sovrascrive gli altri (lo dice il
//      commento che ci avevo messo io in b.98, vantandosene);
//   5. l'ospite entrava quindi in italiano, come l'host;
//   6. italiano verso italiano: NIENTE DA TRADURRE.
//
// Chi provava vedeva i messaggi arrivare non tradotti e concludeva che
// la chat fosse rotta. La chat funzionava benissimo: era la traduzione
// a non avere piu due lingue diverse fra cui lavorare.
//
// La lezione: un difetto nella LINGUA si presenta come un difetto nella
// CHAT. Il sintomo che uno riferisce non e quasi mai il posto in cui
// guardare.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LANGS } from '../app/lib/constants.js';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// La stessa scelta che fa il programma, isolata per poterla provare.
const linguaValida = (c) => !!c && !!LANGS.find((l) => l.code === c);
const scegliLingua = ({ gl, lang, salvata, browser }) =>
  (linguaValida(gl) && gl)
  || (linguaValida(lang) && lang)
  || (linguaValida(salvata) && salvata)
  || (linguaValida(browser) ? browser : 'en');

describe('chi apre un invito entra nella lingua scelta da chi invita', () => {
  it('`lang=` vince sulla lingua del browser', () => {
    // E il caso vero e proprio: telefono italiano, invito in inglese.
    expect(scegliLingua({ lang: 'en', browser: 'it' })).toBe('en');
  });

  it('`lang=` vince sulle preferenze salvate', () => {
    // Chi e gia stato qui in italiano, invitato in spagnolo, entra in
    // spagnolo: chi invita sa in che lingua si parlera.
    expect(scegliLingua({ lang: 'es', salvata: 'it', browser: 'it' })).toBe('es');
  });

  it('`gl=` (il QR) vince su `lang=`', () => {
    // Il QR e piu specifico: contiene le scelte fatte per QUELLA persona.
    expect(scegliLingua({ gl: 'fr', lang: 'en', browser: 'it' })).toBe('fr');
  });

  it('senza indicazioni si ripiega sul browser, poi sull\'inglese', () => {
    expect(scegliLingua({ browser: 'it' })).toBe('it');
    expect(scegliLingua({ browser: 'klingon' })).toBe('en');
    expect(scegliLingua({})).toBe('en');
  });

  it('una lingua inventata non passa e non blocca', () => {
    // Un parametro sbagliato non deve far entrare in una lingua che non
    // esiste: si scende al livello dopo.
    expect(scegliLingua({ lang: 'zz', salvata: 'it' })).toBe('it');
    expect(scegliLingua({ gl: 'xx', lang: 'de', browser: 'it' })).toBe('de');
  });
});

describe('host e ospite non devono ritrovarsi nella stessa lingua', () => {
  it('il caso che si e visto dal vivo: due bandiere italiane', () => {
    // Host italiano, invito in inglese, telefono dell'ospite italiano.
    // Prima l'ospite finiva in italiano e la traduzione non aveva piu
    // niente da fare.
    const host = 'it';
    const ospite = scegliLingua({ lang: 'en', browser: 'it' });
    expect(ospite).not.toBe(host);
  });
});

describe('e collegato al codice vivo', () => {
  it('il calcolo della lingua ospite guarda `lang=`', () => {
    const i = senzaCommenti(app('hooks/useInitializeApp.js'));
    expect(i, 'langParam deve entrare nella scelta').toMatch(/linguaValida\(langParam\) && langParam/);
  });

  it('l\'ordine di priorita e quello giusto', () => {
    const i = senzaCommenti(app('hooks/useInitializeApp.js'));
    const p = i.indexOf('linguaOspite =');
    const blocco = i.slice(p, p + 350);
    const posGl = blocco.indexOf('guestLangParam');
    const posLang = blocco.indexOf('langParam) && langParam');
    const posSalv = blocco.indexOf('p?.lang');
    const posBrowser = blocco.indexOf('linguaBrowser');
    expect(posGl).toBeGreaterThan(-1);
    expect(posLang).toBeGreaterThan(posGl);
    expect(posSalv).toBeGreaterThan(posLang);
    expect(posBrowser).toBeGreaterThan(posSalv);
  });

  it('il link di invito porta davvero la lingua scelta', () => {
    expect(app('page.js')).toMatch(/\?room=\$\{roomPolling\.roomId\}&lang=\$\{inviteLang\}/);
  });

  it('il selettore che la sceglie usa i codici veri di LANGS', () => {
    // Se il selettore offrisse codici diversi da quelli di LANGS, il
    // filtro li scarterebbe tutti in silenzio.
    expect(app('components/LobbyView.js'))
      .toMatch(/LANGS\.map\(l => \(\{ id: l\.code, label: l\.name, icona: l\.flag \}\)\)/ /* b.535: da <option> a opzioni di TendinaVetro — stessi codici veri di LANGS */);
  });

  it('il commento fuorviante e stato corretto', () => {
    // Diceva "host's language, for invite message display only": e cio
    // che ha portato a ignorarlo scrivendo l'ingresso automatico.
    expect(app('hooks/useInitializeApp.js'))
      .not.toMatch(/host's language \(for invite message display only\)/);
  });
});
