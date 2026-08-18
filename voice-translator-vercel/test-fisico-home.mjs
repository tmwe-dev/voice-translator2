import { chromium } from 'playwright';
const URL = 'http://localhost:3000';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
const page = await ctx.newPage();
const errori = [];
page.on('console', m => { if (m.type() === 'error') errori.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errori.push('PAGEERROR: ' + String(e).slice(0, 200)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
// Aspetta che la UI vera compaia (bottoni oltre il boot splash)
try { await page.waitForFunction(() => document.querySelectorAll('button').length > 2, { timeout: 30000 }); }
catch { console.log('!! la UI non è comparsa in 30s'); }
await page.waitForTimeout(2000);

const dati = await page.evaluate(() => {
  const t = document.body.innerText;
  return {
    versione: (t.match(/b\.2\d\d/) || [null])[0],
    testoLen: t.length,
    estratto: t.slice(0, 300).replace(/\n+/g, ' | '),
    bottoni: [...document.querySelectorAll('button')].map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().slice(0, 28)).filter(Boolean).slice(0, 30),
    input: [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.type).slice(0, 10),
  };
});
console.log(JSON.stringify(dati, null, 1));
console.log('ERRORI CONSOLE:', errori.length ? JSON.stringify(errori, null, 1) : 'nessuno');
await page.screenshot({ path: '/tmp/home.png', fullPage: false });
await b.close();
