import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════
// Production smoke tests — run against the LIVE deployment.
//
// Run: BASE_URL=https://voice-translator2.vercel.app npx playwright test e2e/production-smoke.spec.js
//
// These verify:
// 1. App loads and hydrates
// 2. Health endpoint responds
// 3. Direct mode guard is LIVE — content APIs reject X-Session-Mode: direct
// 4. TaxiTalk API accepts only ciphertext
// ═══════════════════════════════════════════════

const PROD = process.env.BASE_URL || 'https://voice-translator2.vercel.app';

test.describe('Production smoke', () => {
  test('homepage loads with BarTalk title', async ({ page }) => {
    await page.goto(PROD);
    await expect(page).toHaveTitle(/BarTalk/i);
  });

  test('app hydrates without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(PROD);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('health endpoint responds', async ({ request }) => {
    const res = await request.get(`${PROD}/api/health`);
    // Health may be 200 or 404 if not present — but never 500
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Direct mode guard — LIVE privacy verification', () => {
  const BLOCKED_ROUTES = [
    { path: '/api/messages', method: 'post', body: { roomId: 'TESTROOM1', sender: 'x', original: 'test' } },
    { path: '/api/translate-free', method: 'post', body: { text: 'hello', sourceLang: 'en', targetLang: 'it' } },
    { path: '/api/summary', method: 'post', body: { roomId: 'TESTROOM1' } },
  ];

  for (const route of BLOCKED_ROUTES) {
    test(`${route.path} rejects Direct mode with 403`, async ({ request }) => {
      const res = await request[route.method](`${PROD}${route.path}`, {
        headers: { 'X-Session-Mode': 'direct', 'Content-Type': 'application/json' },
        data: route.body,
      });
      expect(res.status()).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Direct mode');
    });
  }

  test('translate-free works WITHOUT direct header (Translate mode)', async ({ request }) => {
    const res = await request.post(`${PROD}/api/translate-free`, {
      headers: { 'Content-Type': 'application/json' },
      data: { text: 'hello', sourceLang: 'en', targetLang: 'it' },
    });
    // Should NOT be 403 (may be 200 or 429 rate-limited, but not blocked)
    expect(res.status()).not.toBe(403);
  });
});

test.describe('TaxiTalk API — ciphertext-only contract', () => {
  test('rejects cleartext destination fields', async ({ request }) => {
    const res = await request.post(`${PROD}/api/taxi/destination`, {
      headers: { 'Content-Type': 'application/json' },
      data: { lat: 45.46, lng: 9.19, normalizedAddress: 'Via Roma 1' },
    });
    // No ciphertext field → 400 (never stores cleartext)
    expect(res.status()).toBe(400);
  });

  test('accepts ciphertext blob', async ({ request }) => {
    const res = await request.post(`${PROD}/api/taxi/destination`, {
      headers: { 'Content-Type': 'application/json' },
      data: { ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0LWJsb2ItZm9yLXNtb2tlLXRlc3Q' },
    });
    // 200 with id, or 429 if rate-limited — never 500
    expect([200, 201, 429]).toContain(res.status());
    if (res.status() < 400) {
      const json = await res.json();
      expect(json.id).toBeTruthy();
      // Response must NOT echo any location data
      expect(JSON.stringify(json)).not.toContain('45.46');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// b.414 · P1.21 — LIFE IN PRODUZIONE, che finora non provava nessuno.
//
// L'audit: «lo smoke verifica homepage, health, Direct, TaxiTalk. NON
// prova Life, Amico, Podcast, Tavola, Impara, Pronuncia, CompagnoLive,
// Compiti. Quindi un deploy puo essere verde con l'intera sezione Life
// non funzionante». Verificato: era vero.
//
// QUESTE PROVE NON SPENDONO NIENTE, ed e una scelta: girano a ogni
// invio su main, e uno smoke che chiama il modello a ogni push
// diventerebbe una voce di costo che nessuno ha deciso.
//
// Provano le PORTE: che le rotte di Life esistano davvero nel deploy,
// che rispondano, e che dicano di no a chi non ha diritto. E' cio che
// si rompe quando un deploy va storto — una rotta che sparisce, una
// guardia che smette di guardare. Cio che costa (un turno di Amico, una
// voce, un syllabus) resta scoperto e va detto: si prova a mano, o con
// un ambiente di prova a credito separato.
// ═══════════════════════════════════════════════════════════════
test.describe('Life — le porte ci sono e sanno dire di no', () => {
  // Ogni riga: la rotta, cosa le si chiede, e cosa deve rispondere a chi
  // non ha fatto l'accesso. Non 500, non 200: un no dichiarato.
  const PORTE = [
    { nome: 'i miei Compagni', path: '/api/compagni/mie', body: { azione: 'elenco' } },
    { nome: 'parla con l\'Amico', path: '/api/compagni/amico', body: { compagnoId: 'x', messaggi: [] } },
    { nome: 'la linea dal vivo (b.407)', path: '/api/compagni/live/session', body: { azione: 'apri', compagnoId: 'x' } },
  ];

  // NOTA ONESTA: qui c'era anche una riga per l'azione «dimentica». L'ho
  // tolta perche NON provava niente di piu: il cancello dell'accesso
  // scatta prima di guardare quale azione stai chiedendo, quindi
  // rispondeva 401 anche se l'azione non fosse esistita. Che l'azione ci
  // sia lo prova `memoria-compagno-b411`, dove si guarda il codice.
  // Una prova che sembra provare e peggio di una prova che manca.
  for (const porta of PORTE) {
    test(`${porta.nome}: esiste, e senza gettone risponde 401`, async ({ request }) => {
      const res = await request.post(`${PROD}${porta.path}`, {
        headers: { 'Content-Type': 'application/json' },
        data: porta.body,
      });
      // 404 vorrebbe dire che la rotta non e stata pubblicata; 500 che e
      // rotta. Un 401 e la risposta giusta: la porta c'e e sa chi non e.
      expect(res.status(), `${porta.path} deve esistere e rifiutare, non sparire ne esplodere`).toBe(401);
    });
  }

  test('la ricerca di Topics risponde ancora A RIGHE, non in JSON', async ({ request }) => {
    // b.409 dipende da questo contratto: Impara e Mondo leggono la
    // risposta riga per riga. Se un domani tornasse un JSON normale,
    // il lettore comune smetterebbe di trovare lo stadio «fine» e i
    // contenuti sparirebbero in silenzio — che e esattamente com'era.
    // Una domanda vuota costa zero e risponde con lo stesso involucro.
    const res = await request.get(`${PROD}/api/topics/search?q=`);
    expect(res.headers()['content-type'] || '').toContain('ndjson');
  });

  test('e la sezione Life e raggiungibile dalla home', async ({ page }) => {
    // Un browser nuovo non entra nella Home: per progetto vede prima la
    // scelta del paese. Il vecchio smoke cercava quindi Life nella pagina
    // di onboarding e falliva pur con la Home corretta. Prepariamo invece
    // una persona che l'onboarding l'ha gia concluso, senza account e senza
    // chiamate a pagamento: e' la condizione reale in cui la Home esiste.
    await page.addInitScript(() => {
      window.localStorage.setItem('vt-prefs', JSON.stringify({
        name: 'Smoke', lang: 'en', uiLang: 'en', country: 'US',
        avatar: '/avatars/avatar-1.webp', voice: 'nova', autoPlay: true,
      }));
      window.localStorage.setItem('vt-tutorial-done', '1');
    });
    await page.goto(PROD);
    await page.waitForLoadState('networkidle');
    // L'immagine della sezione resta un riferimento stabile, indipendente
    // dalla lingua dell'interfaccia e dal testo dei pulsanti.
    await expect(page.locator('img[src*="sez-life"]').first()).toBeVisible({ timeout: 15000 });
  });
});
