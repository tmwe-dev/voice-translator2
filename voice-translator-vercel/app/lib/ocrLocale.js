'use client';
// ═══════════════════════════════════════════════════════════════
// OCR LOCALE (b.335) — il gradino ZERO-COSTO della cascata dei Materiali.
//
// Tesseract.js gira NEL dispositivo: la foto degli appunti non esce, non
// si paga niente, nessun limite. Perfetto per testo stampato (libri,
// dispense, fotocopie); sul manoscritto rende poco — e li si offre il
// gradino AI (wallet dell'utente), mai in automatico.
//
// Il motore si carica da unpkg (gia in CSP) SOLO alla prima scansione:
// niente peso sull'avvio dell'app. I modelli lingua (~10MB) arrivano da
// tessdata.projectnaptha.com (in CSP) e restano in cache del browser.
// ═══════════════════════════════════════════════════════════════

const SCRIPT_URL = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';

// codici tesseract per le lingue dell'app (stampato)
const LINGUE_TESS = {
  it: 'ita', en: 'eng', es: 'spa', fr: 'fra', de: 'deu', pt: 'por',
  nl: 'nld', pl: 'pol', sv: 'swe', tr: 'tur', ru: 'rus', el: 'ell',
  cs: 'ces', ro: 'ron', fi: 'fin', hu: 'hun', da: 'dan', nb: 'nor',
  uk: 'ukr', ja: 'jpn', zh: 'chi_sim', ko: 'kor', ar: 'ara', hi: 'hin',
  th: 'tha', vi: 'vie', id: 'ind', he: 'heb', bg: 'bul', hr: 'hrv', sk: 'slk',
};

let promScript = null;
function caricaScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('solo browser'));
  if (window.Tesseract) return Promise.resolve();
  if (promScript) return promScript;
  promScript = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => { promScript = null; rej(new Error('tesseract non caricato')); };
    document.head.appendChild(s);
  });
  return promScript;
}

/**
 * Legge il testo da un'immagine, in locale, gratis.
 * @param {string} dataUrl  immagine (jpeg/png data URL)
 * @param {string} lingua   codice lingua dell'app ('it', 'en', ...)
 * @param {(p:number)=>void} onProgresso  0..1
 * @returns {{testo:string, fiducia:number}}  fiducia 0-100
 */
export async function leggiImmagineLocale(dataUrl, lingua = 'it', onProgresso = null) {
  await caricaScript();
  const lang2 = String(lingua || 'it').replace(/-.*/, '');
  const tessLang = LINGUE_TESS[lang2] || 'eng';
  const worker = await window.Tesseract.createWorker(tessLang, 1, {
    logger: onProgresso ? (m) => { if (m.status === 'recognizing text') onProgresso(m.progress || 0); } : undefined,
  });
  try {
    const { data } = await worker.recognize(dataUrl);
    const testo = (data?.text || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return { testo, fiducia: Math.round(data?.confidence || 0) };
  } finally {
    await worker.terminate().catch(() => { /* il motore era gia chiuso */ });
  }
}
