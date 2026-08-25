// ═══════════════════════════════════════════════════════════════
// IL CODICE A BARRE — uno solo, per tutta l'applicazione.
//
// b.483. Nasce da un difetto che avevo trovato e lasciato aperto: il QR
// che si mostra al TASSISTA era VERDE SU BLU SCURO. E il piu importante
// di tutti — e l'unico che deve inquadrare uno sconosciuto, di corsa,
// dentro un'auto, con la luce che c'e — ed era l'unico disegnato al
// contrario. Un lettore di codici si aspetta scuro su chiaro: la norma
// ammette anche l'inverso, ma moltissime fotocamere non lo leggono, e
// quando non legge non c'e un messaggio d'errore — semplicemente non
// succede niente, e chi sta inquadrando pensa di aver sbagliato lui.
//
// E c'era una seconda cosa, piu seria della prima: TRE dei cinque codici
// dell'applicazione non li disegnavamo noi. Venivano da un servizio di
// terzi (api.qrserver.com), cioe:
//   - se quel server e lento, o giu, o irraggiungibile dalla rete di
//     quel taxi, il codice NON COMPARE. E li non c'e un ripiego: il
//     senso di quella schermata e il codice.
//   - l'indirizzo di casa di chi lo usa usciva dal telefono e finiva
//     dentro la richiesta a un'azienda che non conosciamo.
// La libreria per disegnarli ce l'abbiamo gia in casa, ed era gia usata
// negli altri due punti. Quindi non si e aggiunto niente: si e smesso di
// chiedere fuori una cosa che sapevamo fare dentro.
//
// I colori NON sono una preferenza estetica e non si cambiano per gusto:
// nero su bianco e cio che i lettori sanno leggere.
// ═══════════════════════════════════════════════════════════════

/** Il tratto e il fondo. Non si toccano: e cio che rende leggibile un QR. */
export const QR_TRATTO = '#000000';
export const QR_FONDO = '#ffffff';

/**
 * Il livello di correzione. 'M' regge circa il quindici per cento di
 * codice rovinato: e quello che gia usavano l'invito e la sala d'attesa,
 * e resta lo stesso qui perche un codice piu robusto e anche piu FITTO —
 * e su uno schermo inquadrato da lontano i quadratini piccoli si perdono
 * prima di quanto aiuti la correzione.
 */
const CORREZIONE = 'M';

/**
 * Disegna il codice DENTRO una tela che c'e gia.
 * @returns {Promise<boolean>} vero se il codice e stato disegnato.
 */
export async function disegnaQR(canvas, testo, misura = 280, margine = 2) {
  if (!canvas || !testo) return false;
  try {
    const QRCode = await import('qrcode');
    await QRCode.toCanvas(canvas, testo, {
      width: misura, margin: margine,
      color: { dark: QR_TRATTO, light: QR_FONDO },
      errorCorrectionLevel: CORREZIONE,
    });
    return true;
  } catch {
    // La libreria non e arrivata: chi chiama mostra la sua scritta di
    // riserva. Non si disegna un finto codice: un rettangolo che sembra
    // un QR e non lo e fa inquadrare a vuoto.
    return false;
  }
}

/**
 * Il codice come IMMAGINE, per chi lo mette dentro un tag img invece che
 * in una tela. Torna l'immagine gia dentro l'indirizzo (niente rete).
 * @returns {Promise<string>} l'immagine, o stringa vuota se non si puo.
 */
export async function immagineQR(testo, misura = 240, margine = 8) {
  if (!testo) return '';
  try {
    const QRCode = await import('qrcode');
    return await QRCode.toDataURL(testo, {
      width: misura, margin: margine,
      color: { dark: QR_TRATTO, light: QR_FONDO },
      errorCorrectionLevel: CORREZIONE,
    });
  } catch {
    return '';
  }
}
