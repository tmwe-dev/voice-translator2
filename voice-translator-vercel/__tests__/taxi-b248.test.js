// ═══════════════════════════════════════════════════════════════
// TAXITALK: GLI STATI CHE MENTIVANO (b.248)
//
// Quattro punti dall'audit: tre confermati (§5) e uno smentito. I tre
// confermati sono la stessa famiglia di difetto: uno stato derivato
// (la traduzione, la destinazione) che NON seguiva piu lo stato da cui
// derivava, e restava sullo schermo come se fosse ancora vero.
//
//  1. `tradotto` sopravviveva a ogni modifica di `testo`: si cambiava
//     frase e il tassista leggeva la traduzione della frase PRIMA.
//  2. idem per la lingua del tassista: si passava da inglese a
//     giapponese e sotto l'etichetta giapponese restava la frase
//     inglese. Ora si ricorda COSA e' stato tradotto e VERSO quale
//     lingua, e la traduzione si mostra solo se combacia ancora.
//  3. `dest` sopravviveva alla query: scelta una destinazione,
//     riscrivere la ricerca lasciava mappa e QR sul posto vecchio. In
//     TaxiDestinationPanel era peggio: la conferma componeva
//     destinationName con la query NUOVA e lat/lng del posto VECCHIO.
//  4. SMENTITO "il tassista non riesce a tradurre": TaxiDriverView
//     chiama /api/translate senza credenziali, ma resolveAuth ha (da
//     b.154) il percorso anonimo DICHIARATO — chiave di piattaforma,
//     tetto giornaliero di piattaforma, limite per IP in withApiGuard.
//     Non e' un 401/402 e non e' un buco nuovo: qui si tiene fermo che
//     quel percorso resti com'e' e che l'ordine di fatturazione della
//     rotta (autorizzazione → fornitore → esecuzione → contabilita, §8)
//     non cambi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

// Trappola gia' costata tempo (vedi CLAUDE.md §6): ogni correzione porta
// con se' un commento che CITA il codice vecchio. I controlli "non c'e'
// piu'" guardano il codice, non le spiegazioni.
const senzaCommenti = (p) => leggi(p)
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n')
  .map((r) => (/^\s*(\/\/|\*)/.test(r) ? '' : r.replace(/\s\/\/.*$/, '')))
  .join('\n');

const TAXI = 'app/components/TaxiTalk.js';
const PANNELLO = 'app/components/TaxiDestinationPanel.js';

// ═══════════════════════════════════════════════════════════════
describe('1+2 · la traduzione segue il testo E la lingua del tassista', () => {

  it('si ricorda che cosa e\' stato tradotto e verso quale lingua', () => {
    // Senza questa memoria non c\'e\' modo di accorgersi che il campo
    // e\' cambiato: `tradotto` restava "vero" per sempre.
    const src = leggi(TAXI);
    expect(src).toMatch(/setFonteTraduzione\(\{ testo: text, lingua: driverLang \}\)/);
  });

  it('e la mostra solo se combacia ancora con campo e lingua', () => {
    const src = leggi(TAXI);
    expect(src, 'serve il valore derivato che fa da cancello').toMatch(/const tradottoValido =/);
    expect(src, 'deve confrontare il testo tradotto col campo').toMatch(/fonteTraduzione\.testo === testo\.trim\(\)/);
    expect(src, 'e la lingua tradotta con quella scelta').toMatch(/fonteTraduzione\.lingua === driverLang/);
  });

  it('nessun pezzo di schermo legge piu\' la traduzione grezza', () => {
    // Il difetto stava tutto qui: la card, il tasto "Mostra ribaltato",
    // l\'ascolto e l\'overlay girato verso il tassista leggevano
    // `tradotto` senza chiedersi se fosse ancora quello giusto.
    const s = senzaCommenti(TAXI);
    expect(s, 'la card non deve aprirsi su una traduzione stantia').not.toMatch(/\{tradotto\s*&&/);
    expect(s, 'non si ascolta una traduzione stantia').not.toMatch(/ascolta\(tradotto\)/);
    expect(s, 'i tasti non si accendono su una traduzione stantia').not.toMatch(/!tradotto\s*[|}]/);
    // E il cancello e\' usato davvero, non definito e dimenticato.
    expect((s.match(/tradottoValido/g) || []).length).toBeGreaterThanOrEqual(6);
  });

  it('la dettatura allinea il campo al testo davvero tradotto', () => {
    // Guardia sul flusso incrementale: onresult scrive (finale+interim),
    // ma si traduce solo `finale`. Se a fine dettatura i due divergessero,
    // il cancello nasconderebbe una traduzione appena fatta. Il campo si
    // allinea a cio\' che parte verso il server.
    const src = leggi(TAXI);
    expect(src).toMatch(/if \(t\) \{ setTesto\(t\); const out = await traduci\(t\)/);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('3 · la destinazione segue la ricerca', () => {

  it('in TaxiTalk modificare la query invalida la destinazione scelta', () => {
    const src = leggi(TAXI);
    // Un colpo solo: la query cambia e mappa+QR spariscono, invece di
    // restare sul posto vecchio mentre il campo ne dice un altro.
    expect(src).toMatch(/const cambiaQuery = useCallback\(\(v\) => \{ setQuery\(v\); setDest\(null\); \}/);
    expect(src, 'e il campo deve passare da li\'').toMatch(/onChange=\{\(e\) => cambiaQuery\(e\.target\.value\)\}/);
    expect(senzaCommenti(TAXI), 'niente scorciatoia che salta l\'invalidazione')
      .not.toMatch(/onChange=\{\(e\) => setQuery\(e\.target\.value\)\}/);
  });

  it('in TaxiDestinationPanel modificare la query invalida il posto scelto', () => {
    // Qui il danno era doppio: handleConfirm componeva destinationName
    // con la query NUOVA e lat/lng del posto VECCHIO — due verita\' nello
    // stesso oggetto consegnato al QR.
    const src = leggi(PANNELLO);
    const inizio = src.indexOf('const handleQueryChange');
    const blocco = src.slice(inizio, src.indexOf('}, [doSearch]);', inizio));
    expect(inizio, 'handleQueryChange deve esistere ancora').toBeGreaterThan(-1);
    expect(blocco, 'la scelta si annulla appena la query cambia').toContain('setSelectedPlace(null)');
  });

  it('la scelta programmatica della destinazione resta possibile', () => {
    // `scegli`/`selectPlace` reimpostano la query via setQuery: un input
    // controllato non emette onChange per le scritture programmatiche,
    // quindi la scelta appena fatta NON si auto-invalida.
    expect(leggi(TAXI)).toMatch(/const scegli = useCallback\(\(r\) => \{[^\n]*setDest\(r\)/);
    expect(leggi(PANNELLO)).toMatch(/setSelectedPlace\(place\)/);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('4 · il tassista traduce dal percorso anonimo dichiarato (smentito il 401)', () => {

  it('la vista tassista continua a NON mandare credenziali', () => {
    // Non e\' una dimenticanza da "correggere" imbucando il userToken del
    // passeggero nel QR: quel gettone e\' una credenziale di spesa e non
    // deve finire sul telefono di un estraneo. Il percorso e\' l\'anonimo
    // di piattaforma, gia\' dichiarato e gia\' col suo tetto.
    expect(senzaCommenti('app/components/TaxiDriverView.js')).not.toMatch(/userToken|lendingCode|roomSessionToken/);
  });

  it('resolveAuth ha davvero il ramo anonimo che non respinge', () => {
    // E\' il Path 4 di apiAuth.js: niente token, niente stanza, niente
    // prestito → chiave di piattaforma, nessun throw. Se un giorno questo
    // ramo respingesse, il tassista resterebbe muto e il punto 4
    // diventerebbe VERO: questo test e\' la sveglia.
    const src = leggi('app/lib/apiAuth.js');
    const fine = src.indexOf("if (provider === 'elevenlabs'");
    const inizio = src.lastIndexOf('} else {', fine);
    expect(inizio).toBeGreaterThan(-1);
    const ramo = src.slice(inizio, fine)
      .split('\n').filter((r) => !r.trim().startsWith('//')).join('\n');
    expect(ramo, 'il ramo anonimo non deve respingere').not.toMatch(/throw/);
  });

  it('e quel percorso non e\' gratis senza rete: il tetto di piattaforma lo copre', () => {
    const src = leggi('app/lib/apiAuth.js');
    expect(src).toContain('daily:platform:');
    expect(src).toMatch(/DAILY_LIMITS\.PLATFORM_TOTAL/);
    // Piu\' il limite per IP sulla rotta stessa.
    expect(leggi('app/api/translate/route.js')).toMatch(/withApiGuard\(handlePost, \{ maxRequests: 120/);
  });

  it('l\'ordine di fatturazione della rotta non e\' cambiato (§8)', () => {
    // autorizzazione (resolveAuth) → riserva → fornitore (Asia/Global) →
    // contabilita\' (commit). Questo giro non doveva toccarlo e non l\'ha
    // toccato: qui la sequenza resta inchiodata.
    const s = senzaCommenti('app/api/translate/route.js');
    const tappe = [
      'await resolveAuth({',
      'await riserva(billingEmail',
      "import('../../lib/translateAsia.js')",
      'await callLLMWithFallback(',
      'await commit(riservaId',
    ];
    const posizioni = tappe.map((t) => s.indexOf(t));
    for (let i = 0; i < tappe.length; i++) {
      expect(posizioni[i], `manca la tappa: ${tappe[i]}`).toBeGreaterThan(-1);
      if (i > 0) expect(posizioni[i], `${tappe[i]} deve venire dopo ${tappe[i - 1]}`).toBeGreaterThan(posizioni[i - 1]);
    }
  });

  it('e il passeggero, sul SUO schermo, paga come sempre', () => {
    // Le due facce di TaxiTalk vivono sullo stesso telefono: la richiesta
    // parte con la credenziale del passeggero, che e\' chi paga.
    expect(leggi(TAXI)).toMatch(/userToken: userToken \|\| ''/);
  });
});
