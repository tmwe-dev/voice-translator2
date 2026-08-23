// b.355 — Il traduttore subito: la vecchia "prima prova" a frase fissa e
// diventata un traduttore vero, faccia a faccia. Qui si verifica che i
// comportamenti chiesti nel collaudo esistano davvero nel sorgente.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const src = leggi('components/PrimaProva.js');

describe('il traduttore subito', () => {
  it('è montato nella Home, chiuso dietro l\'icona "Parla ora"', () => {
    const home = leggi('components/HomeView.js');
    expect(home).toMatch(/<PrimaProva/);
    expect(home, 'l\'icona che lo apre esiste').toMatch(/riapriPrimaProva/);
    expect(home, 'si chiama "Parla ora"').toMatch(/speakNowTitle/);
  });

  it('si scrive o si detta, e la traduzione parte da sola', () => {
    // Niente frase preconfezionata: si traduce quello che l'utente scrive.
    expect(src, 'traduce il testo dell\'utente').toContain('/api/translate');
    expect(src, 'parte da sola quando smetti di scrivere').toMatch(/setTimeout\(\(\) => traduci\(testo\)/);
    expect(src, 'la dettatura c\'e, dove il browser la offre').toMatch(/SpeechRecognition/);
    expect(src, 'la trascrizione arriva nel campo mentre parli').toMatch(/interimResults = true/);
  });

  it('la voce arriva insieme al testo, ed e madrelingua', () => {
    // b.356 — prima ElevenLabs (voce NATIVA della lingua d'arrivo), e solo
    // se non risponde la voce di sistema: meglio una voce che nessuna.
    expect(src, 'la voce madrelingua').toContain('/api/tts-elevenlabs');
    expect(src, 'il ripiego se ElevenLabs tace').toContain('tts-edge');
    expect(src).toMatch(/new Audio/);
    expect(src, 'la voce parte dalla traduzione appena arrivata').toMatch(/parla\(d\.translated\)/);
    // Ma non mentre il microfono e aperto: il telefono si detterebbe
    // da solo la propria traduzione.
    expect(src).toMatch(/if \(!dettoRef\.current\) parla/);
  });

  it('il faccia a faccia gira il testone di 180 gradi', () => {
    expect(src, 'il tasto che capovolge esiste').toMatch(/setCapovolto/);
    expect(src, 'il tradotto si legge al contrario, dal lato dell\'altro').toContain("rotate(180deg)");
    // b.422/b.423 — questa riga prima si controllava ALLA LETTERA, e si e
    // fatta rossa DUE VOLTE quando il disegno e cambiato, pur restando vero
    // ogni volta cio che difendeva. E' la trappola numero 6 in un'altra
    // forma: la prova proteggeva una RIGA, non un comportamento.
    // Cio che conta, e che vale qualunque disegno: si gira SOLO cio che
    // l'altro deve leggere, e la riga per scrivere resta dritta e usabile
    // (ordine di Luca: «mantieni il campo di testo in basso e ribalta solo
    // il testo da leggere»).
    const iLettura = src.indexOf('const bloccoLettura');
    const iVoce = src.indexOf('const bloccoVoce');
    expect(iLettura, "l'area di lettura esiste").toBeGreaterThan(0);
    expect(src.slice(iLettura, iVoce), 'cio che si legge si gira').toContain('rotate(180deg)');
    expect(src.slice(iVoce), 'ne la voce ne il testo si girano mai').not.toContain('rotate(180deg)');
  });

  it('non propone come meta la lingua che già parli', () => {
    expect(src, 'la scelta iniziale salta la tua lingua').toMatch(/RAPIDE\.find\(\(m\) => m\.split\('-'\)\[0\] !==/);
    expect(src, 'la fila delle mete non contiene la tua lingua').toMatch(/l\.code !== miaLingua/);
  });

  it('una volta usato, non riappare da solo', () => {
    expect(src).toMatch(/memSet\(FATTA, '1'\)/);
    const home = leggi('components/HomeView.js');
    expect(home, 'ma la riga per riaprirlo resta').toMatch(/riapriPrimaProva/);
  });

  it('se la voce fallisce, il testo resta comunque', () => {
    // La sintesi è un di più: non deve far fallire tutta la prova.
    //
    // b.417 — QUESTA PROVA ERA UNA FOTOGRAFIA, ed e diventata rossa quando
    // l'intento e stato soddisfatto MEGLIO. Misurava 1200 caratteri intorno
    // a «tts-edge» e pretendeva di trovarci «catch»: spostando la richiesta
    // della voce in una funzione sua, il catch e rimasto (e ora copre TUTTE
    // e due le rotte, non una), ma la finestra si e riempita di commento.
    // E' la trappola numero 6 del CLAUDE.md in un'altra forma: la prova
    // difendeva una riga invece della cosa che quella riga faceva.
    //
    // Cio che conta davvero e questo: la riga entra nel registro PRIMA che
    // si provi a parlare. Qualunque cosa succeda alla voce — server giu,
    // audio vuoto, telefono muto — il testo tradotto e gia sullo schermo.
    const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const registro = codice.indexOf('setStoria((prima) =>');
    const voce = codice.indexOf('parla(d.translated)');
    expect(registro, 'la riga finisce nel registro').toBeGreaterThan(-1);
    expect(voce, 'e la voce si chiede DOPO averla scritta').toBeGreaterThan(registro);
    // e la richiesta della voce non puo far esplodere niente
    expect(codice, 'ogni rotta della voce e dentro una rete').toMatch(/const chiediVoce = async[\s\S]{0,600}catch/);
  });

  it('dice cosa sta facendo e cosa è andato storto', () => {
    // b.363 — la frase d'errore non sta più scritta a mano dentro il
    // componente: e passata ai pacchetti lingua, perche chi parla turco non
    // deve leggersi un avviso in italiano. La pretesa non cambia — il guasto
    // si VEDE e non resta muto — cambia solo il posto dove si verifica.
    expect(src, 'lo stato di lavoro esiste').toMatch(/'traduco'/);
    expect(src, 'l\'errore si vede, non resta muto')
      .toMatch(/stato === 'errore' &&[\s\S]{0,200}L\('speakNowError'\)/);
    // E la frase esiste davvero, tradotta, in TUTTI i pacchetti: una chiave
    // mancante lascerebbe l'avviso vuoto proprio nel momento del guasto.
    const cartella = path.join(APP, 'lib', 'locales');
    const pacchetti = fs.readdirSync(cartella).filter((f) => f.endsWith('.js') && f !== 'index.js');
    expect(pacchetti.length, 'i pacchetti lingua ci sono tutti').toBeGreaterThanOrEqual(38);
    const senza = pacchetti.filter((f) => !/"speakNowError":\s*"[^"]+"/.test(leggi(path.join('lib', 'locales', f))));
    expect(senza, 'nessun pacchetto senza la frase d\'errore').toEqual([]);
  });

  it('una traduzione respinta dal controllo qualità non passa per buona', () => {
    // b.357/b.363 — quando il controllo del server respinge la resa, la
    // risposta torna col testo ORIGINALE dentro: finiva nel registro sotto la
    // bandiera sbagliata (frasi italiane date per tedesche) e la voce le
    // leggeva pure. Deve diventare un errore visibile, e la stessa frase si
    // deve poter richiedere di nuovo.
    // b.428 — questa prova cercava la riga `giaChiestaRef.current = ''`
    // alla lettera, ed e diventata rossa quando la stessa cosa ha smesso
    // di essere scritta in quattro punti ed e diventata una funzione sola
    // (`slaccia`) chiamata da tutte le uscite. Il comportamento non e
    // cambiato: e migliorato, perche adesso vale anche per i guasti di
    // rete, che prima bruciavano la frase per sempre.
    // La PROVA VERA del comportamento sta in `primo-invio-b428`, dove la
    // frase viene rimandata davvero. Qui resta il controllo che la
    // respinta si riconosca e non passi per buona.
    const i = src.indexOf('d.validationFailed');
    expect(i, 'la respinta si riconosce').toBeGreaterThan(-1);
    const blocco = src.slice(i, i + 300);
    expect(blocco, 'diventa un errore visibile').toMatch(/setStato\('errore'\)/);
    expect(blocco, 'e la stessa frase si puo riprovare').toMatch(/slaccia\(\)/);
    expect(blocco, 'e NON finisce nel registro').not.toMatch(/setStoria/);
  });

  it('i messaggi si susseguono, e restano in ordine', () => {
    // b.356 — nessuna frase tradotta viene persa: entra nel registro, e
    // le risposte che arrivano scomposte si rimettono in fila.
    expect(src, 'il registro esiste').toMatch(/setStoria/);
    expect(src, 'in ordine di partenza').toMatch(/sort\(\(a, b\) => a\.n - b\.n\)/);
    // Ma una resa parziale (l'utente sta ancora allungando la frase) si butta.
    expect(src).toMatch(/staAllungando/);
  });
});
