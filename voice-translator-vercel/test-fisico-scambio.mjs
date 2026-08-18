// Collaudo fisico: due schede, stanza di gruppo, codice a 8 caratteri, scambio messaggi.
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

async function nuovoUtente(nome) {
  const ctx = await b.newContext({ bypassCSP: true, permissions: ['microphone', 'camera'] });
  const page = await ctx.newPage();
  const errori = [];
  page.on('pageerror', e => errori.push('PAGEERROR: ' + String(e).slice(0, 200)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('button').length > 2, { timeout: 30000 });
  try { await page.click('button:has-text("Essential only")', { timeout: 2500 }); } catch {}
  try { await page.click('button:has-text("Italia")', { timeout: 4000 }); await page.waitForTimeout(700); await page.click('button:has-text("Continua")'); await page.waitForTimeout(1800); } catch {}
  try { await page.click('button:has-text("Resta nel browser")', { timeout: 2500 }); } catch {}
  try { await page.click('button:has-text("Continua senza account")', { timeout: 4000 }); await page.waitForTimeout(2000); } catch {}
  try {
    await page.fill('input[placeholder="Es. Marco"]', nome, { timeout: 4000 });
    await page.click('button:has-text("Avanti")'); await page.waitForTimeout(1500);
    await page.click('button:has-text("Marcus")');
    await page.click('button:has-text("Inizia ad usare BarTalk")'); await page.waitForTimeout(2500);
  } catch {}
  try { await page.click('button:has-text("Salta")', { timeout: 2500 }); } catch {}
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); if (!await page.evaluate(() => !!document.querySelector('[role=dialog]'))) break; await page.keyboard.press('Escape'); }
  return { page, errori };
}

const clicca = (page, testo) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find(x => ((x.getAttribute('aria-label')||'') + ' ' + (x.innerText||'')).includes(t));
  if (!b) throw new Error('bottone non trovato: ' + t);
  b.click();
}, testo);
const stato = (page) => page.evaluate(() => ({
  estratto: document.body.innerText.slice(0, 260).replace(/\n+/g, ' | '),
  input: [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.type).slice(0, 8),
}));

// ── A crea la stanza di gruppo ──
const A = await nuovoUtente('Anna');
await clicca(A.page, 'Invita una persona');
await A.page.waitForTimeout(3500);
console.log('A invito TESTO:', JSON.stringify(await A.page.evaluate(() => document.body.innerText.slice(0, 700))));
const codice = await A.page.evaluate(() => {
  const m = document.body.innerText.match(/([A-Z0-9]{8})(?![A-Z0-9])/);
  return m ? m[1] : null;
});
console.log('A: codice stanza =', codice, '(lunghezza', codice?.length + ')');
await A.page.screenshot({ path: '/tmp/10-A-stanza.png' });
// entra nella stanza (di solito c'e un pulsante per procedere)
console.log('A bottoni:', JSON.stringify(await A.page.evaluate(() => [...document.querySelectorAll('button')].map(x => ((x.getAttribute('aria-label')||x.innerText||'')).trim().replace(/\n/g,'·').slice(0,30)).filter(Boolean))));

// ── B entra col codice ──
const B = await nuovoUtente('Bruno');
console.log('B home:', JSON.stringify(await B.page.evaluate(() => [...document.querySelectorAll('button')].map(x => ((x.getAttribute('aria-label')||x.innerText||'')).trim().replace(/\n/g,'·').slice(0,24)).filter(Boolean).slice(0,24))));
// percorso vero: barra in fondo → Chat → Nuova conversazione → Entra con un codice
await B.page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => (x.innerText||'').trim() === 'Chat'); (b[b.length-1]||b[0]).click(); });
await B.page.waitForTimeout(1800);
await clicca(B.page, 'Nuova conversazione');
await B.page.waitForTimeout(1500);
await clicca(B.page, 'Entra con un codice');
await B.page.waitForTimeout(2000);
console.log('B (maschera codice):', JSON.stringify(await stato(B.page)));
await B.page.screenshot({ path: '/tmp/11-B-codice.png' });
// scrivi il codice nel campo
// riempi come un utente vero: Playwright digita e React aggiorna lo stato
await B.page.fill('input[placeholder="Come ti chiami?"]', 'Bruno');
const selCodice = 'input:not([placeholder="Come ti chiami?"])';
await B.page.fill(selCodice, codice);
console.log('B: campo codice →', JSON.stringify(await B.page.evaluate(() => [...document.querySelectorAll('input')].map(x => ({ ph: x.placeholder, v: x.value, max: x.maxLength })))));
await B.page.waitForTimeout(1200);
await B.page.screenshot({ path: '/tmp/12-B-codice-scritto.png' });
await B.page.waitForTimeout(600);
console.log('B bottoni:', JSON.stringify(await B.page.evaluate(() => [...document.querySelectorAll('button')].map(x => ((x.getAttribute('aria-label')||x.innerText||'')).trim().replace(/\n/g,'·').slice(0,30)).filter(Boolean))));
// ── A entra nella propria stanza ──
await clicca(A.page, 'Entra nella stanza');
await A.page.waitForTimeout(2500);
// ── B sceglie la lingua e entra ──
await B.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').includes('Italiano')); if (b) b.click(); });
await B.page.waitForTimeout(600);
const reteB = [];
B.page.on('response', async (r) => { if (r.url().includes('/api/')) { let c=''; try { c=(await r.text()).slice(0,120); } catch {} const u=new URL(r.url()); reteB.push(`${r.request().method()} ${r.status()} ${u.pathname}${u.search} :: ${c} [body: ${(r.request().postData()||'').slice(0,120)}]`); } });
const reteA = [];
A.page.on('response', async (r) => { if (/\/api\/(messages|translate|room$)/.test(new URL(r.url()).pathname) && r.request().method() === 'POST') { let c=''; try { c=(await r.text()).slice(0,220); } catch {} const u=new URL(r.url()); reteA.push(`${r.request().method()} ${r.status()} ${u.pathname}${u.search} :: ${c} [body: ${(r.request().postData()||'').slice(0,160)}]`); } });
console.log('B campi valori:', JSON.stringify(await B.page.evaluate(() => [...document.querySelectorAll('input')].map(x => ({ ph: x.placeholder, v: x.value })))));
console.log('B lingua selezionata:', JSON.stringify(await B.page.evaluate(() => [...document.querySelectorAll('button')].filter(x => x.getAttribute('aria-pressed') === 'true' || x.className.includes('selected')).map(x => (x.innerText||'').slice(0,20)))));
console.log('B pulsante:', JSON.stringify(await B.page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').includes('Entra nella Stanza')); return { disabled: b.disabled, aria: b.getAttribute('aria-disabled') }; })));
await clicca(B.page, 'Entra nella Stanza');
await A.page.waitForTimeout(4000); await B.page.waitForTimeout(4000);
console.log('B rete:', JSON.stringify(reteB.slice(0,8)));
console.log('A rete stanza:', JSON.stringify(reteA.filter(x=>!x.includes('heartbeat')).slice(0,8)));
console.log('A dentro:', JSON.stringify(await stato(A.page)));
console.log('B dentro:', JSON.stringify(await stato(B.page)));
await A.page.screenshot({ path: '/tmp/13-A-dentro.png' });
await B.page.screenshot({ path: '/tmp/14-B-dentro.png' });
// ── A scrive un messaggio ──
const campoA = await A.page.evaluate(() => { const i = [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.type); return i; });
console.log('A campi:', JSON.stringify(campoA));
const invio = await A.page.evaluate(() => {
  const inp = [...document.querySelectorAll('input,textarea')].find(x => /scrivi|messaggio|message|type/i.test(x.placeholder || ''));
  if (!inp) return { ok: false, perche: 'campo messaggio non trovato' };
  const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, 'Ciao da Anna, prova dal vivo');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return { ok: true, placeholder: inp.placeholder };
});
console.log('A scrive:', JSON.stringify(invio));
if (invio.ok) {
  await A.page.keyboard.press('Enter');
  // se Enter non invia, cerca il pulsante di invio
  await A.page.waitForTimeout(1200);
  await A.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /invia|send/i.test(x.getAttribute('aria-label') || x.innerText || '')); if (b) b.click(); });
}
await A.page.waitForTimeout(4000); await B.page.waitForTimeout(4000);
const vistoA = await A.page.evaluate(() => document.body.innerText.includes('Ciao da Anna'));
const vistoB = await B.page.evaluate(() => document.body.innerText.includes('Ciao da Anna'));
console.log('messaggio visibile — A:', vistoA, ' B:', vistoB);
await A.page.screenshot({ path: '/tmp/15-A-msg.png' });
await B.page.screenshot({ path: '/tmp/16-B-msg.png' });
console.log('ERRORI A:', JSON.stringify(A.errori.slice(0,3)));
console.log('ERRORI B:', JSON.stringify(B.errori.slice(0,3)));
await b.close();
