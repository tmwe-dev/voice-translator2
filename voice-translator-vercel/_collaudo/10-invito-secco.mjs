import { apri, entra, BASE, DIR } from './lib.mjs';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const A = await apri();
await entra(A.page, { nomeUtente: 'Anna' });
await A.page.waitForTimeout(1500);
for (let i = 0; i < 3; i++) { if (await A.page.locator('[role=dialog]').count()) { try { await A.page.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await A.page.keyboard.press('Escape'); } await A.page.waitForTimeout(700); } }
await A.page.locator('button:has-text("Parla con chi hai davanti")').first().click({ timeout: 8000 });
await A.page.waitForTimeout(3500);
const codice = await A.page.evaluate(() => (document.body.innerText.match(/\b[A-F0-9]{8}\b/) || [null])[0]);
console.log('CODICE:', codice);

// B: apre il link e NON TOCCA NIENTE. Solo osservazione.
const B = await apri();
B.page.on('request', r => { if (/\/api\/room/.test(r.url())) console.log('  -> RICHIESTA', r.method(), r.url().split('.app')[1], (r.postData()||'').slice(0,160)); });
B.page.on('response', async r => { if (/\/api\/room/.test(r.url())) { console.log('  <- RISPOSTA', r.status(), r.url().split('.app')[1]); try { console.log('     corpo:', (await r.text()).slice(0,300)); } catch (e) { console.log('     corpo NON LEGGIBILE:', String(e).slice(0,80)); } } });
B.page.on('requestfailed', r => { if (/\/api\/room/.test(r.url())) console.log('  !! RICHIESTA FALLITA', r.failure()?.errorText); });
B.page.on('console', m => { const t = m.text(); if (/join|room|stanza|error/i.test(t)) console.log('  [console]', t.slice(0,160)); });
await B.page.goto(`${BASE}?room=${codice}&lang=en&auto=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
for (let s = 1; s <= 8; s++) {
  await B.page.waitForTimeout(1000);
  const v = await B.page.evaluate(() => document.body.innerText.slice(0, 90).replace(/\n+/g, ' | '));
  console.log(`${s}s  ${v}`);
}
console.log('HTTP B:', JSON.stringify([...new Set(B.log.reti)]));
await B.page.screenshot({ path: `${DIR}/10-B-senza-toccare.png` });
await A.b.close(); await B.b.close();
