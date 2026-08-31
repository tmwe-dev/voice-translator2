// ═══════════════════════════════════════════════════════════════
// LE TRACCE DEI SOTTOTITOLI YOUTUBE (b.586)
//
// Il vecchio interprete leggeva dall'elenco soltanto `lang_code`.
// Per i sottotitoli automatici non basta: YouTube distingue la traccia
// con `kind="asr"`, e alcune tracce hanno anche un `name`. Se quei campi
// si perdono, il video dichiara di avere sottotitoli ma la richiesta
// successiva torna vuota. Questo file conserva l'identita completa della
// traccia prima di chiederne il testo.
//
// File puro: niente rete, niente Next, quindi la parte delicata si prova
// senza dipendere da YouTube.
// ═══════════════════════════════════════════════════════════════

function sciogliXml(testo) {
  return String(testo || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function linguaValida(x) {
  const s = String(x || '').trim();
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(s) ? s : '';
}

function attributi(grezzi) {
  const fuori = {};
  const rx = /([A-Za-z_:-]+)="([^"]*)"/g;
  let m;
  while ((m = rx.exec(String(grezzi || '')))) fuori[m[1]] = sciogliXml(m[2]);
  return fuori;
}

/** Tutte le tracce dichiarate da `timedtext?type=list`. */
export function tracceDaElenco(xml) {
  const fuori = [];
  const rx = /<track\b([^>]*)\/?\s*>/gi;
  let m;
  while ((m = rx.exec(String(xml || '')))) {
    const a = attributi(m[1]);
    const lingua = linguaValida(a.lang_code);
    if (!lingua) continue;
    fuori.push({
      lingua,
      kind: String(a.kind || '').trim(),
      nome: String(a.name || '').trim(),
      default: String(a.lang_default || '').toLowerCase() === 'true',
    });
  }
  return fuori;
}

function base(lingua) {
  return String(lingua || '').trim().toLowerCase().split(/[-_]/)[0];
}

/**
 * Ordine dei tentativi, senza perdere kind/name:
 * lingua richiesta esatta → stessa lingua base → inglese → default → prima.
 */
export function ordinaTracce(tracce, chiesta = 'en') {
  const tutte = (Array.isArray(tracce) ? tracce : []).filter((t) => t?.lingua);
  const fuori = [];
  const usate = new Set();
  const metti = (predicato) => {
    for (let i = 0; i < tutte.length; i += 1) {
      if (usate.has(i) || !predicato(tutte[i])) continue;
      usate.add(i);
      fuori.push(tutte[i]);
    }
  };
  const esatta = String(chiesta || '').toLowerCase();
  const radice = base(chiesta);
  metti((t) => String(t.lingua).toLowerCase() === esatta);
  metti((t) => base(t.lingua) === radice);
  metti((t) => base(t.lingua) === 'en');
  metti((t) => !!t.default);
  metti(() => true);
  return fuori;
}

/** Parametri che identificano DAVVERO la traccia nel secondo giro. */
export function parametriTraccia(videoId, traccia) {
  const p = new URLSearchParams({
    v: String(videoId || ''),
    lang: String(traccia?.lingua || ''),
    fmt: 'json3',
  });
  if (traccia?.kind) p.set('kind', traccia.kind);
  if (traccia?.nome) p.set('name', traccia.nome);
  return p;
}
