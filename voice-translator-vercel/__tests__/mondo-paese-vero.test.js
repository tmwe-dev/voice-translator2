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

describe('b.508 — il mondo apre gia sul tuo Paese, dedotto dalla lingua', () => {
  // ORDINE DI LUCA (b.508): «da dove parto, il drop down enorme, non
  // serve tutta quella roba [...] il mio paese, cioe la mia lingua».
  // SCOSTAMENTO dichiarato dal comportamento precedente (b.397, sopra
  // in questo stesso file nella cronologia): il mondo NON parte piu
  // sempre libero in attesa di un ordine — apre subito sul Paese dedotto
  // dalla lingua del telefono, senza chiedere.
  it("all'ingresso il pianeta atterra sul Paese dedotto dalla lingua, senza preferenza esplicita", () => {
    const v = leggi('app/components/MondoView.js');
    expect(v, 'la deduzione e diretta, non passa piu per una preferenza').toMatch(/const mio = paeseDaLingua\(prefs\?\.lang\);/);
    expect(v, "il vecchio cancello mondoPaese/nessuno non c'e piu qui").not.toMatch(/prefs\?\.mondoPaese \|\| 'nessuno'/);
  });

  it('la preferenza "da dove parto" (mondoPaese) non esiste piu nel pannello', () => {
    const pref = leggi('app/components/ui/PreferenzeMondo.js');
    expect(pref, 'nessuna voce mondoPaese fra le preferenze').not.toMatch(/chiave: 'mondoPaese'/);
    expect(pref, 'e niente piu tendina dei paesi').not.toMatch(/opzioniPaese/);
  });

  it('si torna al mondo intero da News (suPaeseScelto), non piu dal pannello preferenze', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v, "l'uscita passa dal callback suPaeseScelto verso MondoNews").toMatch(/suPaeseScelto=\{\(codice\) => \{ setPaeseScelto\(codice\)/);
  });
});

describe('il globo e una porta: si entra, si vede dove sei, si esce', () => {
  it('la testata dice sempre dove sei — un Paese, o il mondo intero', () => {
    const v = leggi('app/components/MondoView.js');
    // b.504 — M1: la pillola non porta piu il «Cambia ›» scritto (si
    // tocca la pillola stessa); il mondo intero resta detto a parole.
    expect(v).toMatch(/L\('wholeWorld'\)/);
    expect(v, 'ad altezza fissa: comparire non deve spostare niente').toMatch(/minHeight: 30/);
  });

  it("l'uscita dal Paese esiste ancora: la pillola apre il pannello, dove c'e mondoPaese", () => {
    const v = leggi('app/components/MondoView.js');
    // b.504 — l'uscita non e piu un tasto che azzera al volo: la pillola
    // apre il pannello e li mondoPaese ha «nessuno» (il mondo intero).
    expect(v).toMatch(/paeseScelto[\s\S]{0,900}setStrumenti\(true\)/);
    // b.508 — il pannello dietro la pillola ora e solo preferenze
    // (titoli/modo/ritmo/aggiorna): l'uscita vera dal Paese e coperta
    // dal test dedicato piu sopra, e passa da News (suPaeseScelto).
  });

  it('il pianeta sa quanto sei sceso, e si vela di conseguenza', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v, 'lo stato della discesa').toMatch(/const \[discesa, setDiscesa\]/);
    expect(v, "e l'elenco stanze lo racconta").toMatch(/onScroll=\{seguiScorrimento\}/);
    const n = leggi('app/components/MondoNews.js');
    expect(n, 'e anche le news, che sono meta di Mondo').toMatch(/onScroll=\{suScorrimento\}/);

    // b.403 — punto 7 del piano di Luca. Qui c'era scritto il velo a
    // memoria: `0.42 + discesa * 0.5`. Cosi il test non provava un
    // comportamento, fotografava tre numeri — e quando i numeri sono
    // cambiati (b.400, il velo spegneva il pianeta) e diventato rosso
    // pur essendo il CODICE quello giusto. Ora si prova cio che conta:
    // a riposo il pianeta si vede, scendendo si copre, e non si esce mai
    // dai limiti dell'opacita.
    const riga = v.match(/background: `linear-gradient\(180deg, rgba\(5,7,15,\$\{([^}]+)\}\)[^`]*`/);
    expect(riga, 'il velo e un gradiente che dipende dalla discesa').toBeTruthy();
    const opacita = (espressione, discesa) =>
      Number(new Function('discesa', `return ${espressione}`)(discesa));
    const cime = [...v.matchAll(/rgba\(5,7,15,\$\{([^}]+)\}\)/g)].map((m) => m[1]);
    expect(cime.length, 'le tre fermate del gradiente').toBeGreaterThanOrEqual(3);
    for (const e of cime.slice(0, 3)) {
      const fermo = opacita(e, 0);
      const sceso = opacita(e, 1);
      expect(fermo, 'a riposo il globo non e spento').toBeLessThan(0.7);
      expect(sceso, 'scendendo il velo si chiude').toBeGreaterThan(fermo);
      expect(sceso, "l'opacita resta un'opacita").toBeLessThanOrEqual(1);
      expect(fermo, "l'opacita resta un'opacita").toBeGreaterThanOrEqual(0);
    }
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

describe('la Home del Paese, e il passaggio fra pianeta e contenuti', () => {
  it('entrando in un Paese si vede di cosa si parla, non solo quanti temi', () => {
    const r = leggi('app/api/mondo/paese/route.js');
    expect(r, 'la rotta li conta e li ordina').toMatch(/temiCaldi = \[\.\.\.perTema\.entries\(\)\]/);
    expect(r, 'e li porta fuori').toMatch(/temiCaldi,/);
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/L\('talkedAboutHere'\)/);
    expect(v, "e compare solo se c'e qualcosa da dire").toMatch(/schedaPaese\?\.temiCaldi\?\.length > 0/);
  });

  it('toccare un tema fa tutta la strada, non meta', () => {
    // prima portava alle news del Paese ma non a QUEL tema
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/setTemaDaMondo\(t\.topic\); setTab\('news'\)/);
    expect(v, 'e lo passa a News').toMatch(/temaDaFuori=\{temaDaMondo\}/);
    const n = leggi('app/components/MondoNews.js');
    expect(n, 'che lo apre').toMatch(/setArgomentoFiltro\(temaDaFuori\)/);
    expect(n, 'e lo consuma una volta sola').toMatch(/suTemaLetto\?\.\(\)/);
  });

  it('una sfumatura unisce il globo ai contenuti invece di tagliarli', () => {
    // b.405 — era scritto a memoria anche qui: `0.5 + discesa * 0.45`.
    // Stesso difetto del velo grande: fotografava due numeri, non un
    // comportamento, ed e diventato rosso quando in b.400 la fascia e
    // stata schiarita pur restando giusta. Ora si prova la fascia per
    // quello che deve fare: partire velata in cima, sparire in fondo,
    // farsi piu decisa mentre scendi, e non prendere i tocchi.
    const v = leggi('app/components/MondoView.js');
    const fascia = v.match(
      /background: `linear-gradient\(180deg, rgba\(5,7,15,\$\{([^}]+)\}\) 0%, rgba\(5,7,15,0\) 100%\)`/,
    );
    expect(fascia, 'la fascia di raccordo esiste e dipende dalla discesa').toBeTruthy();
    expect(fascia[1], 'e segue il gesto').toMatch(/discesa/);

    const opacita = (d) => Number(new Function('discesa', `return ${fascia[1]}`)(d));
    const fermo = opacita(0);
    const sceso = opacita(1);
    expect(fermo, 'a riposo il globo si vede attraverso').toBeLessThan(0.7);
    expect(fermo, "l'opacita resta un'opacita").toBeGreaterThanOrEqual(0);
    expect(sceso, 'scendendo il raccordo si chiude').toBeGreaterThan(fermo);
    expect(sceso, "l'opacita resta un'opacita").toBeLessThanOrEqual(1);

    const blocco = v.slice(Math.max(0, fascia.index - 400), fascia.index);
    expect(blocco, 'e non ruba i tocchi').toMatch(/pointerEvents: 'none'/);
  });

  it("«talkedAboutHere» c'e in tutti e trentotto i pacchetti", async () => {
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const pacco = await import(`../app/lib/locales/${f}`);
      const o = pacco.default || Object.values(pacco)[0];
      expect(typeof o.talkedAboutHere, `${f}`).toBe('string');
      expect(typeof o.whatWorldThinks, `${f}`).toBe('string');
      expect(typeof o.countedAcross, `${f}`).toBe('string');
    }
  });
});
