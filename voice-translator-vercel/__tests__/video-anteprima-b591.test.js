// ═══════════════════════════════════════════════════════════════
// b.591 — video nelle anteprime Vercel, riapplicato da un ramo remoto
// mai unito (origin/b865-pronto, "Ripara i video nelle anteprime
// Vercel", 30/8). Verificato ASSENTE su main prima di questo push
// (nessuna traccia di VERCEL_ENV in app/api/topics/video/route.js).
// Il resto di quel ramo (due commit su "Pianoforte" in Life, e decine
// di file che erano gia cambiati su main da allora) NON e stato
// toccato: divergeva da prima di b.516, unirlo cosi com'e' avrebbe
// cancellato test e file esistenti oggi su main.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const mockRedis = vi.fn(async () => null); // niente cache, niente rate-limit mai superato
vi.mock('../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));

const mockChiaveYouTube = vi.fn();
const mockCercaSuYouTube = vi.fn();
vi.mock('../app/lib/topics/videoUfficiale.js', () => ({
  chiaveYouTube: () => mockChiaveYouTube(),
  cercaSuYouTube: (...args) => mockCercaSuYouTube(...args),
}));

const { GET } = await import('../app/api/topics/video/route.js');

function makeGetReq(params) {
  const url = new URL('http://localhost/api/topics/video');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.toString(), headers: new Headers() };
}

const VERCEL_ENV_ORIGINALE = process.env.VERCEL_ENV;

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.mockResolvedValue(null);
  delete process.env.VERCEL_ENV;
});

afterAll(() => {
  if (VERCEL_ENV_ORIGINALE === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = VERCEL_ENV_ORIGINALE;
});

describe('b.591 — anteprima Vercel senza chiave YouTube: riusa la produzione', () => {
  it('senza chiave e in preview, chiama la produzione e ne restituisce i video', async () => {
    mockChiaveYouTube.mockReturnValue(null);
    process.env.VERCEL_ENV = 'preview';
    const videoFinti = { video: [{ id: 'abc123', titolo: 'Prova' }], disponibile: true };
    const fetchSpia = vi.fn().mockResolvedValue({ ok: true, json: async () => videoFinti });
    vi.stubGlobal('fetch', fetchSpia);

    const res = await GET(makeGetReq({ q: 'notizie oggi', lang: 'it' }));
    const dati = await res.json();

    expect(fetchSpia).toHaveBeenCalledTimes(1);
    const urlChiamato = String(fetchSpia.mock.calls[0][0]);
    expect(urlChiamato).toContain('https://voice-translator2.vercel.app/api/topics/video');
    expect(urlChiamato).toContain('q=notizie+oggi');
    expect(dati.video).toEqual(videoFinti.video);
    expect(dati.daProduzione).toBe(true);

    vi.unstubAllGlobals();
  });

  it('con la chiave presente NON chiama mai la produzione, anche in preview', async () => {
    mockChiaveYouTube.mockReturnValue('una-chiave-vera');
    mockCercaSuYouTube.mockResolvedValue([]);
    process.env.VERCEL_ENV = 'preview';
    const fetchSpia = vi.fn();
    vi.stubGlobal('fetch', fetchSpia);

    await GET(makeGetReq({ q: 'notizie oggi', lang: 'it' }));

    expect(fetchSpia).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('in PRODUZIONE (VERCEL_ENV assente/production) non chiama mai la produzione, anche senza chiave', async () => {
    mockChiaveYouTube.mockReturnValue(null);
    process.env.VERCEL_ENV = 'production';
    const fetchSpia = vi.fn();
    vi.stubGlobal('fetch', fetchSpia);

    const res = await GET(makeGetReq({ q: 'notizie oggi', lang: 'it' }));
    const dati = await res.json();

    expect(fetchSpia).not.toHaveBeenCalled();
    expect(dati.daProduzione).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('se la produzione non risponde, degrada senza esplodere (nessun daProduzione)', async () => {
    mockChiaveYouTube.mockReturnValue(null);
    process.env.VERCEL_ENV = 'preview';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    const res = await GET(makeGetReq({ q: 'notizie oggi', lang: 'it' }));
    expect(res.status).toBeLessThan(500);
    const dati = await res.json();
    expect(dati.daProduzione).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
