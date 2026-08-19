import { apri, foto, entra, DIR } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const { b, page, log } = await apri();
await entra(page);
await page.waitForTimeout(2000);
const chiudi = async () => { for (let i = 0; i < 3; i++) { if (await page.locator('[role=dialog]').count()) { try { await page.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await page.keyboard.press('Escape'); } await page.waitForTimeout(800); } else return; } };
await chiudi();

const dump = async (t) => {
  const s = await page.evaluate(() => ({
    testo: document.body.innerText.slice(0, 420).replace(/\n+/g, ' | '),
    bottoni: [...document.querySelectorAll('button')].map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g, '·').slice(0, 34)).filter(Boolean),
    input: [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.getAttribute('aria-label') || x.type),
  }));
  console.log(`\n===== ${t} =====`);
  console.log(JSON.stringify(s, null, 1));
  return s;
};

// ── 1. elenco chat dalla barra in basso ──
await page.getByRole('button', { name: 'Chat', exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(3000);
await dump('ELENCO CHAT');
await foto(page, '07-elenco-chat');

// ── 2. creo una stanza di gruppo ed entro nella chat ──
await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 5000 });
await page.waitForTimeout(2000);
await chiudi();
await page.locator('button:has-text("Chat di gruppo")').first().click({ timeout: 8000 });
await page.waitForTimeout(4000);
const s2 = await dump('DOPO "CHAT DI GRUPPO"');
await foto(page, '07-stanza-gruppo');

// entro nella chat vera: cerco il pulsante che apre la conversazione
for (const sel of ['button:has-text("Entra in chat")', 'button:has-text("Apri chat")', 'button:has-text("Vai alla chat")', 'button:has-text("Entra")', 'button:has-text("Chat")']) {
  try { await page.locator(sel).first().click({ timeout: 2500 }); console.log('ingresso chat con:', sel); break; } catch {}
}
await page.waitForTimeout(4000);
const s3 = await dump('DENTRO LA CHAT');
await foto(page, '07-dentro-chat');

// ── 3. invio un messaggio ──
const campi = await page.evaluate(() => [...document.querySelectorAll('input,textarea')].map(x => ({ ph: x.placeholder, tipo: x.type, vis: x.getBoundingClientRect().height > 0 })));
console.log('campi disponibili:', JSON.stringify(campi));
let inviato = false;
for (const sel of ['textarea', 'input[placeholder*="essagg"]', 'input[type="text"]']) {
  try {
    await page.locator(sel).first().fill('Ciao, questa e una prova di collaudo', { timeout: 3000 });
    await page.waitForTimeout(500);
    const rP = log.reti.length;
    try { await page.locator('button[aria-label*="nvia"], button:has-text("Invia")').first().click({ timeout: 2500 }); }
    catch { await page.keyboard.press('Enter'); }
    inviato = true;
    await page.waitForTimeout(6000);
    console.log('inviato con', sel, '| HTTP nuove:', JSON.stringify([...new Set(log.reti.slice(rP))]));
    break;
  } catch {}
}
console.log('messaggio inviato:', inviato);
const s4 = await dump('DOPO INVIO MESSAGGIO');
await foto(page, '07-dopo-invio');
writeFileSync(`${DIR}/chat.json`, JSON.stringify({ s2, s3, s4 }, null, 1));
console.log('\nERRORI CONSOLE:', JSON.stringify([...new Set(log.errori)].slice(0, 8), null, 1));
console.log('HTTP>=400:', JSON.stringify([...new Set(log.reti)]));
await b.close();
