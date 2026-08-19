import { apri, stato, foto, entra, clicca, DIR } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'fs';
mkdirSync(DIR, { recursive: true });

const { b, page, log } = await apri();
await entra(page);
await page.waitForTimeout(1500);

// il dialogo rubrica si apre da solo sopra la home: lo chiudo
const chiuso = await clicca(page, ['[role=dialog] button:has-text("Chiudi")', 'button:has-text("Chiudi")'], { attesa: 1200 });
console.log('dialogo iniziale chiuso con:', chiuso);
await foto(page, '03-home-pulita');

const istantanea = () => page.evaluate(() => ({
  url: location.pathname + location.search,
  dialogo: (() => { const d = document.querySelector('[role=dialog]'); return d ? (d.getAttribute('aria-label') || d.innerText.slice(0, 90).replace(/\n+/g, ' | ')) : null; })(),
  testo: document.body.innerText.slice(0, 160).replace(/\n+/g, ' | '),
  nBottoni: document.querySelectorAll('button').length,
}));

const base = await istantanea();
console.log('BASE HOME:', JSON.stringify(base));

const bersagli = [
  ['selettore-lingua', 'button:has-text("Italiano")'],
  ['ascolta-demo', 'button:has-text("Ascolta")'],
  ['demo-english', 'button:has-text("English (US)")'],
  ['non-mostrare-piu', 'button:has-text("Non mostrare più")'],
  ['card-qr-vicino', 'button:has-text("Parla con chi hai davanti")'],
  ['card-invita', 'button:has-text("Invita una persona")'],
  ['card-taxitalk', 'button:has-text("TaxiTalk")'],
  ['card-gruppo', 'button:has-text("Chat di gruppo")'],
  ['card-mondo-ora', 'button:has-text("Stanze aperte")'],
  ['card-life', 'button:has-text("Life")'],
  ['card-regala', 'button:has-text("Regala minuti")'],
  ['nav-chat', 'nav button:has-text("Chat"), button:has-text("Chat")'],
  ['nav-nuova', 'button:has-text("Nuova conversazione")'],
  ['nav-community', 'button:has-text("Community")'],
  ['nav-profilo', 'button:has-text("Profilo")'],
  ['nav-home', 'button:has-text("Home")'],
];

const esiti = [];
for (const [nome, sel] of bersagli) {
  const errPrima = log.errori.length, retiPrima = log.reti.length;
  let esito = { nome, cliccato: false };
  try {
    await page.click(sel.split(', ')[0], { timeout: 4000 });
    esito.cliccato = true;
  } catch {
    // secondo tentativo con gli altri selettori
    for (const s of sel.split(', ').slice(1)) {
      try { await page.click(s, { timeout: 2500 }); esito.cliccato = true; break; } catch {}
    }
  }
  await page.waitForTimeout(2200);
  const dopo = await istantanea();
  esito.reazione = (dopo.url !== base.url) ? `NAVIGA → ${dopo.url}`
    : dopo.dialogo ? `DIALOGO: ${dopo.dialogo.slice(0, 60)}`
    : (dopo.testo !== base.testo || dopo.nBottoni !== base.nBottoni) ? 'la schermata cambia'
    : 'NESSUNA REAZIONE VISIBILE';
  esito.erroriNuovi = [...new Set(log.errori.slice(errPrima))].slice(0, 3);
  esito.retiNuove = [...new Set(log.reti.slice(retiPrima))];
  esiti.push(esito);
  console.log(`• ${nome.padEnd(20)} clic=${esito.cliccato ? 'sì ' : 'NO '} → ${esito.reazione}` +
    (esito.retiNuove.length ? `  [HTTP: ${esito.retiNuove.join(', ')}]` : '') +
    (esito.erroriNuovi.length ? `  [ERR: ${esito.erroriNuovi.length}]` : ''));
  await foto(page, `03-${nome}`);
  // ritorno alla home
  await clicca(page, ['[role=dialog] button:has-text("Chiudi")', '[role=dialog] button[aria-label="Chiudi"]', 'button:has-text("Chiudi")'], { attesa: 700 });
  await clicca(page, ['button:has-text("Home")'], { attesa: 1200 });
  const rientro = await istantanea();
  if (rientro.url !== base.url || rientro.dialogo) {
    await page.goto(process.env.BASE_URL || 'https://voice-translator2.vercel.app', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await clicca(page, ['button:has-text("Chiudi")'], { attesa: 700 });
  }
}
writeFileSync(`${DIR}/esiti-home.json`, JSON.stringify(esiti, null, 1));
console.log('\nERRORI TOTALI:', JSON.stringify([...new Set(log.errori)].slice(0, 10), null, 1));
console.log('HTTP>=400 TOTALI:', JSON.stringify([...new Set(log.reti)]));
await b.close();
