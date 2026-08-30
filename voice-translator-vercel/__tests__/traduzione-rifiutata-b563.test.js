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
// LA CAUSA. I pezzi dell'applicazione che NON SANNO in che lingua sia
// il testo mandano `sourceLang: 'auto'`: e' esattamente il caso in cui
// si chiede alla macchina di riconoscerla. Il controllo originario
// voleva due o tre lettere (`^[a-z]{2,3}...`) e «auto» ne ha quattro.
//
// b.581 — l'interprete video adesso e' un caso migliore: la rotta dei
// sottotitoli ci restituisce anche la lingua realmente trovata. Quando
// c'e', la usiamo; quando manca, il ripiego resta `auto`. Non torniamo
// quindi al difetto b.563 e non paghiamo un rilevamento lingua inutile.
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

describe('chi non conosce la lingua manda auto; chi la conosce la dichiara', () => {
  it('i titoli del feed continuano a usare auto', () => {
    expect(leggi('app/components/MondoNews.js')).toMatch(/sourceLang: 'auto', targetLang: mia/);
  });

  it('l interprete video usa la lingua dei sottotitoli e ripiega su auto', () => {
    const i = leggi('app/components/ui/InterpreteVideo.js');
    expect(i).toMatch(/const sorgente = linguaSottotitoli\.current/);
    expect(i).toMatch(/const sourceLang = sorgente \|\| 'auto'/);
    expect(i).toMatch(/sourceLang,/);
  });

  it('e il tassista usa auto nei suoi due punti', () => {
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
