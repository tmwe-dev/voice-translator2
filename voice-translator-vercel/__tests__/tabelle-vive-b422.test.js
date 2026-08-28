// ═══════════════════════════════════════════════════════════════
// b.422 — SI PARLA SOLO CON LE TABELLE CHE ESISTONO
//
// Interrogando il database VIVO di produzione sono venute fuori nove
// tabelle che il codice nominava e che nello schema `public` non ci sono
// mai state:
//
//     profiles · user_settings · payments · usage_daily · glossaries
//     api_keys_vault · audit_logs · rooms · tavole
//
// Il guasto non e che quelle funzioni fossero rotte. E che NON SI
// VEDEVA che fossero rotte. Supabase, interrogato su una tabella che
// non esiste, non fa esplodere niente: restituisce un errore che quasi
// tutto questo codice leggeva come «nessuna riga». Quindi il cruscotto
// amministrativo si apriva pieno di zeri, l'esportazione GDPR
// consegnava un capitolo vuoto, la cassaforte delle chiavi rispondeva
// «nessuna chiave salvata», le statistiche rispondevano 404. Tutte
// risposte plausibili. Nessuna vera.
//
// E c'e il caso peggiore, che e quello che ha insegnato la lezione:
// `translations` ESISTE, ma era a zero righe. Non perche l'insert
// fallisse — perche prima dell'insert si cercava l'UUID della persona
// in `profiles`, quella ricerca falliva, e l'insert non veniva nemmeno
// tentato. Una tabella morta ne aveva portata giu una viva.
//
// Da qui in avanti la regola e scritta: se una riga di app/ interroga
// una tabella che non e in questo elenco, questa prova diventa rossa
// prima del deploy, invece di scoprirlo fra sei mesi guardando un
// pannello pieno di zeri.
//
// ── L'INSIDIA DA NON RIPETERE ──
// `tavole` NON e una tabella: e un CASSETTO dell'archivio (bucket), e
// si vede dalla forma della chiamata — `sb.storage.from('tavole')`, non
// `sb.from('tavole')`. Lo usa /api/compagni/avatar per non ridisegnare
// (e non ripagare) due volte la stessa tavola di lezione: e codice
// recente e VIVO. Chi cercasse i nove nomi con una ricerca di testo lo
// troverebbe fra i morti e romperebbe una funzione che lavora. Il
// controllo qui sotto distingue le due forme, e c'e un caso apposta che
// lo dimostra.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');

// Le tabelle e le viste che nello schema `public` ci sono davvero, fra
// quelle che il programma nomina. L'elenco nasce per sottrazione: tutto
// cio che il codice interroga, meno le nove trovate mancanti sul
// database vivo. Chi ne aggiunge una deve prima averla creata.
const TABELLE_VIVE = new Set([
  // wallet e contabilita
  'credit_ledger', 'vouchers', 'ai_config',
  'wallet_economics', 'wallet_totali', 'wallet_per_utente',
  'provider_snapshots',
  // traduzione
  'translations', 'voci_lingue',
  // Life: compagni, ricordi, compiti, corsi
  'compagni', 'compagno_memorie',
  'compiti_jobs', 'compiti_materiali', 'compiti_scansioni',
  'corsi_utente', 'corsi_pubblici',
  'imparare_progresso', 'imparare_studente',
  'profilo_studente', 'pronuncia_profilo',
  // Mondo
  'mondo_discussions', 'mondo_comments', 'mondo_comment_likes',
  'mondo_follows', 'mondo_segnalazioni',
  // b.554 — il registro delle fonti. VISTE SUL DATABASE prima di
  // scriverle qui, come vuole questa prova: create con la migrazione
  // `b553_registro_fonti` sul progetto voicetranslate, e oggi contengono
  // 71 fonti e 86 ambiti. Erano finite in produzione senza passare da
  // qui — ed e' proprio il buco che questa prova esiste per chiudere.
  'mondo_fonti', 'mondo_fonti_ambito',
  // PeepOff
  'peepoff_dispositivi', 'peepoff_segnali',
]);

const TABELLE_MORTE = [
  'profiles', 'user_settings', 'payments', 'usage_daily', 'glossaries',
  'api_keys_vault', 'audit_logs', 'rooms', 'tavole',
];

// Un difetto CITATO in un commento non e quel difetto: e la stessa
// regola gia adottata da scripts/inventario-api.mjs e da
// inventario-onesto.test.js, e serve proprio qui, perche le rimozioni
// di b.422 hanno lasciato commenti che nominano le tabelle tolte.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

// `sb.from('x')` e una tabella. `sb.storage.from('x')` e un cassetto
// dell'archivio, e non c'entra niente con lo schema `public`. Anche
// `Buffer.from`/`Array.from` si chiamano `from` e non sono nessuna
// delle due cose.
const NON_E_UNA_TABELLA = /(storage|Buffer|Array|Uint8Array|Int8Array|Float32Array|Object)\s*\.\s*$/;

/** Le tabelle interrogate da un sorgente, con la riga in cui compaiono. */
export function tabelleInterrogate(sorgente) {
  const pulito = senzaCommenti(sorgente);
  const trovate = [];
  const re = /\bfrom\(\s*'([a-z_][a-z0-9_]*)'\s*\)/g;
  let m;
  while ((m = re.exec(pulito)) !== null) {
    const prima = pulito.slice(Math.max(0, m.index - 24), m.index);
    if (NON_E_UNA_TABELLA.test(prima)) continue;
    trovate.push({
      tabella: m[1],
      riga: pulito.slice(0, m.index).split('\n').length,
    });
  }
  return trovate;
}

function tuttiISorgenti(dir, trovati = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === 'node_modules') continue;
      tuttiISorgenti(p, trovati);
    } else if (voce.name.endsWith('.js') || voce.name.endsWith('.jsx')) {
      trovati.push(p);
    }
  }
  return trovati;
}

function scansione() {
  const fuoriElenco = [];
  for (const f of tuttiISorgenti(APP)) {
    const src = fs.readFileSync(f, 'utf8');
    for (const { tabella, riga } of tabelleInterrogate(src)) {
      if (!TABELLE_VIVE.has(tabella)) {
        fuoriElenco.push(`${path.relative(APP, f)}:${riga} → from('${tabella}')`);
      }
    }
  }
  return fuoriElenco;
}

describe('b.422 — il codice interroga solo tabelle che esistono', () => {
  it('nessuna riga di app/ parla con una tabella fuori elenco', () => {
    const fuori = scansione();
    expect(fuori, [
      'Queste righe interrogano una tabella che non e nell\'elenco delle vive.',
      'O la tabella esiste davvero (allora aggiungila a TABELLE_VIVE, dopo',
      'averla vista sul database), o quella strada e morta e va tolta:',
      ...fuori,
    ].join('\n  ')).toEqual([]);
  });

  it('nessuna delle nove tabelle mancanti viene piu interrogata', () => {
    // Detto per nome, cosi il giorno che una rientra si legge QUALE.
    const risorte = [];
    for (const f of tuttiISorgenti(APP)) {
      const src = fs.readFileSync(f, 'utf8');
      for (const { tabella, riga } of tabelleInterrogate(src)) {
        if (TABELLE_MORTE.includes(tabella)) {
          risorte.push(`${path.relative(APP, f)}:${riga} → ${tabella}`);
        }
      }
    }
    expect(risorte, `tabelle inesistenti di nuovo interrogate:\n  ${risorte.join('\n  ')}`).toEqual([]);
  });
});

describe('b.422 — il controllo sa distinguere, e sa mordere', () => {
  // Un controllo che non puo diventare rosso non e un controllo: e la
  // lezione dell'inventario che gridava al lupo (b.121), al contrario.
  it('una tabella inventata viene vista', () => {
    const finto = "const { data } = await sb.from('tabella_che_non_esiste').select('*');";
    expect(tabelleInterrogate(finto).map(t => t.tabella)).toEqual(['tabella_che_non_esiste']);
  });

  it('un CASSETTO dell\'archivio non e una tabella', () => {
    // E' il caso vero di /api/compagni/avatar: `tavole` e un bucket.
    const finto = "await sb.storage.from('tavole').list('scena', { limit: 1 });";
    expect(tabelleInterrogate(finto)).toEqual([]);
  });

  it('e infatti la rotta dell\'avatar non risulta fra le colpevoli', () => {
    // Prova diretta sul file vero: se un domani qualcuno lo "ripulisse"
    // scambiando il cassetto per una tabella, si accorgerebbe qui che
    // stava togliendo codice vivo — quello che fa pagare UNA volta sola
    // la tavola di una lezione (b.350, b.378, b.381).
    const src = fs.readFileSync(path.join(APP, 'api', 'compagni', 'avatar', 'route.js'), 'utf8');
    expect(tabelleInterrogate(src)).toEqual([]);
    expect(src, 'il cassetto delle tavole deve restare').toMatch(/storage\.from\('tavole'\)/);
  });

  it('Buffer.from e Array.from non sono tabelle', () => {
    const finto = "const b = Buffer.from('deadbeef'); const a = Array.from('abc');";
    expect(tabelleInterrogate(finto)).toEqual([]);
  });

  it('una tabella nominata dentro un commento non conta', () => {
    // Le rimozioni di b.422 hanno lasciato commenti che spiegano cosa
    // c'era prima: se contassero, questa prova sarebbe rossa per aver
    // fatto il proprio lavoro.
    const finto = "// prima qui c'era sb.from('profiles').select('id')\nconst x = 1;";
    expect(tabelleInterrogate(finto)).toEqual([]);
  });
});
