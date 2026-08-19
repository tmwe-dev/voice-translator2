import { chromium } from '@playwright/test';

export const BASE = process.env.BASE_URL || 'https://voice-translator2.vercel.app';
export const DIR = '/Users/teameurope/bartalk-live/_prove';

export async function apri({ nome = 'A' } = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['microphone'],
    locale: 'it-IT',
  });
  const page = await ctx.newPage();
  const log = { errori: [], reti: [], nome };
  page.on('console', m => { if (m.type() === 'error') log.errori.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => log.errori.push('PAGEERROR: ' + String(e).slice(0, 160)));
  page.on('response', r => {
    if (r.status() >= 400) {
      let p = r.url(); try { p = new globalThis.URL(r.url()).pathname; } catch {}
      log.reti.push(`${r.status()} ${p}`);
    }
  });
  return { b, ctx, page, log };
}

export const stato = (page) => page.evaluate(() => ({
  testo: document.body.innerText.slice(0, 500).replace(/\n+/g, ' | '),
  bottoni: [...document.querySelectorAll('button')]
    .map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g, '·').slice(0, 40))
    .filter(Boolean),
  input: [...document.querySelectorAll('input,textarea')].map(x => x.placeholder || x.getAttribute('aria-label') || x.type),
  dialogo: (() => { const d = document.querySelector('[role=dialog]'); return d ? (d.getAttribute('aria-label') || d.innerText.slice(0, 100).replace(/\n+/g,' | ')) : null; })(),
}));

export const foto = (page, n) => page.screenshot({ path: `${DIR}/${n}.png` });

/** click tollerante: prova piu selettori, ritorna quale ha funzionato */
export async function clicca(page, selettori, { attesa = 1200, obbligatorio = false } = {}) {
  for (const s of [].concat(selettori)) {
    try { await page.click(s, { timeout: 3000 }); await page.waitForTimeout(attesa); return s; } catch {}
  }
  if (obbligatorio) throw new Error('NESSUN selettore ha funzionato: ' + JSON.stringify(selettori));
  return null;
}

/** onboarding completo fino alla home, come un utente vero */
export async function entra(page, { nomeUtente = 'Collaudo', paese = 'Italia', url = BASE } = {}) {
  const passi = [];
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('button').length > 1, { timeout: 40000 });
  await page.waitForTimeout(1500);
  passi.push(['cookie', await clicca(page, ['button:has-text("Essential only")', 'button:has-text("Solo essenziali")'])]);
  passi.push(['paese', await clicca(page, [`button:has-text("${paese}")`])]);
  passi.push(['continua', await clicca(page, ['button:has-text("Continue")', 'button:has-text("Continua")'], { attesa: 2500 })]);
  passi.push(['pwa', await clicca(page, ['button:has-text("Resta nel browser")', 'button:has-text("Stay in browser")'])]);
  passi.push(['ospite', await clicca(page, ['button:has-text("Continua senza account")', 'button:has-text("Continue without account")'], { attesa: 3000 })]);
  // configurazione rapida: nome
  try {
    await page.locator('input[placeholder="Es. Marco"], input[placeholder="e.g. Marco"], input[placeholder*="Marco"]').first().fill(nomeUtente, { timeout: 4000 });
    passi.push(['nome', nomeUtente]);
    passi.push(['avanti', await clicca(page, ['button:has-text("Avanti")', 'button:has-text("Next")'], { attesa: 2500 })]);
  } catch { passi.push(['nome', null]); }
  // avatar (primo disponibile) + inizio
  const avatar = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].map(x => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g, '·'));
    return b;
  });
  passi.push(['schermata-avatar', avatar.slice(0, 12)]);
  passi.push(['avatar', await clicca(page, ['button:has-text("Marcus")'], { attesa: 800 })]);
  passi.push(['inizia', await clicca(page, ['button:has-text("Inizia ad usare BarTalk")', 'button:has-text("Start using BarTalk")'], { attesa: 4000 })]);
  // tour / dialoghi che possono coprire la home
  passi.push(['tour', await clicca(page, ['button:has-text("Salta")', 'button:has-text("Skip")'], { attesa: 1200 })]);
  return passi;
}
