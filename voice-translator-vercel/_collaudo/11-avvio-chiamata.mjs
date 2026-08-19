import { apri, entra, BASE, DIR } from './lib.mjs';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const chiudi = async (p) => { for (let i = 0; i < 3; i++) { if (await p.locator('[role=dialog]').count()) { try { await p.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await p.keyboard.press('Escape'); } await p.waitForTimeout(700); } else return; } };

const A = await apri();
const B = await apri();
for (const P of [A, B]) P.page.on('console', m => { const t = m.text(); if (/webrtc|signal|call|chiamata/i.test(t)) console.log(`  [${P.log.nome}]`, t.slice(0, 150)); });

await entra(A.page, { nomeUtente: 'Anna' });
await A.page.waitForTimeout(1500); await chiudi(A.page);
await A.page.locator('button:has-text("Parla con chi hai davanti")').first().click({ timeout: 8000 });
await A.page.waitForTimeout(3500);
const codice = await A.page.evaluate(() => (document.body.innerText.match(/\b[A-F0-9]{8}\b/) || [null])[0]);
console.log('CODICE:', codice);

await B.page.goto(`${BASE}?room=${codice}&lang=en&auto=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await B.page.waitForTimeout(8000);
await chiudi(B.page);
console.log('B dentro?', await B.page.evaluate(() => document.body.innerText.slice(0, 110).replace(/\n+/g, ' | ')));

// l'host entra nella stanza (dalla lobby) e cerca il pulsante della chiamata
try { await A.page.locator('button:has-text("Iniziamo")').first().click({ timeout: 5000 }); console.log('A: premuto Iniziamo'); } catch { console.log('A: nessun Iniziamo'); }
await A.page.waitForTimeout(4000);
const bottoniA = await A.page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\n/g,'·').slice(0,34)).filter(Boolean));
console.log('BOTTONI A nella stanza:', JSON.stringify(bottoniA));

// apro il menu ••• e guardo cosa c'e dentro
try { await A.page.locator('button[aria-label="Impostazioni"]').first().click({ timeout: 4000 }); console.log('A: menu ••• aperto'); } catch { console.log('A: menu ••• NON aperto'); }
await A.page.waitForTimeout(1200);
const vociMenu = await A.page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\n/g,'·').slice(0,34)).filter(Boolean));
console.log('VOCI DEL MENU:', JSON.stringify(vociMenu));
let premuto = null;
for (const sel of ['button:has-text("Videochiamata")', 'button:has-text("Video")', 'button[aria-label*="ideo"]']) {
  try { await A.page.locator(sel).first().click({ timeout: 2500 }); premuto = sel; break; } catch {}
}
console.log('A: pulsante chiamata premuto con', premuto);
for (let s = 1; s <= 10; s++) {
  await A.page.waitForTimeout(1000);
  const a = await A.page.evaluate(() => document.body.innerText.slice(0, 90).replace(/\n+/g, ' | '));
  const b = await B.page.evaluate(() => document.body.innerText.slice(0, 90).replace(/\n+/g, ' | '));
  console.log(`${s}s A: ${a}`);
  console.log(`   B: ${b}`);
}
await A.page.screenshot({ path: `${DIR}/11-A.png` }); await B.page.screenshot({ path: `${DIR}/11-B.png` });
await A.b.close(); await B.b.close();
