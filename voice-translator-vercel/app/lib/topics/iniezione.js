// ═══════════════════════════════════════════════════════════════
// DIFESA DALL'INIEZIONE DI ISTRUZIONI — adattata da COBRA
// (modules/security/injection.js, tradotta in ESM; originale intatto)
//
// Il testo raccolto dal web e ostile per definizione: dentro una
// pagina puo esserci scritto "ignora le istruzioni precedenti" nella
// speranza che un agente lo legga e obbedisca. Qui quel testo non
// arriva a nessun modello per ora, ma arriva NEGLI OCCHI dell'utente
// e nella cache condivisa: si pulisce comunque, cosi il giorno in cui
// un riassunto AI verra aggiunto, il filtro sara gia sulla porta.
// ═══════════════════════════════════════════════════════════════

const PATTERN = [
  // Sovrascrittura diretta delle istruzioni
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?(your\s+)?instructions/i,
  /override\s+(system|safety|security)\s+(prompt|instructions|rules)/i,
  // Dirottamento del ruolo
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /switch\s+to\s+(a\s+)?new\s+(role|persona|mode)/i,
  /enter\s+(developer|admin|god|sudo|root)\s+mode/i,
  // Estrazione del prompt
  /reveal\s+(your|the)\s+(system\s+)?prompt/i,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
  // Manipolazione dei delimitatori
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<\s*SYS\s*>>/i,
  /<\|im_start\|>/i,
  /```system/i,
  // Manipolazione di strumenti
  /execute\s+this\s+(command|code|script)/i,
  /run\s+the\s+following\s+(command|code|script)/i,
  // Pretesa di autorita
  /this\s+is\s+(a|an)\s+(system|admin|developer)\s+message/i,
  /emergency\s+override/i,
  /priority\s+instruction/i,
];

const SOGLIA = 2;

/** @returns {{ trovato: boolean, punteggio: number }} */
export function rilevaIniezione(testo) {
  if (!testo || typeof testo !== 'string') return { trovato: false, punteggio: 0 };
  const campione = testo.length > 50000 ? testo.substring(0, 50000) : testo;
  let punteggio = 0;
  for (const p of PATTERN) {
    if (p.test(campione)) {
      punteggio += 1;
      if (punteggio >= SOGLIA * 2) break;
    }
  }
  return { trovato: punteggio >= SOGLIA, punteggio };
}

/**
 * Pulisce un testo raccolto dal web prima che entri in cache o in UI.
 * Se l'iniezione e rilevata, i pattern vengono sostituiti, non si
 * butta l'articolo intero: il titolo di una notizia SULL'injection
 * e legittimo, e la soglia a 2 esiste apposta.
 */
export function pulisciTestoWeb(testo) {
  if (!testo) return { testo: '', iniezione: false };
  const esito = rilevaIniezione(testo);
  if (!esito.trovato) return { testo, iniezione: false };
  let pulito = testo;
  for (const p of PATTERN) {
    pulito = pulito.replace(new RegExp(p.source, 'gi'), '[filtrato]');
  }
  return { testo: pulito, iniezione: true, punteggio: esito.punteggio };
}
