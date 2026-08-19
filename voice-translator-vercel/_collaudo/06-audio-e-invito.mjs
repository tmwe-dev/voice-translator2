import { apri, foto, entra, DIR } from './lib.mjs';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const { b, page, log } = await apri();

// spia su play(): registro ogni tentativo di riprodurre audio e il suo esito
await page.addInitScript(() => {
  window.__audio = [];
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    const src = (this.src || '').slice(0, 80);
    const r = orig.apply(this, a);
    Promise.resolve(r).then(
      () => window.__audio.push({ src, esito: 'ok', durata: this.duration }),
      (e) => window.__audio.push({ src, esito: 'RIFIUTATO: ' + String(e).slice(0, 60) })
    );
    return r;
  };
});

const tts = [];
page.on('response', r => { if (/tts|speech|eleven|audio/i.test(r.url())) tts.push(`${r.status()} ${r.url().split('?')[0].slice(-46)}`); });

await entra(page);
await page.waitForTimeout(2000);
for (let i = 0; i < 3; i++) { if (await page.locator('[role=dialog]').count()) { try { await page.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await page.keyboard.press('Escape'); } await page.waitForTimeout(800); } }

// ── PROVA 1: il pulsante "Ascolta" della dimostrazione in home ──
console.log('== lingua interfaccia prima:', await page.evaluate(() => document.body.innerText.slice(0, 60).replace(/\n+/g, ' | ')));
await page.getByRole('button', { name: 'Ascolta', exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(9000);
const testoDemo = await page.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf('Sentila funzionare');
  return t.slice(i, i + 320).replace(/\n+/g, ' | ');
});
console.log('== DEMO DOPO ASCOLTA ==');
console.log(testoDemo);
console.log('chiamate TTS:', JSON.stringify([...new Set(tts)], null, 1));
console.log('riproduzioni audio:', JSON.stringify(await page.evaluate(() => window.__audio), null, 1));
await foto(page, '06-demo-ascolta');

// ── PROVA 2: lingua dell'invito, sessione pulita (mai toccata la lingua) ──
const { b: b2, page: p2, log: log2 } = await apri();
await entra(p2);
await p2.waitForTimeout(2000);
for (let i = 0; i < 3; i++) { if (await p2.locator('[role=dialog]').count()) { try { await p2.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await p2.keyboard.press('Escape'); } await p2.waitForTimeout(800); } }
await p2.locator('button:has-text("Parla con chi hai davanti")').first().click({ timeout: 8000 });
await p2.waitForTimeout(4000);
const stanza = await p2.evaluate(() => ({
  testo: document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '),
  select: [...document.querySelectorAll('select')].map(s => ({ etichetta: s.previousElementSibling?.innerText?.trim().slice(0,40), scelto: s.options[s.selectedIndex]?.text })),
}));
console.log('== STANZA (sessione pulita, utente italiano) ==');
console.log(JSON.stringify(stanza, null, 1));
console.log('HTTP>=400 sessione pulita:', JSON.stringify([...new Set(log2.reti)]));
await foto(p2, '06-stanza-pulita');
await b.close(); await b2.close();
