import { apri, stato, foto, entra, DIR } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const { b, page, log } = await apri();
const passi = await entra(page);
console.log('PASSI:', JSON.stringify(passi.map(p => p[0] + '=' + (Array.isArray(p[1]) ? 'ok' : p[1] ? 'ok' : 'SALTATO'))));
await page.waitForTimeout(1500);
const s = await stato(page);
console.log('=== HOME ===');
console.log(JSON.stringify(s, null, 1));
await foto(page, '02-home');
// mappa completa degli elementi interattivi
const mappa = await page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const el = [...document.querySelectorAll('button,a[href],input,textarea,select,[role=button],[role=tab]')];
  return el.filter(vis).map((x, i) => ({
    i,
    tag: x.tagName.toLowerCase(),
    etichetta: (x.getAttribute('aria-label') || x.innerText || x.placeholder || x.getAttribute('href') || '').trim().replace(/\n/g, '·').slice(0, 46),
    disabilitato: x.disabled === true || x.getAttribute('aria-disabled') === 'true',
  }));
});
console.log('=== ELEMENTI INTERATTIVI HOME:', mappa.length, '===');
console.log(JSON.stringify(mappa, null, 0));
writeFileSync(`${DIR}/mappa-home.json`, JSON.stringify(mappa, null, 1));
console.log('ERRORI:', JSON.stringify([...new Set(log.errori)].slice(0, 8), null, 1));
console.log('HTTP>=400:', JSON.stringify([...new Set(log.reti)]));
await b.close();
