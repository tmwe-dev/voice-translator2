// ═══════════════════════════════════════════════════════════════
// LA FRESCHEZZA — quanto indietro vale una notizia (b.559)
//
// Questo file esiste per una ragione precisa, e la ragione e' un
// errore mio: in b.557 avevo messo queste funzioni dentro
// `registro.js`, che legge i flussi dalla rete e quindi importa
// `ssrf.js`, che importa `dns` di Node. Quando MondoNews — che e'
// codice del BROWSER — ha importato `soloRecenti`, si e' portato
// dietro tutta quella catena e la compilazione e' morta:
//   Module not found: Can't resolve 'dns'
// Due deploy di fila in errore, e Luca intanto vedeva la versione
// vecchia senza sapere perche'.
//
// LA REGOLA CHE NE ESCE: una funzione PURA non vive nello stesso file
// di chi apre connessioni. Non e' pulizia formale — e' cio che decide
// se il browser puo usarla senza trascinarsi dietro mezzo Node.
//
// Qui dentro non si importa niente. Nemmeno una riga.
// ═══════════════════════════════════════════════════════════════

export const DUE_GIORNI = 48 * 3600 * 1000;

export function soloRecenti(voci, { finestra = DUE_GIORNI, adesso = Date.now() } = {}) {
  const lista = Array.isArray(voci) ? voci : [];
  const dentro = [];
  const senzaData = [];
  for (const v of lista) {
    if (!v?.pubblicato) { senzaData.push(v); continue; }
    if (adesso - v.pubblicato <= finestra) dentro.push(v);
  }
  dentro.sort((a, b) => (b.pubblicato || 0) - (a.pubblicato || 0));
  return [...dentro, ...senzaData];
}

/** Quanto e' fresca una lista: serve a decidere se allargare la finestra. */
export function quantiFreschi(voci, { finestra = DUE_GIORNI, adesso = Date.now() } = {}) {
  return (Array.isArray(voci) ? voci : []).filter((v) => v?.pubblicato && adesso - v.pubblicato <= finestra).length;
}
