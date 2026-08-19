import { apri, foto, entra, BASE, DIR } from './lib.mjs';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const chiudi = async (p) => { for (let i = 0; i < 3; i++) { if (await p.locator('[role=dialog]').count()) { try { await p.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await p.keyboard.press('Escape'); } await p.waitForTimeout(700); } else return; } };
const dump = async (p, t) => { const s = await p.evaluate(() => ({
  url: location.href.slice(0, 90),
  testo: document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '),
  bottoni: [...document.querySelectorAll('button')].map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g,'·').slice(0,28)).filter(Boolean).slice(0, 14),
  campi: [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.type),
})); console.log(`\n=== ${t} ===\n` + JSON.stringify(s, null, 1)); return s; };

const A = await apri({ nome: 'A' });
await entra(A.page, { nomeUtente: 'Anna' });
await A.page.waitForTimeout(1500); await chiudi(A.page);
await A.page.locator('button:has-text("Parla con chi hai davanti")').first().click({ timeout: 8000 });
await A.page.waitForTimeout(3500);
const codice = await A.page.evaluate(() => (document.body.innerText.match(/\b[A-F0-9]{8}\b/) || [null])[0]);
// il link vero: quello che l'app stessa mette nel pulsante "Condividi link"
const linkApp = await A.page.evaluate(async () => {
  const b = [...document.querySelectorAll('a')].map(a => a.href).filter(h => /room=/.test(h));
  return b[0] || null;
});
console.log('CODICE:', codice, '| link trovato nella pagina:', linkApp);

const LINK = `${BASE}?room=${codice}&lang=en&auto=1`;
const B = await apri({ nome: 'B' });
const passi = await entra(B.page, { nomeUtente: 'Bob', paese: 'United States', url: LINK });
console.log('PASSI B:', JSON.stringify(passi.map(p => p[0] + '=' + (p[1] ? 'ok' : 'SALTATO'))));
await B.page.waitForTimeout(4000);
await chiudi(B.page);
await B.page.waitForTimeout(2000);
await dump(B.page, 'B — dopo onboarding completo dal link');
await foto(B.page, '09-B-dal-link');
await A.page.waitForTimeout(2500);
await dump(A.page, 'A — lato host');
await foto(A.page, '09-A-host');
// se A ha "Iniziamo", lo premo: e' la chat che comincia
try { await A.page.locator('button:has-text("Iniziamo")').first().click({ timeout: 4000 }); await A.page.waitForTimeout(4000); console.log('A: premuto "Iniziamo"'); } catch { console.log('A: nessun "Iniziamo"'); }
await dump(A.page, 'A — dopo Iniziamo');
await foto(A.page, '09-A-dopo-iniziamo');
await B.page.waitForTimeout(3000);
await dump(B.page, 'B — dopo che A ha iniziato');
await foto(B.page, '09-B-dopo-iniziamo');
console.log('HTTP A:', JSON.stringify([...new Set(A.log.reti)]));
console.log('HTTP B:', JSON.stringify([...new Set(B.log.reti)]));
await A.b.close(); await B.b.close();
