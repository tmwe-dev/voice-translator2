// ═══════════════════════════════════════════════════════════════
// INVENTARIO DELLE ROTTE — generato dal codice, non scritto a mano
//
//     node scripts/inventario-api.mjs
//
// ── LA PRIMA VERSIONE HA MENTITO, E VALE LA PENA RACCONTARE COME ──
//
// Nell'intestazione avevo scritto: "una tabella che mente e peggio di
// nessuna tabella, perche qualcuno ci si fida". Poi l'ho eseguita e ha
// segnalato dieci cose. Ne ho verificate quattro a mano:
//
//   · /api/auth, /api/messages, /api/translate-free — "due limitatori
//     sovrapposti". Falso: le chiavi sono DIVERSE (`auth` contro
//     `auth-otp`, `messages` contro `messages-patch`, `translate-free`
//     contro `free-translate`). Non e un doppio conteggio: e un limite
//     piu stretto annidato dentro uno piu largo, che e esattamente
//     quello che si vuole per un'azione delicata come il login.
//     In /api/auth c'era perfino il commento che documentava la
//     correzione di quel difetto. L'inventario stava segnalando come
//     bug la sua stessa cura.
//
//   · /api/room — "si fida di un'identita presa dal corpo". Falso:
//     `resolveRoomIdentity` scarta il nome e restituisce null se non
//     c'e un gettone valido. Il parametro e un residuo.
//
// Quattro su quattro. Il controllo non guardava i fatti: cercava una
// stringa (`checkRateLimit(`, `body.name`) e chiamava difetto la sua
// presenza. E la differenza fra un controllo e un sospetto.
//
// ── PERCHE NON E UN DETTAGLIO ──
//
// E lo stesso guasto di b.118, dove ogni corpo malformato produceva un
// 500 e i 500 veri finivano sepolti. Una spia che suona sempre e una
// spia rotta: alla decima segnalazione infondata si smette di leggere
// l'elenco, e la volta che dice il vero non se ne accorge nessuno.
//
// Un inventario che grida al lupo e peggio di uno assente, perche
// costa attenzione e in cambio da finta tranquillita.
//
// ── LA REGOLA ADOTTATA ──
//
// Si segnala solo cio che si sa CONFRONTARE. Chiave contro chiave,
// non stringa contro esistenza. Cio che richiede giudizio umano va
// sotto "da leggere", separato, e non si chiama difetto.
// ═══════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const RADICE = path.join(process.cwd(), 'app', 'api');
const leggi = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const si = (b) => (b ? 'si' : '—');

// Il sorgente senza commenti: un difetto CITATO in un commento per
// spiegarlo non e quel difetto. Ci sono gia cascato una volta, in un
// test che diventava rosso leggendo la propria spiegazione.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Il prefisso che la guardia usa per contare: withApiGuard(h, { prefix: 'x' }) */
function prefissoDellaGuardia(t) {
  const m = t.match(/withApiGuard\s*\([\s\S]{0,200}?prefix:\s*'([^']+)'/);
  return m ? m[1] : null;
}

/** Le chiavi che la rotta conta per conto suo: getRateLimitKey(req, 'y') */
function chiaviProprie(t) {
  return [...t.matchAll(/getRateLimitKey\s*\([^,]+,\s*'([^']+)'/g)].map((m) => m[1]);
}

export function esamina(nome, sorgente) {
  const grezzo = sorgente ?? leggi(path.join(RADICE, nome, 'route.js'));
  if (!grezzo) return null;
  const t = senzaCommenti(grezzo);

  const morta = /Endpoint removed|DEPRECATED/.test(grezzo.slice(0, 400));
  const metodi = [...t.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)/g)]
    .map((m) => m[1]);

  const guardia = /withApiGuard/.test(t);
  const prefisso = prefissoDellaGuardia(t);
  const proprie = chiaviProprie(t);

  // ── IL CONTROLLO CORRETTO ──
  // Doppio conteggio = la rotta conta sulla STESSA chiave della guardia.
  // Chiavi diverse sono due secchi diversi: nessuno si riempie due volte.
  const doppioConteggio = guardia && !!prefisso && proprie.includes(prefisso);

  // ── ALTRO CONTROLLO CORRETTO ──
  // Non basta che nel corpo compaia un nome: quasi tutte le rotte lo
  // ricevono, ed e legittimo (e il nome da mostrare). Il difetto e
  // prendere un'identita dal corpo e non verificare MAI una sessione.
  const identitaDalCorpo = /body\.(hostEmail|email|userName|name)\b|\b(hostEmail|email|userName)\s*[,}]/.test(t);
  const verificaSessione = /getSession|verifyRoomSession|resolveRoomIdentity|resolveIdentity|requireAdmin/.test(t);
  const siFidaDelCorpo = identitaDalCorpo && !verificaSessione;

  // Fuori dalla guardia non vuol dire scoperta: le pagine di collaudo
  // sono chiuse in un altro modo, e va riconosciuto.
  const chiusaAltrimenti = /NODE_ENV === 'production'|ADMIN_PASS|ENABLE_TEST|requireAdmin/.test(t);

  // ── LA DICHIARAZIONE ──
  // Certe rotte DEVONO essere aperte: l'immagine di anteprima social la
  // chiedono programmi senza credenziali. Il motivo pero non va in un
  // elenco dentro questo file, dove nessuno lo rileggerebbe: va scritto
  // accanto alla rotta, cosi chi un giorno la cambia se lo trova
  // davanti e deve contraddirlo per sbagliare.
  //
  //     // INVENTARIO: pubblica — <perche>
  //
  // Si legge dal sorgente GREZZO: e un commento, e senzaCommenti lo
  // toglierebbe. Il motivo dev'essere una frase vera, non "ok": il
  // controllo lo pretende, come per i catch spiegati.
  const dichiarazione = grezzo.match(/\/\/\s*INVENTARIO:\s*pubblica\s*[—-]\s*(.+)/);
  const motivoPubblica = dichiarazione ? dichiarazione[1].trim() : null;

  return {
    rotta: `/api/${nome}`,
    stato: morta ? 'rimossa' : 'viva',
    metodi: metodi.join(' ') || '—',
    guardia: si(guardia),
    prefisso: prefisso || '—',
    chiaviProprie: proprie.join(' ') || '—',
    doppioConteggio,
    schema: si(/validate[A-Z]\w*Input|schemas\.js/.test(t)),
    diretta: si(/assertCloudProcessingAllowed/.test(t)),
    verificaSessione: si(verificaSessione),
    siFidaDelCorpo,
    chiusaAltrimenti,
    motivoPubblica,
    scoperta: !guardia && !chiusaAltrimenti && !motivoPubblica,
  };
}

export function inventario() {
  return fs.readdirSync(RADICE)
    .filter((n) => fs.existsSync(path.join(RADICE, n, 'route.js')))
    .map((n) => esamina(n))
    .filter(Boolean)
    .sort((a, b) => a.rotta.localeCompare(b.rotta));
}

// Eseguito a mano: scrive il documento. Importato da un test: tace.
if (process.argv[1] && process.argv[1].endsWith('inventario-api.mjs')) {
  const righe = inventario();
  const vive = righe.filter((r) => r.stato === 'viva');
  const COL = ['rotta', 'metodi', 'guardia', 'prefisso', 'chiaviProprie', 'schema', 'diretta', 'verificaSessione'];
  const TITOLI = {
    rotta: 'Rotta', metodi: 'Metodi', guardia: 'Guardia', prefisso: 'Chiave guardia',
    chiaviProprie: 'Chiavi proprie', schema: 'Valida ingresso',
    diretta: 'Rispetta Diretta', verificaSessione: 'Verifica sessione',
  };

  let out = `# Inventario delle rotte API\n\n`;
  out += `> Generato da \`scripts/inventario-api.mjs\`. **Non modificare a mano.**\n>\n`;
  out += `> La prima versione segnalo dieci cose e le prime quattro verificate\n`;
  out += `> erano tutte false. Cercava stringhe invece di confrontare fatti.\n`;
  out += `> Ora si segnala solo cio che si sa mettere a confronto: chiave\n`;
  out += `> contro chiave. Il resto sta sotto "da leggere", e non si chiama\n`;
  out += `> difetto.\n\n`;
  out += `Rotte totali: **${righe.length}** — vive: **${vive.length}**, rimosse: **${righe.length - vive.length}**\n\n`;
  out += `## Come si legge\n\n| Colonna | Cosa significa |\n| --- | --- |\n`;
  out += `| Guardia | passa da \`withApiGuard\`: limite, dimensione del corpo, corpo malformato |\n`;
  out += `| Chiave guardia | il secchio su cui conta la guardia |\n`;
  out += `| Chiavi proprie | i secchi che la rotta conta da se. **Diversi dal primo = limite annidato, voluto.** Uguali = si conta due volte |\n`;
  out += `| Valida ingresso | controlla i campi con uno schema, non a occhio |\n`;
  out += `| Rispetta Diretta | rifiuta di lavorare se la sessione e in modalita Diretta |\n`;
  out += `| Verifica sessione | ricava chi sei da un gettone, non da cio che dichiari |\n\n`;
  out += `## Rotte vive\n\n| ${COL.map((c) => TITOLI[c]).join(' | ')} |\n| ${COL.map(() => '---').join(' | ')} |\n`;
  for (const r of vive) out += `| ${COL.map((c) => r[c]).join(' | ')} |\n`;

  const rimosse = righe.filter((r) => r.stato === 'rimossa');
  if (rimosse.length) {
    out += `\n## Rotte rimosse (rispondono 410)\n\n`;
    out += rimosse.map((r) => `- \`${r.rotta}\``).join('\n') + '\n';
  }

  const doppie = vive.filter((r) => r.doppioConteggio);
  const scoperte = vive.filter((r) => r.scoperta);
  const altrimenti = vive.filter((r) => r.guardia === '—' && r.chiusaAltrimenti);
  const fidano = vive.filter((r) => r.siFidaDelCorpo);

  const elenco = (v) => v.map((r) => `- \`${r.rotta}\``).join('\n');

  out += `\n## Difetti (confrontati, non sospettati)\n\n`;
  out += `### Rotte che si contano due volte sulla stessa chiave\n\n`;
  out += doppie.length ? `${elenco(doppie)}\n` : `Nessuna.\n`;
  out += `\n### Rotte senza nessuna protezione\n\n`;
  out += scoperte.length ? `${elenco(scoperte)}\n` : `Nessuna.\n`;

  const dichiarate = vive.filter((r) => r.motivoPubblica);

  out += `\n## Da leggere (serve giudizio: NON sono difetti)\n\n`;
  out += `### Aperte per scelta, con il motivo scritto accanto (${dichiarate.length})\n\n`;
  out += dichiarate.length
    ? dichiarate.map((r) => `- \`${r.rotta}\` — ${r.motivoPubblica}`).join('\n') + '\n'
    : `Nessuna.\n`;
  out += `\n### Chiuse in un modo diverso dalla guardia (${altrimenti.length})\n\n`;
  out += `${elenco(altrimenti)}\n\nPagine di collaudo dietro un interruttore o una parola d'ordine.\n`;
  out += `\n### Prendono un'identita dal corpo senza verificare una sessione (${fidano.length})\n\n`;
  out += fidano.length
    ? `${elenco(fidano)}\n\nDa guardare a mano: alcune non decidono niente in base a\nquel valore, lo rigirano e basta.\n`
    : `Nessuna.\n`;

  fs.writeFileSync(path.join(process.cwd(), 'INVENTARIO-API.md'), out);
  console.log(`rotte: ${righe.length} (vive ${vive.length})`);
  console.log(`DIFETTI  doppio conteggio: ${doppie.length}   scoperte: ${scoperte.length}`);
  console.log(`DA LEGGERE  chiuse altrimenti: ${altrimenti.length}   identita dal corpo: ${fidano.length}`);
}
