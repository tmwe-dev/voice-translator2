// ═══════════════════════════════════════════════════════════════
// IL CONFINE — dove finisce il litigio e comincia il reato (b.111)
//
// Nelle stanze "hot" ci si puo mandare a quel paese. E la scelta: due
// persone che litigano in due lingue diverse hanno il diritto di
// litigare davvero, non di essere addolcite dal traduttore. Li il velo
// grigio non scende: si e entrati sapendo cosa c'era dentro.
//
// Ma c'e un confine, e non si sposta a seconda della stanza:
//
//   INSULTO  → permesso ovunque, coperto dal velo nelle stanze normali,
//              scoperto nelle stanze hot.
//   REATO    → vietato OVUNQUE. Non si vela: non parte proprio.
//
// La differenza non e la durezza delle parole. E che l'insulto offende
// e finisce li, mentre queste cose fanno male anche dopo che la
// conversazione e chiusa: una minaccia resta addosso, un indirizzo
// pubblicato resta pubblicato, un ricatto continua a funzionare.
//
// ── COSA SO FARE E COSA NO, DETTO SUBITO ──
//
// Questo e un elenco di forme ricorrenti, non un giudice. Sbagliera:
//  · per DIFETTO su chi minaccia con garbo, o in una delle quaranta
//    lingue non elencate qui;
//  · per ECCESSO su una citazione, una battuta, un film raccontato.
//
// Per questo NON basta da solo. E il primo filtro, quello istantaneo,
// che funziona anche nelle chat cifrate dove il server non vede niente.
// Dietro restano la segnalazione (moderazione.js) e l'host che
// allontana. Chi progetta questo file non deve credere di aver risolto
// il problema: ha alzato il costo del gesto piu stupido.
//
// ── PERCHE LE FORME E NON LE PAROLE ──
//
// "ammazzare" da solo non e niente: si ammazza il tempo, la noia, una
// partita. Cio che conta e la forma "io + faccio del male + a te".
// Quindi si cercano coppie, non vocaboli — meno falsi allarmi, e chi
// vuole aggirare deve cambiare la frase, non una lettera.
// ═══════════════════════════════════════════════════════════════

import { appiattisci } from './velo.js';

// ── 1. MINACCIA DI MORTE O DI VIOLENZA ──
// Serve il bersaglio: "ti", "you", "te", "dich". Senza, non e rivolto
// a nessuno e non e una minaccia.
const MINACCE = [
  // italiano
  /\bti (ammazzo|uccido|accoppo|sgozzo|spacco la testa|faccio (fuori|del male))\b/,
  /\bvi (ammazzo|uccido|faccio fuori)\b/,
  /\b(ammazzo|uccido) (tuo|tua|i tuoi|le tue|te e)\b/,
  /\bti (vengo a (prendere|cercare)|aspetto sotto casa)\b/,
  // inglese
  /\bi('| a)?m? ?(will |gonna |going to )?(kill|murder|stab|shoot) (you|u|ya)\b/,
  /\b(kill|murder) (you|your (family|kids|children))\b/,
  /\bi know where you (live|work|sleep)\b/,
  // spagnolo
  /\b(te|os) (mato|voy a matar|voy a mandar)\b/,
  /\bs[ée] d[óo]nde vives\b/,
  // francese
  /\bje vais te (tuer|buter|crever|retrouver)\b/,
  /\bje sais o[uù] tu (habites|vis)\b/,
  // tedesco
  /\bich (bringe|mach) dich (um|fertig)\b/,
  /\bich wei[sß]+ wo du wohnst\b/,
  // portoghese
  /\b(te|vou te) (mato|matar)\b/,
  /\bsei onde (voce|voc[êe]) mora\b/,
];

// Sapere dove abita qualcuno, in italiano, senza verbo di minaccia:
// da solo e gia intimidazione quando arriva in un litigio.
const INTIMIDAZIONI = [
  /\bso dove (abiti|vivi|lavori|dormi)\b/,
  /\bconosco (il tuo indirizzo|casa tua)\b/,
];

// ── 2. RICATTO ED ESTORSIONE ──
// La forma e "se non fai X, io pubblico/dico/mando".
const RICATTI = [
  /\bse non (paghi|mi dai|fai quello che)\b[\s\S]{0,60}\b(pubblico|mando|dico|faccio vedere|lo sapranno)\b/,
  /\b(pubblico|mando|faccio girare) (le tue|quelle) (foto|immagini|chat)\b/,
  /\bif you (don'?t|dont) (pay|send)\b[\s\S]{0,60}\b(i('| wi)?ll )?(post|send|leak|share)\b/,
  /\b(leak|post) your (nudes|photos|pics)\b/,
];

// ── 3. MATERIALE SESSUALE CHE COINVOLGE MINORI ──
// Qui non si cerca la forma ma l'ACCOSTAMENTO: un termine sessuale
// esplicito nella stessa frase di un termine che indica un minore.
// Nessuna stanza, per quanto "hot", rende questo discutibile.
const SESSUALI = /\b(sesso|scopare|scopo|nud[aeoi]|porno|pompino|eccita|masturb|fottere|fuck|nude|naked|porn|blowjob|horny|sexo|desnud|follar|nu(e|es)\b|baise)/;
const MINORI = /\b(bambin[aeoi]|bimb[aeoi]|ragazzin[aeoi]|minorenn[ei]|infradiciotto|dodicenn|tredicenn|quattordicenn|child(ren)?|kid|kids|minor|underage|preteen|ni[ñn][ao]s?|enfant|kind(er)?|crian[çc]a)\b/;

// ── 4. ISTIGAZIONE / TERRORISMO ──
const ISTIGAZIONI = [
  /\b(come|how to) (fare|build|make) (una |a )?(bomba|bomb|explosive|ordigno)\b/,
  /\b(dobbiamo|bisogna) (ammazzarli|ucciderli|sterminarli|bruciarli tutti)\b/,
  /\b(kill|gas|exterminate) (them )?all\b/,
];

/** @typedef {{ vietato: boolean, categoria: string, motivo: string }} Verdetto */

const NIENTE = { vietato: false, categoria: '', motivo: '' };

/**
 * C'e un reato in questo testo?
 *
 * Vale in OGNI stanza, hot comprese: e questo che distingue "litigio
 * libero" da "terra di nessuno".
 *
 * @param {string} testo
 * @returns {Verdetto}
 */
export function reato(testo) {
  if (!testo || typeof testo !== 'string') return NIENTE;
  const piatto = appiattisci(testo);

  for (const r of MINACCE) {
    if (r.test(piatto)) {
      return { vietato: true, categoria: 'minaccia', motivo: 'Minacce di violenza: non si possono mandare, nemmeno qui.' };
    }
  }
  for (const r of INTIMIDAZIONI) {
    if (r.test(piatto)) {
      return { vietato: true, categoria: 'intimidazione', motivo: 'Riferimenti a dove vive una persona: e intimidazione.' };
    }
  }
  for (const r of RICATTI) {
    if (r.test(piatto)) {
      return { vietato: true, categoria: 'ricatto', motivo: 'Ricatto: non si puo mandare.' };
    }
  }
  if (SESSUALI.test(piatto) && MINORI.test(piatto)) {
    return { vietato: true, categoria: 'minori', motivo: 'Contenuto sessuale riferito a minori: vietato ovunque, sempre.' };
  }
  for (const r of ISTIGAZIONI) {
    if (r.test(piatto)) {
      return { vietato: true, categoria: 'istigazione', motivo: 'Istigazione alla violenza: non si puo mandare.' };
    }
  }
  return NIENTE;
}

/**
 * Il messaggio puo partire?
 * Unico punto da cui passa la domanda, cosi il confine e uno solo e
 * non tre versioni leggermente diverse sparse per il programma.
 */
export function puoPartire(testo) {
  const v = reato(testo);
  return { ok: !v.vietato, ...v };
}

export const CATEGORIE_REATO = ['minaccia', 'intimidazione', 'ricatto', 'minori', 'istigazione'];
