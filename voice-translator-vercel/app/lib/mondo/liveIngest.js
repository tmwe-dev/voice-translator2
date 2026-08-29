import { cercaArgomenti } from '../topics/servizio.js';
import { domandaPer } from './queries.js';
import { daBreaking } from './normalize.js';
import { paeseDellaNotizia } from '../paeseDaFonte.js';
import { PAESI } from '../paesi.js';
import { clusterBreakingCandidates } from './breaking.js';
import { readPushSubscriptions, saveLiveEvents, setLastIngestAt } from './liveStore.js';

const CODICI_NOTI = new Set(PAESI.map((p) => p.codice));
const TOPIC_ROTANTI = ['politics', 'economy', 'markets', 'technology', 'science', 'health', 'environment', 'sport'];

function linguaBase(x) {
  const l = String(x || 'en').split('-')[0].toLowerCase();
  return ['it','en','es','fr','de','pt'].includes(l) ? l : 'en';
}

function nomePaese(codice, lingua = 'en') {
  try { return new Intl.DisplayNames([linguaBase(lingua)], { type: 'region' }).of(codice) || codice; }
  catch { return codice; }
}

function preferenzeAttive(subs) {
  const topics = new Map();
  const countries = new Map();
  const langs = new Map();
  for (const s of (Array.isArray(subs) ? subs : [])) {
    const p = s?.preferences || {};
    for (const t of (p.topics || [])) topics.set(t, (topics.get(t) || 0) + 1);
    for (const c of (p.countries || [])) countries.set(String(c).toUpperCase(), (countries.get(String(c).toUpperCase()) || 0) + 1);
    const l = linguaBase(p.lang);
    langs.set(l, (langs.get(l) || 0) + 1);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { topics: top(topics), countries: top(countries), langs: top(langs) };
}

function pianoRicerca(attive, now = Date.now()) {
  const out = [
    { topic: 'breaking', lang: 'en', query: domandaPer('breaking', 'en'), country: '' },
    { topic: 'world', lang: 'en', query: domandaPer('world', 'en'), country: '' },
  ];

  // Terza corsia: cio che interessa davvero agli utenti attivi. Se non
  // c'e ancora nessuno, il mondo resta vario con una rotazione stabile.
  const l = attive.langs[0] || 'en';
  const country = attive.countries[0] || '';
  const topic = attive.topics[0] || TOPIC_ROTANTI[Math.floor(now / (2 * 60 * 1000)) % TOPIC_ROTANTI.length];
  if (country) {
    const q = `${nomePaese(country, l)} ${domandaPer('breaking', l) || domandaPer('breaking', 'en')}`;
    out.push({ topic: 'breaking', lang: l, query: q, country });
  } else {
    out.push({ topic, lang: l, query: domandaPer(topic, l) || domandaPer(topic, 'en'), country: '' });
  }
  return out.filter((x) => x.query);
}

async function cercaUna(voce) {
  try {
    const r = await cercaArgomenti(voce.query, voce.lang, {
      categoria: 'notizie',
      fresca: true,
      profonda: false,
      fonti: 6,
      paeseFonti: voce.country,
      settoreFonti: voce.topic === 'breaking' || voce.topic === 'world' ? '' : voce.topic,
      racconta: () => {},
    });
    return { voce, argomenti: Array.isArray(r?.argomenti) ? r.argomenti : [] };
  } catch {
    return { voce, argomenti: [] };
  }
}

export async function ingestMondoLive({ now = Date.now() } = {}) {
  const subscriptions = await readPushSubscriptions().catch(() => []);
  const attive = preferenzeAttive(subscriptions);
  const piano = pianoRicerca(attive, now);
  const risultati = await Promise.all(piano.map(cercaUna));

  const entries = [];
  for (const { voce, argomenti } of risultati) {
    for (const raw of argomenti.slice(0, 12)) {
      const country = paeseDellaNotizia(raw, CODICI_NOTI) || voce.country || '';
      const candidate = daBreaking(raw, { topic: voce.topic, query: voce.query });
      if (!candidate) continue;
      entries.push({ candidate: { ...candidate, country }, raw, country, topic: voce.topic });
    }
  }

  const events = clusterBreakingCandidates(entries, {
    now,
    followedTopics: attive.topics,
    countries: attive.countries,
  });
  const nuovi = await saveLiveEvents(events, { now });
  await setLastIngestAt(now);
  return {
    ok: true,
    when: now,
    queries: piano.length,
    candidates: entries.length,
    events: events.length,
    newEvents: nuovi,
  };
}
