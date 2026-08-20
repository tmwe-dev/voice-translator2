'use client';
// ═══════════════════════════════════════════════════════════════
// b.343 — MOTORE DI SCANSIONE (porting fedele dal BizCard Scanner).
//
// Ordine di Luca: COPIARE le funzioni del Business Card scanner —
// collaudate su centinaia di biglietti — e adattarle agli appunti.
// Qui vivono i quattro motori portati pari pari:
//   preElabora        ← preprocessImage   (auto-contrasto + nitidezza)
//   punteggioQualita  ← scoreFrameQuality (nitidezza/contrasto/luce, laplaciano)
//   fondiRisultati    ← mergeOcrResults   (fusione per VOTO riga-per-riga)
//   similiPerFusione  ← criterio multi-scatto (stessa pagina → si fondono)
// piu il classificatore dei CAMPI adattato agli appunti (titolo, materia,
// date, formule, elenchi) per la scheda che si riempie in tempo reale.
// ═══════════════════════════════════════════════════════════════

// ── PRE-ELABORAZIONE (porting da scanner.js del BizCard) ──
// Auto-contrasto con stiramento dell'istogramma + leggera nitidezza:
// e il passo che nel BizCard rendeva leggibili le foto storte o piatte.
export function preElabora(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let min = 255, max = 0;
  for (let i = 0; i < data.length; i += 16) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  const range = (max - min) || 1;
  if (range < 200) {
    const factor = 255 / range;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, (data[i] - min) * factor));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - min) * factor));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - min) * factor));
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── PUNTEGGIO QUALITA (porting da smart-scan.js del BizCard) ──
// Piu alto = piu nitido, piu contrastato, luce migliore. Serve alla
// multiscansione per scegliere gli scatti buoni e scartare i mossi.
export function punteggioQualita(imageData, width, height) {
  const data = imageData.data;
  let sumGray = 0, sumGraySq = 0, edgeSum = 0, sampleCount = 0;

  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const idx = (y * width + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sumGray += gray;
      sumGraySq += gray * gray;

      const idxUp = ((y - 1) * width + x) * 4;
      const idxDown = ((y + 1) * width + x) * 4;
      const idxLeft = (y * width + (x - 1)) * 4;
      const idxRight = (y * width + (x + 1)) * 4;
      const grayUp = 0.299 * data[idxUp] + 0.587 * data[idxUp + 1] + 0.114 * data[idxUp + 2];
      const grayDown = 0.299 * data[idxDown] + 0.587 * data[idxDown + 1] + 0.114 * data[idxDown + 2];
      const grayLeft = 0.299 * data[idxLeft] + 0.587 * data[idxLeft + 1] + 0.114 * data[idxLeft + 2];
      const grayRight = 0.299 * data[idxRight] + 0.587 * data[idxRight + 1] + 0.114 * data[idxRight + 2];

      edgeSum += Math.abs(grayUp + grayDown + grayLeft + grayRight - 4 * gray);
      sampleCount++;
    }
  }
  if (sampleCount === 0) return 0;

  const meanGray = sumGray / sampleCount;
  const variance = (sumGraySq / sampleCount) - (meanGray * meanGray);
  const sharpness = edgeSum / sampleCount;
  const brightnessScore = (1 - Math.abs(meanGray - 128) / 128) * 30;
  const contrastScore = Math.min(variance / 2, 35);
  const sharpnessScore = Math.min(sharpness / 2, 35);
  return brightnessScore + contrastScore + sharpnessScore;
}

// ── FUSIONE PER VOTO (porting da smart-scan.js del BizCard) ──
// Piu letture della STESSA pagina: le righe viste da piu scatti vincono,
// i quasi-duplicati (righe contenute in altre) si eliminano.
export function fondiRisultati(testi) {
  const validi = (testi || []).filter(Boolean);
  if (validi.length === 0) return '';
  if (validi.length === 1) return validi[0];

  const lineVotes = new Map();
  validi.forEach((testo, srcIdx) => {
    const lines = testo.split('\n').map((l) => l.trim()).filter((l) => l.length > 1);
    lines.forEach((line) => {
      const norm = line.toLowerCase().replace(/\s+/g, ' ');
      if (lineVotes.has(norm)) {
        const entry = lineVotes.get(norm);
        entry.count++;
        entry.sources.add(srcIdx);
        if (line.length > entry.original.length) entry.original = line;
      } else {
        lineVotes.set(norm, { original: line, count: 1, sources: new Set([srcIdx]) });
      }
    });
  });

  const sorted = [...lineVotes.values()].sort((a, b) => b.count - a.count);
  const finalLines = [];
  for (const entry of sorted) {
    const norm = entry.original.toLowerCase().replace(/\s+/g, ' ');
    let isDuplicate = false;
    for (const existing of finalLines) {
      const existNorm = existing.toLowerCase().replace(/\s+/g, ' ');
      if (existNorm.includes(norm) || norm.includes(existNorm)) { isDuplicate = true; break; }
    }
    if (!isDuplicate) finalLines.push(entry.original);
  }
  return finalLines.join('\n');
}

// ── STESSA PAGINA O PAGINA NUOVA? ──
// Due scatti con molte righe in comune sono la STESSA pagina rifotografata:
// si fondono per voto. Righe quasi tutte diverse = pagina nuova: si accoda.
export function similiPerFusione(testoA, testoB) {
  const righe = (t) => new Set(String(t || '').split('\n').map((l) => l.trim().toLowerCase().replace(/\s+/g, ' ')).filter((l) => l.length > 3));
  const a = righe(testoA), b = righe(testoB);
  if (a.size === 0 || b.size === 0) return false;
  let comuni = 0;
  for (const r of a) if (b.has(r)) comuni++;
  return comuni / Math.min(a.size, b.size) >= 0.4;
}

// ── CAMPI DEGLI APPUNTI (l'adattamento: qui non ci sono nome/telefono,
// ci sono titolo, materia, date, formule, elenchi). Alimenta la scheda
// che si riempie IN TEMPO REALE durante la scansione. ──
const MATERIE = [
  ['storia', /guerr|impero|secolo|rivoluzion|regno|antic|mediev|risorgiment|dinasti/i],
  ['matematica', /equazion|funzion|derivat|integral|teorema|frazion|geometri|algebr|coseno|logaritm/i],
  ['scienze', /cellul|molecol|atom|energia|fotosintes|dna|reazion|ecosistem|gravit/i],
  ['letteratura', /poesia|romanz|verso|strofa|autore|novell|sonetto|canto|poeta/i],
  ['geografia', /continent|fiume|capitale|clima|popolazion|territor|montagn/i],
  ['lingue', /verbo|grammatic|vocabol|traduzion|pronuncia|plural|coniugazion/i],
  ['diritto', /articolo|codice|legge|costituzion|contratt|reato|tribunal/i],
  ['economia', /mercato|domanda|offerta|inflazion|pil|impresa|bilanci/i],
];

export function classificaAppunti(testo) {
  const righe = String(testo || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const parole = righe.join(' ').split(/\s+/).filter(Boolean);

  // titolo: la prima riga corta e "da intestazione" (niente punto finale)
  const titolo = righe.find((l) => l.length >= 3 && l.length <= 60 && !/[.]$/.test(l)) || righe[0] || '';

  let materia = '';
  const tutto = righe.join('\n');
  for (const [nome, re] of MATERIE) { if (re.test(tutto)) { materia = nome; break; } }

  const date = [...new Set((tutto.match(/\b(\d{3,4}\s?(a\.?C\.?|d\.?C\.?)?|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g) || []).slice(0, 6))];
  const formule = (tutto.match(/[=+\-]{1}[^=\n]{0,20}=|\b\w\s?=\s?[\w\d]/g) || []).length;
  const elenchi = righe.filter((l) => /^[-•*\d][.)]?\s/.test(l)).length;

  return { titolo, materia, date, formule, elenchi, righe: righe.length, parole: parole.length };
}
