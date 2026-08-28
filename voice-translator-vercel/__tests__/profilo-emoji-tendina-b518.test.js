import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { proteggiEmoji } from '../app/lib/emojiScudo.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ───────────────────────────────────────────────────────────────
// b.518 — tre difetti riprodotti DAL VIVO sulla produzione #805
// durante il giro di collaudo automatico orario. Ogni test qui
// sotto fallisce sul codice di b.517 e passa su questo.
// ───────────────────────────────────────────────────────────────

describe('b.518/1 — il profilo arriva davvero al server (POST /api/user)', () => {
  // PROVA DAL VIVO: stesso gettone, due chiamate.
  //   solo `Authorization: Bearer <t>`  -> 401 {"error":"Not authenticated"}
  //   `token` dentro il corpo           -> 200 {"user":{...}}
  // La rotta legge il gettone SOLO dal corpo nel ramo POST.
  it('la rotta POST cerca il gettone nel corpo, non nell’intestazione', () => {
    const rotta = leggi('app/api/user/route.js');
    const primaRiga = rotta.split('\n').find((r) => r.includes('await req.json()'));
    expect(primaRiga).toBeTruthy();
    expect(primaRiga).toMatch(/\btoken\b/);
  });

  it('savePrefs manda il gettone DOVE la rotta lo cerca: nel corpo', () => {
    const pagina = leggi('app/page.js');
    const chiamata = pagina.slice(pagina.indexOf("fetch('/api/user'"));
    const corpo = chiamata.slice(0, chiamata.indexOf('}).catch'));
    expect(corpo).toContain("action: 'update'");
    // il difetto: c'era solo l'intestazione
    expect(corpo).toMatch(/body: JSON\.stringify\(\{[^}]*\btoken\b/);
  });

  it('l’intestazione resta: la correzione aggiunge, non sostituisce', () => {
    const pagina = leggi('app/page.js');
    const chiamata = pagina.slice(pagina.indexOf("fetch('/api/user'"));
    expect(chiamata.slice(0, 600)).toContain('Authorization: `Bearer ${token}`');
  });
});

describe('b.518/2 — un messaggio di sole emoticon non e una domanda al modello', () => {
  // PROVA DAL VIVO: «🎉🎉🎉» it->en rispondeva 200 con
  // translated: "I'm sorry, I can't assist with that.", cached: true.
  const soloSegnaposti = (t) => {
    const { protetto, mappa } = proteggiEmoji(t);
    return mappa.length > 0 && protetto.replace(/⟦\d+⟧/g, '').trim() === '';
  };

  it('riconosce i messaggi fatti di sole emoticon', () => {
    expect(soloSegnaposti('🎉🎉🎉')).toBe(true);
    expect(soloSegnaposti('😀')).toBe(true);
    expect(soloSegnaposti('  ❤️   🔥  ')).toBe(true);
  });

  it('non tocca i messaggi che hanno anche delle parole', () => {
    expect(soloSegnaposti('ciao 🎉')).toBe(false);
    expect(soloSegnaposti('buongiorno')).toBe(false);
    expect(soloSegnaposti('123')).toBe(false);
    expect(soloSegnaposti('...')).toBe(false);
  });

  it('la scorciatoia sta PRIMA della lettura della cache (la voce avvelenata non si guarda piu)', () => {
    const rotta = leggi('app/api/translate/route.js');
    const iScorciatoia = rotta.indexOf('soloEmoji: true');
    const iCache = rotta.indexOf('const cachedTranslation = await chiestaCache');
    expect(iScorciatoia).toBeGreaterThan(0);
    expect(iCache).toBeGreaterThan(0);
    expect(iScorciatoia).toBeLessThan(iCache);
  });

  it('restituisce il testo di partenza identico, senza addebito', () => {
    const rotta = leggi('app/api/translate/route.js');
    const blocco = rotta.slice(rotta.indexOf('INIZIO b.518'), rotta.indexOf('FINE b.518'));
    expect(blocco).toContain('translated: testoOriginale');
    expect(blocco).toContain('cost: 0');
    expect(blocco).toContain('costEurCents: 0');
  });
});

describe('b.518/3 — la tendina della lingua in stanza non e piu di vetro', () => {
  // PROVA DAL VIVO: in stanza, con un messaggio dietro, la riga
  // «English (US)» era illeggibile: il testo della bolla si vedeva
  // attraverso il fondo al 6% di opacita (glassCard).
  const header = () => leggi('app/components/RoomHeader.js');

  it('il selettore lingua usa un fondo pieno, non glassCard', () => {
    const h = header();
    const i = h.indexOf('{showLangPicker && (');
    expect(i).toBeGreaterThan(0);
    const pannello = h.slice(i, i + 1600);
    expect(pannello).toContain('background:S.colors.menuBg || S.colors.bg');
    expect(pannello).not.toContain('background:S.colors.glassCard');
  });

  it('ha la stessa sfocatura gia usata dal menu «···» qui accanto', () => {
    const h = header();
    const i = h.indexOf('{showLangPicker && (');
    expect(h.slice(i, i + 1600)).toContain("backdropFilter:'blur(24px) saturate(1.1)'");
  });

  it('in tutto il file non resta nessuna tendina appoggiata su glassCard', () => {
    expect(header()).not.toContain('S.colors.glassCard');
  });
});
