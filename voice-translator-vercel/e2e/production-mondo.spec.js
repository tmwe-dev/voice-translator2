import { test, expect } from '@playwright/test';

const PROD = process.env.BASE_URL || 'https://voice-translator2.vercel.app';

// b.587 — il Globo aveva due guasti che nessun vecchio smoke poteva
// vedere: la coda restava bloccata dalla scheda Paese e il focus Live
// perdeva contro il Paese gia selezionato. Qui proviamo almeno la prima
// promessa visibile nel BUNDLE pubblicato: entrare nel Globo + ricevere
// un evento SSE deve produrre una card, non una pagina muta.
test.describe('Mondo — Globo Live in produzione', () => {
  test('un evento Live diventa una card visibile sul Globo', async ({ page }) => {
    await page.route('**/api/mondo/discussioni**', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ discussioni: [] }),
    }));
    await page.route('**/api/mondo/paese**', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ persone: 0, stanze: 0, temi: 0, temiCaldi: [] }),
    }));
    await page.route('**/api/mondo', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [] }),
    }));
    await page.route('**/api/topics/search**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: `${JSON.stringify({ stadio: 'fine', argomenti: [], stanze: [], daCache: false, quando: Date.now() })}\n`,
    }));
    await page.route('**/api/topics/video**', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ disponibile: true, video: [] }),
    }));
    await page.route('**/api/mondo/live**', (route) => {
      const evento = {
        id: 'smoke-globo-jp',
        title: 'Evento Live di prova dal Giappone',
        country: 'JP', countries: ['JP'], topics: ['world'],
        important: true, score: 92, sourceCount: 3, status: 'confirmed',
        updatedAt: Date.now(), sources: [],
      };
      const body = [
        `event: heartbeat\ndata: ${JSON.stringify({ status: 'live', when: Date.now(), age: 1000 })}\n`,
        `event: events\ndata: ${JSON.stringify({ events: [evento], cursor: Date.now(), serverTime: Date.now() })}\n`,
        '',
      ].join('\n');
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        headers: { 'Cache-Control': 'no-cache' },
        body,
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('vt-prefs', JSON.stringify({
        name: 'Smoke', lang: 'it', uiLang: 'it', country: 'IT',
        avatar: '/avatars/avatar-1.webp', voice: 'nova', autoPlay: true,
      }));
      window.localStorage.setItem('vt-tutorial-done', '1');
      window.localStorage.removeItem('vt-mondo-live-last-seen');
    });

    await page.goto(PROD);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has(img[src*="menu-cuore.webp"])').click();

    // Mondo apre il giornale a tutta pagina per progetto. Torniamo alla
    // sua testata e passiamo dalla scheda Notizie alla scheda Globo.
    const indietro = page.getByRole('button', { name: /indietro|back/i }).first();
    await expect(indietro).toBeVisible({ timeout: 15000 });
    await indietro.click();
    const schedaNotizie = page.locator('button:has(img[src*="sez-news.webp"])').first();
    await expect(schedaNotizie).toBeVisible({ timeout: 10000 });
    await schedaNotizie.click();

    await expect(page.locator('iframe[src*="/mondo-globo.html?solo=1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Evento Live di prova dal Giappone')).toBeVisible({ timeout: 10000 });
  });
});
