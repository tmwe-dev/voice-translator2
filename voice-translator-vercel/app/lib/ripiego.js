// ═══════════════════════════════════════════════════════════════
// b.362 — UNA SOLA `tt`, non sette copie.
//
// Il ripiego di traduzione (`tt(chiave, testoDiRiserva)`) era ridefinito
// identico in sette componenti: LifeView, Tavolo, CompitiView,
// GestioneCompagni, GestioneObiettivi, CondivisoSheet, LinguettaLingua.
// Sette posti dove correggere lo stesso rigo. Ora vive qui: ogni
// componente fa `const tt = conRipiego(L)` e basta.
//
// Il comportamento e IDENTICO alle copie che sostituisce: se la chiave
// esiste nel pacchetto lingua si usa la traduzione, altrimenti il testo
// di riserva. Tollera anche L assente (superfici montate prima del
// contesto lingua).
// ═══════════════════════════════════════════════════════════════

export const conRipiego = (L) => (k, f) => {
  const v = L ? L(k) : k;
  return v && v !== k ? v : f;
};
