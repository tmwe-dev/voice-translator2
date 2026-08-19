// ═══════════════════════════════════════════════════════════════
// PANNELLO A SCHERMO INTERO — chi copre lo schermo lo dichiara (b.255)
//
// Il problema, verificato: il banner "Installa l'applicazione" si mostra
// da solo dopo pochi secondi e sta in fondo (position:fixed). page.js lo
// sospende in base alla SCHERMATA (`SCHERMATE_SENZA_VELO`), ma dentro il
// Mondo i pannelli — una discussione aperta, il profilo di una persona,
// la scheda di un articolo — NON cambiano schermata: vivono in uno stato
// interno. Risultato: mentre scrivevi un commento poteva comparire il
// banner e coprire il campo di testo e il pulsante di invio.
//
// Rincorrere ogni singolo pannello dentro page.js avrebbe voluto dire
// portarsi su gli stati interni di tre componenti, e ricominciare da capo
// al prossimo pannello. Qui invece la regola e una sola e la dichiara chi
// sa di stare coprendo lo schermo: "ora sono davanti a tutto".
//
// Volutamente minuscolo e senza React: e la stessa forma di lib/avvisi.js,
// per lo stesso motivo — chi deve dichiararsi non deve dipendere da come
// le cose sono disegnate.
// ═══════════════════════════════════════════════════════════════

// Un contatore, non un booleano: due pannelli sovrapposti (una scheda
// aperta sopra una discussione) devono poter chiudere ciascuno il proprio
// senza spegnere anche quello dell'altro.
let aperti = 0;
const ascoltatori = new Set();

function annuncia() {
  const stato = aperti > 0;
  ascoltatori.forEach((fn) => fn(stato));
}

export function apriPannelloPieno() {
  aperti++;
  annuncia();
}

export function chiudiPannelloPieno() {
  aperti = Math.max(0, aperti - 1);
  annuncia();
}

/** Il componente si iscrive; la funzione restituita lo disiscrive. */
export function ascoltaPannelloPieno(fn) {
  ascoltatori.add(fn);
  fn(aperti > 0);
  return () => ascoltatori.delete(fn);
}

/** Per i controlli: quanti pannelli si dichiarano aperti adesso. */
export function pannelliAperti() {
  return aperti;
}
