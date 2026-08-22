// b.397 — LA PORTA DEL GLOBO, primo pezzo: il Paese smette di essere
// indovinato dalla lingua, e i numeri della vetrina smettono di essere
// quelli della nascita.
//
// Dal documento di Luca: "Non stai filtrando le News per Paese. Stai
// entrando in quel Paese." E, sui numeri: "Mai inventare percentuali o
// consenso." Queste prove difendono la seconda frase quanto la prima.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('il Paese viaggia con la stanza, dalla nascita al setaccio', () => {
  it('il telefono manda il Paese che la persona ha gia scelto', () => {
    const p = leggi('app/page.js');
    expect(p, 'senza chiedere niente di nuovo').toMatch(/paese: prefs\.country \|\| ''/);
  });

  it('la rotta lo accetta e lo scrive nella voce di vetrina', () => {
    const r = leggi('app/api/mondo/route.js');
    expect(r, 'lo legge dal corpo').toMatch(/hot, paese,/);
    expect(r, 'e lo mette nella voce').toMatch(/paese: \/\^\[A-Za-z\]\{2\}\$\/\.test/);
  });

  it('due lettere o niente: non si inventa un posto', () => {
    const regola = /^[A-Za-z]{2}$/;
    const passa = (x) => (regola.test(String(x || '')) ? String(x).toUpperCase() : '');
    expect(passa('it')).toBe('IT');
    expect(passa('MX')).toBe('MX');
    expect(passa(''), 'chi non lo sa resta senza').toBe('');
    expect(passa('ITA'), 'tre lettere non sono un paese').toBe('');
    expect(passa('<script>'), 'e nemmeno questo').toBe('');
    expect(passa(null)).toBe('');
  });

  it('il setaccio preferisce il Paese vero e ripiega sulla lingua solo per le vecchie', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/r\.paese \? r\.paese === paeseScelto :/);
    expect(v, 'e il ripiego resta la lingua di casa').toMatch(/linguaDiLa \? r\.lang === linguaDiLa : true/);
    expect(v, 'e il setaccio si rifa quando cambia il Paese').toMatch(/\[rooms, langFilter, modeFilter, search, paeseScelto\]/);
  });

  it('la regola in una riga: col Paese vero, il Messico non finisce in Spagna', () => {
    const setaccia = (stanze, paeseScelto, linguaDiLa) =>
      stanze.filter((r) => (r.paese ? r.paese === paeseScelto : (linguaDiLa ? r.lang === linguaDiLa : true)));
    const stanze = [
      { nome: 'da Citta del Messico', lang: 'es', paese: 'MX' },
      { nome: 'da Madrid', lang: 'es', paese: 'ES' },
      { nome: 'vecchia, in spagnolo', lang: 'es' },
      { nome: 'vecchia, in italiano', lang: 'it' },
    ];
    const inMessico = setaccia(stanze, 'MX', 'es').map((r) => r.nome);
    expect(inMessico, 'quella di Madrid non entra').not.toContain('da Madrid');
    expect(inMessico).toContain('da Citta del Messico');
    expect(inMessico, 'e la vecchia entra col ripiego, dichiarato').toContain('vecchia, in spagnolo');
    expect(inMessico).not.toContain('vecchia, in italiano');
  });
});

describe('la vetrina dice quante persone ci sono ADESSO', () => {
  it('legge le stanze vere invece di fidarsi della fotografia', () => {
    const r = leggi('app/api/mondo/route.js');
    expect(r, 'in un colpo solo per tutte').toMatch(/redis\('MGET', \.\.\.chiavi\)/);
    expect(r, 'e prende il numero dei presenti veri').toMatch(/active\[i\]\.memberCount = stanza\.members\.length/);
  });

  it('una stanza gia finita non si mostra come aperta', () => {
    const r = leggi('app/api/mondo/route.js');
    expect(r).toMatch(/active\[i\]\.chiusa = true/);
    expect(r).toMatch(/active\.filter\(r => !r\.chiusa\)/);
  });

  it('se la lettura viva non riesce, restano i numeri vecchi e si registra', () => {
    const r = leggi('app/api/mondo/route.js');
    // una piazza coi numeri vecchi e meglio di una piazza vuota, ma il
    // silenzio no: un numero vecchio che sembra nuovo va detto.
    expect(r).toMatch(/log\.warn\('conteggio vivo non riuscito/);
  });
});

describe('il mondo gira, finche non gli dici dove andare', () => {
  it("all'ingresso non si atterra piu sul proprio Paese senza averlo chiesto", () => {
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/prefs\?\.mondoPaese \|\| 'nessuno'/);
    expect(v, 'via il vecchio valore di partenza').not.toMatch(/prefs\?\.mondoPaese \|\| 'auto'/);
  });

  it('e le preferenze dicono la stessa cosa della schermata', () => {
    // due posti che devono concordare: se uno cambia e l'altro no, la
    // preferenza mostrata non e quella che l'app applica davvero.
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    const blocco = p.slice(p.indexOf("chiave: 'mondoPaese'"));
    const predefinito = blocco.match(/predefinito: '([a-z]+)'/)[1];
    expect(predefinito).toBe('nessuno');
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(new RegExp(`mondoPaese \\\\|\\\\| '${predefinito}'`));
  });

  it("chi aveva scelto «dove sono» a mano se lo tiene", () => {
    const v = leggi('app/components/MondoView.js');
    expect(v, "il ramo 'auto' esiste ancora").toMatch(/scelto === 'auto' \? paeseDaLingua/);
  });
});
