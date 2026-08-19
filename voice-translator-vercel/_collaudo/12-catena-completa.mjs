import { apri, entra, BASE, DIR } from './lib.mjs';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const chiudi = async (p) => { for (let i = 0; i < 3; i++) { if (await p.locator('[role=dialog]').count()) { try { await p.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await p.keyboard.press('Escape'); } await p.waitForTimeout(700); } else return; } };

const A = await apri(); const B = await apri();
for (const [P, n] of [[A,'A'],[B,'B']]) {
  P.page.on('console', m => { const t=m.text(); if (/error|fail/i.test(t) && !/favicon|analytics|stt-token/i.test(t)) console.log(`  [${n}!]`, t.slice(0,130)); });
}
await entra(A.page, { nomeUtente: 'Anna' });
await A.page.waitForTimeout(1500); await chiudi(A.page);
await A.page.locator('button:has-text("Parla con chi hai davanti")').first().click({ timeout: 8000 });
await A.page.waitForTimeout(3500);
const codice = await A.page.evaluate(() => (document.body.innerText.match(/\b[A-F0-9]{8}\b/) || [null])[0]);
console.log('STANZA:', codice);
await B.page.goto(`${BASE}?room=${codice}&lang=en&auto=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await B.page.waitForTimeout(9000); await chiudi(B.page);
try { await A.page.locator('button:has-text("Iniziamo")').first().click({ timeout: 5000 }); } catch {}
await A.page.waitForTimeout(3000);

// ── 1. MESSAGGIO SCRITTO: A scrive in italiano, B deve vederlo in inglese ──
await A.page.locator('input[placeholder*="crivi"], textarea').first().fill('Buongiorno, come stai oggi?');
await A.page.locator('button[aria-label*="nvia"]').first().click({ timeout: 3000 }).catch(() => A.page.keyboard.press('Enter'));
await B.page.waitForTimeout(9000);
const vistoB = await B.page.evaluate(() => document.body.innerText);
const okTesto = /Good morning|How are you/i.test(vistoB);
console.log('1. TESTO tradotto arrivato a B:', okTesto ? 'SI' : 'NO', '|', (vistoB.match(/Good[^\n]{0,60}/i)||[''])[0]);
await B.page.screenshot({ path: `${DIR}/12-B-testo.png` });

// ── 2. RISPOSTA: B scrive in inglese, A deve vederla in italiano ──
// B e in modalita voce: passo alla tastiera se serve
try { await B.page.locator('button[aria-label*="eyboard"], button[aria-label*="astiera"]').first().click({ timeout: 3000 }); await B.page.waitForTimeout(800); } catch {}
const campoB = B.page.locator('input[type="text"], textarea').last();
await campoB.fill('I am fine, thank you my friend', { timeout: 15000 });
await campoB.press('Enter').catch(() => {});
try { await B.page.locator('button[aria-label*="end"], button[aria-label*="nvia"]').first().click({ timeout: 2500 }); } catch {}
await A.page.waitForTimeout(9000);
const vistoA = await A.page.evaluate(() => document.body.innerText);
const okRisposta = /Sto bene|grazie/i.test(vistoA);
console.log('2. RISPOSTA tradotta arrivata ad A:', okRisposta ? 'SI' : 'NO', '|', (vistoA.match(/Sto bene[^\n]{0,50}/i)||[''])[0]);

// ── 3. il tasto ▶ della voce sul messaggio, lato B ──
const rete = [];
B.page.on('response', r => { if (/tts/.test(r.url())) rete.push(r.status() + ' ' + r.url().split('/api/')[1]?.split('?')[0]); });
try {
  await B.page.locator('button[aria-label*="lay"], button[aria-label*="scolta"]').first().click({ timeout: 4000 });
  await B.page.waitForTimeout(6000);
  console.log('3. VOCE dal tasto play, chiamate:', JSON.stringify([...new Set(rete)]));
} catch { console.log('3. VOCE: tasto play non trovato'); }

// ── 4. il monitor di bordo: cosa ha registrato la catena su A ──
const monitorA = await A.page.evaluate(() => (window.__bartalkMonitor || []).map(r => r.fase + (r.ms ? ` ${r.ms}ms` : '') + (r.stato ? ` stato=${r.stato}` : '') + (r.fornitore ? ` ${r.fornitore}` : '')));
console.log('4. MONITOR A:', JSON.stringify(monitorA, null, 1));
await A.page.screenshot({ path: `${DIR}/12-A-fine.png` });
await A.b.close(); await B.b.close();
