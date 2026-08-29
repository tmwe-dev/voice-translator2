// ═══════════════════════════════════════════════════════════════
// LA REGIA — IN CHE ORDINE MOSTRARLO (b.576, FASE 4)
//
// Documento di Luca, capitoli 20-23 e 33. Il Ranker ha detto quanto
// vale ogni pezzo; qui si decide la SEQUENZA. Sono due mestieri
// diversi e la regola 10 impone di tenerli separati.
//
// Perche' separati, detto con l'esempio che lo rende ovvio: i dieci
// pezzi piu rilevanti su una giornata di Formula 1 sono dieci pezzi di
// Formula 1, magari otto dalla stessa testata. Ognuno merita il suo
// punteggio — e insieme, in fila, sono un giornale illeggibile. La
// rilevanza non sa niente della noia; la sequenza si.
//
// LE REGOLE (capitolo 22), e sono quelle che il carosello aveva gia
// imparato a mano in regia.js — qui diventano una cosa sola:
//   · mai piu di due di fila stesso topic, mai piu di due stessa fonte
//   · una quota di mondo: ~22% da fuori, quando c'e'
//   · una quota di scoperta: ~12% fuori dai tuoi interessi
//   · nessun formato oltre l'80% se esistono alternative (cap. 33)
//
// E una regola che non e' scritta nel documento ma viene dai collaudi
// di Luca, e vale piu delle altre: CIO CHE STAI GUARDANDO NON SI TOCCA
// MAI. La sequenza si costruisce in avanti, non si rimescola sotto le
// dita di chi sta scorrendo.
//
// Import: solo file puri di questa cartella.
// ═══════════════════════════════════════════════════════════════
import { REGIA } from './rankingConfig.js';
import { motivo } from './reasons.js';

function primoTopic(x) {
  return x?.content?.topics?.[0] || '';
}

function fonteDi(x) {
  return x?.content?.sourceId || x?.content?.source || '';
}

function eDiScoperta(x) {
  return (x?.reasons || []).some((m) => m?.type === 'discovery');
}

function eInternazionale(x, miaLingua) {
  const l = String(x?.content?.language || '').slice(0, 2).toLowerCase();
  const mia = String(miaLingua || 'it').slice(0, 2).toLowerCase();
  return !!l && l !== mia;
}

/**
 * Il pezzo va bene QUI? Guarda solo la coda di cio che e' gia stato
 * messo: due dello stesso topic o della stessa fonte di fila bastano.
 */
function troppoTopic(x, sequenza) {
  const coda = sequenza.slice(-REGIA.maxStessoTopicDiFila);
  if (coda.length < REGIA.maxStessoTopicDiFila) return false;
  const t = primoTopic(x);
  return !!t && coda.every((y) => primoTopic(y) === t);
}

function troppoFonte(x, sequenza) {
  const coda = sequenza.slice(-REGIA.maxStessaFonteDiFila);
  if (coda.length < REGIA.maxStessaFonteDiFila) return false;
  const f = fonteDi(x);
  return !!f && coda.every((y) => fonteDi(y) === f);
}

export function stonaQui(x, sequenza) {
  return troppoTopic(x, sequenza) || troppoFonte(x, sequenza);
}

/**
 * MondoDirector. Riceve la classifica del Ranker, torna la sequenza.
 *
 * Il metodo e' semplice apposta: si scorre la classifica e si prende il
 * primo che non stona nella posizione corrente. Se stonano tutti, si
 * prende comunque il migliore — perche' la regola numero uno resta che
 * un buco e' peggio di una ripetizione (la lezione di visti.js: si
 * ORDINA, non si filtra).
 */
export function mondoDirector(classificati, {
  miaLingua = 'it',
  quanti = 40,
  formatoMassimo = REGIA.maxUnFormato,
} = {}) {
  const restanti = [...(Array.isArray(classificati) ? classificati : [])].filter(Boolean);
  const sequenza = [];
  const perFormato = {};
  const tetto = Math.max(1, Math.min(quanti, restanti.length));

  // ═══ SI CEDE UNA REGOLA ALLA VOLTA, NON TUTTE INSIEME ═══
  // Prima versione: se nessun candidato andava bene si prendeva il
  // primo della classifica — cioe' si buttavano TUTTE le regole in una
  // volta. Provato con dieci pezzi dello stesso argomento (che e' cio
  // che succede in una giornata di Formula 1) veniva fuori una fila di
  // quattro video della stessa fonte: il caso peggiore, proprio dove
  // la regia doveva servire di piu.
  // Le regole non hanno lo stesso valore. Due pezzi di fila sullo
  // stesso ARGOMENTO, quando la giornata parla solo di quello, sono la
  // realta. Due di fila della stessa FONTE, no: quella e' pigrizia
  // nostra e si vede. Quindi si cede prima l'argomento, poi la fonte,
  // e il formato per ultimo.
  const REGOLE = [
    (x, seq) => !troppoTopic(x, seq) && !troppoFonte(x, seq),   // tutto
    (x, seq) => !troppoFonte(x, seq),                            // l'argomento si ripete: pazienza
    () => true,                                                  // resta solo il formato
  ];

  while (sequenza.length < tetto && restanti.length) {
    let scelto = -1;
    for (const regola of REGOLE) {
      for (let i = 0; i < restanti.length; i += 1) {
        const x = restanti[i];
        if (!regola(x, sequenza)) continue;
        // capitolo 33: nessun formato oltre l'80%, se esiste un'alternativa
        const tipo = x.content?.type || 'article';
        const quanti0 = (perFormato[tipo] || 0) + 1;
        const troppo = sequenza.length >= 4 && (quanti0 / (sequenza.length + 1)) > formatoMassimo;
        if (troppo && restanti.some((y) => (y.content?.type || 'article') !== tipo)) continue;
        scelto = i;
        break;
      }
      if (scelto >= 0) break;
    }
    // nemmeno cosi: si prende il migliore. Un buco e' peggio di una
    // ripetizione (la lezione di visti.js: si ordina, non si filtra).
    if (scelto < 0) scelto = 0;
    const [x] = restanti.splice(scelto, 1);
    perFormato[x.content?.type || 'article'] = (perFormato[x.content?.type || 'article'] || 0) + 1;
    sequenza.push(x);
  }

  return sequenza;
}

/**
 * Com'e' venuta la sequenza. Non serve al motore: serve a NOI, per
 * poter dire con i numeri se le quote del documento sono rispettate
 * invece di crederlo. Un obiettivo che nessuno misura non e' un
 * obiettivo, e' un auspicio.
 */
export function comeEVenuta(sequenza, { miaLingua = 'it' } = {}) {
  const n = sequenza.length || 1;
  const formati = {};
  let internazionali = 0;
  let scoperte = 0;
  let ripetizioniTopic = 0;
  let ripetizioniFonte = 0;
  sequenza.forEach((x, i) => {
    const t = x.content?.type || 'article';
    formati[t] = (formati[t] || 0) + 1;
    if (eInternazionale(x, miaLingua)) internazionali += 1;
    if (eDiScoperta(x)) scoperte += 1;
    if (i >= REGIA.maxStessoTopicDiFila) {
      const finestra = sequenza.slice(i - REGIA.maxStessoTopicDiFila, i + 1);
      const t0 = primoTopic(x);
      if (t0 && finestra.every((y) => primoTopic(y) === t0)) ripetizioniTopic += 1;
      const f0 = fonteDi(x);
      if (f0 && finestra.every((y) => fonteDi(y) === f0)) ripetizioniFonte += 1;
    }
  });
  return {
    quanti: sequenza.length,
    formati,
    quotaInternazionale: internazionali / n,
    quotaScoperta: scoperte / n,
    ripetizioniTopic,
    ripetizioniFonte,
    formatoDominante: Object.entries(formati).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    quotaFormatoDominante: Math.max(0, ...Object.values(formati)) / n,
  };
}

/**
 * Un motivo di scoperta si aggiunge a chi entra per la quota, cosi la
 * scheda puo dirlo: «una scoperta fuori dai tuoi interessi»
 * (capitolo 24).
 */
export function segnaScoperta(x) {
  if (!x || eDiScoperta(x)) return x;
  const m = motivo('discovery', x.content?.topics?.[0] || '');
  return m ? { ...x, reasons: [...(x.reasons || []), m] } : x;
}
