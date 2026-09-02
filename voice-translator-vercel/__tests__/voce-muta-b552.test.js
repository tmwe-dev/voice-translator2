// ═══════════════════════════════════════════════════════════════
// b.552 — «SINTESI RIUSCITA MA AUDIO VUOTO»: era il nostro errore
//
// Nei registri di produzione (Vercel, 24h del 28/08) questo era l'errore
// piu frequente dell'applicazione: 65 volte in una settimana, sei
// persone diverse. Sembrava un guasto di Edge TTS. Non lo era.
//
// `preprocessForTTS` toglie markdown ed emoji — giusto: una faccina non
// si legge ad alta voce. Ma un messaggio fatto di SOLE emoji («👍😂»),
// che in chat e' normalissimo, dopo la pulizia e' la stringa vuota. Si
// chiedeva a Edge TTS di pronunciare il nulla, lui restituiva il nulla,
// e noi lo scrivevamo nei registri come errore — sessantacinque volte.
//
// La regola nuova: NIENTE DA DIRE NON E' UN GUASTO. Si risponde 204, e
// chi ha chiamato tace invece di ripiegare su un'altra voce (o peggio,
// di pagare OpenAI per far dire il vuoto).
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { preprocessForTTS } from '../app/lib/ttsPreprocessor.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

describe('il caso vero: un messaggio di sole emoji', () => {
  it('dopo la pulizia non resta niente da pronunciare', () => {
    // Questo e' il difetto, riprodotto: la prova che la causa era qui.
    expect(preprocessForTTS('👍😂', 'it').trim()).toBe('');
    expect(preprocessForTTS('...', 'it').replace(/[.\s]/g, '')).toBe('');
  });

  it('una frase vera invece resta, e va pronunciata', () => {
    expect(preprocessForTTS('Ciao, come stai?', 'it')).toMatch(/Ciao/);
  });
});

describe('la rotta distingue «niente da dire» da «non ci sono riuscito»', () => {
  const r = leggi('api/tts-edge/route.js');

  it('senza lettere ne numeri risponde 204, e non scrive un errore', () => {
    expect(r).toMatch(/qualcosaDaDire = \/\[\\p\{L\}\\p\{N\}\]\/u\.test\(trimmed\)/);
    expect(r).toMatch(/if \(!qualcosaDaDire\)[\s\S]{0,300}status: 204/);
    const blocco = r.slice(r.indexOf('const qualcosaDaDire'), r.indexOf('const { getEdgeRateForLang }'));
    expect(blocco, 'niente da dire si annota, non si denuncia').not.toMatch(/log\.error/);
  });

  it('col testo vero, un buffer muto fa riprovare UNA volta', () => {
    expect(r).toMatch(/const sintetizza = async \(\) =>/);
    expect(r).toMatch(/primo tentativo muto, riprovo/);
  });

  it('e se anche il secondo tentativo e muto, il registro dice voce e lingua', () => {
    // Senza questi due dati, dal registro vecchio non si poteva capire se
    // il guasto fosse di una lingua sola o di tutte: e' cosi che questo
    // errore e' rimasto sette giorni in cima alla classifica.
    expect(r).toMatch(/audio vuoto', \{ voce: voiceName, lingua: lang2/);
  });
});

describe('chi chiama non ripiega, e soprattutto non paga, per il nulla', () => {
  it('il motore vocale della chat tace e basta', () => {
    const h = leggi('hooks/useTTSEngine.js');
    expect(h).toMatch(/if \(res\.status === 204\) return null;/);
    expect(h, 'e non passa alla voce del browser').toMatch(/blob === null\) return;/);
  });

  it('l interprete non cambia motore: non c e niente da tradurre in voce', () => {
    // b.599 — il 204 lo capisce il modulo unico, per tutte e due le pipeline.
    expect(leggi('lib/audio/voceTradotta.js')).toMatch(/r\.status === 204\) \{ esito\.motivo = 'niente-da-dire'; return esito; \}/);
    expect(leggi('hooks/useInterpreterMode.js')).toMatch(/if \(motivo === 'niente-da-dire'\) return;/);
  });

  it('le due schermate che pagherebbero OpenAI si fermano prima', () => {
    // Qui il danno non era solo il registro sporco: dopo il 204 il codice
    // proseguiva su /api/tts, che e' a pagamento, per far dire il vuoto.
    // b.603 — il ciclo e' unico (procuraVoce): il 204 ferma la catena li',
    // per tutte e due, e /api/tts viene DOPO edge nell'ordine dichiarato.
    expect(leggi('lib/audio/voceTradotta.js')).toMatch(/if \(r\.status === 204\) return null;/);
    for (const f of ['components/SpeakerView.js', 'components/TaxiTalk.js']) {
      const s = leggi(f);
      expect(s).toMatch(/procuraVoce\(\[\s*\{ rotta: '\/api\/tts-edge'[\s\S]{0,200}\{ rotta: '\/api\/tts'/);
    }
  });
});
