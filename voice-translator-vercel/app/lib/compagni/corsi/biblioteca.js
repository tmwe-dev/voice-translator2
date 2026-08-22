// ═══════════════════════════════════════════════════════════════
// BIBLIOTECA — i corsi DELL'UTENTE e il suo profilo (b.321, Ondata A)
//
// Prima il corso viveva solo nello stato del componente: chiudevi l'app e
// dovevi rigenerare tutto (e ripagarlo), e il progresso — salvato per numero
// di lezione — si disallineava dal syllabus rigenerato. Qui il corso si
// SALVA (syllabus stabile), si riprende, e il progresso gli resta attaccato.
//
// Stesse regole di studente.js: chiave = impronta pubblica (mai l'email),
// lettura/scrittura solo dal server, fallimenti silenziosi (il corso deve
// funzionare anche se la biblioteca non risponde).
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '../../supabase.js';
import { idUtente } from '../persistenza.js';
import { chiaveCorso } from './imparare.js';

function slugCorso(argomento) {
  return chiaveCorso(argomento).slice(0, 60) || 'corso';
}

/** Salva (o aggiorna) un corso dell'utente: syllabus stabile + impostazioni. */
export async function salvaCorsoUtente(email, c = {}) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb || !c.argomento || !Array.isArray(c.lezioni) || !c.lezioni.length) return null;
  const id = `${owner}_${slugCorso(c.argomento)}`;
  const riga = {
    id, owner,
    argomento: String(c.argomento).slice(0, 200),
    titolo: String(c.titolo || c.argomento).slice(0, 200),
    categoria: c.categoria || 'altro',
    livello: c.livello || 'base',
    lingua: (c.lingua || 'it').slice(0, 8),
    // b.374 — la lingua CHE SI STUDIA (inglese, spagnolo...), diversa da
    // `lingua` che e quella in cui il corso e SCRITTO. Prima si deduceva
    // dal titolo a ogni apertura; adesso e una scelta, e le scelte si
    // conservano.
    lingua_studiata: c.linguaStudiata ? String(c.linguaStudiata).slice(0, 8) : null,
    docente_id: c.docenteId || null,
    lezioni: c.lezioni.slice(0, 20),
    obiettivo_id: c.obiettivoId || null,
    ultima_lezione: Number(c.ultimaLezione) || 0,
    aggiornato: new Date().toISOString(),
  };
  const { data, error } = await sb.from('corsi_utente').upsert(riga, { onConflict: 'id' }).select().single();
  if (error) return null;
  return data;
}

/** Aggiorna solo il segnalibro (ultima lezione aperta). */
export async function segnaUltimaLezione(email, argomento, indice) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return;
  const id = `${owner}_${slugCorso(argomento)}`;
  await sb.from('corsi_utente').update({ ultima_lezione: Number(indice) || 0, aggiornato: new Date().toISOString() }).eq('id', id);
}

/**
 * I corsi dell'utente, con il PROGRESSO unito (lezioni superate / totali).
 * "Superata" = punteggio registrato ≥ 50; "vista" = registrata anche senza
 * punteggio (quiz saltato — pesa nella valutazione, come deciso da Luca).
 */
export async function mieiCorsi(email) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return [];
  const { data: corsi, error } = await sb.from('corsi_utente')
    .select('id, argomento, titolo, categoria, livello, lingua, lingua_studiata, docente_id, lezioni, obiettivo_id, ultima_lezione, aggiornato')
    .eq('owner', owner).order('aggiornato', { ascending: false }).limit(20);
  if (error || !corsi?.length) return [];
  const { data: prog } = await sb.from('imparare_progresso')
    .select('corso, lezione, punteggio, prossimo_ripasso').eq('owner', owner);
  const perCorso = new Map();
  for (const p of prog || []) {
    const k = p.corso;
    if (!perCorso.has(k)) perCorso.set(k, []);
    perCorso.get(k).push(p);
  }
  return corsi.map((c) => {
    const righe = perCorso.get(chiaveCorso(c.argomento)) || [];
    const totale = Array.isArray(c.lezioni) ? c.lezioni.length : 0;
    const superate = righe.filter((r) => Number(r.punteggio) >= 50).length;
    const viste = righe.length;
    const saltate = righe.filter((r) => r.punteggio === null || r.punteggio === undefined).length;
    return {
      id: c.id, argomento: c.argomento, titolo: c.titolo, categoria: c.categoria,
      livello: c.livello, lingua: c.lingua, docenteId: c.docente_id,
      linguaStudiata: c.lingua_studiata || null,
      lezioni: c.lezioni, obiettivoId: c.obiettivo_id, ultimaLezione: c.ultima_lezione,
      totale, superate, viste, saltate,
      // % di completamento VERIFICATO: le lezioni saltate contano meta
      // (viste ma non verificate) — e il "pesa sulla valutazione" deciso.
      percento: totale ? Math.round(((superate + saltate * 0.5) / totale) * 100) : 0,
      // b.334 — RIPASSO A INTERVALLI: quante lezioni sono "scadute" e vanno
      // riprese oggi (data di ripasso raggiunta e punteggio non brillante).
      daRipassare: righe.filter((r) => r.prossimo_ripasso && r.prossimo_ripasso <= new Date().toISOString().slice(0, 10) && (r.punteggio === null || r.punteggio < 80)).length,
      // dettaglio per lezione per la spunta in lista
      esiti: righe.map((r) => ({ lezione: r.lezione, punteggio: r.punteggio })),
    };
  });
}

// ── PROFILO STUDENTE (Learner Profile + preferenze esperienza) ──

export async function leggiProfiloStudente(email) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from('profilo_studente').select('profilo, comunicazione, preferenze').eq('owner', owner).maybeSingle();
  if (error || !data) return null;
  return { profilo: data.profilo || {}, comunicazione: data.comunicazione || {}, preferenze: data.preferenze || {} };
}

export async function salvaProfiloStudente(email, { profilo, comunicazione, preferenze } = {}) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb) return false;
  const attuale = await leggiProfiloStudente(email) || { profilo: {}, comunicazione: {}, preferenze: {} };
  const riga = {
    owner,
    profilo: { ...attuale.profilo, ...(profilo || {}) },
    comunicazione: { ...attuale.comunicazione, ...(comunicazione || {}) },
    preferenze: { ...attuale.preferenze, ...(preferenze || {}) },
    aggiornato: new Date().toISOString(),
  };
  const { error } = await sb.from('profilo_studente').upsert(riga, { onConflict: 'owner' });
  return !error;
}

/** Il profilo in FORMA DI PROMPT: chi e lo studente e come parlargli. */
export function contestoProfilo(dati) {
  if (!dati) return '';
  const p = dati.profilo || {}, pref = dati.preferenze || {};
  const righe = [];
  if (p.eta) righe.push(`eta: ${p.eta}`);
  if (p.professione) righe.push(`professione: ${p.professione}`);
  if (p.obiettivo) righe.push(`perche studia: ${p.obiettivo}`);
  if (p.interessi) righe.push(`interessi: ${p.interessi}`);
  if (pref.stile) righe.push(`stile preferito: ${pref.stile}`);
  if (!righe.length) return '';
  return `\n\nCHI HAI DAVANTI (adatta linguaggio, esempi e profondita a questa persona — la preparazione conta piu dell'eta, niente stereotipi):\n- ${righe.join('\n- ')}`;
}

// ── PROFILO PRONUNCIA (persistente, per lingua) ──

export async function leggiProfiloPronuncia(email, lingua) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb || !lingua) return null;
  const { data, error } = await sb.from('pronuncia_profilo').select('errori, trend').eq('owner', owner).eq('lingua', lingua).maybeSingle();
  if (error || !data) return null;
  return { errori: Array.isArray(data.errori) ? data.errori : [], trend: data.trend || {} };
}

/**
 * Registra un esito di pronuncia: accumula gli errori RICORRENTI (parola +
 * quante volte) e il trend (ultimi punteggi). Gli errori ricorrenti tornano
 * negli esercizi futuri (Teaching Policy: occasionale→registra, ricorrente→drill).
 */
export async function aggiornaProfiloPronuncia(email, lingua, { punteggio, parole = [] } = {}) {
  const owner = idUtente(email);
  const sb = owner && getSupabaseAdmin();
  if (!sb || !lingua) return;
  const attuale = await leggiProfiloPronuncia(email, lingua) || { errori: [], trend: {} };
  const conta = new Map(attuale.errori.map((e) => [e.parola, e.volte]));
  for (const p of parole) {
    const w = String(p || '').toLowerCase().slice(0, 40);
    if (w) conta.set(w, (conta.get(w) || 0) + 1);
  }
  const errori = [...conta.entries()].map(([parola, volte]) => ({ parola, volte }))
    .sort((a, b) => b.volte - a.volte).slice(0, 30);
  const ultimi = Array.isArray(attuale.trend.ultimi) ? attuale.trend.ultimi : [];
  const trend = { ultimi: [...ultimi, Number(punteggio) || 0].slice(-10) };
  await sb.from('pronuncia_profilo').upsert({ owner, lingua, errori, trend, aggiornato: new Date().toISOString() }, { onConflict: 'owner,lingua' });
  return { errori, trend }; // b.334 — serve al drill automatico (2ª volta)
}
