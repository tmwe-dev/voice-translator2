// ═══════════════════════════════════════════════════════════════
// LA REGIA DEL CAROSELLO (b.561)
//
// Ordini di Luca, in due tempi. Prima il comportamento:
//   «Se cerco tom cruise mostri tom cruise, ma poi mostri anche il
//    resto random, dando priorita ai gusti, la permanenza, le
//    interazioni, sviluppi i rami. Devi gestire il carosello in modo
//    entertainment senza dimenticare che non devi essere ripetitivo,
//    devi essere curioso, mai monotono, esplorativo, intraprendente.»
// Poi la dottrina, dopo aver studiato come fa Instagram:
//   «Analizza cosa possiamo integrare per rendere la nostra esperienza
//    migliore di quella degli utenti Instagram.»
//
// LA DIFFERENZA CHE CONTA. Il loro imbuto ottimizza il tempo sull'app,
// e da li viene tutto: il feed che converge, le stesse cinque facce,
// l'indignazione che gira meglio della notizia. Noi non abbiamo i dati
// per addestrare un modello — con dieci utenti una REGOLA SCRITTA BENE
// batte qualunque rete neurale — e non abbiamo il loro obiettivo.
//
// LE CINQUE REGOLE, e sono tutte qui dentro:
//   1. QUOTA DI MONDO — almeno una scheda su quattro viene da un'altra
//      lingua. Non «se capita»: per costruzione. E' l'unica cosa che
//      Instagram non puo copiare senza rifare l'azienda, ed e' il
//      motivo per cui BarTalk esiste.
//   2. MAI DUE DI FILA uguali — stessa fonte, stesso tema. E' cio che
//      separa un carosello da un elenco.
//   3. UNA SORPRESA OGNI SETTE — esplorazione che non si spegne MAI,
//      nemmeno quando il sistema crede di averti capito. E' quella che
//      evita di vedere Beethoven per sempre perche' una volta l'hai
//      cercato.
//   4. NIENTE GIA VISTO in cima (visti.js manda in fondo, non fuori).
//   5. OGNI SCHEDA SA DIRE PERCHE' — «perche hai cercato Thailandia»,
//      «perche segui Il Post», «perche e' la sorpresa di oggi».
//      Instagram non lo fara mai: se ti mostrasse i pesi, capiresti che
//      sei tu il prodotto.
//
// Qui dentro non si importa NIENTE: e' un file puro, e il browser lo
// puo leggere senza tirarsi dietro mezzo Node (lezione di b.559).
// ═══════════════════════════════════════════════════════════════

/** Perche' una scheda e' nel carosello. Sono chiavi di traduzione. */
export const PERCHE = {
  cercato: 'perCercato',     // l'hai chiesto tu
  seme: 'perSeme',           // un tuo interesse fisso
  ramo: 'perRamo',           // il giardino ha allargato di qui
  mondo: 'perMondo',         // arriva da un'altra lingua
  sorpresa: 'perSorpresa',   // esplorazione, e si dice
};

export const QUOTA_MONDO = 0.25;    // una su quattro
export const SORPRESA_OGNI = 7;

const nudo = (d) => String(d || '').trim().toLowerCase()
  .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

/** Chi racconta questa scheda: il dominio, o il canale per i video. */
export function fonteDi(x) {
  if (!x) return '';
  return nudo(x.dominio || x.url || '') || String(x.canale || '').toLowerCase();
}

/** Di cosa parla: il seme che l'ha portata, o la fonte come ripiego. */
export function temaDi(x) {
  return String(x?.seme || x?.tema || '').toLowerCase() || fonteDi(x);
}

/** Viene da un'altra lingua? */
export function eDelMondo(x, miaLingua = 'it') {
  const l = String(x?.lingua || '').slice(0, 2).toLowerCase();
  return !!l && l !== String(miaLingua || 'it').slice(0, 2).toLowerCase();
}

// ═══ I GUSTI: contatori, non un modello ═══
//
// Instagram predice venti probabilita con una rete neurale. Noi
// contiamo cinque cose per tema, e con dieci utenti funziona meglio:
// un modello senza dati e' peggio di una regola.
//
// I gesti pesano diversamente perche' COSTANO diversamente: mettere in
// bacheca e' una decisione, un cuore e' un istante, restare dieci
// secondi e' involontario e per questo e' il segnale piu onesto che
// esista. E il rifiuto pesa piu del gradimento — i rifiuti sono molti
// di piu, e chi salta in due secondi ha detto qualcosa di preciso.
export const PESI = {
  bacheca: 5,
  aperto: 3,
  cuore: 3,
  commento: 4,
  reazione: 2,
  restato: 2,     // piu di dieci secondi sulla scheda
  saltato: -2,    // via in meno di due secondi
  nascosto: -8,   // «non mostrarmelo piu»
};

/** Aggiunge un gesto al peso di un tema. Ritorna la mappa NUOVA. */
export function annota(gusti, tema, gesto) {
  const t = String(tema || '').toLowerCase();
  const p = PESI[gesto];
  if (!t || !p) return gusti || {};
  const ora = { ...(gusti || {}) };
  ora[t] = Math.max(-40, Math.min(120, (ora[t] || 0) + p));
  return ora;
}

/** Quanto ti piace un tema, da -40 a 120. Zero = non lo so. */
export function peso(gusti, tema) {
  return (gusti || {})[String(tema || '').toLowerCase()] || 0;
}

/**
 * ═══ LA COMPOSIZIONE ═══
 *
 * `richiesta` sono le schede che rispondono a cio che hai appena
 * chiesto: vengono PRIME e in ordine, sempre. «Se cerco tom cruise
 * mostri tom cruise» — prima di ogni intelligenza viene il rispetto
 * della domanda.
 *
 * `altre` e' tutto il resto (rami, gusti, mondo): da li si pesca
 * secondo le regole, non secondo l'ordine di arrivo.
 */
export function componi(richiesta, altre, {
  gusti = {}, miaLingua = 'it', quantaRichiesta = 4,
  sorpresaOgni = SORPRESA_OGNI, quotaMondo = QUOTA_MONDO,
} = {}) {
  const testa = (Array.isArray(richiesta) ? richiesta : []).slice(0, quantaRichiesta)
    .map((x) => ({ ...x, perche: x.perche || PERCHE.cercato }));

  const restanti = [
    ...(Array.isArray(richiesta) ? richiesta : []).slice(quantaRichiesta),
    ...(Array.isArray(altre) ? altre : []),
  ].filter(Boolean);

  const fuori = [...testa];
  const rimaste = [...restanti];
  let dalMondo = fuori.filter((x) => eDelMondo(x, miaLingua)).length;

  const vaBene = (c) => {
    const ultima = fuori[fuori.length - 1];
    if (!ultima) return true;
    if (fonteDi(c) && fonteDi(c) === fonteDi(ultima)) return false;   // regola 2
    if (temaDi(c) && temaDi(c) === temaDi(ultima)) return false;
    return true;
  };

  while (rimaste.length) {
    const posto = fuori.length + 1;
    let scelta = -1;

    // REGOLA 3 — la sorpresa: ogni sette posti si prende la cosa piu
    // LONTANA dai gusti, non la piu vicina. E' l'unica riga di questo
    // file che va contro il gradimento, ed e' apposta.
    if (posto % sorpresaOgni === 0) {
      let piuLontano = Infinity;
      rimaste.forEach((c, i) => {
        const p = peso(gusti, temaDi(c));
        if (p < piuLontano && vaBene(c)) { piuLontano = p; scelta = i; }
      });
    }

    // REGOLA 1 — la quota di mondo: se siamo sotto, il prossimo posto
    // se lo prende una scheda che arriva da un'altra lingua.
    if (scelta < 0 && (dalMondo / posto) < quotaMondo) {
      scelta = rimaste.findIndex((c) => eDelMondo(c, miaLingua) && vaBene(c));
    }

    // e negli altri posti comanda il gusto, a parita di regole.
    if (scelta < 0) {
      let miglior = -Infinity;
      rimaste.forEach((c, i) => {
        if (!vaBene(c)) return;
        const p = peso(gusti, temaDi(c));
        if (p > miglior) { miglior = p; scelta = i; }
      });
    }

    // se le regole hanno bloccato tutto, si prende comunque il primo:
    // meglio due della stessa fonte che un giornale che finisce.
    if (scelta < 0) scelta = 0;

    const [presa] = rimaste.splice(scelta, 1);
    if (eDelMondo(presa, miaLingua)) dalMondo += 1;
    fuori.push({
      ...presa,
      perche: presa.perche
        || (eDelMondo(presa, miaLingua) ? PERCHE.mondo
          : (fuori.length + 1) % sorpresaOgni === 0 ? PERCHE.sorpresa
            : presa.seme ? PERCHE.seme : PERCHE.ramo),
    });
  }
  return fuori;
}
