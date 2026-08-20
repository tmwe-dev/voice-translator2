// ═══════════════════════════════════════════════════════════════
// FONIA — analisi locale del parlato per il confronto grafico (b.322)
//
// Chiesto da Luca: l'utente deve VEDERE davanti a se l'analisi della
// registrazione — la fascia della pronuncia ATTESA (dal riferimento
// vocale) e sopra la SUA onda, colorata a tratti: verde dentro la
// fascia, arancione vicino, rosso fuori. Dalla seconda registrazione
// si capisce DOVE si sbaglia dai colori.
//
// Cosa si misura qui (tutto locale, gratis, WebAudio):
//  - MELODIA: il contorno del tono (F0 per autocorrelazione), in
//    semitoni relativi alla mediana di CHI parla — cosi una voce
//    maschile e una femminile si confrontano ad armi pari.
//  - ENERGIA/RITMO: l'inviluppo RMS nel tempo.
// L'identita del fonema resta allo strato ASR (parole colorate) e al
// futuro precision layer: qui si giudica la PROSODIA — che per le
// lingue tonali (zh/vi/th) e proprio la sostanza.
//
// Funzioni PURE su Float32Array: testabili senza browser.
// ═══════════════════════════════════════════════════════════════

const N_PUNTI = 96;          // risoluzione del confronto (punti sul tempo)
const F0_MIN = 60;           // Hz — voce umana, limite basso
const F0_MAX = 400;          // Hz — limite alto (parlato, non canto)

/** Inviluppo RMS normalizzato 0..1, ricampionato su n punti. */
export function inviluppo(campioni, n = N_PUNTI) {
  const len = campioni?.length || 0;
  if (!len) return new Array(n).fill(0);
  const out = new Array(n).fill(0);
  const passo = len / n;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const da = Math.floor(i * passo), a = Math.min(len, Math.floor((i + 1) * passo));
    let somma = 0;
    for (let j = da; j < a; j++) somma += campioni[j] * campioni[j];
    const rms = Math.sqrt(somma / Math.max(1, a - da));
    out[i] = rms; if (rms > max) max = rms;
  }
  if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
  return out;
}

/** F0 di un frame via autocorrelazione. 0 = non voiced. */
function f0Frame(campioni, da, len, sr) {
  let energia = 0;
  for (let i = da; i < da + len; i++) energia += campioni[i] * campioni[i];
  if (energia / len < 1e-5) return 0; // silenzio: niente tono
  const lagMin = Math.floor(sr / F0_MAX), lagMax = Math.min(len - 1, Math.ceil(sr / F0_MIN));
  let migliore = 0, bestLag = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = da; i < da + len - lag; i++) s += campioni[i] * campioni[i + lag];
    if (s > migliore) { migliore = s; bestLag = lag; }
  }
  if (!bestLag || migliore / energia < 0.3) return 0; // poco periodico: unvoiced
  return sr / bestLag;
}

/**
 * Contorno del tono in SEMITONI relativi alla mediana del parlante
 * (indipendente dall'altezza della voce), ricampionato su n punti.
 * I tratti non-voiced valgono null.
 */
export function tracciaTono(campioni, sr, n = N_PUNTI) {
  const len = campioni?.length || 0;
  if (!len || !sr) return new Array(n).fill(null);
  const frame = Math.floor(sr * 0.04); // 40ms
  const f0s = new Array(n).fill(0);
  const passo = Math.max(1, (len - frame) / n);
  for (let i = 0; i < n; i++) {
    const da = Math.floor(i * passo);
    if (da + frame >= len) break;
    f0s[i] = f0Frame(campioni, da, frame, sr);
  }
  const voiced = f0s.filter((f) => f > 0).sort((a, b) => a - b);
  if (!voiced.length) return new Array(n).fill(null);
  const mediana = voiced[Math.floor(voiced.length / 2)];
  return f0s.map((f) => f > 0 ? 12 * Math.log2(f / mediana) : null);
}

/** Analisi completa di un buffer audio (mono). */
export function analizza(campioni, sr) {
  return {
    energia: inviluppo(campioni, N_PUNTI),
    tono: tracciaTono(campioni, sr, N_PUNTI),
    durata: sr ? (campioni?.length || 0) / sr : 0,
  };
}

// ── Soglie delle fasce (in semitoni per il tono, frazione per l'energia) ──
const TONO_VERDE = 2.0, TONO_ARANCIO = 4.0;      // scarto melodico tollerato
const ENERGIA_VERDE = 0.28, ENERGIA_ARANCIO = 0.5;

/**
 * CONFRONTO attesa↔rilevata: per ogni punto del tempo (normalizzato) dice
 * quanto la tua onda sta dentro la fascia del riferimento.
 * Ritorna { punti: [{tRif, tUte, colore, scarto}], somiglianza: 0-100,
 *           rapportoDurata } — 'verde' | 'arancio' | 'rosso'.
 * La durata diversa non falsa il confronto: le due tracce sono gia
 * normalizzate sullo stesso numero di punti (stiramento lineare).
 */
export function confronta(rif, ute) {
  const n = Math.min(rif?.tono?.length || 0, ute?.tono?.length || 0);
  if (!n) return { punti: [], somiglianza: 0, rapportoDurata: 1 };
  const punti = [];
  let somma = 0, contati = 0;
  for (let i = 0; i < n; i++) {
    const tr = rif.tono[i], tu = ute.tono[i];
    const er = rif.energia[i] ?? 0, eu = ute.energia[i] ?? 0;
    const dEnergia = Math.abs(er - eu);
    let dTono = null;
    if (tr !== null && tu !== null) dTono = Math.abs(tr - tu);
    // Il giudizio del punto: pesa il tono quando c'e voce da entrambe le
    // parti, altrimenti solo l'energia (pause e attacchi).
    let colore = 'verde', scarto = 0;
    if (dTono !== null) {
      scarto = dTono / TONO_ARANCIO + dEnergia / ENERGIA_ARANCIO;
      colore = (dTono <= TONO_VERDE && dEnergia <= ENERGIA_VERDE) ? 'verde'
        : (dTono <= TONO_ARANCIO && dEnergia <= ENERGIA_ARANCIO) ? 'arancio' : 'rosso';
    } else if ((tr === null) !== (tu === null)) {
      // uno parla dove l'altro tace: ritmo fuori
      colore = dEnergia > ENERGIA_VERDE ? 'rosso' : 'arancio';
      scarto = 1;
    } else {
      colore = dEnergia <= ENERGIA_VERDE ? 'verde' : dEnergia <= ENERGIA_ARANCIO ? 'arancio' : 'rosso';
      scarto = dEnergia / ENERGIA_ARANCIO;
    }
    punti.push({ tonoRif: tr, tonoUte: tu, energiaRif: er, energiaUte: eu, colore });
    somma += Math.min(2, scarto); contati++;
  }
  const rapportoDurata = rif.durata > 0 ? (ute.durata / rif.durata) : 1;
  // Penale se la durata e molto diversa (parlato troppo veloce/lento).
  const penaleDurata = Math.min(20, Math.abs(Math.log2(rapportoDurata || 1)) * 25);
  const somiglianza = Math.max(0, Math.round(100 - (contati ? (somma / contati) * 60 : 100) - penaleDurata));
  return { punti, somiglianza, rapportoDurata };
}

/** Il quality gate (audit + piano di Luca): un campione inaffidabile NON si
 *  giudica. Ritorna { ok, motivo } — motivo leggibile per l'utente. */
export function qualityGate(campioni, sr) {
  const durata = sr ? (campioni?.length || 0) / sr : 0;
  if (durata < 0.35) return { ok: false, motivo: 'Registrazione troppo corta.' };
  const env = inviluppo(campioni, 40);
  const attivi = env.filter((v) => v > 0.12).length;
  if (attivi < 4) return { ok: false, motivo: 'Non sento la voce: parla più vicino al microfono.' };
  let clip = 0;
  for (let i = 0; i < campioni.length; i += 97) if (Math.abs(campioni[i]) > 0.985) clip++;
  if (clip > campioni.length / 97 * 0.08) return { ok: false, motivo: 'Audio distorto: allontanati un po’ dal microfono.' };
  return { ok: true };
}
