// ═══════════════════════════════════════════════════════════════
// CHI C'E' NELLA STANZA — letto in modo che non possa mai schiantare.
//
// b.387, secondo collaudo di Luca. Due schianti diversi, stessa causa:
//
//   [Poll] error: TypeError: e.members.filter is not a function
//   Azioni AI  → TypeError: P.find is not a function → l'app cade
//
// E, molto peggio dei due schianti, la conseguenza silenziosa: chi
// scrive decide IN CHE LINGUA TRADURRE guardando i membri. Se non li
// ha, manda il testo grezzo — e due persone di lingua diversa, nella
// stanza, non si capiscono. Cioe la funzione per cui esiste il prodotto.
//
// PERCHE' I MEMBRI POSSONO MANCARE, ed e giusto che manchino: la lettura
// PUBBLICA di una stanza non li restituisce apposta — «quanti sono, non
// chi sono». Restituisce `membersCount` e `langs`. Quindi il client deve
// saper vivere con una risposta che non li ha, invece di dare per
// scontato un array e morire.
//
// Qui c'e un posto solo che risponde alle due domande, e non lancia mai.
// ═══════════════════════════════════════════════════════════════

/** I membri, SEMPRE come elenco: mai undefined, mai un oggetto. */
export function membriDi(room) {
  const m = room?.members;
  return Array.isArray(m) ? m : [];
}

/** Quanti sono davvero: dall'elenco se c'e, se no dal conteggio. */
export function quantiDentro(room) {
  const m = membriDi(room);
  if (m.length) return m.length;
  const n = Number(room?.membersCount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * In che lingua devo tradurre quello che scrivo.
 *
 * b.387 — la vera riparazione del P0. Prima si guardava SOLO l'elenco
 * dei membri, e se mancava si ripiegava su un'ipotesi cieca
 * (italiano/inglese a caso). Se nella stanza c'era un tedesco, riceveva
 * l'inglese; e col testo grezzo, niente.
 *
 * Adesso ci sono tre strade, dalla piu precisa alla piu grossolana, e la
 * seconda usa un dato che la risposta pubblica DA' SEMPRE:
 *
 *   1. l'elenco dei membri, se c'e: la lingua di chi non sono io;
 *   2. `langs` della stanza — le lingue che ci si parlano, che arrivano
 *      anche quando i nomi non arrivano;
 *   3. solo se non c'e nemmeno quello, il vecchio ripiego.
 *
 * @returns {string|null} il codice lingua, o null se non si sa
 */
export function linguaDellAltro(room, mioNome, miaLingua) {
  const mia = String(miaLingua || '').split('-')[0];

  for (const m of membriDi(room)) {
    if (!m || m.name === mioNome || !m.lang) continue;
    if (String(m.lang).split('-')[0] === mia) continue;
    return m.lang;
  }

  const lingue = Array.isArray(room?.langs) ? room.langs : [];
  for (const l of lingue) {
    if (l && String(l).split('-')[0] !== mia) return l;
  }

  return null;
}

/**
 * TUTTE le lingue verso cui tradurre (stanza di gruppo): la mia esclusa.
 * Stessa scala di ripieghi di sopra.
 */
export function lingueDegliAltri(room, mioNome, miaLingua) {
  const mia = String(miaLingua || '').split('-')[0];
  const fuori = new Set();

  for (const m of membriDi(room)) {
    if (!m || m.name === mioNome || !m.lang) continue;
    if (String(m.lang).split('-')[0] === mia) continue;
    fuori.add(m.lang);
  }
  if (fuori.size) return [...fuori];

  for (const l of (Array.isArray(room?.langs) ? room.langs : [])) {
    if (l && String(l).split('-')[0] !== mia) fuori.add(l);
  }
  return [...fuori];
}
