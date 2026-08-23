// ═══════════════════════════════════════════════════════════════
// b.404 — QUESTO FILE HA CAMBIATO CASA.
//
// Il telecomando non e piu «di Life»: e della piattaforma intera. Il
// censimento chiesto da Luca ha trovato SEDICI punti che fanno suonare
// qualcosa e UN SOLO registro — questo — usato da quattro. Gli altri
// dodici (stanza, taxi, archivio, prova voce, i cinque hook della voce)
// suonavano per conto loro: lo Stop del telecomando non li fermava, e
// due voci potevano partire insieme senza sapere l'una dell'altra.
//
// Il contenuto e andato in `lib/voce.js`, che e il nome giusto per una
// cosa che vale ovunque. Qui resta il ponte, perche i file che
// importavano `audioLife` continuino a funzionare senza toccarli tutti
// nello stesso momento.
// ═══════════════════════════════════════════════════════════════
export * from './voce.js';
