// ═══════════════════════════════════════════════════════════════
// b.563 — MILLEDUECENTO TRADUZIONI RIFIUTATE IN SEI ORE
//
// Trovato scavando nei registri di produzione, dopo aver visto che il
// 21% delle richieste rispondeva 400. Erano TUTTE la stessa rotta e
// tutte lo stesso errore:
//
//     POST /api/translate  →  400
//     {"code":"INVALID_INPUT","message":"Invalid fields: sourceLang"}
//
// LA CAUSA. Quattro pezzi dell'applicazione mandano
// `sourceLang: 'auto'` — i titoli del feed, i sottotitoli
// dell'interprete video, e due punti del tassista — perche' NON SANNO
// in che lingua sia il testo: e' esattamente il caso in cui si chiede
// alla macchina di riconoscerla. Ma il controllo voleva due o tre
// lettere (`^[a-z]{2,3}...`) e «auto» ne ha quattro. Rifiutate tutte,
// in silenzio, dal giorno in cui il controllo e' stato scritto.
//
// COSA SPIEGA. Il collaudo di Luca «i testi non vengono tradotti anche
// se il setting dice di farlo»: in b.548 avevo riparato l'aggancio —
// e l'aggancio era giusto — ma la chiamata non e' MAI passata dalla
// porta. E spiega anche perche' i sottotitoli tradotti del video non si
// vedevano mai.
//
// LEZIONE: un errore 400 non e' rumore. Sono le nostre richieste, fatte
// male da noi, e nessuno le guardava perche' «400» sembra colpa di chi
// chiama — e chi chiama eravamo noi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateTranslateInput } from '../app/lib/schemas.js';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const base = { text: 'Ciao mondo', targetLang: 'en' };

describe('«auto» e una lingua di partenza legittima', () => {
  it('il caso vero, quello rifiutato 1.273 volte', () => {
    const esito = validateTranslateInput({ ...base, sourceLang: 'auto' });
    expect(esito.valid, esito.error).toBe(true);
    expect(esito.data.sourceLang).toBe('auto');
  });

  it('e le lingue vere continuano a passare come prima', () => {
    expect(validateTranslateInput({ ...base, sourceLang: 'it' }).valid).toBe(true);
    expect(validateTranslateInput({ ...base, sourceLang: 'zh-TW' }).valid).toBe(true);
  });

  it('la roba storta resta storta', () => {
    expect(validateTranslateInput({ ...base, sourceLang: 'italiano' }).valid).toBe(false);
    expect(validateTranslateInput({ ...base, sourceLang: '' }).valid).toBe(false);
    expect(validateTranslateInput({ ...base, sourceLang: 123 }).valid).toBe(false);
  });

  it('ma «auto» in ARRIVO no: verso dove?', () => {
    // tradurre «verso auto» non vuol dire niente, e accettarlo
    // significherebbe mandare al modello un compito impossibile.
    expect(validateTranslateInput({ text: 'x', sourceLang: 'it', targetLang: 'auto' }).valid).toBe(false);
  });
});

describe('chi manda «auto», e sono quattro', () => {
  it('i titoli del feed', () => {
    expect(leggi('app/components/MondoNews.js')).toMatch(/sourceLang: 'auto', targetLang: mia/);
  });
  it('i sottotitoli dell interprete video', () => {
    expect(leggi('app/components/ui/InterpreteVideo.js')).toMatch(/sourceLang: 'auto'/);
  });
  it('e il tassista, in due punti', () => {
    expect((leggi('app/components/TaxiDriverView.js').match(/sourceLang: 'auto'/g) || [])).toHaveLength(2);
  });
});

describe('e la rotta sa cosa farne', () => {
  it('non chiede al modello di tradurre «da auto»', () => {
    const r = leggi('app/api/translate/route.js');
    expect(r).toMatch(/const nomePartenza = sourceLang === 'auto'/);
    expect(r).toMatch(/detect it yourself/);
    expect(r, 'e il prompt riceve il nome vero, non la sigla').toMatch(/sourceLangName: nomePartenza/);
  });
});
