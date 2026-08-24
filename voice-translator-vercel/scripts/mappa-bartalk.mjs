// ═══════════════════════════════════════════════════════════════
// LA MAPPA DI BARTALK — la si disegna cambiando una tavolozza.
//
// b.453, Luca: «non possiamo disegnarne una noi modificando alcune
// tonalita di colore?». Si: uno stile MapLibre e un file di COLORI.
// Questo script prende Liberty (dati OpenStreetMap, piastrelle
// OpenFreeMap, nessuna chiave) e ne riscrive SOLO le tinte.
//
// b.453b, Luca: «usa contrasti orange/blu/oro, e magari azzurro celeste
// se ti serve un altro colore». Fatto: le strade tengono una gerarchia
// CALDA (oro l'autostrada, arancio la principale, bruno le minori),
// l'acqua e FREDDA (blu profondo, celeste per i nomi). Caldo su freddo:
// e il contrasto che fa leggere una mappa in un colpo d'occhio.
//
// Da TomTom non e stato copiato NIENTE — quello e materiale con licenza.
// Da loro viene solo l'idea che le strade debbano restare distinguibili
// per TINTA anche di notte, invece di diventare tutte grigie. Un'idea
// non si possiede.
//
//   node scripts/mappa-bartalk.mjs
// ═══════════════════════════════════════════════════════════════
import fs from 'fs';

const FONTE = 'https://tiles.openfreemap.org/styles/liberty';
const USCITA = 'public/mappe';

// ── LE TAVOLOZZE. Cambiare qui cambia tutta la mappa. ──
const TAVOLOZZE = {
  'bartalk-notte': {
    fondo: '#05070f',       // il blu-nero dell'applicazione, non nero morto
    acqua: '#0f2f6b', fiume: '#1e5ac0', acquaTesto: '#38e1ff',
    autostrada: '#ffc44d',  // ORO: la strada piu importante
    principale: '#ff8a3d',  // ARANCIO: la seconda
    secondaria: '#a06636',  // arancio spento
    locale: '#4a4234',      // bruno quasi spento: c'e, ma non grida
    bordoStrada: '#05070f',
    ferrovia: '#2d4a7d', edificio: '#0e1626',
    verde: '#0c261a', parco: '#0f2f22', sabbia: '#241f14',
    testo: '#eef2ff', alone: '#05070f',
    confine: '#2a3550', aeroporto: '#121a2c',
  },
  'bartalk-giorno': {
    fondo: '#f6f4ee',
    acqua: '#9fc6f5', fiume: '#5b8cff', acquaTesto: '#2b6bb8',
    autostrada: '#ffb020',
    principale: '#ff8a3d',
    secondaria: '#ffe0b8',
    locale: '#ffffff',
    bordoStrada: '#ded6c4',
    ferrovia: '#b3bccb', edificio: '#e9e4d6',
    verde: '#d3e8c0', parco: '#c6e0ae', sabbia: '#f0e8cf',
    testo: '#232833', alone: '#ffffff',
    confine: '#c2bfb2', aeroporto: '#e3e7ec',
  },
};

function famiglia(L) {
  const i = (L.id || '').toLowerCase();
  const sl = (L['source-layer'] || '').toLowerCase();
  if (L.type === 'background') return 'fondo';
  if (sl === 'water') return 'acqua';
  if (sl === 'waterway') return 'fiume';
  if (sl === 'water_name') return 'acquaTesto';
  if (sl === 'building') return 'edificio';
  if (sl === 'park') return 'parco';
  if (sl === 'landcover') return /wood|grass|forest|park/.test(i) ? 'verde' : 'sabbia';
  if (sl === 'landuse') return i.includes('aero') ? 'aeroporto' : 'verde';
  if (sl === 'aeroway') return 'aeroporto';
  if (sl === 'boundary') return 'confine';
  if (['place', 'transportation_name', 'aerodrome_label', 'poi'].includes(sl)) return 'testo';
  if (sl === 'transportation') {
    if (/rail|transit/.test(i)) return 'ferrovia';
    if (/motorway|trunk/.test(i)) return 'autostrada';
    if (i.includes('primary')) return 'principale';
    if (/secondary|tertiary/.test(i)) return 'secondaria';
    return 'locale';
  }
  return null;
}

function ricolora(L, tv) {
  const f = famiglia(L);
  if (!f) return;
  const col = tv[f];
  const i = (L.id || '').toLowerCase();
  L.paint = L.paint || {};
  if (L.type === 'background') L.paint['background-color'] = col;
  else if (L.type === 'fill') {
    L.paint['fill-color'] = col;
    delete L.paint['fill-pattern'];
    if ('fill-outline-color' in L.paint) L.paint['fill-outline-color'] = tv.bordoStrada;
  } else if (L.type === 'line') {
    // i «casing» sono i bordi della strada, non la strada
    L.paint['line-color'] = i.includes('casing') ? tv.bordoStrada : col;
  } else if (L.type === 'symbol') {
    L.paint['text-color'] = (f === 'acquaTesto') ? col : tv.testo;
    L.paint['text-halo-color'] = tv.alone;
    L.paint['text-halo-width'] = 1.4;
    delete L.paint['icon-color'];
  }
}

const base = await (await fetch(FONTE, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json();
fs.mkdirSync(USCITA, { recursive: true });

for (const [nome, tv] of Object.entries(TAVOLOZZE)) {
  const d = JSON.parse(JSON.stringify(base));
  d.name = `BarTalk ${nome.split('-')[1]}`;
  // via il rilievo raster: sporca il fondo pieno
  d.layers = d.layers.filter((L) => L.type !== 'raster');
  delete d.sources.ne2_shaded;
  d.layers.forEach((L) => ricolora(L, tv));
  const p = `${USCITA}/${nome}.json`;
  fs.writeFileSync(p, JSON.stringify(d));
  console.log(`${nome}: ${d.layers.length} livelli, ${Math.round(fs.statSync(p).size / 1024)} kB`);
}
