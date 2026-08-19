import { apri, foto, entra, DIR } from './lib.mjs';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const { b, page, log } = await apri();
await entra(page);
await page.waitForTimeout(2000);

const quanti = await page.locator('button:has-text("Chiudi")').count();
console.log('bottoni con testo "Chiudi":', quanti);
const dettagli = await page.evaluate(() => [...document.querySelectorAll('button')]
  .map((x, i) => ({ i, t: (x.innerText || '').trim().replace(/\n/g, '·').slice(0, 30), aria: x.getAttribute('aria-label'), inDialog: !!x.closest('[role=dialog]') }))
  .filter(x => /chiudi|close|×|✕/i.test(x.t + ' ' + (x.aria || ''))));
console.log('candidati chiusura:', JSON.stringify(dettagli));

// tentativo 1: il primo "Chiudi"
try { await page.locator('button:has-text("Chiudi")').first().click({ timeout: 4000 }); console.log('clic Chiudi: ok'); }
catch (e) { console.log('clic Chiudi FALLITO:', String(e).split('\n')[0].slice(0, 120)); }
await page.waitForTimeout(1500);
let d = await page.evaluate(() => { const x = document.querySelector('[role=dialog]'); return x ? x.innerText.slice(0, 60).replace(/\n+/g, ' | ') : null; });
console.log('dialogo dopo clic:', d);

if (d) {
  await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
  d = await page.evaluate(() => { const x = document.querySelector('[role=dialog]'); return x ? x.innerText.slice(0, 60).replace(/\n+/g, ' | ') : null; });
  console.log('dialogo dopo Escape:', d);
}
await foto(page, '04-dopo-chiusura');
// la home è utilizzabile?
try {
  await page.locator('button:has-text("Italiano")').first().click({ timeout: 4000 });
  await page.waitForTimeout(1500);
  const dopo = await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\n+/g, ' | '));
  console.log('clic selettore lingua: ok →', dopo);
} catch (e) { console.log('selettore lingua FALLITO:', String(e).split('\n')[0].slice(0, 140)); }
await foto(page, '04-selettore-lingua');
await b.close();
