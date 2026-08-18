import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
const page = await ctx.newPage();
const errori = [], reti = [];
page.on('console', m => { if (m.type() === 'error') errori.push(m.text().slice(0, 140)); });
page.on('pageerror', e => errori.push('PAGEERROR: ' + String(e).slice(0, 140)));
page.on('response', r => { if (r.status() >= 400) reti.push(`${r.status()} ${r.url().split('3111')[1]||r.url()}`.slice(0,80)); });
const foto = (n) => page.screenshot({ path: `/tmp/${n}.png` });
const stato = () => page.evaluate(() => ({
  estratto: document.body.innerText.slice(0, 320).replace(/\n+/g, ' | '),
  bottoni: [...document.querySelectorAll('button')].map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g,'·').slice(0, 26)).filter(Boolean).slice(0, 24),
  input: [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.type).slice(0, 8),
}));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll('button').length > 2, { timeout: 30000 });
try { await page.click('button:has-text("Essential only")', { timeout: 2500 }); } catch {}
await page.click('button:has-text("Italia")'); await page.waitForTimeout(900);
await page.click('button:has-text("Continua")'); await page.waitForTimeout(2500);

// dialogo PWA "Installa BarTalk": resto nel browser
try { await page.click(`button:has-text("Resta nel browser")`, { timeout: 2500 }); console.log("PWA: resto nel browser"); } catch {}
// ospite
await page.click('button:has-text("Continua senza account")');
await page.waitForTimeout(3000);
console.log('== HOME (ospite) =='); console.log(JSON.stringify(await stato(), null, 1)); await foto('03-home');

// configurazione rapida: nome + avanti
await page.fill('input[placeholder="Es. Marco"]', 'Collaudo');
await page.click('button:has-text("Avanti")');
await page.waitForTimeout(3000);
console.log('== DOPO NOME =='); console.log(JSON.stringify(await stato(), null, 1)); await foto('03b-dopo-nome');

// avatar + inizia
await page.click('button:has-text("Marcus")');
await page.click('button:has-text("Inizia ad usare BarTalk")');
await page.waitForTimeout(4000);
console.log('== HOME VERA =='); console.log(JSON.stringify(await stato(), null, 1)); await foto('03c-home-vera');

// prova a creare una stanza: cerca il pulsante
const nomi = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label')||b.innerText||'').trim().replace(/\n/g,'·')));
console.log('tour: salto');
try { await page.click('button:has-text("Salta")', { timeout: 2500 }); } catch {}
await page.waitForTimeout(800);
// se un dialogo modale e rimasto aperto (rubrica), lo chiudo
const dlg = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? d.getAttribute('aria-label') || d.innerText.slice(0,80) : null; });
if (dlg) {
  console.log('DIALOGO APERTO da chiudere:', JSON.stringify(dlg.slice(0,80)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  const ancora = await page.evaluate(() => !!document.querySelector('[role=dialog]'));
  if (ancora) { // prova il pulsante di chiusura dentro il dialogo
    await page.evaluate(() => { const d=document.querySelector('[role=dialog]'); const b=[...d.querySelectorAll('button')].find(x=>/chiudi|annulla|×|✕|indietro/i.test(x.getAttribute('aria-label')||x.innerText)); if (b) b.click(); });
    await page.waitForTimeout(600);
  }
  console.log('dialogo ancora aperto?', await page.evaluate(() => !!document.querySelector('[role=dialog]')));
}
// vai alla pagina CHAT dalla barra in fondo — corrispondenza ESATTA:
// has-text e per sottostringa e prendeva "Chat di gruppo".
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => (x.innerText||'').trim() === 'Chat'); (b[b.length-1]||b[0]).click(); });
await page.waitForTimeout(2200);
console.log('== PAGINA CHAT =='); console.log(JSON.stringify(await stato(), null, 1)); await foto('05-chat');
// nuova conversazione
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => ((x.getAttribute('aria-label')||x.innerText||'')).includes('Nuova conversazione')); b.click(); });
await page.waitForTimeout(2500);
console.log('== NUOVA CONVERSAZIONE =='); console.log(JSON.stringify(await stato(), null, 1)); await foto('06-nuova');
console.log('rete >=400:', JSON.stringify([...new Set(reti)]));
console.log('errori:', JSON.stringify([...new Set(errori)].slice(0,6)));
await b.close();
