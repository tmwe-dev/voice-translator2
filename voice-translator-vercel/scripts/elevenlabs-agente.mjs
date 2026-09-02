#!/usr/bin/env node
// b.609 — L'AGENTE CONVERSAZIONALE, LETTO E SCRITTO DA RIGA DI COMANDO.
//
// Il prompt del Compagno dal vivo non sta nel repo: sta sull'agente
// ElevenLabs (ELEVENLABS_AMICO_AGENT_ID). Ermes (TMWE) lo cambia dal
// canvas con `prompt_update`, archiviando la versione precedente. Qui la
// stessa idea, a mano e senza UI: si scarica la configurazione (per
// leggerla, confrontarla, tenerne copia), si applica un prompt nuovo
// SOLO dopo aver salvato quello vecchio su disco.
//
// La chiave si legge da ELEVENLABS_API_KEY nell'ambiente o in .env.local:
// non si passa mai come argomento (finirebbe nella cronologia della shell).
//
//   node scripts/elevenlabs-agente.mjs scarica <agent_id> [file.json]
//   node scripts/elevenlabs-agente.mjs prompt  <agent_id>            → stampa solo il prompt
//   node scripts/elevenlabs-agente.mjs applica <agent_id> <prompt.txt> → salva il vecchio, poi PATCH
//   node scripts/elevenlabs-agente.mjs strumenti <agent_id> <tools.json> → registra i client tools

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function chiave() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^ELEVENLABS_API_KEY="?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  }
  console.error('ELEVENLABS_API_KEY non trovata (ambiente o .env.local). Prova: vercel env pull .env.local --environment=production');
  process.exit(2);
}

const BASE = 'https://api.elevenlabs.io/v1/convai/agents/';
async function leggi(id, xi) {
  const r = await fetch(BASE + id, { headers: { 'xi-api-key': xi } });
  if (!r.ok) throw new Error(`GET agente ${id}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function patch(id, xi, corpo) {
  const r = await fetch(BASE + id, { method: 'PATCH', headers: { 'xi-api-key': xi, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const t = await r.text();
  if (!r.ok) throw new Error(`PATCH agente ${id}: HTTP ${r.status} ${t.slice(0, 400)}`);
  return t;
}
const promptDi = (cfg) => cfg?.conversation_config?.agent?.prompt?.prompt || '';
const quando = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

const [, , cmd, id, arg] = process.argv;
if (!cmd || !id) { console.error('uso: scarica|prompt|applica|strumenti <agent_id> [file]'); process.exit(1); }
const xi = chiave();

if (cmd === 'scarica') {
  const cfg = await leggi(id, xi);
  const out = arg || `agente-${id}-${quando()}.json`;
  writeFileSync(out, JSON.stringify(cfg, null, 2));
  console.log(`salvato ${out} (${promptDi(cfg).length} caratteri di prompt, ${(cfg?.conversation_config?.agent?.prompt?.tools || []).length} strumenti)`);
} else if (cmd === 'prompt') {
  console.log(promptDi(await leggi(id, xi)));
} else if (cmd === 'applica') {
  if (!arg || !existsSync(arg)) { console.error('serve il file del prompt nuovo'); process.exit(1); }
  const nuovo = readFileSync(arg, 'utf8');
  const cfg = await leggi(id, xi);
  const vecchio = promptDi(cfg);
  // come Ermes: senza archivio non si cambia niente
  const archivio = `prompt-${id}-${quando()}-sostituito.txt`;
  writeFileSync(archivio, vecchio);
  console.log(`vecchio prompt archiviato in ${archivio} (${vecchio.length} caratteri)`);
  await patch(id, xi, { conversation_config: { agent: { prompt: { prompt: nuovo } } } });
  console.log(`prompt applicato (${nuovo.length} caratteri). Attivo dalle prossime telefonate.`);
} else if (cmd === 'strumenti') {
  if (!arg || !existsSync(arg)) { console.error('serve il file JSON degli strumenti'); process.exit(1); }
  const tools = JSON.parse(readFileSync(arg, 'utf8'));
  const cfg = await leggi(id, xi);
  writeFileSync(`strumenti-${id}-${quando()}-prima.json`, JSON.stringify(cfg?.conversation_config?.agent?.prompt?.tools || [], null, 2));
  await patch(id, xi, { conversation_config: { agent: { prompt: { tools } } } });
  console.log(`strumenti registrati: ${tools.map((t) => t.name).join(', ')}`);
} else {
  console.error('comando sconosciuto: ' + cmd);
  process.exit(1);
}
