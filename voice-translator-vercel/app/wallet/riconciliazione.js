// ═══════════════════════════════════════════════════════════════
// RICONCILIAZIONE — I contatori VERI dei provider.
//
// Domanda a cui risponde: "quello che scaliamo agli utenti
// corrisponde a quello che i provider ci addebitano?"
//
// Ogni funzione interroga il contatore ufficiale del provider e
// ritorna sempre la stessa forma: { provider, unita, usate, limite, costoUsd }
// Uno snapshot ogni ora finisce in provider_snapshots (via cron):
// il monitor admin confronta interno vs provider e segnala gli scarti.
//
// Affidabilità dei contatori:
//   ElevenLabs  → quasi in tempo reale (il migliore)
//   Deepgram    → dettagliato, pochi minuti di ritardo
//   OpenAI      → aggregato, minuti/ore di ritardo
//   Gemini/Azure→ NON interrogabili facilmente: resta la stima interna
// ═══════════════════════════════════════════════════════════════

/** ElevenLabs: caratteri usati e limite del piano. */
export async function contatoreElevenLabs() {
  const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
  });
  if (!r.ok) throw new Error('ElevenLabs ' + r.status);
  const d = await r.json();
  return {
    provider: 'elevenlabs', unita: 'caratteri',
    usate: d.character_count, limite: d.character_limit,
    resetIl: d.next_character_count_reset_unix
      ? new Date(d.next_character_count_reset_unix * 1000).toISOString() : null,
    costoUsd: null, // ElevenLabs è a piano: il costo è la quota mensile
  };
}

/** Deepgram: saldo residuo del progetto (USD). */
export async function contatoreDeepgram() {
  const progetto = process.env.DEEPGRAM_PROJECT_ID;
  const r = await fetch(`https://api.deepgram.com/v1/projects/${progetto}/balances`, {
    headers: { Authorization: 'Token ' + process.env.DEEPGRAM_API_KEY },
  });
  if (!r.ok) throw new Error('Deepgram ' + r.status);
  const d = await r.json();
  const saldo = d.balances?.[0];
  return {
    provider: 'deepgram', unita: 'usd_residui',
    usate: null, limite: null,
    saldoUsd: saldo?.amount ?? null,
    costoUsd: null,
  };
}

/** OpenAI: costi dell'organizzazione di oggi (serve una Admin key). */
export async function contatoreOpenAI() {
  const oggi = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000);
  const r = await fetch(`https://api.openai.com/v1/organization/costs?start_time=${oggi}&limit=1`, {
    headers: { Authorization: 'Bearer ' + (process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY) },
  });
  if (!r.ok) throw new Error('OpenAI ' + r.status);
  const d = await r.json();
  const centesimi = d.data?.[0]?.results?.reduce((s, x) => s + (x.amount?.value || 0), 0) || 0;
  return { provider: 'openai', unita: 'usd_oggi', usate: null, limite: null, costoUsd: centesimi };
}

/**
 * Fotografa tutti i contatori disponibili.
 * I provider senza chiave configurata vengono saltati senza errore.
 */
export async function fotografaTutti() {
  const letture = [];
  const prove = [
    ['ELEVENLABS_API_KEY', contatoreElevenLabs],
    ['DEEPGRAM_API_KEY', contatoreDeepgram],
    ['OPENAI_API_KEY', contatoreOpenAI],
  ];
  for (const [chiaveEnv, leggi] of prove) {
    if (!process.env[chiaveEnv]) continue;
    try { letture.push(await leggi()); }
    catch (e) { letture.push({ provider: chiaveEnv, errore: e.message }); }
  }
  return letture;
}
