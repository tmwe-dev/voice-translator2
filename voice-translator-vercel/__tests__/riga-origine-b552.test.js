// ═══════════════════════════════════════════════════════════════
// b.552 — LA NOTA VA IN ALTO, IN UNA RIGA SUA
//
// Collaudo di Luca, con la fotografia della slide: «titoli e sottotitoli
// in basso a volte si sovrappongono. Se devi mettere una nota mettila in
// alto in una riga dedicata con bandiera e origine e data pubblicazione
// bene evidente con la ora a destra in alto».
//
// In basso si accatastavano tre cose che crescono ognuna per conto suo —
// titolo, nome del canale, sottotitoli dell'interprete — e i sottotitoli
// stavano a un `bottom: 132` scritto a mano: bastava un titolo di due
// righe per finirci sopra.
//
// Il patto nuovo: la nota ha la sua riga in cima, il piede ha
// un'altezza CERTA (PIEDE_VIDEO, garantita dal taglio a due righe) e
// l'interprete riceve quella quota invece di indovinarla.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { daApi } from '../app/lib/topics/videoUfficiale.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const feed = leggi('components/FeedNotizieMondo.js');

describe('la riga dedicata, in alto', () => {
  it('esiste, e' + ' larga tutta e sta sopra la fotografia', () => {
    expect(feed).toMatch(/function RigaOrigine\(/);
    const r = feed.slice(feed.indexOf('function RigaOrigine('), feed.indexOf('export default function FeedNotizieMondo'));
    expect(r, 'da bordo a bordo: e una riga, non una targhetta').toMatch(/left: 0, right: 0/);
    expect(r, 'sotto la barra in cima').toMatch(/top: 70/);
    expect(r, 'non ruba tocchi: e pittura').toMatch(/pointerEvents: 'none'/);
  });

  it('porta bandiera, origine, data — e l ora a DESTRA', () => {
    const r = feed.slice(feed.indexOf('function RigaOrigine('), feed.indexOf('export default function FeedNotizieMondo'));
    expect(r).toMatch(/toLocaleDateString/);
    expect(r).toMatch(/toLocaleTimeString/);
    expect(r, 'l ora va a destra, come chiesto').toMatch(/marginLeft: 'auto'/);
    expect(r, 'niente grassetto, mai').not.toMatch(/fontWeight: (6|7|8|9)00/);
  });

  it('la usano tutte e due le diapositive, video e articolo', () => {
    expect(feed.match(/<RigaOrigine/g) || []).toHaveLength(2);
    expect(feed, 'il video porta la sua eta').toMatch(/quandoTesto=\{el\.dati\.quandoTesto/);
    expect(feed, 'l articolo la sua data vera').toMatch(/quandoMs=\{el\.dati\.pubblicato/);
  });
});

describe('in basso non si sovrappone piu niente', () => {
  it('il piede del video porta SOLO il titolo, tagliato a due righe', () => {
    const i = feed.indexOf('marginBottom: `calc(${BARRA_YT}');
    expect(i, 'il piede del video esiste ancora').toBeGreaterThan(0);
    const piede = feed.slice(i, i + 1600);
    expect(piede).toMatch(/WebkitLineClamp: 2/);
    expect(piede, 'il canale non si ripete qui: e salito in alto').not.toMatch(/el\.dati\.canale/);
  });

  it('l altezza del piede e un numero dichiarato, non un indovinello', () => {
    expect(feed).toMatch(/const PIEDE_VIDEO = \d+;/);
    expect(feed, 'e l interprete la riceve').toMatch(/daFondo=\{BARRA_YT \+ PIEDE_VIDEO\}/);
  });

  it('i sottotitoli non hanno piu un numero cucito addosso', () => {
    const i = leggi('components/ui/InterpreteVideo.js');
    // b.556 — la firma si e' allungata (il comando puo vivere nel
    // ventaglio): il ripiego a 132 resta per chi non passa niente.
    expect(i).toMatch(/daFondo = 132,/);
    expect(i).toMatch(/bottom: `calc\(\$\{daFondo\}px \+ env\(safe-area-inset-bottom\)\)`/);
    expect(i, 'e il comando in cima e sceso sotto la riga nuova').toMatch(/left: 12, top: 116/);
  });
});

describe('la data del video: quella vera che esiste', () => {
  it('viene dalla Data API, ed e un istante preciso', () => {
    // b.553-bis — quando la data la leggevamo dalla pagina di YouTube
    // avevamo solo l'eta scritta a parole («2 giorni fa»), e la
    // mostravamo cosi: meglio una verita approssimata che una data
    // inventata. Dalla porta ufficiale arriva `publishedAt`, cioe
    // l'istante vero: la riga in alto puo scrivere data E ora, che e'
    // esattamente quello che Luca aveva chiesto.
    const [v] = daApi([{ snippet: {
      title: 'Prova', channelTitle: 'Nova Lectio',
      resourceId: { videoId: 'abcdefghijk' }, publishedAt: '2026-08-26T07:30:00Z',
    } }]);
    expect(v.canale).toBe('Nova Lectio');
    expect(new Date(v.pubblicato).toISOString()).toBe('2026-08-26T07:30:00.000Z');
  });
});

describe('b.552 — il primo contenuto si mostra quando e certo', () => {
  it('finche non e pronto non si monta nessuna diapositiva', () => {
    // Il difetto raccontato da Luca: «mostra la pagina cerca, poi un
    // video, e a volte salta subito ad altri e si ferma». Saltava perche'
    // l'elenco continuava a ricomporsi sotto una diapositiva gia montata.
    expect(feed).toMatch(/\{\(!pronto \|\| !elementi\.length\) && \(/);   // b.574
    expect(feed).toMatch(/\{pronto && !!elementi\.length && elementi\.map\(/);   // b.574
  });

  it('e intanto gira un anello: l attesa ha una faccia', () => {
    expect(feed).toMatch(/animation: 'vtGira 0\.9s linear infinite'/);
    expect(feed).toMatch(/@keyframes vtGira/);
  });

  it('«pronto» aspetta il primo giro, non la crescita in sottofondo', () => {
    expect(feed).toMatch(/const pronto = visto \|\| \(aperto && !caricando && elementi\.length > 0\);/);
    const news = leggi('components/MondoNews.js');
    expect(news, 'e il primo giro e quello in primo piano').toMatch(/caricando=\{cercando\}/);
  });

  it('chiudendo il feed l attesa riparte da capo', () => {
    expect(feed).toMatch(/if \(!aperto\) \{ setVisto\(false\); ordineRef\.current = \[\]; prontoRef\.current = false; \}/);
  });
});

describe('b.552 — il vetro di Luca', () => {
  it('la ricetta vive in un posto solo', () => {
    const v = leggi('lib/vetro.js');
    expect(v).toMatch(/export const VETRO = \{/);
    expect(v, 'semi trasparente').toMatch(/rgba\(26,40,74,0\.42\)/);
    expect(v, 'superficie vetrata').toMatch(/backdropFilter: 'blur\(12px\)'/);
    expect(v, 'e il caldo: il «brown» chiesto da Luca').toMatch(/VETRO_CUORE/);
  });

  it('il feed la usa per i tasti, i filtri e la riga dell origine', () => {
    expect(feed).toMatch(/import \{ VETRO, VETRO_ACCESO, VETRO_CUORE, VETRO_FASCIA \}/);
    // b.556 — acceso non vuol dire sempre caldo: il cuore e' rosso, la
    // stella della bacheca e' d'oro, e il vetro cambia di conseguenza.
    expect(feed, 'i tasti del ventaglio').toMatch(/\.\.\.\(v\.acceso \? \(v\.caldo \? VETRO_CUORE : VETRO_ACCESO\) : VETRO\)/);
    expect(feed, 'la riga in alto').toMatch(/\.\.\.VETRO_FASCIA/);
    expect(feed, 'il filtro acceso').toMatch(/\.\.\.\(acceso \? VETRO_ACCESO/);
  });
});
