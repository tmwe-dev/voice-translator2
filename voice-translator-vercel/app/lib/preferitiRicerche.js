// b.535 — I PREFERITI CHE SCEGLI TU. Ordine di Luca: «quando scelgo il
// milan ac aggiungi un selettore aggiungi alle notizie preferite e
// aggiungi il badge». Fin qui i preferiti erano solo i temi VERI del
// giornale (arrivano da soli, si puo' solo toglierli); da qui l'utente
// puo' anche AGGIUNGERE una sua ricerca, che diventa un badge accanto
// agli altri e rifa' la ricerca con un tocco.
// Funzioni pure su prefs: chi le chiama salva con savePrefs.

const MASSIMO = 12;

export function preferitiAggiunti(prefs) {
  const v = prefs?.ricerchePreferite;
  return Array.isArray(v) ? v.filter((r) => r && typeof r.q === 'string' && r.q.trim()) : [];
}

export function ePreferita(prefs, q) {
  const pulita = String(q || '').trim().toLowerCase();
  if (!pulita) return false;
  return preferitiAggiunti(prefs).some((r) => r.q.trim().toLowerCase() === pulita);
}

export function aggiungiPreferita(prefs, { q, etichetta, img }) {
  const pulita = String(q || '').trim();
  if (!pulita) return prefs;
  const senza = preferitiAggiunti(prefs).filter((r) => r.q.trim().toLowerCase() !== pulita.toLowerCase());
  const voce = { q: pulita, etichetta: (etichetta || pulita).slice(0, 26), img: img || null };
  return { ...prefs, ricerchePreferite: [voce, ...senza].slice(0, MASSIMO) };
}

export function togliPreferita(prefs, q) {
  const pulita = String(q || '').trim().toLowerCase();
  return { ...prefs, ricerchePreferite: preferitiAggiunti(prefs).filter((r) => r.q.trim().toLowerCase() !== pulita) };
}
