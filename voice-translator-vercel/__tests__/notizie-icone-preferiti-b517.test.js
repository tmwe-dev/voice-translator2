import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.517 — ordini dal vivo di Luca:
// «aperte adesso con la descrizione elimina non serve»
// «mostra dei bei badge con sfondo in vetro colore brown e blu in
//  alternanza, numero bianco visibile e mettili dentro la sidebar in alto
//  come preferiti, inserisci una x per eliminare la preferenza»
// «i pulsanti apri e traduci, apri, vai al sito devono essere delle icone!!!»
// «parlane o apri discussione non devono essere ambedue presenti ...
//  (aggiungi un numero dei partecipanti)»
// «non mi stai facendo leggere l'articolo dentro la applicazione. il
//  riassunto e una delle due opzioni»
// «quando apro un articolo non mostrare la x ma monta a sinistra un tasto
//  back. nel mobile con trascina torna alla pagina precedente»

describe('b.517 — Stanze: via la descrizione sotto APERTE ADESSO', () => {
  const f = leggi('app/components/MondoView.js');
  it('l elenco non stampa piu openRoomNotice', () => {
    expect(f).not.toMatch(/\{L\('openRoomNotice'\)\}/);
  });
  it('l etichetta APERTE ADESSO resta', () => {
    expect(f).toMatch(/\{L\('openNowWord'\)\}/);
  });
});

describe('b.517 — i temi diventano preferiti di vetro nel pannello', () => {
  const v = leggi('app/components/MondoView.js');
  const b = leggi('app/components/ui/PreferitiTemi.js');
  it('i chip non stanno piu nell elenco', () => {
    expect(v).not.toMatch(/\{L\('talkedAboutHere'\)\}/);
  });
  it('PreferitiTemi e montato dentro il pannello, in cima', () => {
    expect(v).toMatch(/<PreferitiTemi temi=\{schedaPaese\?\.temiCaldi\}/);
    expect(v.indexOf('<PreferitiTemi')).toBeGreaterThan(v.indexOf('<PannelloLaterale'));
    expect(v.indexOf('<PreferitiTemi')).toBeLessThan(v.indexOf('<PreferenzeMondo'));
  });
  it('due tinte alternate, brown e blu, con vetro', () => {
    expect(b).toMatch(/rgba\(140,88,48/);   // brown
    expect(b).toMatch(/rgba\(44,94,170/);   // blu
    expect(b).toMatch(/backdropFilter: 'blur/);
    expect(b).toMatch(/TINTES?\[i % TINTE\.length\]|TINTE\[i % TINTE\.length\]/);
  });
  it('il numero e bianco e leggibile', () => {
    expect(b).toMatch(/color: '#fff'[\s\S]{0,200}\{t\.discussioni\}/);
  });
  it('la x toglie davvero la preferenza, e la scrive nelle preferenze', () => {
    expect(b).toMatch(/Icon name="x"/);
    expect(b).toMatch(/savePrefs\?\.\(\{ \.\.\.prefs, temiTolti: nuovi \}\)/);
    expect(b).toMatch(/!tolti\.has\(t\.topic\)/);
  });
});

describe('b.517 — articolo: quattro porte, tutte icone', () => {
  const f = leggi('app/components/MondoNews.js');
  it('leggi / traduci / vai al sito / parlane sono icone', () => {
    expect(f).toMatch(/<Icon name="doc"/);
    expect(f).toMatch(/<Icon name="globe"/);
    // b.529 — il sito ora e il MONDO (Luca: «l'icona mondo ti porta sul
    // browser»); la bacchetta ha preso il posto della traduzione.
    expect(f).toMatch(/<Icon name="wand"/);
    expect(f).toMatch(/<Icon name="chat"/);
  });
  it('nessun tasto a piena larghezza con quelle etichette', () => {
    expect(f).not.toMatch(/\{L\('openDiscussion'\)\}/);
    expect(f).not.toMatch(/>\s*\{L\('newsOpenSite'\)\}\s*</);
  });
  it('apri e apri-e-traduci aprono la stessa pagina su facce diverse', () => {
    expect(f).toMatch(/dati: t, faccia: 'articolo'/);
    expect(f).toMatch(/dati: t, faccia: 'sintesi'/);
  });
});

describe('b.517 — parlane e una porta sola, col numero di chi c e gia', () => {
  const f = leggi('app/components/MondoNews.js');
  it('indicizza le discussioni gia aperte per link, senza rete in piu', () => {
    expect(f).toMatch(/const discussionePerLink = useMemo/);
    expect(f).toMatch(/persone: d\.comment_count \|\| 0/);
  });
  it('se c e gia gente entra li, se non c e nessuno apre la discussione', () => {
    expect(f).toMatch(/if \(viva\) setDiscAperta\(viva\.id\); else apriDiscussione\(t\)/);
  });
  it('il numero dei partecipanti si vede sul tasto', () => {
    expect(f).toMatch(/\{viva\.persone\}/);
  });
});

describe('b.517 — il lettore: due facce e ritorno col trascinamento', () => {
  const f = leggi('app/components/ui/LettoreArticolo.js');
  it('accetta la faccia di partenza', () => {
    expect(f).toMatch(/faccia = 'articolo'/);
    expect(f).toMatch(/const \[vista, setVista\] = useState/);
  });
  it('due opzioni: la pagina vera e la sintesi', () => {
    expect(f).toMatch(/role="tablist"/);
    expect(f).toMatch(/\{ id: 'articolo', testo: L\('newsOpen'\) \}/);
    expect(f).toMatch(/\{ id: 'sintesi', testo: L\('schedaSintesi'\) \}/);
  });
  it('la pagina vera resta un iframe dell editore (niente testo copiato)', () => {
    expect(f).toMatch(/<iframe/);
    // b.529 — l'iframe serve la pagina ORIGINALE o quella TRADOTTA da
    // Google (mai testo copiato da noi): l'url nudo resta il caso 'orig'.
    expect(f).toMatch(/linguaLettura === 'orig' \? url :/);
  });
  it('atterrando sulla sintesi la genera da sola, una volta sola', () => {
    expect(f).toMatch(/chiestaRef/);
    expect(f).toMatch(/if \(vista !== 'sintesi'/);
  });
  it('indietro e un tasto back a sinistra, non una x', () => {
    expect(f).toMatch(/<Icon name="back"/);
    expect(f).not.toMatch(/<Icon name="x"/);
  });
  it('trascinando dal bordo sinistro si torna indietro', () => {
    expect(f).toMatch(/onTouchStart=\{iniziaPresa\} onTouchEnd=\{finiscePresa\}/);
    expect(f).toMatch(/if \(dx > 60 && dy < dx \/ 2\)/);
  });
});

describe('b.517 — le chiavi nuove ci sono in it/en', () => {
  it('favouritesWord', () => {
    expect(leggi('app/lib/locales/it.js')).toMatch(/"favouritesWord":"Preferiti"/);
    expect(leggi('app/lib/locales/en.js')).toMatch(/"favouritesWord":"Favourites"/);
  });
});
