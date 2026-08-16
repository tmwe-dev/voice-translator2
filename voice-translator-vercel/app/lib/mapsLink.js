// ═══════════════════════════════════════════════════════════════
// mapsLink — costruisce il link a una mappa vera per il tassista.
//
// b.182 — il QR del Taxi non porta piu dentro la nostra app: contiene
// direttamente un link che apre la MAPPA sul telefono del tassista, con
// il percorso verso la destinazione. Niente install, niente pagina
// nostra, niente server: sparisce il 404 della pagina tassista e il
// problema della mappa nostra. Funziona anche offline nella sua app.
//
// Provider:
//   'google' (default) — Google Maps con indicazioni. Apre l'app se c'e,
//                        altrimenti il browser. Il piu universale.
//   'apple'            — Apple Maps (iPhone).
//   'geo'              — URI geo: apre l'app mappe PREDEFINITA del telefono
//                        (utile in Asia dove la predefinita e Amap/Baidu).
// ═══════════════════════════════════════════════════════════════

export function buildMapsUrl(dest, provider = 'google') {
  if (!dest || typeof dest.lat !== 'number' || typeof dest.lng !== 'number') return '';
  const lat = dest.lat;
  const lng = dest.lng;
  const label = (dest.normalizedAddress || dest.destinationName || '').trim();

  switch (provider) {
    case 'apple':
      // daddr = destinazione (Apple calcola il percorso dalla posizione attuale)
      return `https://maps.apple.com/?daddr=${lat},${lng}${label ? `&q=${encodeURIComponent(label)}` : ''}`;
    case 'geo':
      // geo: apre l'app mappe predefinita del dispositivo
      return `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${encodeURIComponent(label)})` : ''}`;
    case 'google':
    default:
      // Indicazioni verso la destinazione: apre l'app Google Maps o il browser
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
}

// Etichette per la scelta del provider nell'interfaccia
export const MAPS_PROVIDERS = [
  { id: 'google', label: 'Google Maps' },
  { id: 'apple', label: 'Apple Maps' },
  { id: 'geo', label: 'App predefinita' },
];
