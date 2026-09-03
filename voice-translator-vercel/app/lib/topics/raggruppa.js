// ═══════════════════════════════════════════════════════════════
// RAGGRUPPAMENTO IN ARGOMENTI — trenta articoli, non trenta card
//
// "Principali titoli" non deve restituire i primi trenta URL: sette
// testate che raccontano lo stesso evento devono diventare UNA card
// con sette fonti. Qui si fa senza AI, di proposito: la somiglianza
// fra titoli si misura contando le parole significative in comune
// (Jaccard sugli insiemi di parole). Costa zero, funziona in ogni
// lingua che separa le parole con gli spazi, e per il cinese/giapponese
// ripiega sui bigrammi di caratteri. Il riassunto AI, quando verra,
// si aggiungera SOPRA questi cluster, non al posto loro.
// ═══════════════════════════════════════════════════════════════

import { pulisciTesto } from './registro.js';   // b.617 — una sola pulizia del testo

// Parole vuote minime nelle lingue principali: tolgono rumore dal confronto.
const VUOTE = new Set([
  'il','lo','la','le','gli','un','una','di','da','in','con','per','su','che','del','della','dei','delle','al','alla','ai','e','a','o',
  'the','a','an','of','to','in','on','for','and','or','is','are','at','by','with','from','as','it','its','after','over','new',
  'der','die','das','und','von','mit','für','auf','im','den','dem','ein','eine','zu','nach','bei',
  'el','los','las','de','del','en','con','por','para','y','que','al','una','uno',
  'le','les','des','du','de','la','un','une','et','en','pour','sur','avec','au','aux','dans',
  'o','os','as','um','uma','em','no','na','dos','das','com','por','para','que',
]);

/** Riduce un titolo al suo insieme di parole significative. */
export function impronta(titolo) {
  const pulito = (titolo || '').toLowerCase()
    .replace(/[«»"'''""!?,.;:()\[\]|–—-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  // Lingue senza spazi: bigrammi di caratteri CJK
  if (/[぀-ヿ一-鿿가-힯]/.test(pulito) && pulito.split(' ').length <= 2) {
    const caratteri = pulito.replace(/\s/g, '');
    const bigrammi = new Set();
    for (let i = 0; i < caratteri.length - 1; i++) bigrammi.add(caratteri.slice(i, i + 2));
    return bigrammi;
  }
  return new Set(pulito.split(' ').filter(p => p.length > 2 && !VUOTE.has(p)));
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let comuni = 0;
  for (const x of a) if (b.has(x)) comuni++;
  return comuni / (a.size + b.size - comuni);
}

const SOGLIA_STESSO_EVENTO = 0.3;

/**
 * Da articoli piatti a Topic Card: articoli che raccontano lo stesso
 * evento diventano un solo argomento con l'elenco delle fonti.
 *
 * Ordinamento del piano: prima chi ha piu fonti (evento coperto da
 * piu testate = evento che conta), poi il piu recente.
 */
export function raggruppaInArgomenti(articoli) {
  const gruppi = [];
  for (const art of articoli) {
    const mia = impronta(art.titolo);
    let casa = null;
    for (const g of gruppi) {
      if (jaccard(mia, g.impronta) >= SOGLIA_STESSO_EVENTO) { casa = g; break; }
    }
    if (!casa) {
      casa = { impronta: mia, articoli: [] };
      gruppi.push(casa);
    } else {
      // L'impronta del gruppo si allarga: cosi il terzo articolo puo
      // agganciarsi anche se somiglia al secondo piu che al primo.
      for (const p of mia) casa.impronta.add(p);
    }
    casa.articoli.push(art);
  }

  const argomenti = gruppi.map((g, i) => {
    const capo = g.articoli[0];
    const conImmagine = g.articoli.find(a => a.immagine);
    const conDescrizione = g.articoli
      .filter(a => a.descrizione)
      .sort((a, b) => b.descrizione.length - a.descrizione.length)[0];
    const fonti = [];
    const dominiVisti = new Set();
    for (const a of g.articoli) {
      if (dominiVisti.has(a.dominio)) continue;
      dominiVisti.add(a.dominio);
      fonti.push({ dominio: a.dominio, fonte: a.fonte, url: a.url, titolo: a.titolo });
    }
    const pubblicati = g.articoli.map(a => a.pubblicato).filter(Boolean);
    return {
      id: `t${i}`,
      titolo: capo.titolo,
      // b.617 — SI RIPULISCE ANCHE IN USCITA. La b.615 aveva corretto la
      // decodifica in INGRESSO, ma le schede gia' in cache restavano com'erano:
      // dal vivo (collaudo 03/09) «...febbraio 2027.&nbsp;\"El Nino...» era
      // ancora li. Qui passa tutto cio che va a schermo, cache compresa.
      sintesi: pulisciTesto(conDescrizione?.descrizione || ''),
      immagine: conImmagine?.immagine || '',
      url: capo.url,
      fonti,
      pubblicato: pubblicati.length ? Math.max(...pubblicati) : null,
    };
  });

  argomenti.sort((a, b) =>
    (b.fonti.length - a.fonti.length) || ((b.pubblicato || 0) - (a.pubblicato || 0)));
  return argomenti;
}
