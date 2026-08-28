// ═══════════════════════════════════════════════════════════════
// b.567 — IL CONTRATTO FRA CHI CHIAMA E CHI CONTROLLA
//
// Nasce da un difetto vero e costoso (b.563): quattro pezzi
// dell'applicazione mandavano `sourceLang: 'auto'` a /api/translate, e
// il controllo lo rifiutava perche' voleva due o tre lettere. **1.273
// traduzioni rifiutate in sei ore**, per settimane, con tutte le prove
// verdi.
//
// PERCHE' NESSUNA PROVA SE N'ERA ACCORTA: le prove del componente
// controllavano che il componente chiamasse; le prove della rotta
// controllavano che la rotta validasse. Nessuna metteva le due cose
// nella stessa stanza. Il difetto viveva ESATTAMENTE nello spazio fra
// due prove verdi.
//
// QUESTA PROVA CHIUDE QUELLO SPAZIO: prende i corpi delle richieste
// scritti nei componenti veri e li fa passare dal validatore vero. Se
// domani qualcuno manda un campo che la rotta non accetta, si scopre
// qui e non fra sei settimane guardando i registri.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateTranslateInput } from '../app/lib/schemas.js';

const APP = path.join(__dirname, '..', 'app');

function tuttiIFile(dir) {
  const fuori = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuori.push(...tuttiIFile(p));
    else if (/\.jsx?$/.test(e.name)) fuori.push(p);
  }
  return fuori;
}

/**
 * I corpi mandati a /api/translate, letti dal codice vero.
 * Si guardano solo i valori LETTERALI (`sourceLang: 'auto'`): quelli
 * calcolati a runtime non si possono conoscere da fermi, e fingere di
 * saperli sarebbe peggio che ammettere il limite.
 */
function chiamateATranslate() {
  const fuori = [];
  for (const f of tuttiIFile(APP)) {
    const s = fs.readFileSync(f, 'utf8');
    if (!s.includes("'/api/translate'")) continue;
    for (const m of s.matchAll(/JSON\.stringify\(\{([^}]{0,400})\}\)/g)) {
      const corpo = m[1];
      if (!/sourceLang|targetLang/.test(corpo)) continue;
      const campi = {};
      for (const c of corpo.matchAll(/(\w+)\s*:\s*'([^']*)'/g)) campi[c[1]] = c[2];
      fuori.push({ file: path.relative(APP, f), campi, corpo: corpo.replace(/\s+/g, ' ').slice(0, 90) });
    }
  }
  return fuori;
}

describe('chi chiama /api/translate parla la lingua della rotta', () => {
  const chiamate = chiamateATranslate();

  it('le chiamate si trovano davvero: se un giorno sparissero, questa prova diventerebbe verde per finta', () => {
    expect(chiamate.length).toBeGreaterThanOrEqual(3);
  });

  it('ogni lingua di partenza scritta a mano e accettata dal validatore', () => {
    const rifiutate = [];
    for (const c of chiamate) {
      if (!c.campi.sourceLang) continue;   // calcolata a runtime: non si puo sapere da qui
      const esito = validateTranslateInput({ text: 'prova', sourceLang: c.campi.sourceLang, targetLang: 'en' });
      if (!esito.valid) rifiutate.push(`${c.file}: sourceLang '${c.campi.sourceLang}' → ${esito.error}`);
    }
    expect(rifiutate, `queste chiamate verrebbero rifiutate in produzione:\n  ${rifiutate.join('\n  ')}`).toEqual([]);
  });

  it('e ogni lingua di arrivo scritta a mano pure', () => {
    const rifiutate = [];
    for (const c of chiamate) {
      if (!c.campi.targetLang) continue;
      const esito = validateTranslateInput({ text: 'prova', sourceLang: 'it', targetLang: c.campi.targetLang });
      if (!esito.valid) rifiutate.push(`${c.file}: targetLang '${c.campi.targetLang}' → ${esito.error}`);
    }
    expect(rifiutate, rifiutate.join('\n  ')).toEqual([]);
  });

  it('IL CASO VERO di b.563, riprodotto: «auto» deve passare', () => {
    // se qualcuno domani stringesse di nuovo la regola, questa riga
    // diventerebbe rossa prima del deploy invece che dopo sei settimane.
    const conAuto = chiamate.filter((c) => c.campi.sourceLang === 'auto');
    expect(conAuto.length, 'i pezzi che non sanno la lingua di partenza esistono ancora').toBeGreaterThanOrEqual(3);
    expect(validateTranslateInput({ text: 'x', sourceLang: 'auto', targetLang: 'en' }).valid).toBe(true);
  });
});
