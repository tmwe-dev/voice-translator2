// b.605 — CREARE UNA STANZA E METTERLA IN VETRINA: un passo, in un posto.
//
// Modulo F1 dell'audit di architettura (b.598): page.js (1.967 righe,
// fan-out 71) rende 29 schermate e in mezzo, dentro l'`onCreate` del
// foglio di creazione, portava ~70 righe di logica di dominio — creare
// la stanza, applicare la politica Diretta, decidere se va in vetrina,
// comporre e mandare la POST a /api/mondo con tutti i campi che b.96,
// b.110, b.111, b.397 avevano aggiunto uno alla volta. Logica che
// nessuna prova poteva ESEGUIRE, perche' viveva dentro un componente
// che nessuna prova monta: la si "provava" cercando `nome:` e
// `roomType:` nel testo di page.js.
//
// Qui la stessa sequenza, come funzione pura: riceve quello che le
// serve e torna la stanza. Si esegue in una prova con un fetch finto e
// una roomPolling finta. page.js la chiama e basta.

import { vaInVetrina } from '../decisioni.js';
import { memGet } from '../memoria.js';

export const SCADENZA_PUBBLICAZIONE_MS = 15000;

/**
 * @param {object} p
 * @param {object} p.roomConfig — dal foglio di creazione
 * @param {object} p.prefs — { name, lang, avatar, country }
 * @param {string} p.myLang
 * @param {string} p.selectedMode
 * @param {string} p.selectedContext
 * @param {object} p.auth — { isTrial, isTopPro, userAccount }
 * @param {object} p.roomPolling — { handleCreateRoom, roomSessionTokenRef }
 * @param {(room: object) => void} p.applicaPoliticaStanza
 * @param {{ current: object }} p.roomInfoRef
 * @param {(msg: string, dettaglio?: any) => void} [p.avvisa] — per il guasto di pubblicazione
 * @param {typeof fetch} [p.fetchImpl]
 * @returns {Promise<{ room: object|null, pubblicata: boolean, motivo: string }>}
 */
export async function creaEPubblicaStanza({
  roomConfig, prefs, myLang, selectedMode, selectedContext, auth, roomPolling,
  applicaPoliticaStanza, roomInfoRef, avvisa, fetchImpl = globalThis.fetch,
}) {
  const room = await roomPolling.handleCreateRoom(
    prefs.name || 'Host', roomConfig.lang || myLang,
    roomConfig.mode || selectedMode, prefs.avatar,
    selectedContext, roomConfig.mode || selectedMode,
    roomConfig.description || '',
    auth.isTrial, auth.isTopPro, auth.userAccount,
    roomConfig.diretta,
    roomConfig.maxParticipants,
    roomConfig.ognunoPagaIlSuo
  );
  // ── b.113/b.123 · la scelta dell'utente diventa effettiva QUI ──
  // La modalita' Diretta si legge dalla stanza tornata dal server, con
  // ripiego sulla scelta locale se il server non la rimanda.
  applicaPoliticaStanza?.({ ...room, diretta: room?.diretta ?? roomConfig.diretta });
  if (roomInfoRef) roomInfoRef.current = { ...room, diretta: !!roomConfig.diretta };

  const codice = room?.id;
  if (!codice) return { room, pubblicata: false, motivo: 'stanza-non-creata' };
  // b.139-bis — la regola "va in vetrina?" e' la stessa del server (decisioni.js).
  if (!vaInVetrina(roomConfig.roomType)) return { room, pubblicata: false, motivo: 'privata' };

  try {
    const r = await fetchImpl('/api/mondo', {
      signal: AbortSignal.timeout(SCADENZA_PUBBLICAZIONE_MS),
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: codice,
        host: prefs.name || 'Host',
        nome: roomConfig.nome,
        description: roomConfig.description || '',
        mode: roomConfig.mode,
        categoria: roomConfig.category,
        lang: roomConfig.lang || myLang,
        hostLang: prefs.lang || myLang,
        // b.397 — il Paese viaggia con la stanza (prima si indovinava dalla lingua)
        paese: prefs.country || '',
        roomType: roomConfig.roomType,
        maxPartecipanti: roomConfig.maxParticipants,
        // b.111 — stanza a litigio libero: i reati restano vietati comunque
        hot: !!roomConfig.hot,
        // b.110 — il gettone sta nel ref di roomPolling, non in `room`
        roomSessionToken: roomPolling.roomSessionTokenRef?.current || '',
        userToken: auth.userAccount?.token
          || (typeof window !== 'undefined' ? memGet('vt-token') || '' : ''),
      }),
    });
    if (!r?.ok) {
      avvisa?.('[Community] stanza non pubblicata:', `HTTP ${r?.status}`);
      return { room, pubblicata: false, motivo: `http-${r?.status}` };
    }
    return { room, pubblicata: true, motivo: 'ok' };
  } catch (e) {
    // La stanza esiste comunque: si entra col codice. Solo non compare in
    // vetrina, e l'host deve poterlo sapere.
    avvisa?.('[Community] stanza non pubblicata:', e?.message);
    return { room, pubblicata: false, motivo: 'rete' };
  }
}
