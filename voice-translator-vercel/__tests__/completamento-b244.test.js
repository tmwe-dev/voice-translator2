// ═══════════════════════════════════════════════════════════════
// b.244 — i sospesi chiusi tutti insieme.
//
// 1. MODERAZIONE (P0): la piazza aveva account e nessun freno. Regole
//    decise: 3 segnalazioni nascondono da sole; a mano moderano solo
//    l'amministratore e chi ha aperto la discussione.
// 2. publicUserId: era sha256 di un dato INDOVINABILE (l'email). Ora HMAC.
//    Le tabelle Mondo erano a zero righe: la migrazione è costata nulla.
// 3. PODCAST: tutti i turni in una richiesta sola → timeout. Ora uno per volta.
// 4. MEMORIA: l'estrazione (una seconda chiamata al modello) stava DENTRO il
//    turno; chi parlava aspettava. Ora `after()`.
// 5. PRONUNCIA (da RadioChat): dire la frase e sapere com'è andata.
// 6. APPUNTO del Maestro + soglia di superamento con sblocco.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { puoModerareContenuto, tipoValido, SOGLIA_NASCONDI } from '../app/lib/moderazioneMondo.js';
import { valutaPronuncia, paroleDaRivedere, normalizza, staccaEsercizio } from '../app/lib/compagni/corsi/pronuncia.js';
import { staccaAppunto, lezioneSbloccata, SOGLIA_SUPERAMENTO, esitoInParole } from '../app/lib/compagni/corsi/imparare.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('moderazione — la piazza ha finalmente un freno', () => {
  it('si nasconde da sé a 3 segnalazioni', () => {
    expect(SOGLIA_NASCONDI).toBe(3);
  });

  it('a mano moderano SOLO l\'amministratore e chi ha aperto la discussione', () => {
    const admin = { emailUtente: 'capo@x.it', emailAdmin: 'capo@x.it', idUtente: 'u_a', idAutore: 'u_b' };
    const autore = { emailUtente: 'tizio@x.it', emailAdmin: 'capo@x.it', idUtente: 'u_b', idAutore: 'u_b' };
    const estraneo = { emailUtente: 'tizio@x.it', emailAdmin: 'capo@x.it', idUtente: 'u_c', idAutore: 'u_b' };
    expect(puoModerareContenuto(admin)).toBe(true);
    expect(puoModerareContenuto(autore)).toBe(true);
    expect(puoModerareContenuto(estraneo)).toBe(false);
  });

  it('e senza admin configurato un estraneo non diventa moderatore', () => {
    expect(puoModerareContenuto({ emailUtente: 'x@x.it', emailAdmin: '', idUtente: 'u_c', idAutore: 'u_b' })).toBe(false);
    expect(puoModerareContenuto({})).toBe(false);
  });

  it('i tipi moderabili sono tre: discussione, commento, corso', () => {
    expect(tipoValido('discussione') && tipoValido('commento') && tipoValido('corso')).toBe(true);
    expect(tipoValido('qualsiasi')).toBe(false);
  });

  it('nascondere NON cancella: si può riaprire', () => {
    const s = leggi('app/lib/moderazioneMondo.js');
    expect(s).toMatch(/impostaVisibilita/);
    expect(s).not.toMatch(/\.delete\(\)/);
  });

  it('e ciò che è nascosto esce dal feed, dai commenti e dallo scaffale', () => {
    expect(leggi('app/lib/mondoDB.js')).toMatch(/\.eq\('hidden', false\)/);
    expect(leggi('app/lib/compagni/corsi/pubblici.js')).toMatch(/\.eq\('hidden', false\)/);
  });

  it('una persona non può segnalare due volte la stessa cosa', () => {
    // Lo garantisce la chiave primaria (tipo, contenuto, segnalante) + upsert.
    expect(leggi('app/lib/moderazioneMondo.js')).toMatch(/onConflict: 'tipo,contenuto,segnalante'/);
  });
});

describe('identità pubblica — non più il digest di un dato indovinabile', () => {
  it('usa HMAC quando c\'è il segreto', () => {
    const s = leggi('app/lib/mondoDB.js');
    expect(s).toMatch(/createHmac\('sha256', segreto\)/);
    expect(s).toMatch(/MONDO_ID_SECRET/);
  });

  it('e senza segreto non spegne la piazza: ripiega, dichiarandolo', () => {
    const s = leggi('app/lib/mondoDB.js');
    expect(s).toMatch(/Senza MONDO_ID_SECRET si ricade sul vecchio schema/);
  });
});

describe('memoria — gli appunti si prendono a sipario chiuso', () => {
  it('l\'estrazione non è più dentro il turno', () => {
    const s = leggi('app/api/compagni/amico/route.js');
    // b.244-bis — si passa da `dopo()` e non da `after()` diretto: fuori da
    // una richiesta `after` lancerebbe, e gli appunti si perderebbero.
    expect(s).toMatch(/dopo\(async \(\) => \{/);
    expect(s).toMatch(/import \{ dopo \}/);
  });
});

describe('pronuncia — una misura indiretta ma VERA', () => {
  it('se lo dici bene, il punteggio è pieno', () => {
    expect(valutaPronuncia('How are you today?', 'how are you today').punteggio).toBe(100);
  });

  it('una parola storpiata scende, non crolla', () => {
    const p = valutaPronuncia('How are you today?', 'how are you todai').punteggio;
    expect(p).toBeGreaterThan(70);
    expect(p).toBeLessThan(100);
  });

  it('saltare metà frase pesa davvero', () => {
    expect(valutaPronuncia('How are you today?', 'how are').punteggio).toBeLessThanOrEqual(60);
  });

  it('e dire tutt\'altro vale zero', () => {
    expect(valutaPronuncia('How are you today?', 'pizza margherita').punteggio).toBe(0);
  });

  it('parlare a raffica non fa punteggio (piccola penale sull\'eccesso)', () => {
    const onesto = valutaPronuncia('good morning', 'good morning').punteggio;
    const raffica = valutaPronuncia('good morning', 'good morning and then a lot of other words').punteggio;
    expect(raffica).toBeLessThan(onesto);
  });

  it('le parole andate male tornano al Maestro per il ripasso', () => {
    const e = valutaPronuncia('the beautiful house', 'the xxxxx house');
    expect(paroleDaRivedere(e)).toContain('beautiful');
    expect(paroleDaRivedere(e)).not.toContain('house');
  });

  it('accenti e punteggiatura non contano', () => {
    expect(normalizza('Perché, davvero?!')).toBe('perche davvero');
  });

  it('il tag [PRONUNCIA:] si stacca e non si vede mai', () => {
    const r = staccaEsercizio('Prova adesso. [PRONUNCIA: Good morning]');
    expect(r.esercizio).toBe('Good morning');
    expect(r.testo).not.toMatch(/PRONUNCIA/);
    expect(staccaEsercizio('Nessun esercizio.').esercizio).toBe(null);
  });

  it('ed è cablato: pannello nella lezione, istruzione al Maestro', () => {
    expect(leggi('app/components/Life/LifeView.js')).toMatch(/PannelloPronuncia/);
    expect(leggi('app/lib/compagni/corsi/lingua.js')).toMatch(/ISTRUZIONE_PRONUNCIA/);
    // Il microfono si chiude sempre, anche uscendo a metà.
    expect(leggi('app/components/Life/PannelloPronuncia.js')).toMatch(/getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/);
  });
});

describe('l\'appunto del Maestro e lo sblocco delle lezioni', () => {
  it('l\'appunto si stacca dal testo e non compare mai', () => {
    const r = staccaAppunto('Bella lezione.<!--APPUNTO: {"osservazioni":["ama la musica"]}-->');
    expect(r.testo).toBe('Bella lezione.');
    expect(r.osservazioni).toEqual(['ama la musica']);
  });

  it('un appunto malformato non rovina la lezione', () => {
    const r = staccaAppunto('Testo buono.<!--APPUNTO: non-json-->');
    expect(r.testo).toBe('Testo buono.');
    expect(r.osservazioni).toEqual([]);
  });

  it('la prima lezione è sempre aperta, e chi non ha mai provato non viene sbarrato', () => {
    expect(lezioneSbloccata([], 0)).toBe(true);
    expect(lezioneSbloccata([], 3)).toBe(true);
    expect(lezioneSbloccata([{ lezione: 0, punteggio: null }], 1)).toBe(true);
  });

  it('ma se hai provato e non hai superato, la prossima aspetta', () => {
    expect(lezioneSbloccata([{ lezione: 0, punteggio: 30 }], 1)).toBe(false);
    expect(lezioneSbloccata([{ lezione: 0, punteggio: SOGLIA_SUPERAMENTO }], 1)).toBe(true);
  });

  it('e l\'esito si dice a parole, non solo con un numero', () => {
    expect(esitoInParole(95)).toBe('quasi perfetto');
    expect(esitoInParole(30)).toBe('da riprendere');
    expect(esitoInParole(null)).toBe('');
  });
});

describe('throttle memoria — il difetto che l\'audit aveva ragione a segnalare', () => {
  it('si conta sul totale VERO, non sui messaggi tagliati a 20', () => {
    // Il difetto: la rotta taglia a 20; superati i 20 scambi la lunghezza
    // restava sempre 20 (+1 = 21) e 21 % 3 === 0 → estrazione a OGNI turno,
    // cioè l'esatto contrario del "throttle leggero" promesso dal commento.
    const s = leggi('app/api/compagni/amico/route.js');
    expect(s).toMatch(/const totaleTurni = \(Number\(body\.totale\) > 0 \? Number\(body\.totale\) : messaggi\.length\) \+ 1;/);
    expect(s).toMatch(/totaleTurni % 3 === 0/);
    expect(s).not.toMatch(/conRisposta\.length % 3 === 0/);
  });

  it('e il client dichiara la lunghezza vera della conversazione', () => {
    expect(leggi('app/lib/compagni/cliente.js')).toMatch(/totale: Array\.isArray\(messaggi\) \? messaggi\.length : 0/);
  });

  it('il rinvio a dopo la risposta non perde il lavoro se non si può rinviare', () => {
    // `after()` esiste solo dentro una richiesta: fuori lancerebbe, e gli
    // appunti andrebbero persi in silenzio. `dopo()` in quel caso esegue.
    const s = leggi('app/lib/dopo.js');
    expect(s).toMatch(/return fn\(\);/);
    expect(s).toMatch(/Meglio farlo in ritardo che non farlo/);
  });
});
