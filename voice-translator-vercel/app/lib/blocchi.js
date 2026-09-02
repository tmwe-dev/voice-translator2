// b.601 — CHI E' BLOCCATO: la domanda, da sola.
//
// `eBloccato` viveva in moderazione.js, e store.js (che sta SOTTO
// moderazione: e' moderazione che espelle usando lo store) la chiedeva
// con un import pigro di moderazione.js in due punti, mentre moderazione
// chiedeva `removeMember` allo store con un altro import pigro. Due
// moduli che si importano a vicenda, tenuti insieme dal caricamento
// pigro e da un commento che diceva il falso ("store.js non importa mai
// moderazione.js"). madge: 2 dei 4 cicli della lib.
//
// La domanda "questo nome e' bloccato in questa stanza?" non ha bisogno
// di nessuno dei due: le bastano Redis e la normalizzazione del nome.
// Sta qui, foglia, e la importano tutti e due alla luce del sole.

import { redis } from './redis.js';
import { normalizzaNome } from './decisioni.js';

export const chiaveBloccati = (roomId) => `stanza:${roomId}:bloccati`;

export async function eBloccato(roomId, nome) {
  const n = normalizzaNome(nome);
  if (!n) return false;
  const dentro = await redis('SISMEMBER', chiaveBloccati(roomId), n);
  return dentro === 1 || dentro === true;
}
