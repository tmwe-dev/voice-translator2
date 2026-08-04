// ═══════════════════════════════════════════════════════════════
// GUARDIA SUL LISTINO
//
// Nato da un bug vero: /landing vendeva "Pro €9,90/mese" e i file di
// lingua dicevano "€14,99/mese e 500 crediti", mentre il prodotto
// reale erano ricariche prepagate. Tre listini, nessuno giusto.
//
// Questo test fallisce se la pagina pubblica torna a scrivere prezzi
// a mano invece di leggerli da wallet/tariffe.js.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PACCHETTI, BONUS_BENVENUTO_SECONDI, MOLTIPLICATORE_PREMIUM } from '../app/wallet/tariffe.js';

const RADICE = path.join(__dirname, '..');
const landing = fs.readFileSync(path.join(RADICE, 'app/landing/page.js'), 'utf8');

const LINGUE = ['it','en','es','fr','de','pt','ru','zh','ja','ko','ar','hi','th','tr','vi'];
function chiavi(lingua) {
  const s = fs.readFileSync(path.join(RADICE, `app/lib/locales/${lingua}.js`), 'utf8');
  return JSON.parse(s.slice(s.indexOf('= {') + 2, s.lastIndexOf('};') + 1));
}

describe('listino pubblico', () => {
  it('la pagina prende i prezzi da tariffe.js, non li scrive a mano', () => {
    expect(landing).toContain("from '../wallet/tariffe.js'");
    expect(landing).toContain('PACCHETTI.map');
  });

  it('nessun prezzo scritto a mano nella pagina', () => {
    // Cerca importi in euro fissi nel sorgente (es. "9.90", "'14,99'").
    const importiFissi = landing.match(/['"]\d+[.,]\d{2}['"]/g) || [];
    expect(importiFissi).toEqual([]);
  });

  it('non parla più di abbonamenti mensili', () => {
    for (const parola of ['landingPerMonth', 'landingPlanPro', 'billingPeriod', 'landingBillingYearly']) {
      expect(landing).not.toContain(parola);
    }
  });

  it('i pacchetti reali sono tre e hanno tutti un nome tradotto', () => {
    expect(PACCHETTI).toHaveLength(3);
    for (const p of PACCHETTI) {
      expect(landing).toContain(p.id);
    }
  });

  it('il bonus di benvenuto annunciato è quello vero', () => {
    expect(BONUS_BENVENUTO_SECONDI).toBe(30 * 60);
    for (const lingua of ['it', 'en']) {
      expect(chiavi(lingua).landingGiftBanner).toMatch(/30/);
    }
  });

  it('il moltiplicatore premium dichiarato nelle FAQ è quello vero', () => {
    expect(MOLTIPLICATORE_PREMIUM).toBe(3);
    expect(chiavi('it').landingFaq4A).toMatch(/triplo/i);
    expect(chiavi('en').landingFaq4A).toMatch(/three times/i);
  });
});

describe('file di lingua', () => {
  it('nessuna lingua conserva le chiavi degli abbonamenti inesistenti', () => {
    const morte = ['landingPlanFree','landingPlanPro','landingPlanBusiness','landingPerMonth',
      'landingProF1','landingBizF1','landingFreeF1','landingBillingMonthly','landingSave20'];
    for (const lingua of LINGUE) {
      const k = chiavi(lingua);
      for (const m of morte) expect(k[m], `${lingua}.${m}`).toBeUndefined();
    }
  });

  it('tutte e 15 le lingue hanno le chiavi del listino vero', () => {
    const richieste = ['landingPlansTitle','landingPlansSub','landingGiftBanner','landingOfTalk',
      'landingWithPremium','landingNoExpiry','landingNoSubscription','landingOwnKeysFree',
      'landingRecharge','landingPackStart','landingPackTravel','landingPackWorld',
      'landingStatLangs','landingStatGift','landingStatNoSub','landingStatLatency'];
    for (const lingua of LINGUE) {
      const k = chiavi(lingua);
      for (const r of richieste) expect(k[r], `${lingua}.${r}`).toBeTruthy();
    }
  });
});
