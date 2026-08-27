import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const feed = leggi('app/components/FeedNotizieMondo.js');

// ═══ b.538 — due collaudi di Luca sullo stesso schermo:
// «i comandi di youtube rimangono nascosti dall'ombreggiatura in basso.
//  devi fare in modo di alzarla»
// «quando ho ribaltato lo schermo, va in errore e si chiude
//  l'applicazione... devo poter ribaltare tranquillamente»

describe('b.538 — il velo si alza sopra i comandi del player', () => {
  it('il blocco del titolo lascia libera la fascia dei comandi', () => {
    expect(feed).toMatch(/const BARRA_YT = \d+;/);
    const misura = Number(feed.match(/const BARRA_YT = (\d+);/)[1]);
    // la barra di YouTube sta fra i 48 (telefono) e i 60 (schermo grande):
    // meno di 48 la coprirebbe di nuovo, piu di 96 sarebbe un buco.
    expect(misura).toBeGreaterThanOrEqual(48);
    expect(misura).toBeLessThanOrEqual(96);
    const blocco = feed.slice(feed.indexOf('b.538, Luca per la seconda volta'));
    expect(blocco).toMatch(/marginBottom: `calc\(\$\{BARRA_YT\}px \+ env\(safe-area-inset-bottom\)\)`/);
    // e resta pittura: da b.535 non ruba i tocchi
    expect(blocco.slice(0, 1400)).toMatch(/pointerEvents: 'none'/);
  });
});

describe('b.538 — ribaltare lo schermo non fa piu cadere l\'applicazione', () => {
  const osservatore = feed.slice(feed.indexOf('const oss = new IntersectionObserver'), feed.indexOf('sentinelleRef.current.forEach'));

  it('per ogni giro si sceglie UNA slide sola, quella che si vede di piu', () => {
    // il difetto era obbedire a TUTTE le voci: ruotando, piu slide
    // superano la soglia insieme e ognuna faceva ridisegnare.
    //
    // AGGIORNATA IN b.546, e la regola che difende NON e cambiata: si
    // sceglie ancora una slide sola per giro e si chiama
    // setIndiceAttivo una volta sola. E' cambiato DOVE si guarda per
    // scegliere. Fino a b.545 si confrontavano fra loro solo le voci di
    // quel giro (`e.intersectionRatio <= miglioreArea`), e li stava
    // meta del «passaggio rotto» che Luca ha visto: l'osservatore
    // avvisa solo delle slide che hanno appena attraversato una soglia,
    // quindi capitava spesso un giro in cui c'era la slide che se ne va
    // e non ancora quella che arriva — e non si decideva niente. Da
    // b.546 le aree si segnano in una memoria (`visibiliRef`) e la
    // scelta si fa sull'elenco intero: il confronto e lo stesso, ma
    // sulle aree ricordate (`area <= miglioreArea`).
    expect(osservatore).toMatch(/let miglioreIdx = -1/);
    expect(osservatore, 'le aree si segnano tutte').toMatch(/visibiliRef\.current\.set\(idx, e\.isIntersecting \? e\.intersectionRatio : 0\)/);
    expect(osservatore, 'e si sceglie confrontandole fra loro').toMatch(/if \(area <= miglioreArea\) return/);
    // una sola chiamata, fuori dal ciclo
    expect((osservatore.match(/setIndiceAttivo\(/g) || []).length).toBe(1);
    expect(osservatore).not.toMatch(/entries\.forEach\([\s\S]{0,200}setIndiceAttivo/);
  });

  it('e se e gia lei l\'attiva non si tocca niente (niente catena di ridisegni)', () => {
    expect(osservatore).toMatch(/setIndiceAttivo\(\(prima\) => \(prima === miglioreIdx \? prima : miglioreIdx\)\)/);
  });

  it('la regola di scelta, provata sui RISULTATI', () => {
    // la stessa logica del componente, isolata: da un lotto di voci
    // (come quelle che arrivano tutte insieme quando lo schermo gira)
    // deve uscire un indice solo, il piu visibile.
    //
    // AGGIORNATA IN b.546 perche' la regola del componente e cambiata
    // in due punti, e una prova che ricopia una regola vecchia e peggio
    // che nessuna prova: (1) la soglia scende a 0.25, perche' una slide
    // alta 100dvh dentro una finestra piu bassa non arriva MAI al 60%
    // e con la soglia vecchia non si sceglieva niente; (2) le aree si
    // RICORDANO fra un giro e l'altro, cosi si sceglie sempre guardando
    // tutte le slide e non solo quelle che si sono appena mosse.
    const SOGLIA = 0.25;
    const memoria = new Map();
    const scegli = (entries) => {
      entries.forEach((e) => {
        const idx = Number(e.target.dataset.indice);
        if (!Number.isFinite(idx)) return;
        memoria.set(idx, e.isIntersecting ? e.intersectionRatio : 0);
      });
      let miglioreIdx = -1, miglioreArea = SOGLIA;
      memoria.forEach((area, idx) => {
        if (area <= miglioreArea) return;
        miglioreArea = area; miglioreIdx = idx;
      });
      return miglioreIdx;
    };
    const voce = (i, ratio, dentro = true) => ({ isIntersecting: dentro, intersectionRatio: ratio, target: { dataset: { indice: String(i) } } });
    // tre slide sopra soglia insieme: vince la piu visibile, una sola
    expect(scegli([voce(2, 0.7), voce(3, 0.95), voce(4, 0.61)])).toBe(3);
    // la 3 scende, la 4 sale: ci si sposta, e con la soglia vecchia
    // (0.6) qui non si sarebbe mosso niente
    expect(scegli([voce(2, 0), voce(3, 0.45), voce(4, 0.55)])).toBe(4);
    // il dito continua e la 4 si prende quasi tutto
    expect(scegli([voce(3, 0.05), voce(4, 0.95)])).toBe(4);
    // giro in cui si sa SOLO che la 4 sta scendendo: la 5 non ha
    // ancora attraversato nessuna soglia e non e nell'elenco. Prima di
    // b.546 qui non si decideva niente; con la memoria si sa che la 4
    // e ancora la piu vista, e si resta su di lei senza inventare.
    expect(scegli([voce(4, 0.6)])).toBe(4);
    // e adesso arriva la 5: la si prende, anche se la 4 non ha
    // attraversato nessuna soglia in questo giro
    expect(scegli([voce(5, 0.8)])).toBe(5);
    // nessuna slide sopra soglia: non si cambia niente (-1 = si resta
    // dov'era). Memoria pulita, altrimenti si parlerebbe del passato.
    memoria.clear();
    expect(scegli([voce(1, 0.1), voce(2, 0.2)])).toBe(-1);
    // fuori vista, anche con area alta, non conta
    memoria.clear();
    expect(scegli([voce(5, 0.99, false)])).toBe(-1);
    // indice illeggibile: si ignora, non si esplode
    memoria.clear();
    expect(scegli([{ isIntersecting: true, intersectionRatio: 0.9, target: { dataset: {} } }])).toBe(-1);
  });

  it('dopo il ribaltamento la slide attiva torna al suo posto', () => {
    expect(feed).toMatch(/window\.addEventListener\('orientationchange', rimetti\)/);
    // b.546 — e SOLO dopo il ribaltamento. Sul telefono la barra del
    // browser che si ritira mentre si scorre fa partire un `resize`
    // identico a questo, e il ritorno forzato riportava indietro chi
    // stava passando alla slide dopo: era una delle cause del
    // «passaggio rotto». La rotazione cambia la larghezza, la barra no.
    expect(feed).toMatch(/if \(larghezzaOra === larghezzaPrima\) return;/);
    expect(feed).toMatch(/scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
    // e si smonta l'ascolto: un ascoltatore lasciato acceso e' l'altra
    // meta di questa stessa malattia
    expect(feed).toMatch(/removeEventListener\('orientationchange', rimetti\)/);
    expect(feed).toMatch(/removeEventListener\('resize', rimetti\)/);
  });

  it('e il video si puo vedere a tutto schermo davvero', () => {
    // allowFullScreen da solo non basta su alcuni browser: serve anche
    // il permesso «fullscreen» nell'elenco allow.
    for (const f of ['FeedNotizieMondo', 'FinestraSulMondo', 'SchedaArgomento']) {
      const src = leggi(`app/components/${f}.js`);
      expect(src, f).toMatch(/allow="[^"]*fullscreen[^"]*"/);
      expect(src, f).toMatch(/allowFullScreen/);
    }
  });
});
