// ═══════════════════════════════════════════════════════════════
// QUELLO CHE I TEST NON VEDEVANO (b.145)
//
// Milletrecentoventiquattro controlli verdi, e NESSUNO apriva una
// pagina. Leggono tutti il sorgente come se fosse un testo: cercano una
// stringa, contano una chiave, verificano che una funzione esista. Un
// controllo cosi non puo accorgersi di come la pagina VIENE FUORI, e
// infatti tre difetti che si vedevano a occhio nudo ci sono passati
// davanti senza che uno solo diventasse rosso.
//
//   · b.143 — LA NEBBIA. `backdrop-filter: blur(16px)` su una riga
//     ripetuta novantadue volte. Il velo non sfoca la card: sfoca cio
//     che le sta DIETRO, e novantadue strati sovrapposti diventano una
//     foschia grigia su tutta la finestra. Luca: "non capisci che stai
//     espandendo l'effetto a tutta la pagina e non solo le cards?".
//
//   · b.134-ter — IL MURO. Un pannello `position:fixed`, `bottom:0`,
//     zIndex 900 sopra la BottomNav, che e fissa, alta 76px e sta a
//     zIndex 50. Home, Chat, Community e Profilo erano irraggiungibili
//     finche non si congedava il pannello. E la stessa cornice `page`
//     arrivava fino a bottom:0 (b.135): gli ultimi 76px di OGNI
//     schermata scorrevole finivano sotto la barra, e li ci finiva
//     anche il messaggio d'errore della clonazione voce.
//
//   · b.133 e b.140 — IL RIMONTAGGIO. Un componente definito DENTRO il
//     corpo di un altro (GlassCard in JoinView, RigaPaese in
//     SceltaPaeseView) rinasce a ogni disegno, e per React una funzione
//     nuova e un TIPO nuovo: smonta e rimonta tutto il sottoalbero. Il
//     campo del nome perdeva il fuoco dopo una lettera — sembrava un
//     limite di un carattere — e le animazioni delle righe non
//     reggevano, perche l'elemento moriva a ogni battuta.
//
// Questi sei controlli guardano la FORMA di cio che viene disegnato,
// non le parole che ci sono dentro. Sono pochi di proposito: uno per
// meccanismo, non uno per sintomo. Ciascuno e stato provato sul file
// vero del giorno in cui il difetto c'era, e in quel giorno era ROSSO;
// dove serviva e scritto nel commento del controllo.
//
// Perche staticamente e non aprendo un browser: una prova che monta
// davvero React misura il DOM di un caso solo, quello che si e pensato
// di scrivere. Queste regole invece passano su tutti i file
// dell'applicazione a ogni giro, e prendono anche il difetto che
// nessuno ha ancora fatto. Il prezzo e che leggono il sorgente — quindi
// i commenti vanno tolti PRIMA di cercarci dentro, o il controllo trova
// la propria spiegazione e si convince da solo (ci siamo gia cascati
// tre volte).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RADICE = path.resolve(__dirname, '..');
const CARTELLA_APP = path.join(RADICE, 'app');

// ── Attrezzi comuni ─────────────────────────────────────────────

function sorgenti(cartella = CARTELLA_APP, raccolta = []) {
  for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
    const p = path.join(cartella, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === 'node_modules' || voce.name === '.next') continue;
      sorgenti(p, raccolta);
    } else if (/\.jsx?$/.test(voce.name)) {
      raccolta.push(p);
    }
  }
  return raccolta;
}

const relativo = (f) => path.relative(RADICE, f);

// I difetti che questi controlli cercano sono RACCONTATI, qui e nei
// componenti, con le parole esatte del difetto. Se non si tolgono i
// commenti, ogni regola trova la propria spiegazione e fallisce (o
// peggio: passa) per il motivo sbagliato.
function senzaCommenti(sorgente) {
  return sorgente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((r) => (/^\s*(\/\/|\*)/.test(r) ? '' : r))
    .join('\n');
}

const riga = (s, i) => s.slice(0, i).split('\n').length;

/** Il testo delimitato dalla parentesi che apre in `i`, chiusa a pari livello. */
function bilanciato(s, i) {
  const apre = s[i];
  const chiude = apre === '(' ? ')' : apre === '{' ? '}' : ']';
  let livello = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === apre) livello++;
    else if (s[j] === chiude) { livello--; if (!livello) return s.slice(i, j + 1); }
  }
  return s.slice(i);
}

/** Il corpo della funzione dichiarata all'indice `d` (arrow o `function`). */
function corpoDellaFunzione(s, d) {
  if (/^\s*(?:const|let|var)/.test(s.slice(d, d + 6))) {
    const freccia = s.indexOf('=>', d);
    if (freccia < 0) return '';
    let i = freccia + 2;
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] === '(' || s[i] === '{') return bilanciato(s, i);
    const fine = s.indexOf(';', i);
    return s.slice(i, fine > -1 ? fine : i + 400);
  }
  const apre = s.indexOf('(', d);
  const dopoParametri = apre + bilanciato(s, apre).length;
  const graffa = s.indexOf('{', dopoParametri);
  return graffa < 0 ? '' : bilanciato(s, graffa);
}

/** Il blocco `style={{ ... }}` che comincia in `i`. */
function bloccoStile(s, i) {
  let livello = 2;
  let j = i + 'style={{'.length;
  while (j < s.length && livello > 0) {
    if (s[j] === '{') livello++;
    else if (s[j] === '}') livello--;
    j++;
  }
  return s.slice(i, j);
}

const VELO = /backdropFilter|backdrop-filter/;

// ═══════════════════════════════════════════════════════════════
describe('1 · nessun componente nasce dentro un altro componente', () => {

  // PROVATO SUL DIFETTO VERO. Su `JoinView.js` come stava prima di
  // b.133 (0078e59^) questo controllo elenca GlassCard alla riga 83 e
  // PrimaryBtn alla riga 97; su `SceltaPaeseView.js` come stava prima
  // di b.140 (5b918ba^) elenca RigaPaese alla riga 93. Erano i due
  // difetti veri: il campo del nome che perdeva il fuoco dopo una
  // lettera, e le righe dei paesi che rinascevano a ogni carattere
  // battuto nella ricerca, spegnendo ogni animazione.
  //
  // COME RICONOSCE UN COMPONENTE: dichiarazione RIENTRATA (quindi non a
  // livello di modulo), nome con l'iniziale maiuscola, e nel CORPO —
  // non nelle quattrocento lettere successive, o `const T = (k) => t(l, k)`
  // finirebbe dentro per via del JSX che gli sta sotto — almeno un tag.

  function componentiAnnidati(s) {
    const trovati = [];
    const re = /^[ \t]+(?:(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:\(|memo\(|function\b|[A-Za-z_$]\w*\s*=>)|function\s+([A-Z]\w*)\s*\()/gm;
    let m;
    while ((m = re.exec(s))) {
      const nome = m[1] || m[2];
      const corpo = corpoDellaFunzione(s, m.index);
      if (!/<[A-Za-z][\w.]*[\s/>]/.test(corpo)) continue;
      trovati.push({ nome, riga: riga(s, m.index) });
    }
    return trovati;
  }

  it('nessun file dell\'applicazione ne dichiara uno', () => {
    const guasti = [];
    for (const f of sorgenti()) {
      const s = senzaCommenti(fs.readFileSync(f, 'utf8'));
      for (const c of componentiAnnidati(s)) {
        guasti.push(`${relativo(f)}:${c.riga} — <${c.nome}> vive dentro un altro componente`);
      }
    }
    expect(guasti).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('2 · nessun campo di testo e avvolto da un tipo che cambia', () => {

  // Lo stesso meccanismo del controllo 1, guardato dalla parte del
  // sintomo: si parte dal campo e si risale agli antenati. Serve perche
  // il danno vero non lo fa il componente annidato in se, lo fa cio che
  // AVVOLGE: il campo di testo tiene il fuoco e il cursore nel nodo del
  // DOM, e se l'antenato viene smontato quel nodo muore con lui.
  //
  // PROVATO SUL DIFETTO VERO. Su `JoinView.js` prima di b.133 questo
  // controllo segnala tre campi (righe 146, 158 e 334) chiusi dentro
  // <GlassCard>, che era dichiarato nel corpo di JoinView. E' esatta-
  // mente il difetto che Luca ha visto dal secondo telefono: scriveva
  // una lettera e il campo tornava vuoto.

  function tipiDichiaratiDentroQualcosa(s) {
    const nomi = new Set();
    const re = /^[ \t]+(?:(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:\(|memo\(|function\b|[A-Za-z_$]\w*\s*=>)|function\s+([A-Z]\w*)\s*\()/gm;
    let m;
    while ((m = re.exec(s))) nomi.add(m[1] || m[2]);
    return nomi;
  }

  it('ogni <input> e ogni <textarea> hanno solo antenati stabili', () => {
    const guasti = [];
    for (const f of sorgenti()) {
      const s = senzaCommenti(fs.readFileSync(f, 'utf8'));
      const instabili = tipiDichiaratiDentroQualcosa(s);
      if (!instabili.size) continue;

      for (const campo of [...s.matchAll(/<(?:input|textarea)\b/g)]) {
        const pila = [];
        const tag = /<(\/?)([A-Z]\w*)([^>]*?)(\/?)>/g;
        let m;
        while ((m = tag.exec(s)) && m.index < campo.index) {
          if (m[1]) pila.pop();
          else if (!m[4]) pila.push({ nome: m[2], riga: riga(s, m.index) });
        }
        for (const antenato of pila) {
          if (instabili.has(antenato.nome)) {
            guasti.push(`${relativo(f)}: il campo a riga ${riga(s, campo.index)} sta dentro <${antenato.nome}> (riga ${antenato.riga}), che rinasce a ogni disegno`);
          }
        }
      }
    }
    expect(guasti).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('3 · il velo di sfocatura non sta su un elemento ripetuto', () => {

  // PROVATO SUL DIFETTO VERO. Su `SceltaPaeseView.js` come stava in
  // b.140 (5b918ba) e in b.141 (1dbbbdc) questo controllo segnala
  // <RigaPaese>, definita a riga 49 con `backdropFilter: blur(12/14px)`
  // e disegnata dentro un `.map` sui novantadue paesi. E' la nebbia di
  // b.143, presa un giro prima che Luca la vedesse.
  //
  // PERCHE PROPRIO IL COMPONENTE-RIGA E NON UNO STILE QUALSIASI: un
  // componente lo si estrae quando l'elenco e lungo — per tre voci si
  // scrive in linea. Ed e la forma in cui il costo non si vede: nel
  // sorgente c'e UN velo, sullo schermo ce ne sono novantadue, uno
  // sopra l'altro, e ognuno sfoca il risultato di quelli sotto.

  it('nessuna riga di elenco porta un backdrop-filter', () => {
    const guasti = [];
    for (const f of sorgenti()) {
      const s = senzaCommenti(fs.readFileSync(f, 'utf8'));
      const mappe = /\.map\s*\(/g;
      let m;
      while ((m = mappe.exec(s))) {
        const argomento = bilanciato(s, m.index + m[0].length - 1);
        if (!/<[A-Za-z]/.test(argomento)) continue;   // non disegna niente

        const disegnati = new Set([...argomento.matchAll(/<([A-Z]\w*)/g)].map((x) => x[1]));
        for (const nome of disegnati) {
          const d = s.search(new RegExp(`^(?:const|let|var)\\s+${nome}\\s*=|^function\\s+${nome}\\s*\\(`, 'm'));
          if (d < 0) continue;                        // arriva da un altro file
          if (VELO.test(corpoDellaFunzione(s, d))) {
            guasti.push(`${relativo(f)}: <${nome}> (riga ${riga(s, d)}) porta un velo ed e ripetuta dal .map di riga ${riga(s, m.index)}`);
          }
        }
      }
    }
    expect([...new Set(guasti)]).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('4 · niente si siede sulla BottomNav', () => {

  // La barra e l'unica strada per Home, Chat, Community e Profilo.
  // Coprirla non e un fastidio grafico: e murare la navigazione.
  //
  // PROVATO SUL DIFETTO VERO. Su `InstallaApp.js` come stava prima di
  // b.134-ter (84a3406^) questo controllo segnala il pannello di riga
  // 79: `position:'fixed'`, `bottom:0`, zIndex 900. Oggi lo stesso
  // pannello si appoggia SOPRA la barra
  // (`bottom: calc(76px + env(safe-area-inset-bottom))`) e passa.
  //
  // L'altezza e lo zIndex si leggono da BottomNav.js invece di
  // inchiodarli qui: se un giorno la barra diventa piu alta, questo
  // controllo si adegua da solo e resta quello vero.

  const barra = senzaCommenti(fs.readFileSync(path.join(CARTELLA_APP, 'components/BottomNav.js'), 'utf8'));
  const ALTEZZA_BARRA = Number((barra.match(/height:\s*'(\d+)px'/) || [])[1]);
  const PIANO_BARRA = Number((barra.match(/zIndex:\s*(\d+)/) || [])[1]);

  it('la barra dichiara ancora la sua altezza e il suo piano', () => {
    // Se un giorno smettesse di dichiararli, i due controlli qui sotto
    // diventerebbero verdi per assenza di misura: peggio che rossi.
    expect(ALTEZZA_BARRA).toBeGreaterThan(0);
    expect(PIANO_BARRA).toBeGreaterThan(0);
  });

  it('nessun pannello fisso e ancorato a bottom:0 sopra il piano della barra', () => {
    const guasti = [];
    for (const f of sorgenti()) {
      if (f.endsWith('BottomNav.js')) continue;       // la barra e lei
      const s = senzaCommenti(fs.readFileSync(f, 'utf8'));
      const stili = /style=\{\{/g;
      let m;
      while ((m = stili.exec(s))) {
        const b = bloccoStile(s, m.index);
        if (!/position:\s*['"]fixed['"]/.test(b)) continue;
        if (!/bottom:\s*0\b/.test(b)) continue;
        if (/top:\s*0\b/.test(b)) continue;           // copre tutto: e un velo, non una fascia
        const piano = Number((b.match(/zIndex:\s*(\d+)/) || [])[1] || 0);
        if (piano > PIANO_BARRA) {
          guasti.push(`${relativo(f)}:${riga(s, m.index)} — fascia fissa a bottom:0 con zIndex ${piano} sopra la barra (${PIANO_BARRA})`);
        }
      }
    }
    expect(guasti).toEqual([]);
  });

  it('la cornice scorrevole condivisa riserva in basso l\'altezza della barra', () => {
    // L'ALTRA FACCIA DELLO STESSO MURO (b.135). `S.page` e fissa fino a
    // bottom:0 e la barra ci sta sopra: senza riempimento in fondo, gli
    // ultimi 76px di OGNI schermata che usa `scrollCenter` sono
    // raggiungibili col dito e mai visibili. Li ci finiva il messaggio
    // d'errore della clonazione voce, e da fuori sembrava che la pagina
    // non salvasse.
    //
    // PROVATO SUL DIFETTO VERO: su `app/lib/styles.js` prima di b.135
    // (84a3406^) `scrollCenter` era `padding:'12px 16px'`, cioe 12px in
    // fondo contro i 76 della barra — rosso.
    const stili = senzaCommenti(fs.readFileSync(path.join(CARTELLA_APP, 'lib/styles.js'), 'utf8'));
    const blocco = stili.slice(stili.indexOf('scrollCenter:'));
    const padding = (blocco.match(/padding:\s*'([^']+)'/) || [])[1];
    expect(padding, 'scrollCenter non dichiara piu un padding').toBeTruthy();

    // L'ultimo valore della scorciatoia e quello in basso; `calc(88px + ...)`
    // conta per 88.
    const pezzi = padding.trim().split(/\s+(?![^(]*\))/);
    const basso = pezzi.length >= 3 ? pezzi[2] : pezzi[0];
    const pixel = Number((basso.match(/(\d+)px/) || [])[1] || 0);
    expect(pixel, `scrollCenter riserva ${pixel}px in fondo, la barra ne occupa ${ALTEZZA_BARRA}`)
      .toBeGreaterThanOrEqual(ALTEZZA_BARRA);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('5 · una vista col fondo pieno rimette lo sfondo animato', () => {

  // page.js disegna SpatialBackdrop e Sciame SOTTO ogni vista (il
  // `wrap` di page.js:1058). Una vista che si dipinge addosso un fondo
  // pieno a tutto schermo li copre: gli effetti ci sono e non si vedono.
  //
  // PROVATO SUL DIFETTO VERO. Su `SceltaPaeseView.js` come stava prima
  // di b.140 (5b918ba^) il riquadro di riga 131 e `position:'fixed'`
  // da top:0 a bottom:0 con un gradiente pieno, e nel file non compare
  // ne <Sciame> ne <SpatialBackdrop>: rosso. Era la prima delle tre
  // domande di Luca ("PERCHE NON CI SONO GLI EFFETTI E GLI SFONDI
  // DINAMICI IN QUESTE PAGINE?"), e in b.144 e tornata identica sulla
  // stessa schermata.
  //
  // Vale per le VISTE, non per i veli: un VideoCallOverlay a tutto
  // schermo deve coprire tutto, ed e il suo mestiere.

  it('ogni *View a tutto schermo con fondo proprio disegna anche lo sfondo', () => {
    const guasti = [];
    for (const f of sorgenti()) {
      if (!/View\.jsx?$/.test(path.basename(f))) continue;
      const s = senzaCommenti(fs.readFileSync(f, 'utf8'));
      if (/<Sciame|<SpatialBackdrop/.test(s)) continue;

      const stili = /style=\{\{/g;
      let m;
      while ((m = stili.exec(s))) {
        const b = bloccoStile(s, m.index);
        if (!/position:\s*['"]fixed['"]/.test(b)) continue;
        if (!/top:\s*0\b/.test(b) || !/bottom:\s*0\b/.test(b)) continue;
        if (!/background:/.test(b)) continue;
        guasti.push(`${relativo(f)}:${riga(s, m.index)} — fondo pieno a tutto schermo, e sotto non resta niente da vedere`);
      }
    }
    expect(guasti).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('6 · la versione dichiarata e quella di questo lavoro', () => {
  it('APP_VERSION esiste ed e ben formata', () => {
    // Si verifica la FORMA e non il valore: inchiodare il numero esatto
    // rende il controllo rosso a ogni rilascio, e un rosso che arriva
    // sempre per il motivo sbagliato insegna a non guardarlo piu.
    const costanti = fs.readFileSync(path.join(CARTELLA_APP, 'lib/constants.js'), 'utf8');
    expect(costanti).toMatch(/APP_VERSION\s*=\s*'b\.\d+'/);
  });
});
