// ═══════════════════════════════════════════════════════════════
// RIEMPI LE LINGUE — completa i pacchetti che hanno dei buchi.
//
// b.370, ordine di Luca dopo aver aperto l'app in thailandese e aver
// trovato frasi in inglese e in italiano: «verifica in tutto il sistema
// e completa le parole mancanti in tutte le lingue».
//
// L'audit ha trovato 21.883 buchi. Il grosso non e sparso: SEDICI
// lingue su trentotto hanno solo un sesto delle parole. Nessuno se
// n'era accorto perche le prove di guardia guardano quindici lingue.
//
// COME FUNZIONA. Per ogni lingua si prendono le chiavi che mancano (o
// che sono rimaste identiche all'inglese), si mandano a blocchi al
// traduttore, e si riscrive il pacchetto. NON si tocca MAI una parola
// che c'e gia ed e diversa dall'inglese: quelle sono traduzioni vere,
// spesso scelte a mano, e sovrascriverle sarebbe un danno.
//
// Si puo interrompere e rilanciare: riparte da quello che manca.
//
//   node scripts/riempi-lingue.mjs            tutte le lingue
//   node scripts/riempi-lingue.mjs th ca af   solo queste
//   node scripts/riempi-lingue.mjs --mancanti solo le chiavi ASSENTI
//
// b.370 — il perche di --mancanti: dopo il primo giro restano parole
// "uguali all'inglese" che sono GIUSTE COSI. Account, Avatar, Chat,
// Code, Conversation in francese si dicono cosi. Insistere a tradurle
// non le migliora: le peggiora, perche il traduttore per forza inventa
// qualcosa pur di restituire una parola diversa.
// ═══════════════════════════════════════════════════════════════
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';

const DIR = 'app/lib/locales';
const BLOCCO = 60;           // chiavi per chiamata: piu grande = piu errori
const INSIEME = 6;           // quante chiamate in volo insieme
const SOLO_MANCANTI = process.argv.includes('--mancanti');
const CHIAVE = process.env.DASHSCOPE_API_KEY;
const MODELLO = 'qwen-plus';
const INDIRIZZO = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

const NOMI = { af:'Afrikaans', ar:'Arabic', bg:'Bulgarian', bn:'Bengali', ca:'Catalan',
  cs:'Czech', da:'Danish', de:'German', el:'Greek', es:'Spanish', fi:'Finnish',
  fil:'Filipino', fr:'French', he:'Hebrew', hi:'Hindi', hr:'Croatian', hu:'Hungarian',
  id:'Indonesian', it:'Italian', ja:'Japanese', ko:'Korean', ms:'Malay', nb:'Norwegian Bokmal',
  nl:'Dutch', pl:'Polish', pt:'Portuguese', ro:'Romanian', ru:'Russian', sk:'Slovak',
  sv:'Swedish', sw:'Swahili', ta:'Tamil', th:'Thai', tr:'Turkish', uk:'Ukrainian',
  vi:'Vietnamese', zh:'Chinese (Simplified)' };

/** Parole che NON si traducono: sono marchi, non frasi. */
const INTOCCABILI = /^(BarTalk|PeepOff|BizCard|TaxiTalk|Stripe|OpenAI|WhatsApp|QR|OK|AI)$/i;

const carica = async (c) =>
  (await import(pathToFileURL(path.resolve(`${DIR}/${c}.js`)).href + `?v=${Date.now()}`)).default;

function scrivi(cod, pacco) {
  const ord = Object.keys(pacco).sort().reduce((o, k) => (o[k] = pacco[k], o), {});
  const via = `${DIR}/${cod}.js`;
  const capo = fs.readFileSync(via, 'utf8').split('\n').filter(r => r.startsWith('//'));
  capo[0] = `// ${cod} translations for BarTalk (${Object.keys(ord).length} keys)`;
  fs.writeFileSync(via, capo.join('\n') + '\n'
    + `const locale_${cod} = ${JSON.stringify(ord)};\n`
    + `export default locale_${cod};\n`);
}

async function traduci(lingua, pezzo, tentativo = 0) {
  const istruzioni = [
    `You translate user-interface strings for BarTalk, a live voice-translation app.`,
    `Translate from English into ${NOMI[lingua]}.`,
    `Rules:`,
    `- Reply with ONLY a JSON object: the same keys, translated values. No prose, no code fence.`,
    `- Keep placeholders EXACTLY as they are: {x} {n} {name} %s and similar.`,
    `- Keep product names untranslated: BarTalk, PeepOff, BizCard, TaxiTalk.`,
    `- Keep emoji and punctuation.`,
    `- These are BUTTONS and LABELS: keep them short. Never add explanations.`,
    `- Use the natural, everyday register a person would expect in an app, not literal word-for-word.`,
  ].join('\n');

  const r = await fetch(INDIRIZZO, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CHIAVE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELLO, temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: istruzioni },
                 { role: 'user', content: JSON.stringify(pezzo) }],
    }),
  });
  if (!r.ok) {
    if (tentativo < 2) { await new Promise(s => setTimeout(s, 1500 * (tentativo + 1))); return traduci(lingua, pezzo, tentativo + 1); }
    throw new Error(`${lingua}: HTTP ${r.status}`);
  }
  const d = await r.json();
  let testo = d?.choices?.[0]?.message?.content || '{}';
  testo = testo.replace(/^```json\s*|^```\s*|```$/gm, '').trim();
  let fuori;
  try { fuori = JSON.parse(testo); }
  catch {
    if (tentativo < 2) return traduci(lingua, pezzo, tentativo + 1);
    return {};
  }
  // si tiene solo cio che e stato davvero chiesto e davvero tradotto
  const buone = {};
  for (const k of Object.keys(pezzo)) {
    const v = fuori[k];
    if (typeof v !== 'string' || !v.trim()) continue;
    const originale = pezzo[k];
    // segnaposto: se ne perde uno, la frase e rotta -> si scarta
    const segnaposto = String(originale).match(/\{[a-zA-Z0-9_]+\}|%s/g) || [];
    if (segnaposto.some(s => !v.includes(s))) continue;
    buone[k] = v;
  }
  return buone;
}

async function riempi(cod, en) {
  const pacco = await carica(cod);
  const daFare = {};
  for (const [k, v] of Object.entries(en)) {
    const mio = pacco[k];
    const manca = !(k in pacco);
    const copiaInglese = mio === v && String(v).length > 3 && !INTOCCABILI.test(String(v).trim());
    if (manca || (!SOLO_MANCANTI && copiaInglese)) daFare[k] = v;
  }
  const chiavi = Object.keys(daFare);
  if (!chiavi.length) return { cod, fatte: 0, restano: 0 };

  const pezzi = [];
  for (let i = 0; i < chiavi.length; i += BLOCCO) {
    pezzi.push(Object.fromEntries(chiavi.slice(i, i + BLOCCO).map(k => [k, daFare[k]])));
  }

  let fatte = 0;
  for (let i = 0; i < pezzi.length; i += INSIEME) {
    const giro = pezzi.slice(i, i + INSIEME);
    const esiti = await Promise.all(giro.map(p => traduci(cod, p).catch(() => ({}))));
    for (const e of esiti) for (const [k, v] of Object.entries(e)) { pacco[k] = v; fatte++; }
    scrivi(cod, pacco);   // si salva a ogni giro: se si interrompe, non si perde niente
    process.stdout.write(`  ${cod}: ${fatte}/${chiavi.length}\r`);
  }
  scrivi(cod, pacco);
  return { cod, fatte, restano: chiavi.length - fatte };
}

// ── via ──
if (!CHIAVE) { console.error('manca DASHSCOPE_API_KEY'); process.exit(1); }
const en = await carica('en');
const chieste = process.argv.slice(2).filter(a => !a.startsWith('--'));
const codici = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''))
  .filter(c => c !== 'en' && (!chieste.length || chieste.includes(c)));

console.log(`lingue da controllare: ${codici.length}\n`);
let totali = 0;
for (const c of codici) {
  const r = await riempi(c, en);
  totali += r.fatte;
  console.log(`  ${c.padEnd(4)} riempite ${String(r.fatte).padStart(5)}${r.restano ? `  (ne restano ${r.restano})` : ''}`);
}
console.log(`\nTOTALE: ${totali} parole nuove`);
