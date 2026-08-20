'use client';
// ═══════════════════════════════════════════════════════════════
// b.346 — IL PONTE DELLO SCANNER: apre il BizCard (intero o in modo
// documenti) e riporta il testo acquisito all'area che l'ha chiesto.
// Canale: BroadcastChannel 'vt-scan' + localStorage come ripiego
// (stessa coppia usata dal modo documenti in /scanner).
// ═══════════════════════════════════════════════════════════════

/** Apre lo scanner. `doc: true` = modo documenti; `dest` torna col testo. */
export function apriScanner({ doc = false, dest = 'materiali' } = {}) {
  const url = doc ? `/scanner/index.html?doc=1&dest=${encodeURIComponent(dest)}` : '/scanner/index.html';
  window.open(url, '_blank', 'noopener');
}

/**
 * Ascolta i documenti inviati dallo scanner. Ritorna la funzione di
 * spegnimento (da chiamare allo smontaggio del componente).
 * cb riceve { testo, dest, quando }.
 */
export function ascoltaScansioni(cb) {
  let canale = null;
  const daMessaggio = (d) => { if (d && typeof d.testo === 'string' && d.testo) cb(d); };
  try {
    canale = new BroadcastChannel('vt-scan');
    canale.onmessage = (ev) => daMessaggio(ev.data);
  } catch { /* canale non supportato: basta il ripiego qui sotto */ }
  const daStorage = (ev) => {
    if (ev.key !== 'vt-scan-risultato' || !ev.newValue) return;
    try { daMessaggio(JSON.parse(ev.newValue)); } catch { /* pacco malformato: si ignora */ }
  };
  window.addEventListener('storage', daStorage);
  return () => {
    try { canale?.close(); } catch { /* gia chiuso: nulla da fare */ }
    window.removeEventListener('storage', daStorage);
  };
}
