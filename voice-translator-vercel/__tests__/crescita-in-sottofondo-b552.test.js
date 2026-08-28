// ═══════════════════════════════════════════════════════════════
// b.552 — LA RICERCA CHE CRESCE NON DEVE INTERROMPERE CHI GUARDA
//
// Ordine di Luca, netto: «quando sto guardando un video non devi
// interrompermi per attivare la nuova ricerca, la devi fare in
// background. Mai rovinare l'esperienza dell'utente».
//
// Il giardino (b.541) cresce da solo quando arrivi vicino al fondo. Ma
// usava la stessa `cerca` del campo in cima, e quella:
//   1. faceva `setVideo(null)` — la diapositiva che stavi guardando
//      spariva a meta;
//   2. faceva vibrare il telefono;
//   3. accendeva il pannello COBRA con gli stadi della ricerca;
//   4. riordinava TUTTO l'elenco quando arrivavano i conteggi;
//   5. e il feed rifaceva l'intreccio articolo/video da capo, spostando
//      di posto ogni diapositiva dopo la settima.
// Cinque interruzioni, nessuna necessaria.
//
// Regola: un giro `accoda` e' un giro DIETRO. Non tocca niente di cio
// che si vede; si accorge solo perche' in fondo c'e' altra roba.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const news = leggi('components/MondoNews.js');
const feed = leggi('components/FeedNotizieMondo.js');

describe('il giro in sottofondo non tocca cio che si vede', () => {
  it('«dietro» nasce da «accoda»: e la stessa cosa detta bene', () => {
    expect(news).toMatch(/const dietro = !!accoda;/);
  });

  it('non svuota i video: la diapositiva sotto gli occhi resta', () => {
    // Era la riga peggiore di tutte: `setVideo(null)` in cima a
    // cercaVideoPer, eseguita anche quando la ricerca era automatica.
    expect(news).toMatch(/cercaVideoPer = useCallback\(async \(q, dietro = false\)/);
    expect(news).toMatch(/if \(!dietro\) setVideo\(null\);/);
    expect(news, 'i video nuovi si accodano in fondo').toMatch(/const base = dietro && Array\.isArray\(prima\) \? prima : \[\];/);
  });

  it('non vibra, non accende il pannello, non spegne i tasti', () => {
    const c = news.slice(news.indexOf('const cerca = useCallback'), news.indexOf('const cresci = useCallback'));
    const accensione = c.slice(c.indexOf('if (dietro) {'), c.indexOf('try {'));
    expect(accensione, 'setCercando e vibrate stanno nel ramo del primo piano').toMatch(/} else \{[\s\S]*setCercando\(true\)[\s\S]*vibrate\(10\)/);
    expect(c).toMatch(/if \(dietro\) return;\s*\/\/ b\.552/);
    expect(c, 'e alla fine non spegne un pannello che non ha acceso').toMatch(/if \(!dietro\) setCercando\(false\)/);
  });

  it('un guasto in sottofondo resta in sottofondo', () => {
    expect(news).toMatch(/if \(e\.name !== 'AbortError' && !dietro\) setErrore\('guasto'\)/);
  });

  it('i due giri hanno due freni distinti: il primo piano comanda', () => {
    // Con un solo AbortController, il giro automatico annullava quello
    // che avevi appena chiesto tu.
    expect(news).toMatch(/const abortDietroRef = useRef\(null\)/);
    expect(news).toMatch(/abortDietroRef\.current\?\.abort\(\)/);
  });

  it('e il riordino non sposta quello che stai gia guardando', () => {
    expect(news).toMatch(/riordinaConSegnali = useCallback\(async \(lista, fermi = 0\)/);
    expect(news).toMatch(/const testa = fermi > 0 \? contenuti\.slice\(0, fermi\) : \[\];/);
    expect(news, 'in sottofondo si ordina solo la coda nuova').toMatch(/dietro \? \(argomentiRef\.current \|\| \[\]\)\.length : 0/);
  });
});

describe('il feed non rifa l ordine gia mostrato', () => {
  it('tiene memoria di cio che ha gia composto', () => {
    expect(feed).toMatch(/const ordineRef = useRef\(\[\]\)/);
    // (dal secondo momento in poi: finche' non si e «pronti» l'elenco si
    // puo ancora ricomporre, perche' nessuno lo sta guardando — vedi
    // riga-origine/prontezza in b.552)
    expect(feed).toMatch(/const testa = prontoRef\.current \? ordineRef\.current\.filter/);
    expect(feed, 'e intreccia SOLO cio che e appena arrivato').toMatch(/intreccia\(art\.filter\(\(e\) => !gia\.has\(e\.chiave\)\), vid\.filter/);
  });

  it('il riferimento e dichiarato sopra a chi lo guarda (lezione b.546)', () => {
    expect(feed.indexOf('const ordineRef = useRef([])')).toBeLessThan(feed.indexOf('const elementi = useMemo(() => {'));
  });
});
