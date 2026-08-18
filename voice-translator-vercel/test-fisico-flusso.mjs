import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
const page = await ctx.newPage();
const errori = [], reti = [];
page.on('console', m => { if (m.type() === 'error') errori.push(m.text().slice(0, 140)); });
page.on('pageerror', e => errori.push('PAGEERROR: ' + String(e).slice(0, 140)));
page.on('response', r => { if (r.status() >= 400) reti.push(`${r.status()} ${new URL(r.url()).pathname}`.slice(0,90)); });
const foto = (n) => page.screenshot({ path: `/tmp/${n}.png` });
const stato = () => page.evaluate(() => ({
  estratto: document.body.innerText.slice(0, 350).replace(/\n+/g, ' | '),
  bottoni: [...document.querySelectorAll('button')].map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g,'·').slice(0, 24)).filter(Boolean).slice(0, 22),
  input: [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.type).slice(0, 8),
}));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll('button').length > 2, { timeout: 30000 });

// 0) banner cookie: solo l'essenziale (scelta più riservata)
try { await page.click('button:has-text("Essential only")', { timeout: 3000 }); console.log('cookie: Essential only'); } catch { console.log('nessun banner cookie'); }
// 1) Italia → conferma ("Continua con questo paese" o simile)
await page.click('button:has-text("Italia")');
await page.waitForTimeout(1000);
await page.click('button:has-text("Continua")');
await page.waitForTimeout(3500);
console.log('== DOPO CONFERMA PAESE =='); console.log(JSON.stringify(await stato(), null, 1)); await foto('02-post-paese');
console.log('rete >=400:', JSON.stringify([...new Set(reti)]));
console.log('errori:', JSON.stringify([...new Set(errori)].slice(0,5)));
await b.close();
