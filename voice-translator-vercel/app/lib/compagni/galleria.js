'use client';
// ═══════════════════════════════════════════════════════════════
// GALLERIA — le immagini avatar salvate SUL DISPOSITIVO (IndexedDB).
//
// b.223 — come deciso: le immagini generate/caricate restano sul dispositivo
// dell'utente, non su un server. Qui un piccolo archivio locale (IndexedDB)
// per riusarle senza rigenerare (e ripagare). Tutto client-side, best effort:
// se IndexedDB non c'è, le funzioni degradano a no-op senza rompere nulla.
// ═══════════════════════════════════════════════════════════════

const DB = 'bartalk-avatars';
const STORE = 'immagini';

function apri() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}

/** Salva un'immagine (data URL) nella galleria locale. Ritorna l'id o null. */
export async function salvaImmagine(dataUrl, meta = {}) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  try {
    const db = await apri();
    const id = 'img_' + Math.random().toString(36).slice(2) + '_' + dataUrl.length;
    const ordine = Math.random(); // per ordinare senza Date (best effort)
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id, dataUrl, ordine, nome: meta.nome || '' });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    return id;
  } catch { return null; }
}

/** Le ultime immagini salvate sul dispositivo (max `limite`). */
export async function elencoImmagini(limite = 12) {
  try {
    const db = await apri();
    const tutte = await new Promise((res) => {
      const out = [];
      const tx = db.transaction(STORE, 'readonly');
      const cur = tx.objectStore(STORE).openCursor();
      cur.onsuccess = () => { const c = cur.result; if (c) { out.push(c.value); c.continue(); } else res(out); };
      cur.onerror = () => res(out);
    });
    return tutte.sort((a, b) => (b.ordine || 0) - (a.ordine || 0)).slice(0, limite);
  } catch { return []; }
}

/** Rimuove un'immagine dalla galleria locale. */
export async function rimuoviImmagine(id) {
  if (!id) return;
  try {
    const db = await apri();
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res; tx.onerror = res;
    });
  } catch { /* best effort */ }
}
