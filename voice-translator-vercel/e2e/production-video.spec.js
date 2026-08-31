import { test, expect } from '@playwright/test';

const PROD = process.env.BASE_URL || 'https://voice-translator2.vercel.app';
const TED_CON_SOTTOTITOLI = ['iG9CE55wbtY', 'rrkrvAUbU9Y'];

// ═══════════════════════════════════════════════════════════════
// b.586 — LA PROVA CHE MANCAVA.
//
// I test unitari dell'interprete dimostrano ricucitura e sincronismo,
// ma non possono dimostrare che la produzione riesca davvero a leggere
// una traccia YouTube. Questa prova interroga la rotta LIVE su due TED
// pubblici e storicamente sottotitolati: ne basta uno per dimostrare che
// il ponte BarTalk → YouTube → json3 e' realmente aperto.
//
// La seconda prova collauda il BUNDLE live fino alla scritta tradotta.
// Le risposte esterne sono simulate apposta: cosi non consuma modelli e
// separa il cablaggio dell'interfaccia dalla disponibilita di YouTube.
// ═══════════════════════════════════════════════════════════════

test.describe('Interprete video — produzione', () => {
  test('la rotta live recupera una traccia YouTube reale', async ({ request }) => {
    const esiti = [];
    for (const id of TED_CON_SOTTOTITOLI) {
      const r = await request.get(`${PROD}/api/video/sottotitoli?id=${id}&lang=it`);
      expect(r.status()).toBe(200);
      const d = await r.json();
      esiti.push({ id, disponibili: !!d.disponibili, temporaneo: !!d.temporaneo, righe: d.righe?.length || 0, motivo: d.motivo || '' });
      if (d.disponibili && d.righe?.length) break;
    }
    console.log('[b.586] sottotitoli live:', JSON.stringify(esiti));
    expect(esiti.some((x) => x.disponibili && x.righe > 0), JSON.stringify(esiti)).toBe(true);
  });

  test('il bundle live mostra Traduci e consegna il testo al timestamp', async ({ page }) => {
    await page.route('**/api/topics/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: `${JSON.stringify({ stadio: 'fine', argomenti: [], stanze: [], daCache: false, quando: Date.now() })}\n`,
      });
    });
    await page.route('**/api/topics/video**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          disponibile: true,
          video: [{
            id: 'iG9CE55wbtY', titolo: 'Prova interprete', canale: 'TED',
            miniatura: 'https://i.ytimg.com/vi/iG9CE55wbtY/hqdefault.jpg',
            pubblicato: Date.now(), seme: 'prova', lingua: 'en',
          }],
        }),
      });
    });
    await page.route('**/api/video/sottotitoli**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          disponibili: true, lingua: 'en',
          righe: [{ inizio: 1, fine: 6, testo: 'Hello world.' }],
        }),
      });
    });
    await page.route('**/api/translate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ translated: 'Ciao mondo.' }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('vt-prefs', JSON.stringify({
        name: 'Smoke', lang: 'it', uiLang: 'it', country: 'IT',
        avatar: '/avatars/avatar-1.webp', voice: 'nova', autoPlay: true,
      }));
      window.localStorage.setItem('vt-tutorial-done', '1');
      window.localStorage.setItem('bartalk-interprete-video-modo-v1', 'spento');
    });

    await page.goto(PROD);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /community/i }).click();

    const traduci = page.getByTestId('traduci-video').first();
    await expect(traduci).toBeVisible({ timeout: 20000 });
    await expect(traduci).toBeEnabled({ timeout: 12000 });
    await traduci.click();
    const scelte = page.getByRole('radio');
    await expect(scelte).toHaveCount(3);
    await scelte.nth(1).click();

    // Il player reale e cross-origin. Per provare la NOSTRA porta del
    // tempo si invia lo stesso evento `infoDelivery` che l'iframe manda
    // al componente: prima di t=1 la traduzione e' pronta ma non appare.
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://www.youtube-nocookie.com',
        data: JSON.stringify({ event: 'infoDelivery', info: { currentTime: 0.3 } }),
      }));
    });
    await page.waitForTimeout(500);
    await expect(page.getByText('Ciao mondo.')).toHaveCount(0);

    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://www.youtube-nocookie.com',
        data: JSON.stringify({ event: 'infoDelivery', info: { currentTime: 1.2 } }),
      }));
    });
    await expect(page.getByText('Ciao mondo.')).toBeVisible({ timeout: 4000 });
  });
});
