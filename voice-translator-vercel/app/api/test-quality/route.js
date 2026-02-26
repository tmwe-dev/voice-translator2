import { NextResponse } from 'next/server';

// ═══════════════════════════════════════
// SERVER-SIDE Translation Quality Test
// Runs 100 tests through our FREE API + Google Translate
// Visit: /api/test-quality
// ═══════════════════════════════════════

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const LIBRE_URLS = [
  'https://libretranslate.com/translate',
  'https://translate.terraprint.co/translate',
];

const TESTS = [
  // ZH Chinese — 12
  {text:'Hello, how are you today?', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'I would like to order two coffees please', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'Where is the nearest train station?', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'The weather today is very cold', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'Can you help me find a hotel?', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'I have a reservation for tonight at eight', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'My stomach hurts, I need a doctor', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'How much does this cost?', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'Thank you very much for your help', s:'en', t:'zh', cat:'ZH Chinese'},
  {text:'Buongiorno, quanto costa un biglietto per Pechino?', s:'it', t:'zh', cat:'ZH Chinese'},
  {text:'Mi scusi, dove posso trovare un ristorante cinese?', s:'it', t:'zh', cat:'ZH Chinese'},
  {text:'Vorrei prenotare una camera doppia per tre notti', s:'it', t:'zh', cat:'ZH Chinese'},

  // TH Thai — 12
  {text:'Good morning, I need directions to the airport', s:'en', t:'th', cat:'TH Thai'},
  {text:'How much is this dish?', s:'en', t:'th', cat:'TH Thai'},
  {text:'I am allergic to peanuts', s:'en', t:'th', cat:'TH Thai'},
  {text:'Can you call a taxi for me?', s:'en', t:'th', cat:'TH Thai'},
  {text:'Where is the bathroom please?', s:'en', t:'th', cat:'TH Thai'},
  {text:'I lost my passport, please help', s:'en', t:'th', cat:'TH Thai'},
  {text:'The food was delicious, thank you', s:'en', t:'th', cat:'TH Thai'},
  {text:'I would like to visit the temple today', s:'en', t:'th', cat:'TH Thai'},
  {text:'Buongiorno, quanto costa questo piatto?', s:'it', t:'th', cat:'TH Thai'},
  {text:'Ho bisogno di un medico urgentemente', s:'it', t:'th', cat:'TH Thai'},
  {text:'Mi può portare al mercato per favore?', s:'it', t:'th', cat:'TH Thai'},
  {text:'Vorrei cambiare dei soldi, dove posso andare?', s:'it', t:'th', cat:'TH Thai'},

  // VI Vietnamese — 10
  {text:'Excuse me, where is the nearest pharmacy?', s:'en', t:'vi', cat:'VI Vietnamese'},
  {text:'I would like to try the local food', s:'en', t:'vi', cat:'VI Vietnamese'},
  {text:'How do I get to the old quarter?', s:'en', t:'vi', cat:'VI Vietnamese'},
  {text:'Can I pay with credit card?', s:'en', t:'vi', cat:'VI Vietnamese'},
  {text:'The hotel room is very nice, thank you', s:'en', t:'vi', cat:'VI Vietnamese'},
  {text:'I need to buy a SIM card for my phone', s:'en', t:'vi', cat:'VI Vietnamese'},
  {text:'What time does the museum close?', s:'en', t:'vi', cat:'VI Vietnamese'},
  {text:'Mi piacerebbe visitare la baia di Ha Long', s:'it', t:'vi', cat:'VI Vietnamese'},
  {text:'Quanto costa una corsa in motorino?', s:'it', t:'vi', cat:'VI Vietnamese'},
  {text:'Posso avere il conto per favore?', s:'it', t:'vi', cat:'VI Vietnamese'},

  // KO Korean — 10
  {text:'Hello, I am a tourist from Italy', s:'en', t:'ko', cat:'KO Korean'},
  {text:'Where can I find a good restaurant nearby?', s:'en', t:'ko', cat:'KO Korean'},
  {text:'I would like to buy a subway ticket', s:'en', t:'ko', cat:'KO Korean'},
  {text:'Can you recommend a traditional Korean meal?', s:'en', t:'ko', cat:'KO Korean'},
  {text:'My flight departs tomorrow morning', s:'en', t:'ko', cat:'KO Korean'},
  {text:'I need to find the Italian embassy', s:'en', t:'ko', cat:'KO Korean'},
  {text:'How far is it from here to the palace?', s:'en', t:'ko', cat:'KO Korean'},
  {text:'Vorrei ordinare il bibimbap per favore', s:'it', t:'ko', cat:'KO Korean'},
  {text:'Dove posso comprare dei souvenir?', s:'it', t:'ko', cat:'KO Korean'},
  {text:'Il treno per Seoul parte alle nove', s:'it', t:'ko', cat:'KO Korean'},

  // JA Japanese — 10
  {text:'Excuse me, I would like to check in', s:'en', t:'ja', cat:'JA Japanese'},
  {text:'Can you take me to Shibuya station?', s:'en', t:'ja', cat:'JA Japanese'},
  {text:'I would like green tea please', s:'en', t:'ja', cat:'JA Japanese'},
  {text:'Where is the nearest convenience store?', s:'en', t:'ja', cat:'JA Japanese'},
  {text:'I am looking for the cherry blossom festival', s:'en', t:'ja', cat:'JA Japanese'},
  {text:'How do I use this vending machine?', s:'en', t:'ja', cat:'JA Japanese'},
  {text:'The sushi here is amazing', s:'en', t:'ja', cat:'JA Japanese'},
  {text:'Vorrei visitare il tempio di Kyoto', s:'it', t:'ja', cat:'JA Japanese'},
  {text:'Mi può aiutare con le indicazioni?', s:'it', t:'ja', cat:'JA Japanese'},
  {text:'Quanto costa il treno per Osaka?', s:'it', t:'ja', cat:'JA Japanese'},

  // AR Arabic — 8
  {text:'Good morning, I need a taxi to the hotel', s:'en', t:'ar', cat:'AR Arabic'},
  {text:'Where is the nearest mosque?', s:'en', t:'ar', cat:'AR Arabic'},
  {text:'I would like to visit the old city', s:'en', t:'ar', cat:'AR Arabic'},
  {text:'How much is a bottle of water?', s:'en', t:'ar', cat:'AR Arabic'},
  {text:'Can you help me find my way?', s:'en', t:'ar', cat:'AR Arabic'},
  {text:'The market is very beautiful', s:'en', t:'ar', cat:'AR Arabic'},
  {text:'Mi scusi, dove si trova il museo?', s:'it', t:'ar', cat:'AR Arabic'},
  {text:'Vorrei comprare delle spezie al mercato', s:'it', t:'ar', cat:'AR Arabic'},

  // HI Hindi — 8
  {text:'Hello, I am visiting from Europe', s:'en', t:'hi', cat:'HI Hindi'},
  {text:'Can you recommend a vegetarian restaurant?', s:'en', t:'hi', cat:'HI Hindi'},
  {text:'I would like to see the Taj Mahal', s:'en', t:'hi', cat:'HI Hindi'},
  {text:'How do I get to the railway station?', s:'en', t:'hi', cat:'HI Hindi'},
  {text:'This street food is very spicy', s:'en', t:'hi', cat:'HI Hindi'},
  {text:'I need to exchange some money', s:'en', t:'hi', cat:'HI Hindi'},
  {text:'Buongiorno, come si arriva al tempio?', s:'it', t:'hi', cat:'HI Hindi'},
  {text:'Vorrei provare il cibo locale indiano', s:'it', t:'hi', cat:'HI Hindi'},

  // RU Russian — 8
  {text:'Good evening, I have a reservation', s:'en', t:'ru', cat:'RU Russian'},
  {text:'Where can I buy tickets for the ballet?', s:'en', t:'ru', cat:'RU Russian'},
  {text:'The metro system is very efficient', s:'en', t:'ru', cat:'RU Russian'},
  {text:'I am looking for a pharmacy', s:'en', t:'ru', cat:'RU Russian'},
  {text:'Can you tell me the way to Red Square?', s:'en', t:'ru', cat:'RU Russian'},
  {text:'I would like to order borscht', s:'en', t:'ru', cat:'RU Russian'},
  {text:'Quanto costa il biglietto per il Bolshoi?', s:'it', t:'ru', cat:'RU Russian'},
  {text:'Mi può indicare la strada per il Cremlino?', s:'it', t:'ru', cat:'RU Russian'},

  // Common pairs — 22
  {text:'Ciao, come stai oggi?', s:'it', t:'en', cat:'IT-EN Common'},
  {text:'Ho un forte mal di testa e la febbre alta', s:'it', t:'en', cat:'IT-EN Common'},
  {text:'Dai andiamo a farci un giro, che ne dici?', s:'it', t:'en', cat:'IT-EN Common'},
  {text:'Non capisco cosa stai dicendo', s:'it', t:'en', cat:'IT-EN Common'},
  {text:'Scusi, potrebbe dirmi dove si trova la stazione?', s:'it', t:'en', cat:'IT-EN Common'},
  {text:'We need to schedule a meeting for next week', s:'en', t:'it', cat:'IT-EN Common'},
  {text:'The server returned a 502 bad gateway error', s:'en', t:'it', cat:'IT-EN Common'},
  {text:'I really enjoyed the concert last night', s:'en', t:'it', cat:'IT-EN Common'},
  {text:'Could you please send me the invoice by email?', s:'en', t:'it', cat:'IT-EN Common'},
  {text:'The project deadline has been moved to Friday', s:'en', t:'it', cat:'IT-EN Common'},
  {text:'Me gustaría reservar una mesa para dos', s:'es', t:'it', cat:'ES-FR-DE'},
  {text:'Dónde está la estación de metro más cercana?', s:'es', t:'en', cat:'ES-FR-DE'},
  {text:'El vuelo ha sido cancelado por mal tiempo', s:'es', t:'it', cat:'ES-FR-DE'},
  {text:'Necesito encontrar un cajero automático', s:'es', t:'en', cat:'ES-FR-DE'},
  {text:'Bonjour, je voudrais une table pour quatre personnes', s:'fr', t:'it', cat:'ES-FR-DE'},
  {text:'Où est la sortie la plus proche?', s:'fr', t:'en', cat:'ES-FR-DE'},
  {text:'Je suis perdu, pouvez-vous m\'aider?', s:'fr', t:'it', cat:'ES-FR-DE'},
  {text:'Le train partira à quinze heures', s:'fr', t:'en', cat:'ES-FR-DE'},
  {text:'Entschuldigung, wo ist der Bahnhof?', s:'de', t:'en', cat:'ES-FR-DE'},
  {text:'Ich möchte ein Zimmer für zwei Nächte buchen', s:'de', t:'it', cat:'ES-FR-DE'},
  {text:'Die Rechnung bitte', s:'de', t:'en', cat:'ES-FR-DE'},
  {text:'Können Sie mir den Weg zum Museum zeigen?', s:'de', t:'it', cat:'ES-FR-DE'},
];

const SCRIPTS = {
  'zh': /[\u4E00-\u9FFF]/,
  'th': /[\u0E00-\u0E7F]/,
  'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
  'ko': /[\uAC00-\uD7AF\u1100-\u11FF]/,
  'ar': /[\u0600-\u06FF]/,
  'hi': /[\u0900-\u097F]/,
  'ru': /[\u0400-\u04FF]/,
};

async function callOurFree(text, s, t) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  try {
    const r = await fetch(`${baseUrl}/api/translate-free`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({text, sourceLang:s, targetLang:t}),
      signal: AbortSignal.timeout(12000)
    });
    if(!r.ok) return {translated:`[HTTP ${r.status}]`, provider:'error', fallback:true};
    return await r.json();
  } catch(e) { return {translated:`[ERR: ${e.message}]`, provider:'error', fallback:true}; }
}

async function callGoogle(text, s, t) {
  try {
    const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${s}&tl=${t}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(u, {signal: AbortSignal.timeout(6000)});
    if(!r.ok) return `[HTTP ${r.status}]`;
    const d = await r.json();
    return d[0].map(x=>x[0]).join('');
  } catch(e) { return `[ERR: ${e.message}]`; }
}

function assess(oursT, google, test, fallback) {
  if(fallback) return 'error';
  if(!oursT || oursT.startsWith('[ERR') || oursT.startsWith('[HTTP')) return 'error';
  if(oursT.trim() === test.text.trim()) return 'identical';
  if(SCRIPTS[test.t] && !SCRIPTS[test.t].test(oursT)) return 'wrong_script';
  if(typeof google !== 'string' || google.startsWith('[')) return 'no_ref';

  if(['zh','ja','ko','th'].includes(test.t)) {
    const oC = new Set([...oursT]);
    const gC = new Set([...google]);
    const common = [...oC].filter(c => gC.has(c)).length;
    const overlap = common / Math.max(oC.size, gC.size, 1);
    if(overlap >= 0.5) return 'good';
    if(overlap >= 0.25) return 'partial';
    return 'different';
  }

  const oW = new Set(oursT.toLowerCase().split(/\s+/).filter(w=>w.length>1));
  const gW = new Set(google.toLowerCase().split(/\s+/).filter(w=>w.length>1));
  const common = [...oW].filter(w=>gW.has(w)).length;
  const overlap = common / Math.max(oW.size, gW.size, 1);
  if(overlap >= 0.65) return 'good';
  if(overlap >= 0.35) return 'partial';
  return 'different';
}

export const maxDuration = 60; // Allow up to 60s on Vercel

export async function GET() {
  const results = [];

  for(let i = 0; i < TESTS.length; i++) {
    const t = TESTS[i];
    const [ours, google] = await Promise.all([
      callOurFree(t.text, t.s, t.t),
      callGoogle(t.text, t.s, t.t)
    ]);
    const level = assess(ours.translated, google, t, ours.fallback);
    results.push({
      i: i+1,
      cat: t.cat,
      pair: `${t.s}->${t.t}`,
      orig: t.text,
      ours: ours.translated,
      provider: ours.provider,
      match: ours.match,
      fallback: ours.fallback,
      google: google,
      level
    });
    // Small delay every 5 tests
    if(i % 5 === 4) await new Promise(r => setTimeout(r, 200));
  }

  // Compute scores
  const byCategory = {};
  results.forEach(r => {
    if(!byCategory[r.cat]) byCategory[r.cat] = [];
    byCategory[r.cat].push(r);
  });

  const total = results.length;
  const goodT = results.filter(r=>r.level==='good').length;
  const partialT = results.filter(r=>['partial','different','no_ref'].includes(r.level)).length;
  const badT = results.filter(r=>['error','wrong_script','identical'].includes(r.level)).length;
  const totalScore = Math.round((goodT*100 + partialT*50) / total);

  const catScores = {};
  for(const [cat, arr] of Object.entries(byCategory)) {
    const g = arr.filter(r=>r.level==='good').length;
    const p = arr.filter(r=>['partial','different','no_ref'].includes(r.level)).length;
    const b = arr.filter(r=>['error','wrong_script','identical'].includes(r.level)).length;
    catScores[cat] = { score: Math.round((g*100+p*50)/arr.length), good:g, partial:p, bad:b, total:arr.length };
  }

  return NextResponse.json({
    totalScore,
    good: goodT,
    partial: partialT,
    bad: badT,
    total,
    catScores,
    results
  }, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  });
}
