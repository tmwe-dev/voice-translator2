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

describe('il globo e una porta: si entra, si vede dove sei, si esce', () => {
  it('la testata dice sempre dove sei — un Paese, o il mondo intero', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/L\('changeWord'\)/);
    expect(v).toMatch(/L\('wholeWorld'\)/);
    expect(v, 'ad altezza fissa: comparire non deve spostare niente').toMatch(/minHeight: 30/);
  });

  it("«Cambia» riporta al mondo, che e l'unica uscita che prima non c'era", () => {
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/setPaeseScelto\(null\); setLangFilter\('all'\)/);
  });

  it('il pianeta sa quanto sei sceso, e si vela di conseguenza', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v, 'lo stato della discesa').toMatch(/const \[discesa, setDiscesa\]/);
    expect(v, 'il velo lo usa').toMatch(/0\.42 \+ discesa \* 0\.5/);
    expect(v, "e l'elenco stanze lo racconta").toMatch(/onScroll=\{seguiScorrimento\}/);
    const n = leggi('app/components/MondoNews.js');
    expect(n, 'e anche le news, che sono meta di Mondo').toMatch(/onScroll=\{suScorrimento\}/);
  });

  it('il Paese torna indietro da News: si sceglie in un posto, lo sanno tutti', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n, 'la bandiera non cambia piu solo la copia locale').not.toMatch(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); vibrate\(6\); setPaeseFiltro\(/);
    expect(n).toMatch(/scegliPaese\(paeseFiltro === d\.country \? null : d\.country\)/);
    expect(n, 'e risale a chi la ospita').toMatch(/suPaeseScelto\?\.\(codice\)/);
    const v = leggi('app/components/MondoView.js');
    expect(v, 'che la manda al pianeta e alle stanze').toMatch(/suPaeseScelto=\{\(codice\) => \{ setPaeseScelto\(codice\)/);
  });

  it('il nome del Paese lo dice il telefono, non un elenco scritto a mano', async () => {
    const { nomePaese } = await import('../app/lib/schedaMondo.js');
    expect(nomePaese('JP')).toBeTruthy();
    expect(nomePaese('jp'), 'minuscolo o maiuscolo e lo stesso posto').toBe(nomePaese('JP'));
    expect(nomePaese('ZZZ'), 'tre lettere non sono un paese').toBe('');
    expect(nomePaese(''), 'e il vuoto resta vuoto').toBe('');
  });

  it('le due parole nuove ci sono in tutti e trentotto i pacchetti', async () => {
    const { readdirSync } = await import('node:fs');
    const file = readdirSync(join(process.cwd(), 'app/lib/locales')).filter((f) => f.endsWith('.js'));
    expect(file.length).toBe(38);
    for (const f of file) {
      const pacco = await import(`../app/lib/locales/${f}`);
      const o = pacco.default || Object.values(pacco)[0];
      expect(typeof o.changeWord, `${f}: manca changeWord`).toBe('string');
      expect(o.changeWord.length, `${f}: changeWord vuota`).toBeGreaterThan(0);
      expect(typeof o.wholeWorld, `${f}: manca wholeWorld`).toBe('string');
      expect(o.wholeWorld.length, `${f}: wholeWorld vuota`).toBeGreaterThan(0);
    }
  });
});

describe('il riquadro del Paese dice solo numeri contati', () => {
  it('la chiamata e una sola, o il riquadro comparirebbe a pezzi', () => {
    const v = leggi('app/components/MondoView.js');
    const chiamate = (v.match(/\/api\/mondo\/paese\?code=/g) || []).length;
    expect(chiamate).toBe(1);
  });

  it('un numero che non sappiamo sparisce, non diventa zero', () => {
    // zero e un'affermazione — «non c'e nessuno» — e dirla senza saperla
    // e proprio cio che il documento di Luca vieta.
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/Number\.isFinite\(schedaPaese\.persone\) && schedaPaese\.persone > 0/);
    expect(v, 'e se non c\'e niente lo si dice a parole').toMatch(/L\('quietHereNow'\)/);
  });

  it('il separatore sta FRA i pezzi, non davanti a ognuno', () => {
    // visto dal vivo: con persone e stanze a zero restava un puntino
    // orfano in testa alla riga.
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/pezzi\.join\(` \$\{PUNTO\} `\)/);
  });

  it('il riquadro sta SOPRA il pianeta: comparire non sposta niente', () => {
    const v = leggi('app/components/MondoView.js');
    const blocco = v.slice(v.indexOf('schedaPaese && discesa < 0.6'));
    expect(blocco.slice(0, 400)).toMatch(/position: 'absolute'/);
    expect(blocco.slice(0, 400), 'e non ruba i tocchi al globo').toMatch(/pointerEvents: 'none'/);
  });

  it('la rotta rifiuta un codice che non puo essere un Paese', () => {
    const r = leggi('app/api/mondo/paese/route.js');
    expect(r).toMatch(/\/\^\[A-Z\]\{2\}\$\/\.test\(c\)/);
    expect(r).toMatch(/codice paese non valido/);
  });

  it('le persone sono quelle DENTRO le stanze vere, non la fotografia', () => {
    const r = leggi('app/api/mondo/paese/route.js');
    expect(r).toMatch(/redis\('MGET', \.\.\.chiavi\)/);
    expect(r).toMatch(/Array\.isArray\(stanza\.members\) \? stanza\.members\.length : 0/);
    expect(r, 'e senza lettura viva si dice che non si sa').toMatch(/dentro = null/);
  });

  it('dice anche quante stanze ha contato per approssimazione', () => {
    // le stanze nate prima di b.397 il Paese non ce l'hanno: si arriva
    // dalla lingua, ed e giusto che chi legge sappia quanto fidarsi.
    const r = leggi('app/api/mondo/paese/route.js');
    expect(r).toMatch(/approssimate: perApprossimazione/);
  });

  it("«quietHereNow» esiste in tutti e trentotto i pacchetti", async () => {
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const pacco = await import(`../app/lib/locales/${f}`);
      const o = pacco.default || Object.values(pacco)[0];
      expect(typeof o.quietHereNow, `${f}`).toBe('string');
      expect(o.quietHereNow.length, `${f}: vuota`).toBeGreaterThan(0);
    }
  });
});
