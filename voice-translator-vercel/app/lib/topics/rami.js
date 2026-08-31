// ═══════════════════════════════════════════════════════════════
// I RAMI: DA DOVE VIENE LA VARIETA (b.573)
//
// Ordine di Luca, dal vivo: «ma perche non presenti niente random?????
// se non do preferenze lavora su ultime notizie, tendenze, moda,
// wellness etc, non puoi mantenere solo un contesto e non sviluppare
// alcun ramo includendo le ultime ricerche e poi allargando. Devi
// rendere interessante e dare informazioni e curiosita».
//
// Aveva ragione e il difetto era grosso: chi non aveva dato preferenze
// riceveva UNA query sola, «breaking news» del suo Paese (casaEViaggio).
// Un giornale intero costruito su una domanda. Chi invece aveva cercato
// qualcosa restava incollato a quello: cercavi Beethoven una volta e il
// Mondo diventava un monumento a Beethoven.
//
// QUI NON C'E NESSUN CASO. «Random» per chi guarda non vuol dire dadi:
// vuol dire NON PREVEDIBILE. Un dado vero darebbe due volte lo stesso
// ramo e zero volte un altro, e nessuno se ne accorgerebbe se non in
// male. Una RUOTA invece garantisce che in pochi ingressi hai visto
// tutto il giardino, non ha bisogno di memoria, e si puo provare —
// cosa che con Math.random non si potrebbe mai.
//
// La forma del giornale, che risponde parola per parola all'ordine:
//   · si parte da CIO CHE HAI CERCATO   (continuita: sei tu)
//   · si ALLARGA su rami che ruotano    (le tendenze, la moda, il
//     benessere, le curiosita: il mondo che non hai chiesto)
//   · l'ultima ora c'e SEMPRE           (un giornale senza oggi non e
//                                        un giornale)
//
// File PURO: nessun import (lezione di b.559).
// ═══════════════════════════════════════════════════════════════

/**
 * I rami del giardino. Ognuno con le sue parole nelle lingue che
 * parliamo di piu; per le altre si cade sull'inglese, che e' meglio di
 * un ramo mancante.
 *
 * Non sono categorie da archivio: sono LE COSE DI CUI PARLA LA GENTE.
 * Per questo ci sono la moda e le curiosita accanto all'economia.
 */
export const RAMI = [
  { id: 'ultimora',   q: { it: 'ultime notizie oggi', en: 'breaking news today', es: 'últimas noticias hoy', fr: 'dernières nouvelles', de: 'aktuelle nachrichten', pt: 'últimas notícias' } },
  { id: 'tendenze',   q: { it: 'di cosa si parla oggi', en: 'trending today', es: 'tendencias hoy', fr: 'tendances du jour', de: 'trends heute', pt: 'tendências hoje' } },
  { id: 'moda',       q: { it: 'moda tendenze stile', en: 'fashion trends style', es: 'moda tendencias estilo', fr: 'mode tendances style', de: 'mode trends stil', pt: 'moda tendências estilo' } },
  { id: 'benessere',  q: { it: 'benessere salute consigli', en: 'wellness health tips', es: 'bienestar salud consejos', fr: 'bien-être santé conseils', de: 'wohlbefinden gesundheit', pt: 'bem-estar saúde' } },
  { id: 'curiosita',  q: { it: 'curiosità cose che non sapevi', en: 'amazing facts you did not know', es: 'curiosidades increíbles', fr: 'faits étonnants', de: 'erstaunliche fakten', pt: 'curiosidades incríveis' } },
  { id: 'scienza',    q: { it: 'scoperte scientifiche', en: 'science discoveries', es: 'descubrimientos científicos', fr: 'découvertes scientifiques', de: 'wissenschaftliche entdeckungen', pt: 'descobertas científicas' } },
  { id: 'tecnologia', q: { it: 'tecnologia novità', en: 'technology news', es: 'tecnología novedades', fr: 'technologie nouveautés', de: 'technik neuheiten', pt: 'tecnologia novidades' } },
  { id: 'cucina',     q: { it: 'ricette cucina piatti', en: 'recipes cooking food', es: 'recetas cocina', fr: 'recettes cuisine', de: 'rezepte kochen', pt: 'receitas cozinha' } },
  { id: 'viaggi',     q: { it: 'viaggi posti da vedere', en: 'travel places to see', es: 'viajes lugares', fr: 'voyages lieux à voir', de: 'reisen orte', pt: 'viagens lugares' } },
  { id: 'sport',      q: { it: 'sport risultati', en: 'sport results', es: 'deportes resultados', fr: 'sport résultats', de: 'sport ergebnisse', pt: 'esporte resultados' } },
  { id: 'cultura',    q: { it: 'cinema musica spettacolo', en: 'movies music entertainment', es: 'cine música espectáculo', fr: 'cinéma musique spectacle', de: 'kino musik unterhaltung', pt: 'cinema música espetáculo' } },
  { id: 'natura',     q: { it: 'natura animali pianeta', en: 'nature animals planet', es: 'naturaleza animales', fr: 'nature animaux', de: 'natur tiere', pt: 'natureza animais' } },
  { id: 'storie',     q: { it: 'storie di persone', en: 'human stories', es: 'historias de personas', fr: 'histoires de gens', de: 'menschen geschichten', pt: 'histórias de pessoas' } },
  { id: 'soldi',      q: { it: 'economia mercati soldi', en: 'economy markets money', es: 'economía mercados', fr: 'économie marchés', de: 'wirtschaft märkte', pt: 'economia mercados' } },
  { id: 'motori',     q: { it: 'motori auto novità', en: 'cars motors news', es: 'motor coches', fr: 'automobile actualités', de: 'auto news', pt: 'carros novidades' } },
];

// b.585 — un marchio MONOUSO, in memoria soltanto. Non e un nuovo stato
// utente e non finisce in localStorage/Supabase: serve solo a dire al
// client Topics «questa query e stata inventata dal Giardino». Se la
// stessa frase viene cercata a mano dopo, il marchio e gia consumato e
// la ricerca torna esplicita come deve essere.
const automatiche = new Map();
const chiaveAutomatica = (q) => String(q || '').trim().toLowerCase();

export function segnaQueryAutomatica(q) {
  const k = chiaveAutomatica(q);
  if (!k) return;
  automatiche.set(k, (automatiche.get(k) || 0) + 1);
}

export function consumaQueryAutomatica(q) {
  const k = chiaveAutomatica(q);
  const n = automatiche.get(k) || 0;
  if (!k || n < 1) return false;
  if (n === 1) automatiche.delete(k);
  else automatiche.set(k, n - 1);
  return true;
}

/** Le parole di un ramo nella lingua di chi guarda. */
export function ramoParla(ramo, lingua) {
  const l = String(lingua || 'it').split('-')[0].toLowerCase();
  return ramo?.q?.[l] || ramo?.q?.en || '';
}

/**
 * I rami di questo ingresso. `giro` e' il contatore che gia esiste
 * (vt-gazzetta-giro): la ruota avanza da sola a ogni apertura, quindi
 * il giornale cambia faccia senza che nessuno debba ricordarsi niente.
 *
 * L'ultima ora e' SEMPRE la prima — con il nome del Paese davanti se lo
 * sappiamo, perche' «ultime notizie» a Bangkok e a Verbania non sono la
 * stessa cosa.
 */
export function ramiDelGiorno({ lingua = 'it', ultimora = '', giro = 0, quanti = 3 } = {}) {
  const fuori = [];
  const primo = String(ultimora || '').trim() || ramoParla(RAMI[0], lingua);
  if (primo) fuori.push({ id: 'ultimora', query: primo, origine: 'ramo' });
  const altri = RAMI.slice(1);
  const passo = Math.max(1, Math.floor(giro) || 0);
  for (let i = 0; fuori.length < Math.max(1, quanti) && i < altri.length; i += 1) {
    const r = altri[(passo + i) % altri.length];
    const q = ramoParla(r, lingua);
    if (q) fuori.push({ id: r.id, query: q, origine: 'ramo' });
  }
  return fuori;
}

/**
 * PRIMA TU, POI IL MONDO.
 *
 * Si alternano: un seme tuo, un ramo, un seme tuo, un ramo. Cosi il
 * giornale ti riconosce (le tue ricerche ci sono, in cima) ma non ti
 * rinchiude — e chi non ha mai cercato niente non resta con una
 * domanda sola in mano, ha comunque un giardino.
 *
 * Il tetto e' basso apposta: ogni giro e' una chiamata pagata, e un
 * giornale di quattro mazzi e' gia piu di quanto si legga in una volta.
 */
export function mescolaSemi(semiUtente, rami, { quanti = 4 } = {}) {
  const miei = (Array.isArray(semiUtente) ? semiUtente : []).filter((s) => s?.query);
  const suoi = (Array.isArray(rami) ? rami : []).filter((r) => r?.query);
  const fuori = [];
  const visti = new Set();
  const metti = (x) => {
    const k = String(x.query).trim().toLowerCase();
    if (!k || visti.has(k) || fuori.length >= quanti) return;
    visti.add(k); fuori.push(x);
    // Si marca SOLO il ramo che entra davvero nel mazzo. Se una query
    // coincide con un preferito/seme gia inserito, il ramo viene deduplicato
    // e non puo trasformare per errore una richiesta personale in automatica.
    if (x.origine === 'ramo') segnaQueryAutomatica(x.query);
  };
  // al massimo META di quello che si chiede viene da te: l'altra meta e'
  // il mondo. Senza questo tetto, tre preferiti riempirebbero tutto e
  // saremmo di nuovo al monumento a Beethoven.
  const tettoMiei = Math.max(1, Math.floor(quanti / 2));
  let mio = 0;
  let suo = 0;
  while (fuori.length < quanti && (mio < miei.length || suo < suoi.length)) {
    if (mio < miei.length && mio < tettoMiei) { metti(miei[mio]); mio += 1; }
    if (fuori.length >= quanti) break;
    if (suo < suoi.length) { metti(suoi[suo]); suo += 1; }
    else if (mio >= miei.length || mio >= tettoMiei) break;   // finiti entrambi
  }
  return fuori;
}
