import { apri, foto, entra, BASE, DIR } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'fs';
mkdirSync(DIR, { recursive: true });

const { b, page, log } = await apri();
await entra(page);
await page.waitForTimeout(2000);

const chiudiDialogo = async () => {
  for (let i = 0; i < 3; i++) {
    const c = await page.locator('[role=dialog]').count();
    if (!c) return true;
    try { await page.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 2000 }); }
    catch { await page.keyboard.press('Escape'); }
    await page.waitForTimeout(900);
  }
  return (await page.locator('[role=dialog]').count()) === 0;
};

const MARCATORI = ['Con chi vuoi parlare?', 'Who do you want to talk to?', '¿Con quién quieres hablar?'];
const inHome = () => page.evaluate((m) => m.some(x => document.body.innerText.includes(x)), MARCATORI);

// b.256: scegliendo una lingua cambia anche la lingua dei MENU, con un
// avviso e un annulla. Nel collaudo rimetto l'italiano per non perdere
// i selettori.
const ripristinaItaliano = async () => {
  for (const s of ['button:has-text("Cancel (Italiano)")', 'button:has-text("Annulla (Italiano)")', 'button:has-text("(Italiano)")']) {
    try { await page.locator(s).first().click({ timeout: 1500 }); await page.waitForTimeout(1200); return true; } catch {}
  }
  return false;
};

const tornaHome = async () => {
  await ripristinaItaliano();
  if (await inHome()) return true;
  for (let i = 0; i < 4; i++) {
    if (await page.locator('[role=dialog]').count()) {
      try { await page.locator('[role=dialog] button[aria-label="Chiudi"]').first().click({ timeout: 1500 }); } catch { await page.keyboard.press('Escape'); }
    } else {
      let mosso = false;
      for (const s of ['button:has-text("← Indietro")', 'button[aria-label="Indietro"]', 'button[aria-label="Chiudi"]']) {
        try { await page.locator(s).first().click({ timeout: 1500 }); mosso = true; break; } catch {}
      }
      if (!mosso) { try { await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 1500 }); } catch { await page.keyboard.press('Escape'); } }
    }
    await page.waitForTimeout(1200);
    if (await inHome()) return true;
  }
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await chiudiDialogo();
  return await inHome();
};

const istantanea = () => page.evaluate(() => ({
  url: location.pathname + location.search,
  dialogo: (() => { const d = document.querySelector('[role=dialog]'); return d ? (d.getAttribute('aria-label') || d.innerText.slice(0, 80).replace(/\n+/g, ' | ')) : null; })(),
  testo: document.body.innerText.slice(0, 200).replace(/\n+/g, ' | '),
  nBottoni: document.querySelectorAll('button').length,
}));

await chiudiDialogo();
await foto(page, '05-home-pulita');
const base = await istantanea();
console.log('BASE HOME:', JSON.stringify(base));

const bersagli = [
  ['selettore-lingua',   () => page.locator('button:has-text("Italiano")').first()],
  ['demo-english',       () => page.locator('button:has-text("English (US)")').first()],
  ['demo-ascolta',       () => page.getByRole('button', { name: 'Ascolta', exact: true }).first()],
  ['demo-non-mostrare',  () => page.getByRole('button', { name: 'Non mostrare più', exact: true }).first()],
  ['card-qr-vicino',     () => page.locator('button:has-text("Parla con chi hai davanti")').first()],
  ['card-invita',        () => page.locator('button:has-text("Invita una persona")').first()],
  ['card-taxitalk',      () => page.locator('button:has-text("TaxiTalk")').first()],
  ['card-gruppo',        () => page.locator('button:has-text("Chat di gruppo")').first()],
  ['card-mondo-ora',     () => page.locator('button:has-text("Stanze aperte")').first()],
  ['card-life',          () => page.locator('button:has-text("Podcast, tutor")').first()],
  ['card-regala',        () => page.locator('button:has-text("Regala minuti")').first()],
  ['nav-chat',           () => page.getByRole('button', { name: 'Chat', exact: true }).first()],
  ['nav-nuova',          () => page.getByRole('button', { name: 'Nuova conversazione', exact: true }).first()],
  ['nav-community',      () => page.getByRole('button', { name: 'Community', exact: true }).first()],
  ['nav-profilo',        () => page.getByRole('button', { name: 'Profilo', exact: true }).first()],
  ['nav-home',           () => page.getByRole('button', { name: 'Home', exact: true }).first()],
];

const esiti = [];
for (const [nome, loc] of bersagli) {
  const eP = log.errori.length, rP = log.reti.length;
  const e = { nome, clic: 'no' };
  try { await loc().click({ timeout: 5000 }); e.clic = 'sì'; }
  catch (err) { e.errore = String(err).split('\n')[0].slice(0, 90); }
  await page.waitForTimeout(2200);
  const d = await istantanea();
  e.reazione = d.url !== base.url ? `NAVIGA → ${d.url}`
    : d.dialogo ? `DIALOGO: ${String(d.dialogo).slice(0, 55)}`
    : (d.testo !== base.testo || d.nBottoni !== base.nBottoni) ? 'schermata cambiata'
    : 'NESSUNA REAZIONE';
  e.err = [...new Set(log.errori.slice(eP))].slice(0, 2);
  e.http = [...new Set(log.reti.slice(rP))];
  esiti.push(e);
  console.log(`• ${nome.padEnd(19)} clic=${e.clic.padEnd(3)} → ${e.reazione}` +
    (e.http.length ? `  [HTTP ${e.http.join(' ')}]` : '') + (e.err.length ? `  [ERR ${e.err.length}]` : '') +
    (e.errore ? `  (${e.errore})` : ''));
  await foto(page, `05-${nome}`);
  await chiudiDialogo();
  e.linguaRimessa = await ripristinaItaliano();
  e.rientroHome = await tornaHome();
  if (!e.rientroHome) console.log(`   !! non sono riuscito a tornare alla home dopo ${nome}`);
}
writeFileSync(`${DIR}/esiti-home.json`, JSON.stringify(esiti, null, 1));
console.log('\nERRORI CONSOLE (unici):', JSON.stringify([...new Set(log.errori)].slice(0, 10), null, 1));
console.log('HTTP>=400 (unici):', JSON.stringify([...new Set(log.reti)]));
await b.close();
