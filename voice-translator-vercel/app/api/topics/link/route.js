// GET /api/topics/link?url=... — trasforma un link condiviso in chat in
// una scheda leggibile (b.154, task "spazio sotto per contenuti").
//
// Riusa quello che esiste gia per Mondo News: nessuna chiamata nuova a
// un motore di ricerca, nessuna chiave. Se e YouTube, l'id si legge
// dall'URL stesso (nessuna pagina da scaricare). Altrimenti si passa
// da estraiScheda(), che e gia SSRF-safe e gia usata per gli articoli.
// Cache condivisa 6 ore: lo stesso link, condiviso in piu stanze, si
// paga di rete una volta sola.

import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { estraiScheda, immagineRaggiungibile } from '../../../lib/topics/estrai.js';

const TTL = 6 * 60 * 60;

function idYoutube(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2];
    }
    return null;
  } catch { return null; }
}

async function handleGet(req) {
  const url = new URL(req.url);
  const link = (url.searchParams.get('url') || '').trim();
  if (!link || !/^https?:\/\//i.test(link)) {
    return NextResponse.json({ ok: false, motivo: 'url mancante o non valido' }, { status: 400 });
  }

  const k = `topics:link:${link}`;
  try {
    const salvato = await redis('GET', k);
    if (salvato) return NextResponse.json({ ...JSON.parse(salvato), daCache: true });
  } catch { /* la cache non risponde: si legge da capo, nessun dramma */ }

  const videoId = idYoutube(link);
  let esito;
  if (videoId) {
    esito = {
      ok: true, tipo: 'video',
      dati: { id: videoId, titolo: '', canale: '', miniatura: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
    };
  } else {
    const scheda = await estraiScheda(link);
    if (!scheda.ok) {
      return NextResponse.json({ ok: false, motivo: scheda.motivo || 'lettura fallita' });
    }
    let immagine = scheda.immagine;
    if (immagine && !(await immagineRaggiungibile(immagine))) immagine = '';
    let fonte = '';
    try { fonte = new URL(link).hostname.replace(/^www\./, ''); } catch { fonte = ''; }
    esito = {
      ok: true, tipo: 'articolo',
      dati: {
        titolo: scheda.titolo || fonte,
        immagine, descrizione: scheda.descrizione || '',
        url: link, fonte, pubblicato: scheda.pubblicato,
      },
    };
  }

  try { await redis('SET', k, JSON.stringify(esito), 'EX', TTL); } catch { /* senza cache si vive */ }
  return NextResponse.json(esito);
}

export const GET = withApiGuard(handleGet, { maxRequests: 20, prefix: 'topics-link', skipBodyCheck: true });
