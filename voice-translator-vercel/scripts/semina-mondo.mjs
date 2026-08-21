#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// SEMINA — riempie Mondo di contenuti veri per vedere come si presenta
// pieno: stanze aperte nei paesi, discussioni con articoli e link,
// commenti sotto. Chiesto da Luca (b.363).
//
// Tutto quello che scrive porta un marchio, e si toglie con un comando:
//
//     node scripts/semina-mondo.mjs            → semina
//     node scripts/semina-mondo.mjs --pulisci  → toglie SOLO cio che ha seminato
//
// Le credenziali si leggono da ../.env.local (non si scrivono qui dentro).
//
// NOTA sulle stanze: la vetrina di Mondo vive in una lista con un'ora di
// vita (e cosi che l'app tiene pulita la piazza). Le stanze seminate
// spariscono da sole dopo un'ora: per rivederle si riesegue la semina.
// Le discussioni invece restano finche non si pulisce.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));

// ── le credenziali, dal file dell'ambiente ──
function ambiente() {
  const percorso = join(QUI, '..', '..', '.env.local');
  const testo = readFileSync(percorso, 'utf8');
  const env = {};
  for (const riga of testo.split('\n')) {
    const m = riga.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = ambiente();
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const CHIAVE = E.SUPABASE_SERVICE_ROLE_KEY;
const REDIS_URL = E.UPSTASH_REDIS_REST_URL;
const REDIS_TOK = E.UPSTASH_REDIS_REST_TOKEN;
if (!SUPA || !CHIAVE) { console.error('Mancano le credenziali Supabase in .env.local'); process.exit(1); }

// ── IL MARCHIO: tutto cio che semino porta questo autore, cosi si
//    riconosce a colpo d'occhio e si toglie senza toccare il resto ──
const MARCHIO = 'u_semina_mock';

const intestazioni = {
  apikey: CHIAVE,
  Authorization: `Bearer ${CHIAVE}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function sql(percorso, opzioni = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${percorso}`, { ...opzioni, headers: intestazioni });
  const testo = await r.text();
  if (!r.ok) throw new Error(`${percorso}: ${r.status} ${testo.slice(0, 300)}`);
  return testo ? JSON.parse(testo) : null;
}

async function redis(...comando) {
  if (!REDIS_URL || !REDIS_TOK) return null;
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando),
  });
  const d = await r.json().catch(() => ({}));
  return d?.result ?? null;
}

// ═══════════════════════ LE STANZE ═══════════════════════
// Nomi veri, non riempitivi: e cosi che si capisce se la vetrina regge.
const STANZE = [
  { nome: 'Caffè e giornali del mattino', host: 'Luca', desc: 'Si legge la prima pagina e se ne parla', lang: 'it', mode: 'conversation', membri: 4 },
  { nome: 'Cucina di casa, ricette vere', host: 'Marta', desc: 'Quello che si mangia stasera, senza chef', lang: 'it', mode: 'freetalk', membri: 6 },
  { nome: 'Morning coffee, travel stories', host: 'Sarah', desc: 'Where have you been lately?', lang: 'en', mode: 'freetalk', membri: 9 },
  { nome: 'English practice, no judgement', host: 'Tom', desc: 'Speak badly, get better', lang: 'en', mode: 'classroom', membri: 12 },
  { nome: 'Sobremesa, hablemos de todo', host: 'Carmen', desc: 'La charla larga después de comer', lang: 'es', mode: 'conversation', membri: 7 },
  { nome: 'Fútbol y nada más', host: 'Diego', desc: 'La liga, la champions, lo que sea', lang: 'es', mode: 'freetalk', membri: 15 },
  { nome: 'Le comptoir du soir', host: 'Élise', desc: 'On refait le monde, tranquillement', lang: 'fr', mode: 'conversation', membri: 5 },
  { nome: 'Feierabend, einfach reden', host: 'Jonas', desc: 'Nach der Arbeit, ohne Thema', lang: 'de', mode: 'freetalk', membri: 8 },
  { nome: 'Café da manhã brasileiro', host: 'Ana', desc: 'Conversa leve pra começar o dia', lang: 'pt', mode: 'conversation', membri: 11 },
  { nome: '夜のラウンジ', host: 'Yuki', desc: '静かに話しましょう', lang: 'ja', mode: 'conversation', membri: 3 },
  { nome: '晚间闲聊', host: 'Wei', desc: '随便聊聊，不限话题', lang: 'zh', mode: 'freetalk', membri: 6 },
  { nome: 'Вечерний разговор', host: 'Ирина', desc: 'О чём угодно, спокойно', lang: 'ru', mode: 'conversation', membri: 4 },
  { nome: 'مقهى الليل', host: 'سامي', desc: 'حديث هادئ في المساء', lang: 'ar', mode: 'freetalk', membri: 5 },
  { nome: 'Business English, 20 minuti', host: 'Chiara', desc: 'Riunioni, mail, telefonate', lang: 'it', mode: 'classroom', membri: 10 },
];

// ═══════════════════════ LE DISCUSSIONI ═══════════════════════
// Con link veri e riconoscibili: e cosi che si vede come si presenta una
// discussione nata da un articolo.
const DISCUSSIONI = [
  { titolo: 'Il treno ad alta velocità Milano–Parigi riapre dopo due anni', topic: 'trasporti', paese: 'IT', lang: 'it',
    media: { url: 'https://www.ilpost.it/2026/07/12/treno-milano-parigi/', source: 'Il Post', tipo: 'articolo' },
    commenti: [
      { n: 'Marta', t: 'Ci ho messo sei ore in macchina l\'estate scorsa. Sei ore.', l: 'it' },
      { n: 'Élise', t: 'Depuis Paris on attendait ça depuis longtemps.', l: 'fr' },
      { n: 'Luca', t: 'Quanto costa il biglietto? Se costa come l\'aereo cambia tutto.', l: 'it' },
    ] },
  { titolo: 'A new study says learning a language after 40 works better than we thought', topic: 'formazione', paese: 'US', lang: 'en',
    media: { url: 'https://www.nature.com/articles/s41562-026-01887-2', source: 'Nature Human Behaviour', tipo: 'articolo' },
    commenti: [
      { n: 'Tom', t: 'I started Spanish at 47. It is slower but it sticks better.', l: 'en' },
      { n: 'Chiara', t: 'Dipende molto da quanto lo usi davvero, non da quanto studi.', l: 'it' },
      { n: 'Yuki', t: '40代で英語を始めました。会話が一番効きます。', l: 'ja' },
      { n: 'Sarah', t: 'Same. Talking to people beat every app I tried.', l: 'en' },
    ] },
  { titolo: 'España aprueba la semana laboral de cuatro días para empresas pequeñas', topic: 'economia', paese: 'ES', lang: 'es',
    media: { url: 'https://elpais.com/economia/2026-06-30/semana-cuatro-dias.html', source: 'El País', tipo: 'articolo' },
    commenti: [
      { n: 'Carmen', t: 'En mi empresa lo probamos seis meses. Nadie quiere volver atrás.', l: 'es' },
      { n: 'Diego', t: '¿Y el sueldo? Esa es la pregunta de verdad.', l: 'es' },
      { n: 'Jonas', t: 'In Deutschland wird das auch diskutiert, aber langsamer.', l: 'de' },
    ] },
  { titolo: 'Le prix du café atteint son plus haut niveau depuis quarante ans', topic: 'economia', paese: 'FR', lang: 'fr',
    media: { url: 'https://www.lemonde.fr/economie/article/2026/08/02/prix-cafe.html', source: 'Le Monde', tipo: 'articolo' },
    commenti: [
      { n: 'Élise', t: 'Le petit noir du matin va devenir un luxe.', l: 'fr' },
      { n: 'Ana', t: 'Aqui no Brasil a colheita foi péssima este ano. É por isso.', l: 'pt' },
    ] },
  { titolo: 'Tokyo apre la prima linea di metropolitana interamente automatica', topic: 'tecnologia', paese: 'JP', lang: 'ja',
    media: { url: 'https://www3.nhk.or.jp/news/html/20260715/k10014567891000.html', source: 'NHK', tipo: 'articolo' },
    commenti: [
      { n: 'Yuki', t: '乗ってきました。運転席がないのは不思議な感じです。', l: 'ja' },
      { n: 'Wei', t: '上海也有类似的线路，已经用了几年了。', l: 'zh' },
      { n: 'Tom', t: 'Meanwhile my city cannot keep two escalators working.', l: 'en' },
    ] },
  { titolo: 'Brasil bate recorde de energia solar: metade da rede in un solo giorno', topic: 'ambiente', paese: 'BR', lang: 'pt',
    media: { url: 'https://g1.globo.com/economia/noticia/2026/07/28/energia-solar-recorde.ghtml', source: 'G1', tipo: 'articolo' },
    commenti: [
      { n: 'Ana', t: 'Metade da rede em um dia. Há dez anos isso era ficção.', l: 'pt' },
      { n: 'Diego', t: 'En España pasó algo parecido en mayo.', l: 'es' },
    ] },
  { titolo: 'Der Streit über die Rückkehr ins Büro ist noch nicht vorbei', topic: 'lavoro', paese: 'DE', lang: 'de',
    media: { url: 'https://www.zeit.de/arbeit/2026-08/rueckkehr-buero-debatte', source: 'Die Zeit', tipo: 'articolo' },
    commenti: [
      { n: 'Jonas', t: 'Drei Tage im Büro, zwei zu Hause. Für mich passt das.', l: 'de' },
      { n: 'Chiara', t: 'Da noi è tornato tutto come prima, senza dirlo apertamente.', l: 'it' },
      { n: 'Sarah', t: 'My team is fully remote across four countries. It works.', l: 'en' },
    ] },
  { titolo: 'Perché le città stanno togliendo i parcheggi dal centro', topic: 'citta', paese: 'IT', lang: 'it',
    media: { url: 'https://www.internazionale.it/notizie/2026/07/05/citta-senza-auto', source: 'Internazionale', tipo: 'articolo' },
    commenti: [
      { n: 'Luca', t: 'A Milano l\'hanno fatto in centro e i negozi hanno protestato. Poi hanno smesso.', l: 'it' },
      { n: 'Élise', t: 'Paris a fait pareil. Au début tout le monde râle, après personne ne revient en arrière.', l: 'fr' },
      { n: 'Marta', t: 'Io ci vado in bici, ma con due bambini piccoli non è così semplice.', l: 'it' },
    ] },
  { titolo: 'The video that explains inflation better than any textbook', topic: 'economia', paese: 'GB', lang: 'en',
    media: { url: 'https://www.youtube.com/watch?v=T8-85cZRI9o', source: 'YouTube', tipo: 'video', thumb: 'https://i.ytimg.com/vi/T8-85cZRI9o/hqdefault.jpg' },
    commenti: [
      { n: 'Tom', t: 'Twelve minutes and I finally get it.', l: 'en' },
      { n: 'Wei', t: '这个视频有中文字幕吗？', l: 'zh' },
    ] },
  { titolo: 'Что изменилось в правилах въезда этим летом', topic: 'viaggi', paese: 'RU', lang: 'ru',
    media: { url: 'https://www.rbc.ru/society/2026/07/20/pravila-vezda', source: 'РБК', tipo: 'articolo' },
    commenti: [
      { n: 'Ирина', t: 'Проверила вчера — всё работает как написано.', l: 'ru' },
    ] },
  { titolo: 'كيف غيّرت الترجمة الفورية طريقة عملنا', topic: 'tecnologia', paese: 'AE', lang: 'ar',
    media: { url: 'https://www.aljazeera.net/tech/2026/8/1/live-translation', source: 'الجزيرة', tipo: 'articolo' },
    commenti: [
      { n: 'سامي', t: 'صرت أحضر اجتماعات بلغات لا أعرفها إطلاقاً.', l: 'ar' },
      { n: 'Sarah', t: 'This is exactly what we use BarTalk for at work.', l: 'en' },
    ] },
  { titolo: '中国高铁网络突破五万公里', topic: 'trasporti', paese: 'CN', lang: 'zh',
    media: { url: 'https://www.xinhuanet.com/2026-07/18/c_1130456789.htm', source: '新华网', tipo: 'articolo' },
    commenti: [
      { n: 'Wei', t: '从北京到上海四个半小时，飞机都比不了。', l: 'zh' },
      { n: 'Yuki', t: '日本の新幹線と比べてどうですか？', l: 'ja' },
    ] },
];

// ═══════════════════════ SEMINA ═══════════════════════
function codiceStanza(i) { return `MOCK${String(i + 1).padStart(2, '0')}`; }

async function semina() {
  console.log('Semina in corso…\n');

  // ── 1. le stanze nella vetrina ──
  const MONDO_KEY = 'mondo:rooms';
  const ora = Date.now();
  let stanzeFatte = 0;
  for (let i = 0; i < STANZE.length; i++) {
    const st = STANZE[i];
    const id = codiceStanza(i);
    const voce = {
      roomId: id, host: st.host, nome: st.nome, description: st.desc,
      mode: st.mode, categoria: st.mode, lang: st.lang, hostLang: st.lang,
      roomType: 'public', suApprovazione: false, hot: false,
      maxPartecipanti: 20, memberCount: st.membri,
      createdAt: ora, seminato: true,
    };
    // la stanza vera, cosi si puo anche entrare
    await redis('SET', `room:${id}`, JSON.stringify({
      id, host: st.host, hostLang: st.lang, lang: st.lang, mode: st.mode,
      description: st.desc, nome: st.nome, createdAt: ora, seminato: true,
      members: [{ name: st.host, lang: st.lang, joinedAt: ora }],
      maxPartecipanti: 20, roomType: 'public',
    }), 'EX', 3600);
    await redis('LPUSH', MONDO_KEY, JSON.stringify(voce));
    stanzeFatte++;
  }
  await redis('LTRIM', MONDO_KEY, 0, 29);
  await redis('EXPIRE', MONDO_KEY, 3600);
  console.log(`  ${stanzeFatte} stanze aperte nella vetrina (durano un'ora)`);

  // ── 2. le discussioni, con i loro commenti ──
  let disc = 0, com = 0;
  for (const d of DISCUSSIONI) {
    const quando = new Date(ora - Math.floor((disc + 1) * 3.7 * 3600000)).toISOString();
    const [riga] = await sql('mondo_discussions', {
      method: 'POST',
      body: JSON.stringify({
        author_user_id: MARCHIO, author_name: 'BarTalk',
        title: d.titolo, title_lang: d.lang, topic: d.topic,
        country: d.paese, lang: d.lang, media: d.media,
        comment_count: d.commenti.length, view_count: 40 + disc * 17,
        archived: false, hidden: false,
        created_at: quando, last_activity_at: new Date(ora - disc * 900000).toISOString(),
      }),
    });
    disc++;
    for (let k = 0; k < d.commenti.length; k++) {
      const c = d.commenti[k];
      await sql('mondo_comments', {
        method: 'POST',
        body: JSON.stringify({
          discussion_id: riga.id, author_user_id: `${MARCHIO}_${c.n}`,
          author_name: c.n, text: c.t, lang: c.l,
          like_count: (k * 3) % 7, hidden: false,
          created_at: new Date(new Date(quando).getTime() + (k + 1) * 600000).toISOString(),
        }),
      });
      com++;
    }
    process.stdout.write(`\r  ${disc} discussioni · ${com} commenti`);
  }
  console.log('\n\nFatto. Apri Mondo.');
  console.log('Per togliere tutto:  node scripts/semina-mondo.mjs --pulisci');
}

// ═══════════════════════ PULIZIA ═══════════════════════
async function pulisci() {
  console.log('Pulizia in corso…\n');

  // le discussioni seminate (i commenti se ne vanno con loro se c'e il
  // vincolo; per sicurezza si tolgono prima a mano)
  const righe = await sql(`mondo_discussions?author_user_id=eq.${MARCHIO}&select=id`);
  for (const r of righe || []) {
    await sql(`mondo_comments?discussion_id=eq.${r.id}`, { method: 'DELETE' });
  }
  await sql(`mondo_discussions?author_user_id=eq.${MARCHIO}`, { method: 'DELETE' });
  console.log(`  ${(righe || []).length} discussioni tolte (con i loro commenti)`);

  // le stanze: si tolgono solo le voci marchiate, le altre restano
  const vetrina = await redis('LRANGE', 'mondo:rooms', 0, -1);
  let tolte = 0;
  for (const grezzo of vetrina || []) {
    try {
      if (JSON.parse(grezzo)?.seminato) { await redis('LREM', 'mondo:rooms', 1, grezzo); tolte++; }
    } catch { /* una voce illeggibile non e nostra: si lascia dov'e */ }
  }
  for (let i = 0; i < STANZE.length; i++) await redis('DEL', `room:${codiceStanza(i)}`);
  console.log(`  ${tolte} stanze tolte dalla vetrina`);
  console.log('\nFatto: la piazza e tornata com\'era.');
}

const argomenti = process.argv.slice(2);
(argomenti.includes('--pulisci') ? pulisci() : semina()).catch((e) => {
  console.error('\nGuasto:', e.message);
  process.exit(1);
});
