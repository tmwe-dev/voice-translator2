import { apri, foto, entra, BASE, DIR } from './lib.mjs';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });

const chiudi = async (p) => { for (let i = 0; i < 3; i++) { if (await p.locator('[role=dialog]').count()) { try { await p.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await p.keyboard.press('Escape'); } await p.waitForTimeout(700); } else return; } };
const dump = async (p, t) => { const s = await p.evaluate(() => ({
  testo: document.body.innerText.slice(0, 380).replace(/\n+/g, ' | '),
  bottoni: [...document.querySelectorAll('button')].map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g,'·').slice(0,30)).filter(Boolean),
  campi: [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.type),
})); console.log(`\n=== ${t} ===\n` + JSON.stringify(s, null, 1)); return s; };

// ── OSPITE A (italiano): crea la stanza ──
const A = await apri({ nome: 'A' });
await entra(A.page, { nomeUtente: 'Anna' });
await A.page.waitForTimeout(2000); await chiudi(A.page);
await A.page.locator('button:has-text("Parla con chi hai davanti")').first().click({ timeout: 8000 });
await A.page.waitForTimeout(4000);
const codice = await A.page.evaluate(() => (document.body.innerText.match(/\b[A-F0-9]{8}\b/) || [null])[0]);
console.log('CODICE STANZA:', codice);
await foto(A.page, '08-A-stanza');
if (!codice) { console.log('!! nessun codice stanza: mi fermo'); await A.b.close(); process.exit(1); }

// ── OSPITE B (inglese): entra col link ──
const B = await apri({ nome: 'B' });
await B.page.goto(`${BASE}?room=${codice}&lang=en&auto=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await B.page.waitForTimeout(4000);
await dump(B.page, 'B — ARRIVO DAL LINK');
// eventuale onboarding ridotto
for (const s of ['button:has-text("Essential only")', 'button:has-text("Solo essenziali")']) { try { await B.page.locator(s).first().click({ timeout: 2000 }); } catch {} }
for (const s of ['button:has-text("Stay in browser")', 'button:has-text("Resta nel browser")']) { try { await B.page.locator(s).first().click({ timeout: 2000 }); } catch {} }
for (const s of ['button:has-text("Continue without account")', 'button:has-text("Continua senza account")']) { try { await B.page.locator(s).first().click({ timeout: 3000 }); await B.page.waitForTimeout(2500); } catch {} }
try { await B.page.locator('input[placeholder*="Marco"], input[placeholder*="Es."]').first().fill('Bob', { timeout: 3000 }); await B.page.locator('button:has-text("Avanti"), button:has-text("Next")').first().click({ timeout: 3000 }); await B.page.waitForTimeout(2000); } catch {}
try { await B.page.locator('button:has-text("Marcus")').first().click({ timeout: 3000 }); await B.page.locator('button:has-text("Inizia"), button:has-text("Start")').first().click({ timeout: 3000 }); await B.page.waitForTimeout(4000); } catch {}
await chiudi(B.page);
const sb = await dump(B.page, 'B — DOPO INGRESSO');
await foto(B.page, '08-B-ingresso');

await A.page.waitForTimeout(3000);
const sa = await dump(A.page, 'A — DOPO ARRIVO DI B');
await foto(A.page, '08-A-dopo-arrivo');

// ── prova di CHAT: cerco il campo messaggio da entrambe le parti ──
const provaInvio = async (P, testo, tag) => {
  const campi = await P.page.evaluate(() => [...document.querySelectorAll('input,textarea')].map(x => ({ ph: x.placeholder || '', h: Math.round(x.getBoundingClientRect().height) })));
  console.log(`${tag} campi:`, JSON.stringify(campi));
  for (const sel of ['textarea', 'input[placeholder*="essagg"]', 'input[placeholder*="essage"]', 'input[type="text"]']) {
    try {
      await P.page.locator(sel).first().fill(testo, { timeout: 2500 });
      const r0 = P.log.reti.length;
      try { await P.page.locator('button[aria-label*="nvia"], button[aria-label*="end"], button:has-text("Invia")').first().click({ timeout: 2000 }); }
      catch { await P.page.keyboard.press('Enter'); }
      await P.page.waitForTimeout(5000);
      console.log(`${tag} INVIATO "${testo}" con ${sel} | HTTP: ${JSON.stringify([...new Set(P.log.reti.slice(r0))])}`);
      return true;
    } catch {}
  }
  console.log(`${tag} nessun campo messaggio trovato`);
  return false;
};

const inviatoA = await provaInvio(A, 'Buongiorno, come stai?', 'A→');
await B.page.waitForTimeout(4000);
const bDopo = await dump(B.page, 'B — DOPO MESSAGGIO DI A');
await foto(B.page, '08-B-riceve');
const inviatoB = await provaInvio(B, 'Hello, I am fine thanks', 'B→');
await A.page.waitForTimeout(4000);
const aDopo = await dump(A.page, 'A — DOPO MESSAGGIO DI B');
await foto(A.page, '08-A-riceve');

console.log('\nRIEPILOGO: inviatoA=' + inviatoA + ' inviatoB=' + inviatoB);
console.log('HTTP A:', JSON.stringify([...new Set(A.log.reti)]));
console.log('HTTP B:', JSON.stringify([...new Set(B.log.reti)]));
console.log('ERRORI B:', JSON.stringify([...new Set(B.log.errori)].slice(0, 5), null, 1));
await A.b.close(); await B.b.close();
