// ═══════════════════════════════════════════════════════════════
// b.349 — PEEPOFF · L'INDIRIZZO. La regola fondante del protocollo:
// l'email verificata diventa l'indirizzo del network sostituendo la
// sola @ con #. Deterministico, prevedibile, senza registrazioni:
// luca@tmwe.it → luca#tmwe.it. (Stessa logica del progetto originale.)
// ═══════════════════════════════════════════════════════════════

const LOCALE_RE = /^[a-z0-9._+-]{1,64}$/;
const DOMINIO_RE = /^[a-z0-9.-]{1,253}\.[a-z]{2,}$/;

/** Normalizza un'email; null se non valida. */
export function normalizzaEmail(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (s.length < 3 || s.length > 254) return null;
  const at = s.indexOf('@');
  if (at < 1 || at !== s.lastIndexOf('@')) return null;
  const locale = s.slice(0, at);
  const dominio = s.slice(at + 1);
  if (!LOCALE_RE.test(locale) || !DOMINIO_RE.test(dominio)) return null;
  return locale + '@' + dominio;
}

/** email → address PeepOff (`nome#dominio`); null se l'email non è valida. */
export function emailInIndirizzo(email) {
  const n = normalizzaEmail(email);
  return n ? n.replace('@', '#') : null;
}

/** Normalizza un address `nome#dominio`; null se non valido. */
export function normalizzaIndirizzo(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  const canc = s.indexOf('#');
  if (canc < 1 || canc !== s.lastIndexOf('#')) return null;
  const locale = s.slice(0, canc);
  const dominio = s.slice(canc + 1);
  if (!LOCALE_RE.test(locale) || !DOMINIO_RE.test(dominio)) return null;
  return locale + '#' + dominio;
}

/** address → email (per gli inviti a chi non è ancora registrato). */
export function indirizzoInEmail(indirizzo) {
  const n = normalizzaIndirizzo(indirizzo);
  return n ? n.replace('#', '@') : null;
}
