// ═══════════════════════════════════════════════════════════════
// CORSI PUBBLICI — la libreria "Corsi disponibili" (Luca)
//
// Un corso generato può essere PUBBLICATO: entra nella libreria dentro Impara
// e chiunque può avviarlo. Persistenza NOSTRA di Life (tabella corsi_pubblici,
// RLS server-only): non passa dal ponte. L'autore è l'impronta (idUtente),
// mai l'email in chiaro — come i Compagni.
//
// Lingua: si salva la lingua d'ORIGINE. Se un bambino apre un corso in un'altra
// lingua, il generatore rigenera le lezioni nella SUA lingua (il generatore
// prende già `lingua`); qui si conserva solo la struttura.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '../../supabase.js';
import { idUtente } from '../persistenza.js';

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'corso';
}

function daRiga(r) {
  return {
    id: r.id, titolo: r.titolo, argomento: r.argomento, categoria: r.categoria || 'altro',
    livello: r.livello || 'base', lingua: r.lingua || 'it', perBambini: !!r.per_bambini,
    lezioni: Array.isArray(r.lezioni) ? r.lezioni : [], docente: r.docente || null,
    creato: r.created_at,
  };
}

/** Pubblica un corso nella libreria. Ritorna il corso pubblicato o null. */
// b.412 · P1.19 — la forma consentita di una lezione, e nient'altro.
const PESI = ['alto', 'medio', 'basso'];
function normalizzaLezione(l) {
  if (!l || typeof l !== 'object') return null;
  const titolo = String(l.titolo || '').slice(0, 160).trim();
  if (!titolo) return null;                      // senza titolo non e una lezione
  const obiettivi = (Array.isArray(l.obiettivi) ? l.obiettivi : [])
    .slice(0, 8)
    .map((o) => String(o || '').slice(0, 200).trim())
    .filter(Boolean);
  const peso = PESI.includes(l.peso) ? l.peso : 'medio';
  // Solo questi tre campi escono di qui. Se domani serve il quarto, lo si
  // aggiunge QUI: e l'unico posto dove guardare per sapere cosa viaggia.
  return { titolo, obiettivi, peso };
}

export async function pubblicaCorso(email, corso = {}) {
  const autore = idUtente(email);
  if (!autore) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const titolo = String(corso.titolo || corso.argomento || '').slice(0, 160).trim();
  const argomento = String(corso.argomento || titolo).slice(0, 200).trim();
  if (!titolo || !argomento) return null;
  // b.412 · P1.19 — LE LEZIONI SI RICOSTRUISCONO CAMPO PER CAMPO.
  //
  // Prima si prendevano cosi com'erano (`slice(0, 20)` e via), quindi un
  // client poteva pubblicare oggetti di forma qualunque entro il limite
  // del corpo. Quei titoli e quegli obiettivi poi entrano nella schermata
  // di ALTRI utenti e — peggio — dentro il prompt che genera le loro
  // lezioni. E questa e la libreria aperta anche ai bambini.
  //
  // Non si filtra cio che si teme: si tiene solo cio che si conosce.
  const lezioni = (Array.isArray(corso.lezioni) ? corso.lezioni : [])
    .slice(0, 20)
    .map(normalizzaLezione)
    .filter(Boolean);
  if (!lezioni.length) return null;
  const id = `${slug(argomento)}-${autore.slice(2, 10)}`;
  const riga = {
    id, autore, titolo, argomento,
    categoria: String(corso.categoria || 'altro').slice(0, 40),
    livello: String(corso.livello || 'base').slice(0, 40),
    lingua: String(corso.lingua || 'it').slice(0, 8),
    per_bambini: !!corso.perBambini || corso.livello === 'bambino',
    lezioni,
    docente: corso.docente || null,
  };
  const { data, error } = await sb.from('corsi_pubblici').upsert(riga, { onConflict: 'id' }).select().single();
  if (error) return null;
  return daRiga(data);
}

/** Elenco dei corsi pubblici, con filtri. */
export async function elencaCorsiPubblici({ soloBambini = false, lingua = null, categoria = null, limite = 40 } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  // b.244 — un corso nascosto (3 segnalazioni o un moderatore) esce dallo
  // scaffale. Conta doppio qui: la libreria e aperta anche ai bambini.
  let q = sb.from('corsi_pubblici').select('*').eq('hidden', false)
    .order('created_at', { ascending: false }).limit(Math.min(80, limite));
  if (soloBambini) q = q.eq('per_bambini', true);
  if (lingua) q = q.eq('lingua', lingua);
  if (categoria && categoria !== 'altro') q = q.eq('categoria', categoria);
  const { data, error } = await q;
  if (error) return [];
  return (data || []).map(daRiga);
}

// b.363 — qui c'era getCorsoPubblico, che leggeva un singolo corso della
// vetrina pubblica. Nessuna rotta la chiamava: la vetrina si apre solo
// con l'elenco, un corso alla volta non lo chiede nessuno.
