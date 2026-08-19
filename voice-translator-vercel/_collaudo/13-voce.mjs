import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE_URL || 'https://voice-translator2.vercel.app';
const DIR = '/Users/teameurope/bartalk-live/_prove';
mkdirSync(DIR, { recursive: true });

// microfono FINTO del browser: un tono continuo — serve a provare che la
// CATENA giri (registra -> invia -> stato risposta), non la qualita
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'], locale: 'it-IT' });
const page = await ctx.newPage();
const rete = [];
page.on('response', r => { if (/transcribe|translate|tts/.test(r.url())) rete.push(`${r.status()} ${r.url().split('/api/')[1]?.split('?')[0]}`); });

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll('button').length > 1, { timeout: 40000 });
await page.waitForTimeout(1500);
for (const s of ['button:has-text("Solo essenziali")','button:has-text("Italia")','button:has-text("Continua")','button:has-text("Resta nel browser")','button:has-text("Continua senza account")']) {
  try { await page.locator(s).first().click({ timeout: 3500 }); await page.waitForTimeout(1500); } catch {}
}
try { await page.locator('input[placeholder*="Marco"]').first().fill('Prova', { timeout: 3000 }); await page.locator('button:has-text("Avanti")').first().click(); await page.waitForTimeout(1500); } catch {}
try { await page.locator('button:has-text("Marcus")').first().click({ timeout: 2500 }); await page.locator('button:has-text("Inizia")').first().click(); await page.waitForTimeout(3500); } catch {}
for (let i = 0; i < 3; i++) { if (await page.locator('[role=dialog]').count()) { try { await page.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1200 }); } catch { await page.keyboard.press('Escape'); } await page.waitForTimeout(600); } }
// il tour introduttivo copre la home: lo salto
for (const t of ['button:has-text("Salta")','button:has-text("Skip")']) { try { await page.locator(t).first().click({ timeout: 2500 }); await page.waitForTimeout(700); } catch {} }
await page.keyboard.press('Escape'); await page.waitForTimeout(700);
await page.locator('button:has-text("Chat di gruppo")').first().click({ timeout: 8000 });
await page.waitForTimeout(3500);
try { await page.locator('button:has-text("Iniziamo")').first().click({ timeout: 4000 }); } catch {}
await page.waitForTimeout(2500);

// tengo premuto il pulsante del parlato per 3 secondi
const mic = page.locator('button:has-text("Tieni premuto"), button[aria-label*="arlare"]').first();
const box = await mic.boundingBox();
console.log('pulsante voce trovato:', !!box);
if (box) {
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();
  await page.waitForTimeout(10000);
}
console.log('CHIAMATE DI RETE della catena voce:', JSON.stringify([...new Set(rete)], null, 1));
const monitor = await page.evaluate(() => (window.__bartalkMonitor || []).map(r => `${r.fase}${r.ms?' '+r.ms+'ms':''}${r.stato?' stato='+r.stato:''}${r.frequenza?' '+r.frequenza+'Hz':''}${r.byte?' '+r.byte+'B':''}`));
console.log('MONITOR:', JSON.stringify(monitor, null, 1));
await page.screenshot({ path: `${DIR}/13-voce.png` });
await b.close();
