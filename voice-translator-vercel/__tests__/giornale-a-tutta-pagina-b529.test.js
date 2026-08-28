import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.529 — il giro di feedback di Luca sul giornale, in nove punti.

describe('b.529 — la colonna va da bordo a bordo e non balla', () => {
  const f = leggi('app/components/MondoNews.js');
  it('niente rientro laterale sul contenitore, overflowX chiuso', () => {
    expect(f).toMatch(/padding: '0 0 106px', overflowX: 'hidden'/);
  });
  it('le card sono a tutta larghezza: solo bordi sopra e sotto', () => {
    expect(f).not.toMatch(/marginBottom: 12, borderRadius: 16/);
    expect(f).toMatch(/borderTop: bordo, borderBottom: bordo/);
  });
});

describe('b.529 — il pannello applica UNA volta', () => {
  const f = leggi('app/components/MondoNews.js');
  const v = leggi('app/components/MondoView.js');
  it('il Paese scrive la BOZZA, non la query', () => {
    expect(f).toMatch(/onCambia=\{\(v\) => setBozzaPaese\(v === 'tutto' \? null : v\)\}/);
    // b.552 — la tendina della CATEGORIA non esiste piu. Collaudo di
    // Luca: «non mi e' chiara la utilita di questi filtri, confondono.
    // Se non sono necessari accontentiamoci dei preferiti, del random,
    // delle ultime ricerche e dell'albero che cresce». Chiedere in che
    // categoria cercare e' chiedere alla persona il lavoro che il
    // giardino (b.541) fa gia da solo. Il patto di b.529 — si scrive una
    // bozza e si applica UNA volta — resta, e resta provato qui sopra
    // sull'unica cosa rimasta da applicare.
    expect(f, 'niente tendina delle categorie').not.toMatch(/onCambia=\{\(v\) => setBozzaCategoria\(v\)\}/);
  });
  it('il tasto Applica esiste nei due pannelli e chiude', () => {
    expect(f).toMatch(/\{L\('applyWord'\)\}/);
    expect(v).toMatch(/\{L\('applyWord'\)\}/);
    expect(f).toMatch(/suChiudiStrumenti\?\.\(\);\s*\n\s*\}\}/ /* b.535: Applica vive in una IIFE col `cambiato`, il rientro e' cambiato ma il gesto (applica e chiudi) e' identico */);
  });
});

describe('b.529 — ultime ricerche con miniatura e nome corto', () => {
  const f = leggi('app/components/MondoNews.js');
  it('la ricerca riuscita si ricorda (max 6, senza doppioni)', () => {
    expect(f).toMatch(/ricercheRecenti: nuove/);
    expect(f).toMatch(/\.slice\(0, 6\)/);
  });
  it('l etichetta sono le prime due parole piene', () => {
    expect(f).toMatch(/parole\.slice\(0, 2\)/);
    expect(f).toMatch(/VUOTE/);
  });
  it('nel pannello: badge con miniatura, tocco che ricerca, x che dimentica', () => {
    expect(f).toMatch(/L\('recentSearches'\)/);
    expect(f).toMatch(/cerca\(r\.q\); suChiudiStrumenti/);
    expect(f).toMatch(/ricercheRecenti\.filter\(x => x\.q !== r\.q\)/);
  });
});

describe('b.529 — preferiti: dropdown, alfabetici, bassi e rettangolari', () => {
  const f = leggi('app/components/ui/PreferitiTemi.js');
  it('ordinati per nome', () => {
    expect(f).toMatch(/localeCompare/);
  });
  it('richiusi dietro una riga col conteggio', () => {
    expect(f).toMatch(/aria-expanded=\{aperti\}/);
    expect(f).toMatch(/\(\{visibili\.length \+ \(aggiunte\?\.length \|\| 0\)\}\)/ /* b.535: il conteggio somma anche le ricerche salvate con la stella */);
  });
  it('rettangolari e piu bassi', () => {
    expect(f).toMatch(/borderRadius: 7/);
    expect(f).toMatch(/minHeight: 26/);
  });
});

describe('b.529 — discussione: proporzioni vere e commento inline', () => {
  const f = leggi('app/components/MondoDiscussioni.js');
  it('l immagine non viene piu stirata', () => {
    expect(f).toMatch(/objectFit: 'contain'/);
    expect(f).not.toMatch(/maxHeight: 180, height: 180/);
  });
  it('il campo commento sta in basso, senza popup e senza campo nome', () => {
    expect(f).not.toMatch(/\{composerAperto && \(/);
    const piede = f.slice(f.indexOf('IL CAMPO STA QUI'));
    expect(piede).toMatch(/textarea/);
    expect(piede).not.toMatch(/publicNickname/);
  });
});

describe('b.529 — icone: bacchetta per tradurre, mondo per il browser', () => {
  it('la bacchetta esiste nel set', () => {
    expect(leggi('app/components/Icon.js')).toMatch(/wand: 'M15 4V2/);
  });
  it('nella card: wand=sintesi, globe=sito', () => {
    const f = leggi('app/components/MondoNews.js');
    const riga = f.slice(f.indexOf("faccia: 'sintesi'"), f.indexOf("faccia: 'sintesi'") + 900);
    expect(riga).toMatch(/name="wand"/);
    expect(f.slice(f.indexOf("L('newsOpenSite')"), f.indexOf("L('newsOpenSite')") + 700)).toMatch(/name="globe"/);
  });
});

describe('b.529 — l articolo intero, tradotto, dentro l app', () => {
  const f = leggi('app/components/ui/LettoreArticolo.js');
  it('bandiera + freccia scelgono la lingua, default profilo', () => {
    expect(f).toMatch(/useState\(prefs\?\.lang \|\| prefs\?\.uiLang \|\| 'en'\)/);
    expect(f).toMatch(/valore=\{linguaLettura\}/ /* b.535: la select di sistema e' diventata TendinaVetro (ordine di Luca sui dropdown): stessa scelta, veste dell'app */);
    expect(f).toMatch(/icona: l\.flag/ /* b.535: la bandiera del valore la disegna TendinaVetro (soloIcona) dalle opzioni; niente piu span dedicato */);
  });
  it('la pagina dell editore viene servita TRADOTTA (mai copiata da noi)', () => {
    expect(f).toMatch(/translate\.google\.com\/translate\?sl=auto&tl=/);
    expect(f).toMatch(/linguaLettura === 'orig' \? url :/);
  });
});

describe('b.529 — la vista continua parte da sola, solo video', () => {
  const f = leggi('app/components/MondoNews.js');
  it('si apre alla prima entrata (una volta per sessione)', () => {
    expect(f).toMatch(/__VT_FEED_VISTO/);
  });
  it('il filtro di default resta SOLO VIDEO', () => {
    expect(f).toMatch(/prefs\?\.mondoFeedFiltro \|\| 'video'/);
  });
});
