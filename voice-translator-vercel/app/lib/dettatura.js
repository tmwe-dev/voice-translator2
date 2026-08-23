// ═══════════════════════════════════════════════════════════════
// LA DETTATURA — parlare invece di scrivere, in un posto solo.
//
// b.432. Collaudo di Luca: «pagina amico life manca il microfono». Vero:
// li dentro l'unico microfono e quello di «Dal vivo», che apre una
// telefonata. Dettare nel campo non si poteva.
//
// PERCHE UN FILE NUOVO E NON UNA QUARTA COPIA. La stessa dettatura e gia
// scritta a mano in tre punti — la Prima prova, TaxiTalk e la vecchia
// schermata del taxi — e ogni copia si e portata dietro i suoi difetti e
// le sue riparazioni, diverse fra loro. E' esattamente la malattia che il
// diario ha gia curato una volta con il lettore delle notizie (b.409):
// «non un secondo parser, ma quello che c'era messo in comune».
//
// Le tre copie vecchie NON sono state toccate: funzionano, e il codice
// della voce non si riscrive senza poterlo provare davvero. Ma la
// prossima volta che una di loro si apre, si sposta qui.
//
// COSA FA, E COSA NON FA. Apre il riconoscimento del telefono, manda il
// testo mentre arriva (compresi i pezzi ancora provvisori, cosi si vede
// scrivere) e avvisa quando ha finito. Non traduce, non parla, non
// decide niente: quelle sono cose di chi la chiama.
// ═══════════════════════════════════════════════════════════════

/** Il telefono sa ascoltare? Si chiede prima di mostrare un microfono. */
export function dettaturaDisponibile() {
  return typeof window !== 'undefined'
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Comincia ad ascoltare.
 *
 * @param {object} opzioni
 * @param {string} opzioni.lingua   in che lingua si parla (es. 'it-IT' o 'it')
 * @param {string} [opzioni.inizio] cio che c'e gia nel campo: si continua da li
 * @param {(testo: string) => void} opzioni.suTesto   chiamato a ogni pezzo
 * @param {(testo: string) => void} [opzioni.suFine]  chiamato alla chiusura
 * @returns {{ferma: () => void} | null} come fermarla, o null se non si puo
 */
export function ascolta({ lingua, inizio = '', suTesto, suFine }) {
  if (!dettaturaDisponibile()) return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec;
  try { rec = new SR(); } catch { return null; }

  rec.lang = lingua || 'en';
  rec.continuous = true;
  rec.interimResults = true;   // si vede scrivere mentre si parla
  rec.maxAlternatives = 1;

  const base = inizio ? `${inizio} ` : '';
  let definitivo = '';
  let chiuso = false;

  rec.onresult = (ev) => {
    let provvisorio = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) definitivo += `${r[0].transcript} `;
      else provvisorio += r[0].transcript;
    }
    try { suTesto?.(`${base}${definitivo}${provvisorio}`.trimStart()); }
    catch { /* chi ascolta e rotto: la dettatura prosegue lo stesso, non e lei a doversi fermare */ }
  };

  // «no-speech» non e un guasto: e silenzio. Fermare tutto per un momento
  // di pausa e il modo piu sicuro di far sembrare rotto il microfono.
  rec.onerror = (e) => {
    if (e?.error === 'no-speech') return;
    chiuso = true;
    try { suFine?.(`${base}${definitivo}`.trim()); }
    catch { /* chi ascolta e rotto: qui non c'e piu niente da salvare */ }
  };

  rec.onend = () => {
    if (chiuso) return;
    chiuso = true;
    // Si consegna solo il DEFINITIVO: un residuo provvisorio potrebbe
    // dire una cosa diversa da quella che si e sentita, e chi legge non
    // avrebbe modo di accorgersene.
    try { suFine?.(`${base}${definitivo}`.trim()); }
    catch { /* chi ascolta e rotto: la chiusura e comunque avvenuta */ }
  };

  try { rec.start(); }
  catch { return null; }

  return {
    ferma() {
      // Fermare due volte non e un guasto: il riconoscimento era gia
      // chiuso, e insistere non cambia niente.
      try { rec.stop(); } catch { /* era gia fermo: non c'e niente da fermare */ }
    },
  };
}
