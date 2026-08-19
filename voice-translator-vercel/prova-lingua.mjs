// Collaudo fisico del cambio lingua dei menu (b.256).
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ bypassCSP: true })).newPage();
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errori.push('CONSOLE: ' + m.text().slice(0, 200)); });
await page.goto('http://localhost:3210/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll('button').length > 2, { timeout: 30000 });
try { await page.click('button:has-text("Essential only")', { timeout: 2500 }); } catch {}
try { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').startsWith('🇮🇹')); if (b) b.click(); }); await page.waitForTimeout(900); await page.click('button:has-text("Continua")', { timeout: 3000 }); await page.waitForTimeout(1800); } catch {}
try { await page.click('button:has-text("Resta nel browser")', { timeout: 2500 }); } catch {}
try { await page.click('button:has-text("Continua senza account")', { timeout: 4000 }); await page.waitForTimeout(2000); } catch {}
for (let g = 0; g < 12; g++) {
  const pronta = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => (b.innerText||'').includes('Invita una persona') || (b.innerText||'').includes('Invite someone')));
  if (pronta) break;
  await page.evaluate(() => {
    const q = (t) => [...document.querySelectorAll('button')].find(x => ((x.getAttribute('aria-label')||'') + (x.innerText||'')).includes(t));
    const inp = [...document.querySelectorAll('input')].find(x => /Marco|chiami/i.test(x.placeholder||''));
    if (inp && !inp.value) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(inp,'Collaudo'); inp.dispatchEvent(new Event('input',{bubbles:true})); return; }
    const av = q('Marcus'); if (av) av.click();
    const via = q('Inizia ad usare BarTalk') || q('Start using BarTalk'); if (via && !via.disabled) { via.click(); return; }
    for (const t of ['Avanti','Next','Salta','Skip']) { const b2 = q(t); if (b2 && !b2.disabled) { b2.click(); return; } }
  });
  await page.waitForTimeout(1300);
}
for (let i = 0; i < 5; i++) { await page.waitForTimeout(600); if (!await page.evaluate(() => !!document.querySelector('[role=dialog]'))) break; await page.keyboard.press('Escape'); }
const titolo = () => page.evaluate(() => (document.querySelector('h1,h2')?.innerText || document.body.innerText.slice(0,60)).replace(/\n/g,' '));
console.log('PRIMA:', await titolo());
// apre il selettore lingua e sceglie Deutsch
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Italiano|▼/.test(x.innerText||'')); b.click(); });
await page.waitForTimeout(800);
const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').includes('Deutsch')); if (!b) return false; b.click(); return true; });
console.log('cliccato Deutsch:', ok);
for (const attesa of [500, 1000, 2000, 3000]) {
  await page.waitForTimeout(attesa);
  console.log(`dopo ${attesa}ms →`, await titolo());
}
console.log('prefs:', await page.evaluate(() => localStorage.getItem('vt-prefs')));
console.log('errori:', JSON.stringify([...new Set(errori)].slice(0,4)));
await page.screenshot({ path: '/tmp/lingua-dopo.png' });
await b.close();
