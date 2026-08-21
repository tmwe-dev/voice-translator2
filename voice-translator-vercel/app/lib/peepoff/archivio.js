'use client';
// ═══════════════════════════════════════════════════════════════
// b.349 — PEEPOFF · L'ARCHIVIO LOCALE (IndexedDB).
// Qui vive TUTTO cio che il server non deve mai vedere: l'identita
// del dispositivo (le CryptoKey non estraibili si salvano cosi come
// sono: il browser le conserva senza mai esporre il privato), i
// messaggi in chiaro, la coda d'uscita e le impronte dei contatti.
// ═══════════════════════════════════════════════════════════════

const DB = 'peepoff';
const VERSIONE = 1;

function apriDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSIONE);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('identita')) d.createObjectStore('identita');
      if (!d.objectStoreNames.contains('messaggi')) {
        const m = d.createObjectStore('messaggi', { keyPath: 'id' });
        m.createIndex('cartella', 'cartella');
      }
      if (!d.objectStoreNames.contains('coda')) d.createObjectStore('coda', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('contatti')) d.createObjectStore('contatti', { keyPath: 'indirizzo' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function operazione(negozio, modo, lavoro) {
  return apriDb().then((d) => new Promise((res, rej) => {
    const tx = d.transaction(negozio, modo);
    const st = tx.objectStore(negozio);
    const esito = lavoro(st);
    tx.oncomplete = () => { d.close(); res(esito && 'result' in esito ? esito.result : undefined); };
    tx.onerror = () => { d.close(); rej(tx.error); };
  }));
}

// ── IDENTITÀ (le CryptoKey restano non estraibili anche salvate) ──
export const salvaIdentita = (id) => operazione('identita', 'readwrite', (st) => st.put(id, 'io'));
export const leggiIdentita = () => operazione('identita', 'readonly', (st) => st.get('io'));

// ── MESSAGGI ──
export const salvaMessaggio = (m) => operazione('messaggi', 'readwrite', (st) => st.put(m));
export function elencaMessaggi(cartella) {
  return apriDb().then((d) => new Promise((res, rej) => {
    const tx = d.transaction('messaggi', 'readonly');
    const r = tx.objectStore('messaggi').index('cartella').getAll(cartella);
    r.onsuccess = () => { d.close(); res((r.result || []).sort((a, b) => b.quando - a.quando)); };
    r.onerror = () => { d.close(); rej(r.error); };
  }));
}

// ── CODA D'USCITA (con la scala di ritenti del protocollo) ──
export const SCALA_MS = [5000, 60000, 600000, 3600000];
export const SCADENZA_MS = 7 * 24 * 3600 * 1000;

/** Prossima attesa: a scalini, costante oltre l'ultimo. PURA e testabile. */
export function attesaScalino(tentativo) {
  return SCALA_MS[Math.min(Math.max(0, tentativo), SCALA_MS.length - 1)];
}

/** Una voce e da lavorare ORA? PURA e testabile. */
export function voceDovuta(voce, ora) {
  if (voce.stato === 'consegnato' || voce.stato === 'scaduto') return false;
  if (ora - voce.creato > SCADENZA_MS) return true; // va CHIUSA come scaduta
  return !voce.prossimo || voce.prossimo <= ora;
}

export const salvaVoce = (v) => operazione('coda', 'readwrite', (st) => st.put(v));
export const elencaCoda = () => operazione('coda', 'readonly', (st) => st.getAll());
export const togliVoce = (id) => operazione('coda', 'readwrite', (st) => st.delete(id));

// ── CONTATTI: l'impronta delle chiavi, e l'allarme se cambia ──
// b.363 — non piu esportata: la legge solo questo file. Era offerta a
// tutto il progetto senza che nessuno la chiedesse.
const leggiContatto = (indirizzo) => operazione('contatti', 'readonly', (st) => st.get(indirizzo));
export const elencaContatti = () => operazione('contatti', 'readonly', (st) => st.getAll());

/** Registra l'impronta vista; se DIVERSA dalla nota, accende l'allarme. */
export async function registraImpronta(indirizzo, impronta) {
  const c = (await leggiContatto(indirizzo)) || { indirizzo };
  const cambiata = !!(c.impronta && c.impronta !== impronta);
  const nuovo = { ...c, impronta, cambiata: cambiata || (c.cambiata && c.impronta === impronta ? c.cambiata : cambiata), visto: Date.now() };
  if (cambiata) nuovo.improntaPrecedente = c.impronta;
  await operazione('contatti', 'readwrite', (st) => st.put(nuovo));
  return nuovo;
}

/** L'utente ha visto l'allarme del cambio chiavi. */
export async function riconosciCambio(indirizzo) {
  const c = await leggiContatto(indirizzo);
  if (!c) return;
  await operazione('contatti', 'readwrite', (st) => st.put({ ...c, cambiata: false }));
}
