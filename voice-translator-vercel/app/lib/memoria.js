// ═══════════════════════════════════════════════════════════════
// b.295 — LA MEMORIA CHE NON ESPLODE MAI
//
// Trovato dal vivo (Luca): un ospite apre l'invito dentro WhatsApp su
// iPhone e vede "SecurityError: The operation is insecure" — schermata
// di errore, mai entrato. Nel browser interno di WhatsApp (e in Safari
// con i cookie bloccati) PERFINO LEGGERE window.localStorage lancia un
// errore di sicurezza: non serve scriverci, basta toccarlo.
//
// Da qui in poi la memoria del telefono si tocca SOLO da queste porte:
// se il browser la vieta, si vive senza — l'app funziona lo stesso, le
// preferenze semplicemente non si conservano. Un ospite che non puo
// salvare niente e comunque un ospite che PARLA.
// ═══════════════════════════════════════════════════════════════

function scatola(nome) {
  try {
    const s = typeof window !== 'undefined' ? window[nome] : null;
    if (!s) return null;
    // il tocco di prova: alcuni browser lanciano solo all'uso vero
    const k = '__vt_prova__';
    s.setItem(k, '1'); s.removeItem(k);
    return s;
  } catch { return null; }
}

export function memGet(chiave, base = null) {
  try { const s = scatola('localStorage'); const v = s ? s.getItem(chiave) : null; return v === null ? base : v; }
  catch { return base; }
}
export function memSet(chiave, valore) {
  try { const s = scatola('localStorage'); if (s) s.setItem(chiave, String(valore)); } catch { /* memoria vietata: si prosegue senza conservare */ }
}
export function memDel(chiave) {
  try { const s = scatola('localStorage'); if (s) s.removeItem(chiave); } catch { /* il browser vieta la memoria (WhatsApp, cookie bloccati): si prosegue senza conservare */ }
}
export function sesGet(chiave, base = null) {
  try { const s = scatola('sessionStorage'); const v = s ? s.getItem(chiave) : null; return v === null ? base : v; }
  catch { return base; }
}
export function sesSet(chiave, valore) {
  try { const s = scatola('sessionStorage'); if (s) s.setItem(chiave, String(valore)); } catch { /* il browser vieta la memoria (WhatsApp, cookie bloccati): si prosegue senza conservare */ }
}
export function sesDel(chiave) {
  try { const s = scatola('sessionStorage'); if (s) s.removeItem(chiave); } catch { /* il browser vieta la memoria (WhatsApp, cookie bloccati): si prosegue senza conservare */ }
}
