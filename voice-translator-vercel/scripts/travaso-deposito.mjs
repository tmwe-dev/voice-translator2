#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// TRAVASO — porta via il contenuto del banco veloce e lo rimette in
// un banco nuovo. Serve per cambiare fornitore senza perdere niente.
//
//   node scripts/travaso-deposito.mjs --porta-via
//       legge TUTTO dal banco attuale e lo salva in un file qui accanto.
//
//   node scripts/travaso-deposito.mjs --rimetti
//       rilegge quel file e lo riscrive nel banco che trova adesso
//       nell'ambiente (cioe quello NUOVO, dopo aver cambiato le due voci).
//
// PERCHE ESISTE (b.363): il banco vecchio ha raggiunto il suo tetto di
// richieste e va sostituito. Dentro non c'erano solo cose usa e getta:
// c'erano gli ACCOUNT delle persone e i riferimenti al loro archivio di
// conversazioni. Buttarlo via senza guardare avrebbe cancellato quelli.
//
// Il banco al tetto rifiuta quasi tutto: ogni lettura viene ritentata
// finche passa, con una pausa in mezzo. Con poche decine di chiavi e
// questione di un minuto.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const DEPOSITO = join(QUI, 'travaso-deposito.json');

function ambiente() {
  const testo = readFileSync(join(QUI, '..', '..', '.env.local'), 'utf8');
  const env = {};
  for (const riga of testo.split('\n')) {
    const m = riga.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = ambiente();
const URL_BANCO = E.UPSTASH_REDIS_REST_URL;
const TOKEN = E.UPSTASH_REDIS_REST_TOKEN;
if (!URL_BANCO || !TOKEN) { console.error('Mancano le credenziali del banco in .env.local'); process.exit(1); }

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

// b.363 — il banco al tetto rifiuta a intermittenza: si insiste con calma
// invece di arrendersi al primo no. Un guasto VERO (credenziali sbagliate,
// comando storto) si ferma subito: non ha senso ritentarlo dieci volte.
async function banco(comando, tentativi = 12) {
  for (let i = 0; i < tentativi; i++) {
    const r = await fetch(URL_BANCO, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(comando),
    });
    const d = await r.json().catch(() => ({}));
    if (d && Object.prototype.hasOwnProperty.call(d, 'result')) return d.result;
    const motivo = d?.error || `HTTP ${r.status}`;
    if (!/max requests limit/i.test(motivo)) throw new Error(`${comando[0]}: ${motivo}`);
    await attendi(1500 + i * 700);
  }
  throw new Error(`${comando[0]}: il banco ha rifiutato ${tentativi} volte di fila`);
}

// ── quali chiavi si portano via, e quali no ──
// daily: sono contatori del giorno, si rifanno da soli.
// mondo:rooms e la vetrina, dura un'ora: non ha senso portarla.
const USA_E_GETTA = (chiave) => /^daily:/.test(chiave) || chiave === 'mondo:rooms' || /^prova:/.test(chiave);

async function portaVia() {
  console.log('Leggo il banco attuale…\n');
  const chiavi = [];
  let cursore = '0';
  do {
    const [prossimo, lotto] = await banco(['SCAN', cursore, 'COUNT', '300']);
    chiavi.push(...lotto);
    cursore = prossimo;
  } while (cursore !== '0');

  const daPortare = chiavi.filter((k) => !USA_E_GETTA(k));
  console.log(`  ${chiavi.length} chiavi in tutto · ${daPortare.length} da portare via`);
  console.log(`  (${chiavi.length - daPortare.length} usa e getta: contatori del giorno e vetrina)\n`);

  const roba = [];
  for (const k of daPortare) {
    const tipo = await banco(['TYPE', k]);
    const scadenza = await banco(['TTL', k]);
    let valore;
    if (tipo === 'string') valore = await banco(['GET', k]);
    else if (tipo === 'list') valore = await banco(['LRANGE', k, 0, -1]);
    else if (tipo === 'set') valore = await banco(['SMEMBERS', k]);
    else if (tipo === 'hash') valore = await banco(['HGETALL', k]);
    else if (tipo === 'zset') valore = await banco(['ZRANGE', k, 0, -1, 'WITHSCORES']);
    else { console.log(`  ! ${k}: tipo "${tipo}" non previsto, saltata`); continue; }
    roba.push({ chiave: k, tipo, valore, scadenza });
    process.stdout.write(`\r  portate via ${roba.length}/${daPortare.length}`);
  }

  writeFileSync(DEPOSITO, JSON.stringify(roba, null, 2));
  const conto = {};
  for (const r of roba) { const t = r.chiave.split(':')[0]; conto[t] = (conto[t] || 0) + 1; }
  console.log('\n\nSalvate in scripts/travaso-deposito.json:');
  for (const [t, n] of Object.entries(conto).sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(12)} ${n}`);
  console.log('\nOra si possono cambiare le due voci dell\'ambiente col banco nuovo,');
  console.log('poi:  node scripts/travaso-deposito.mjs --rimetti');
}

async function rimetti() {
  if (!existsSync(DEPOSITO)) { console.error('Non trovo scripts/travaso-deposito.json: prima --porta-via'); process.exit(1); }
  const roba = JSON.parse(readFileSync(DEPOSITO, 'utf8'));
  console.log(`Rimetto ${roba.length} chiavi nel banco che trovo ora nell'ambiente…\n`);
  console.log(`  banco di destinazione: ${URL_BANCO.replace('https://', '').slice(0, 26)}…\n`);

  // b.363 — NON SI SOVRASCRIVE MAI. Il banco di destinazione puo gia
  // avere dei dati suoi, piu recenti di quelli salvati: rimettendoli
  // sopra si riporterebbero indietro account e sessioni vive. Si porta
  // solo cio che MANCA, e cio che c'e gia si lascia dov'e, dicendolo.
  let esistenti = new Set();
  let cursore = '0';
  do {
    const [prossimo, lotto] = await banco(['SCAN', cursore, 'COUNT', '400']);
    for (const k of lotto) esistenti.add(k);
    cursore = prossimo;
  } while (cursore !== '0');

  const saltate = roba.filter((r) => esistenti.has(r.chiave)).map((r) => r.chiave);
  if (saltate.length) {
    console.log(`  ${saltate.length} lasciate dov'erano (esistono gia sul banco nuovo):`);
    for (const k of saltate) console.log(`    ${k}`);
    console.log();
  }

  let fatte = 0;
  for (const r of roba) {
    if (esistenti.has(r.chiave)) continue;
    if (r.tipo === 'string') await banco(['SET', r.chiave, r.valore]);
    else if (r.tipo === 'list') { if (r.valore.length) await banco(['RPUSH', r.chiave, ...r.valore]); }
    else if (r.tipo === 'set') { if (r.valore.length) await banco(['SADD', r.chiave, ...r.valore]); }
    else if (r.tipo === 'hash') { const p = Object.entries(r.valore).flat(); if (p.length) await banco(['HSET', r.chiave, ...p]); }
    else if (r.tipo === 'zset') {
      const v = r.valore; const arg = [];
      for (let i = 0; i < v.length; i += 2) arg.push(v[i + 1], v[i]);
      if (arg.length) await banco(['ZADD', r.chiave, ...arg]);
    }
    // la scadenza si riporta solo se ce n'era una vera
    if (typeof r.scadenza === 'number' && r.scadenza > 0) await banco(['EXPIRE', r.chiave, String(r.scadenza)]);
    fatte++;
    process.stdout.write(`\r  rimesse ${fatte}/${roba.length - saltate.length}`);
  }
  console.log('\n\nFatto: il banco nuovo ha tutto quello che aveva il vecchio.');
}

const arg = process.argv.slice(2);
const azione = arg.includes('--rimetti') ? rimetti : arg.includes('--porta-via') ? portaVia : null;
if (!azione) {
  console.log('Serve --porta-via oppure --rimetti');
  process.exit(1);
}
azione().catch((e) => { console.error('\nGuasto:', e.message); process.exit(1); });
