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
const SENZA_ID = ['radiografia'];
if (!cmd || (!id && !SENZA_ID.includes(cmd))) {
  console.error('uso: scarica|prompt|applica|strumenti <agent_id> [file]   ·   radiografia   ·   conversazioni <agent_id> [quante]');
  process.exit(1);
}
const xi = chiave();

// ═══ b.618 — I DATI DEGLI AGENTI, PER TARARE INVECE DI INDOVINARE ═══
// Il 03/09, guardando le conversazioni vere dell'API invece dei nostri
// registri, sono venuti fuori in dieci minuti tre difetti che nessuna
// prova avrebbe visto: il 63% delle telefonate del Compagno moriva a zero
// secondi per «Override for field 'voice_id' is not allowed by config»
// (stessa causa su COBRA, 4 su 4); il primo messaggio diceva a voce i
// delimitatori del nome; e le variabili `memoria` e `data_oggi` che il
// server manda dalla b.609 non erano nominate da nessuna parte nel prompt
// dell'agente — cioe' non arrivavano mai al modello. Questi due comandi
// servono a rifare quel giro quando si vuole, senza aprire il pannello.
const elenco = async (percorso) => {
  const r = await fetch('https://api.elevenlabs.io/v1' + percorso, { headers: { 'xi-api-key': xi } });
  if (!r.ok) throw new Error(`GET ${percorso}: HTTP ${r.status}`);
  return r.json();
};

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
} else if (cmd === 'radiografia') {
  // Per ogni agente: gli override che il client puo' davvero usare, il
  // modello, e quante conversazioni sono morte. Ordinati per i peggiori.
  const { agents = [] } = await elenco('/convai/agents?page_size=40');
  const righe = [];
  for (const a of agents) {
    let voce = '?', lingua = '?', llm = '?';
    try {
      const cfg = await leggi(a.agent_id, xi);
      const ov = cfg?.platform_settings?.overrides?.conversation_config_override || {};
      voce = String(!!ov?.tts?.voice_id); lingua = String(!!ov?.agent?.language);
      llm = cfg?.conversation_config?.agent?.prompt?.llm || '?';
    } catch { /* un agente illeggibile non ferma il giro */ }
    let tot = 0, ko = 0, motivo = '';
    try {
      const { conversations = [] } = await elenco(`/convai/conversations?agent_id=${a.agent_id}&page_size=30`);
      tot = conversations.length;
      ko = conversations.filter((c) => c.call_successful === 'failure').length;
      const primo = conversations.find((c) => c.call_successful === 'failure');
      if (primo) {
        const d = await elenco('/convai/conversations/' + primo.conversation_id).catch(() => null);
        motivo = String(d?.metadata?.termination_reason || '').slice(0, 60);
      }
    } catch { /* nessuna conversazione: va bene cosi */ }
    righe.push({ nome: a.name, voce, lingua, llm, tot, ko, motivo });
  }
  righe.sort((x, y) => (y.ko / (y.tot || 1)) - (x.ko / (x.tot || 1)));
  console.log('AGENTE'.padEnd(36), 'voce'.padEnd(6), 'lingua'.padEnd(7), 'modello'.padEnd(20), 'conv', 'falliti');
  for (const r of righe) {
    console.log(String(r.nome).slice(0, 36).padEnd(36), r.voce.padEnd(6), r.lingua.padEnd(7),
      String(r.llm).slice(0, 20).padEnd(20), String(r.tot).padStart(4), String(`${r.ko}/${r.tot}`).padStart(7), r.motivo);
  }
} else if (cmd === 'conversazioni') {
  // Le trascrizioni vere: cosa ha detto l'agente, cosa gli e' arrivato.
  const quante = Number(arg) || 5;
  const { conversations = [] } = await elenco(`/convai/conversations?agent_id=${id}&page_size=${quante}`);
  for (const c of conversations) {
    const d = await elenco('/convai/conversations/' + c.conversation_id);
    const md = d.metadata || {};
    console.log('\n' + '='.repeat(70));
    console.log(new Date((md.start_time_unix_secs || 0) * 1000).toLocaleString('it'),
      '| durata', md.call_duration_secs, 's | esito', d.status, '|', String(md.termination_reason || '').slice(0, 70));
    const dv = d?.conversation_initiation_client_data?.dynamic_variables || {};
    if (Object.keys(dv).length) {
      console.log('  variabili arrivate:', Object.entries(dv)
        .map(([k, v]) => `${k}=${String(v).replace(/\s+/g, ' ').slice(0, 40)}`).join(' · '));
    }
    for (const t of (d.transcript || []).slice(0, 12)) {
      console.log(`  [${t.role}] ${String(t.message || '').replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
} else {
  console.error('comando sconosciuto: ' + cmd);
  process.exit(1);
}
