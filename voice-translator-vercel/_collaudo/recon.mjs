import { chromium } from '@playwright/test';
const BASE = process.env.BASE_URL || 'https://voice-translator2.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errori = [], reti = [];
page.on('console', m => { if (m.type() === 'error') errori.push(m.text().slice(0, 160)); });
page.on('pageerror', e => errori.push('PAGEERROR: ' + String(e).slice(0, 160)));
page.on('response', r => { if (r.status() >= 400) reti.push(`${r.status()} ${new URL(r.url()).pathname}`); });

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
try { await page.waitForFunction(() => document.querySelectorAll('button').length > 1, { timeout: 30000 }); } catch { console.log('!! UI non comparsa'); }
await page.waitForTimeout(2500);

const stato = await page.evaluate(() => ({
  url: location.href,
  titolo: document.title,
  testo: document.body.innerText.slice(0, 700).replace(/\n+/g, ' | '),
  bottoni: [...document.querySelectorAll('button')].map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g,'·').slice(0, 40)).filter(Boolean),
  input: [...document.querySelectorAll('input,textarea,select')].map(x => x.placeholder || x.getAttribute('aria-label') || x.type),
}));
console.log(JSON.stringify(stato, null, 1));
console.log('ERRORI:', errori.length ? JSON.stringify(errori, null, 1) : 'nessuno');
console.log('HTTP>=400:', reti.length ? JSON.stringify([...new Set(reti)]) : 'nessuno');
await page.screenshot({ path: '/Users/teameurope/bartalk-live/voice-translator-vercel/_collaudo/00-ingresso.png' });
await b.close();
