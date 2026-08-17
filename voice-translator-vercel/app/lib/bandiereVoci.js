// ═══════════════════════════════════════════════════════════════
// bandiereVoci — da accento/lingua di una voce ElevenLabs a
// { bandiera, paese, ord } (Luca).
//
// La tendina delle voci mostrava solo "american • entertainment_tv":
// niente bandiere, niente ordinamento per paese, righe disallineate.
// Qui traduciamo l'etichetta ElevenLabs (labels.accent, o labels.language
// di ripiego) in una bandiera e un nome di paese leggibile, così la lista
// si può ordinare e scorrere a colpo d'occhio.
//
// Puro e testabile: nessun accesso a rete o a stato.
// ═══════════════════════════════════════════════════════════════

// chiave normalizzata → { f: bandiera, p: paese, o: ordine }
// L'ordine tiene vicini gli accenti inglesi (i più numerosi), poi il resto
// in ordine alfabetico di paese.
const MAPPA = {
  // Inglese, per accento
  american:        { f: '🇺🇸', p: 'USA', o: 10 },
  'us':            { f: '🇺🇸', p: 'USA', o: 10 },
  'us southern':   { f: '🇺🇸', p: 'USA (Sud)', o: 11 },
  'african american': { f: '🇺🇸', p: 'USA', o: 10 },
  british:         { f: '🇬🇧', p: 'Regno Unito', o: 12 },
  english:         { f: '🇬🇧', p: 'Regno Unito', o: 12 },
  'received pronunciation': { f: '🇬🇧', p: 'Regno Unito', o: 12 },
  cockney:         { f: '🇬🇧', p: 'Regno Unito', o: 12 },
  irish:           { f: '🇮🇪', p: 'Irlanda', o: 13 },
  scottish:        { f: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', p: 'Scozia', o: 14 },
  welsh:           { f: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', p: 'Galles', o: 15 },
  australian:      { f: '🇦🇺', p: 'Australia', o: 16 },
  canadian:        { f: '🇨🇦', p: 'Canada', o: 17 },
  'new zealand':   { f: '🇳🇿', p: 'Nuova Zelanda', o: 18 },
  indian:          { f: '🇮🇳', p: 'India', o: 19 },
  'south african': { f: '🇿🇦', p: 'Sudafrica', o: 20 },
  african:         { f: '🌍', p: 'Africa', o: 21 },
  jamaican:        { f: '🇯🇲', p: 'Giamaica', o: 22 },
  transatlantic:   { f: '🌐', p: 'Neutro', o: 30 },
  neutral:         { f: '🌐', p: 'Neutro', o: 30 },
  // Altre lingue
  italian:         { f: '🇮🇹', p: 'Italiano', o: 40 },
  spanish:         { f: '🇪🇸', p: 'Spagnolo', o: 41 },
  'latin american':{ f: '🌎', p: 'Spagnolo (LatAm)', o: 42 },
  mexican:         { f: '🇲🇽', p: 'Messico', o: 42 },
  french:          { f: '🇫🇷', p: 'Francese', o: 43 },
  german:          { f: '🇩🇪', p: 'Tedesco', o: 44 },
  portuguese:      { f: '🇵🇹', p: 'Portoghese', o: 45 },
  brazilian:       { f: '🇧🇷', p: 'Brasiliano', o: 46 },
  dutch:           { f: '🇳🇱', p: 'Olandese', o: 47 },
  polish:          { f: '🇵🇱', p: 'Polacco', o: 48 },
  swedish:         { f: '🇸🇪', p: 'Svedese', o: 49 },
  norwegian:       { f: '🇳🇴', p: 'Norvegese', o: 50 },
  danish:          { f: '🇩🇰', p: 'Danese', o: 51 },
  finnish:         { f: '🇫🇮', p: 'Finlandese', o: 52 },
  turkish:         { f: '🇹🇷', p: 'Turco', o: 53 },
  russian:         { f: '🇷🇺', p: 'Russo', o: 54 },
  ukrainian:       { f: '🇺🇦', p: 'Ucraino', o: 55 },
  arabic:          { f: '🇸🇦', p: 'Arabo', o: 56 },
  hindi:           { f: '🇮🇳', p: 'Hindi', o: 57 },
  japanese:        { f: '🇯🇵', p: 'Giapponese', o: 58 },
  korean:          { f: '🇰🇷', p: 'Coreano', o: 59 },
  chinese:         { f: '🇨🇳', p: 'Cinese', o: 60 },
  mandarin:        { f: '🇨🇳', p: 'Cinese', o: 60 },
  vietnamese:      { f: '🇻🇳', p: 'Vietnamita', o: 61 },
  thai:            { f: '🇹🇭', p: 'Thai', o: 62 },
  indonesian:      { f: '🇮🇩', p: 'Indonesiano', o: 63 },
  filipino:        { f: '🇵🇭', p: 'Filippino', o: 64 },
  greek:           { f: '🇬🇷', p: 'Greco', o: 65 },
  czech:           { f: '🇨🇿', p: 'Ceco', o: 66 },
  romanian:        { f: '🇷🇴', p: 'Rumeno', o: 67 },
  hungarian:       { f: '🇭🇺', p: 'Ungherese', o: 68 },
};

// Ripiego dai codici lingua ISO a una voce della mappa.
const DA_CODICE = {
  en: 'american', it: 'italian', es: 'spanish', fr: 'french', de: 'german',
  pt: 'portuguese', nl: 'dutch', pl: 'polish', sv: 'swedish', tr: 'turkish',
  ru: 'russian', ar: 'arabic', hi: 'hindi', ja: 'japanese', ko: 'korean',
  zh: 'chinese', vi: 'vietnamese', th: 'thai', id: 'indonesian', el: 'greek',
  cs: 'czech', ro: 'romanian', hu: 'hungarian', uk: 'ukrainian', da: 'danish',
  no: 'norwegian', fi: 'finnish',
};

const IGNOTO = { f: '🏳️', p: 'Altro', o: 900 };

function norm(s) { return String(s || '').trim().toLowerCase(); }

/**
 * Restituisce { f (bandiera), p (paese), o (ordine) } per una voce.
 * Usa prima l'accento, poi la lingua (nome o codice ISO).
 */
export function bandieraVoce(v) {
  if (!v) return IGNOTO;
  const acc = norm(v.accent);
  if (acc && MAPPA[acc]) return MAPPA[acc];
  const lang = norm(v.language);
  if (lang && MAPPA[lang]) return MAPPA[lang];
  if (lang && DA_CODICE[lang] && MAPPA[DA_CODICE[lang]]) return MAPPA[DA_CODICE[lang]];
  // accento sconosciuto ma presente: lo mostriamo comunque come "Altro"
  return acc || lang ? { f: '🏳️', p: (acc || lang), o: 899 } : IGNOTO;
}

/** Ordina un elenco di voci per paese (o), poi per nome. */
export function ordinaVociPerPaese(voci) {
  return [...(voci || [])].sort((a, b) => {
    const ba = bandieraVoce(a), bb = bandieraVoce(b);
    if (ba.o !== bb.o) return ba.o - bb.o;
    if (ba.p !== bb.p) return ba.p.localeCompare(bb.p);
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}
