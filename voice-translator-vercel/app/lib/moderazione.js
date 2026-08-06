import { redis } from './redis.js';

// ═══════════════════════════════════════════════════════════════
// MODERAZIONE DELLE STANZE
//
// Tre cose, tenute insieme perche vivono dello stesso dato:
//
//   1. CHI PUO ENTRARE   — stanze "su approvazione": si bussa, l'host apre
//   2. CHI DEVE USCIRE   — l'host blocca una persona, e non rientra
//   3. CHI SI COMPORTA MALE — le segnalazioni si sommano sul nome, e chi ne
//      raccoglie troppe non entra piu nelle stanze dove non e invitato
//
// Dentro una stanza una persona e il suo NOME: e l'unita che usa gia tutto
// il resto (roomSessionToken porta roomId + name + role). Non inventiamo
// una seconda identita, che si disallineerebbe il giorno dopo.
// ═══════════════════════════════════════════════════════════════

const GIORNO = 86400;
const ORA = 3600;

// Le stanze Community vivono un'ora: le loro liste non devono sopravvivere
// alla stanza, altrimenti un nome resta bloccato in una stanza che non
// esiste piu. Le segnalazioni invece seguono la persona, e durano.
const TTL_STANZA = ORA * 2;
const TTL_SEGNALAZIONI = GIORNO * 30;

// Oltre questa soglia si entra solo dove si e invitati.
export const SOGLIA_SEGNALAZIONI = 5;

const chiave = {
  regole: (r) => `stanza:${r}:regole`,
  bloccati: (r) => `stanza:${r}:bloccati`,
  richieste: (r) => `stanza:${r}:richieste`,
  esito: (r, n) => `stanza:${r}:esito:${n}`,
  segnalazioni: (n) => `segnalazioni:${n}`,
  giaSegnalato: (n, da) => `segnalato:${n}:da:${da}`,
};

// Il nome si confronta senza maiuscole e senza spazi ai bordi: "Marco" e
// "marco " sono la stessa persona, e un blocco aggirabile con lo shift non
// sarebbe un blocco.
export function normalizza(nome) {
  return (nome || '').trim().toLowerCase().slice(0, 40);
}

// ── Regole della stanza (scritte quando la stanza viene pubblicata) ──

export async function salvaRegole(roomId, { suApprovazione, hostNome, hot }) {
  await redis('SET', chiave.regole(roomId),
    // b.111 — `hot`: stanza a litigio libero. Toglie la tendina grigia
    // davanti al linguaggio pesante, NON il divieto sui reati: quello
    // vale in ogni stanza e lo fa rispettare reati.js.
    JSON.stringify({ suApprovazione: !!suApprovazione, hostNome: normalizza(hostNome), hot: !!hot }),
    'EX', TTL_STANZA);
}

export async function leggiRegole(roomId) {
  const grezzo = await redis('GET', chiave.regole(roomId));
  const nessuna = { suApprovazione: false, hostNome: '', hot: false };
  if (!grezzo) return nessuna;
  // Una stanza vecchia, salvata prima di b.111, non ha il campo `hot`:
  // deve risultare NON hot, mai il contrario. Nel dubbio si copre.
  try { return { ...nessuna, ...JSON.parse(grezzo) }; } catch { return nessuna; }
}

export async function eHost(roomId, nome) {
  const { hostNome } = await leggiRegole(roomId);
  return !!hostNome && hostNome === normalizza(nome);
}

// ── Blocco ──

export async function blocca(roomId, nome) {
  const n = normalizza(nome);
  if (!n) return false;
  await redis('SADD', chiave.bloccati(roomId), n);
  await redis('EXPIRE', chiave.bloccati(roomId), TTL_STANZA);
  // Un bloccato non deve restare in coda fra le richieste in attesa.
  await redis('SREM', chiave.richieste(roomId), n);
  await redis('SET', chiave.esito(roomId, n), 'bloccato', 'EX', TTL_STANZA);
  return true;
}

export async function sblocca(roomId, nome) {
  const n = normalizza(nome);
  if (!n) return false;
  await redis('SREM', chiave.bloccati(roomId), n);
  await redis('DEL', chiave.esito(roomId, n));
  return true;
}

export async function eBloccato(roomId, nome) {
  const n = normalizza(nome);
  if (!n) return false;
  const dentro = await redis('SISMEMBER', chiave.bloccati(roomId), n);
  return dentro === 1 || dentro === true;
}

export async function elencoBloccati(roomId) {
  return (await redis('SMEMBERS', chiave.bloccati(roomId))) || [];
}

// ── Ingresso su approvazione ──

export async function richiediIngresso(roomId, nome) {
  const n = normalizza(nome);
  if (!n) return 'rifiutato';
  if (await eBloccato(roomId, nome)) return 'bloccato';

  const gia = await redis('GET', chiave.esito(roomId, n));
  if (gia === 'ammesso') return 'ammesso';
  if (gia === 'rifiutato') return 'rifiutato';

  await redis('SADD', chiave.richieste(roomId), n);
  await redis('EXPIRE', chiave.richieste(roomId), TTL_STANZA);
  return 'in-attesa';
}

export async function richiesteInAttesa(roomId) {
  return (await redis('SMEMBERS', chiave.richieste(roomId))) || [];
}

export async function decidi(roomId, nome, ammesso) {
  const n = normalizza(nome);
  if (!n) return false;
  await redis('SREM', chiave.richieste(roomId), n);
  await redis('SET', chiave.esito(roomId, n), ammesso ? 'ammesso' : 'rifiutato', 'EX', TTL_STANZA);
  return true;
}

export async function statoIngresso(roomId, nome) {
  const n = normalizza(nome);
  if (!n) return 'rifiutato';
  if (await eBloccato(roomId, nome)) return 'bloccato';
  const esito = await redis('GET', chiave.esito(roomId, n));
  if (esito) return esito;
  const inCoda = await redis('SISMEMBER', chiave.richieste(roomId), n);
  return (inCoda === 1 || inCoda === true) ? 'in-attesa' : 'mai-chiesto';
}

// L'host della stanza non deve bussare alla propria porta.
export async function puoEntrare(roomId, nome) {
  if (await eBloccato(roomId, nome)) return { ok: false, motivo: 'bloccato' };
  const { suApprovazione } = await leggiRegole(roomId);
  if (!suApprovazione) return { ok: true };
  if (await eHost(roomId, nome)) return { ok: true };
  const stato = await statoIngresso(roomId, nome);
  if (stato === 'ammesso') return { ok: true };
  return { ok: false, motivo: stato === 'rifiutato' ? 'rifiutato' : 'in-attesa' };
}

// ── Segnalazioni ──

export async function segnala(nome, daChi) {
  const n = normalizza(nome);
  const da = normalizza(daChi);
  if (!n || !da || n === da) return { ok: false, motivo: 'non valida' };

  // Una segnalazione per persona: altrimenti bastano dieci tocchi per
  // affossare qualcuno che non piace.
  const doppia = await redis('SET', chiave.giaSegnalato(n, da), '1', 'NX', 'EX', TTL_SEGNALAZIONI);
  if (!doppia) return { ok: false, motivo: 'gia segnalato' };

  const totale = await redis('INCR', chiave.segnalazioni(n));
  await redis('EXPIRE', chiave.segnalazioni(n), TTL_SEGNALAZIONI);
  return { ok: true, totale: Number(totale) || 1 };
}

export async function contaSegnalazioni(nome) {
  const n = normalizza(nome);
  if (!n) return 0;
  return Number(await redis('GET', chiave.segnalazioni(n))) || 0;
}

// Chi raccoglie troppe segnalazioni non sparisce: perde l'ingresso libero
// nelle stanze pubbliche. Se qualcuno lo invita, entra lo stesso.
export async function limitatoDaSegnalazioni(nome) {
  return (await contaSegnalazioni(nome)) >= SOGLIA_SEGNALAZIONI;
}
