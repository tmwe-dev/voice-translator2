// ═══════════════════════════════════════════════════════════════
// b.238 — VOCAZIONE al posto delle regole, e la voce che smette di
// leggere tutto allo stesso modo.
//
// Il difetto di fondo (audit conversazionale): stavamo programmando il
// COMPORTAMENTO ("non chiudere con una domanda", "verifica la
// comprensione"), cioè spiegando al modello cose che sa già meglio di
// noi. Ora si programma IDENTITÀ, RESPONSABILITÀ e SCOPO — e il
// comportamento si deduce.
//
// E la prosodia: `style: 0.0` era scritto a mano nella rotta TTS. Il
// canale della voce esisteva ed era spento.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { VOCAZIONI, promptVocazione, vocazioneDiProfilo, LENTI_UMANE, contestoRelazione } from '../app/lib/compagni/vocazione.js';
import { promptProfilo } from '../app/lib/compagni/profili.js';
import { situazioneDaTesto, notaPerSituazione, regiaConversazione } from '../app/lib/compagni/controllore.js';
import { parametriVoce, staccaModoVoce, modoValido, MODI_VOCE, ISTRUZIONE_VOCE } from '../app/lib/voceEspressiva.js';
import { COMPAGNI_PREDEFINITI } from '../app/lib/compagni/catalogo.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('vocazione — identità e responsabilità, non regole di condotta', () => {
  it('le quattro vocazioni dicono di cosa ci si sente responsabili', () => {
    expect(Object.keys(VOCAZIONI).sort()).toEqual(['compagnia', 'confronto', 'guida', 'servizio']);
    expect(promptVocazione('guida')).toMatch(/padre|maestro|mentore/i);
    expect(promptVocazione('guida')).toMatch(/meno necessaria la tua guida/);
    expect(promptVocazione('servizio')).toMatch(/servizio, non servilismo/);
    expect(promptVocazione('confronto')).toMatch(/Non devi vincere/);
    expect(promptVocazione('compagnia')).toMatch(/non sei un questionario/i);
  });

  it('il profilo ORA restituisce la vocazione: un solo testo, niente doppioni', () => {
    expect(promptProfilo('didattico')).toBe(promptVocazione('guida'));
    expect(promptProfilo('operativo')).toBe(promptVocazione('servizio'));
    expect(promptProfilo('dibattimentale')).toBe(promptVocazione('confronto'));
    expect(promptProfilo('conversazionale')).toBe(promptVocazione('compagnia'));
    expect(vocazioneDiProfilo('didattico')).toBe('guida');
  });

  it('le vecchie regole di condotta NON ci sono più', () => {
    // Erano gli "if" travestiti da prompt: il modello sa già che a uno
    // sfogo non si risponde con un interrogatorio.
    const tutti = Object.keys(VOCAZIONI).map(promptVocazione).join('\n');
    expect(tutti).not.toMatch(/PROFILO (CONVERSAZIONALE|DIDATTICO|DIBATTIMENTALE|OPERATIVO)/);
    expect(tutti).not.toMatch(/NON chiudere ogni risposta con una domanda/);
  });

  it('le tre distinzioni che reggono tutto sono nel modulo', () => {
    const src = leggi('app/lib/compagni/vocazione.js');
    expect(src).toMatch(/leadership ≠ autorità/);
    expect(src).toMatch(/servizio\s+≠ obbedienza/);
    expect(src).toMatch(/educazione ≠ controllo/);
  });
});

describe('le lenti — modi di guardare, non campi da riempire', () => {
  it('coprono i punti che rendono umano l\'ascolto', () => {
    expect(LENTI_UMANE).toMatch(/ipotesi/i);            // stato = ipotesi, non verità
    expect(LENTI_UMANE).toMatch(/Richiesta e bisogno/); // domanda ≠ bisogno
    expect(LENTI_UMANE).toMatch(/pausa/);               // il silenzio è pensiero
    expect(LENTI_UMANE).toMatch(/Confidenza e iniziativa crescono/); // tempo della relazione
    expect(LENTI_UMANE).toMatch(/dipendenza/);          // peso dell'influenza
    expect(LENTI_UMANE).toMatch(/coerente/);            // coerenza nel tempo
  });

  it('restano brevi: la velocità è un requisito, non un dettaglio', () => {
    expect(LENTI_UMANE.length).toBeLessThan(1000);
  });

  it('il tempo della relazione cambia la confidenza, senza query in più', () => {
    expect(contestoRelazione(0)).toMatch(/STATE CONOSCENDO ORA/);
    expect(contestoRelazione(3)).toMatch(/DA POCO/);
    expect(contestoRelazione(40)).toMatch(/CONOSCETE BENE/);
  });
});

describe('controllore — retrocesso da decisore a ipotesi', () => {
  it('la stima della situazione resta (serve come indizio)', () => {
    expect(situazioneDaTesto('Sono stanco morto, non ne posso più')).toBe('sfogo');
    expect(situazioneDaTesto('Secondo me il problema è che...')).toBe('riflessione');
  });

  it('ma NON detta più la mossa: dichiara un\'ipotesi e restituisce la scelta', () => {
    const { blocco } = regiaConversazione({ ultimo: 'Sono a pezzi, non ce la faccio più' });
    expect(blocco).toMatch(/ipotesi da confermare o scartare/);
    expect(blocco).toMatch(/Decidi tu se e come rispondere/);
    // Le vecchie prescrizioni imperative non ci sono più.
    expect(blocco).not.toMatch(/Mossa:/);
    expect(blocco).not.toMatch(/Prima di tutto ASCOLTA/);
  });

  it('ed è più corto di prima: meno prompt, meno latenza', () => {
    const { blocco } = regiaConversazione({ ultimo: 'Sono stanchissimo' });
    expect(blocco.length).toBeLessThan(300);
    expect(notaPerSituazione('sfogo')).toMatch(/capita/);
  });
});

describe('voce — la prosodia la decide chi parla, non una tabella di emozioni', () => {
  it('senza intento nulla cambia: la traduzione resta fedele, non recitata', () => {
    const p = parametriVoce({ stability: 0.65 });
    expect(p.style).toBe(0);
    expect(p.stability).toBe(0.65);
  });

  it('con un intento la voce si apre', () => {
    expect(parametriVoce({ stability: 0.65, modo: 'entusiasta' }).style).toBeGreaterThan(0.4);
    expect(parametriVoce({ stability: 0.65, modo: 'entusiasta' }).stability).toBeLessThan(0.65);
    expect(parametriVoce({ stability: 0.65, modo: 'serio' }).stability).toBeGreaterThan(0.65);
  });

  it('ma su una lingua TONALE la stabilità non scende mai: il tono è la parola', () => {
    const t = parametriVoce({ stability: 0.75, modo: 'entusiasta', tonale: true });
    expect(t.stability).toBeGreaterThanOrEqual(0.75);
    expect(t.style).toBeLessThanOrEqual(0.35);
  });

  it('un intento inventato non rompe niente: si ricade su neutro', () => {
    expect(modoValido('jailbreak')).toBe(false);
    expect(parametriVoce({ stability: 0.65, modo: 'jailbreak' }).style).toBe(0);
  });

  it('il marcatore si stacca dal testo e non viene mai letto', () => {
    const r = staccaModoVoce('Ti capisco, e non è poco. [voce: caldo]');
    expect(r.testo).toBe('Ti capisco, e non è poco.');
    expect(r.modo).toBe('caldo');
    // Senza marcatore il testo resta intatto.
    expect(staccaModoVoce('Solo testo.')).toEqual({ testo: 'Solo testo.', modo: 'neutro' });
    // Marcatore malformato: il testo non si rovina.
    expect(staccaModoVoce('Ciao [voce: inventato]').modo).toBe('neutro');
  });

  it('l\'istruzione elenca gli archetipi disponibili', () => {
    for (const m of MODI_VOCE) expect(ISTRUZIONE_VOCE).toContain(m);
  });
});

describe('i punti d\'innesto veri', () => {
  it('la rotta TTS non ha più style: 0.0 scritto a mano', () => {
    const s = leggi('app/api/tts-elevenlabs/route.js');
    expect(s).not.toMatch(/style: 0\.0/);
    expect(s).toMatch(/parametriVoce\(/);
  });

  it('la rotta Amico stacca l\'intento e lo restituisce al client', () => {
    const s = leggi('app/api/compagni/amico/route.js');
    expect(s).toMatch(/staccaModoVoce\(r\.testo\)/);
    expect(s).toMatch(/risposta: rispostaPulita/);
    expect(s).toMatch(/LENTI_UMANE/);
    expect(s).toMatch(/contestoRelazione\(ricordi\.length\)/);
  });

  it('e il client porta l\'intento fino alla voce', () => {
    expect(leggi('app/lib/compagni/cliente.js')).toMatch(/speechMode: modoVoce/);
    expect(leggi('app/components/Life/AmicoChat.js')).toMatch(/modoVoce: d\.modoVoce/);
  });

  it('ogni Compagno ha una vocazione: chi e, come si comporta, e non e una etichetta', () => {
    // b.536 — ROSSO PRE-ESISTENTE, dichiarato: rosso da b.528, quando il
    // cast di RadioChat (Albert, Pitagora, Newton) e' entrato con le
    // personalita' NELLA FORMA DI RADIOCHAT — ruolo, stile, punti di
    // forza, regola di dibattito — che dicono le stesse cose senza usare
    // le parole «vocazione» e «responsabilita».
    // La prova cercava DUE PAROLE invece della SOSTANZA (trappola n.6 del
    // CLAUDE.md: difendeva una riga, non cio che quella riga faceva), e
    // riscrivendola ho rischiato di rifare lo stesso errore con un elenco
    // di sinonimi piu lungo. Quindi si prova la STRUTTURA di una
    // vocazione, che non dipende dalle parole scelte: dice a chi parla
    // CHI e', e gli dice come comportarsi in piu di una frase — cioe
    // istruzioni alla seconda persona, non un'etichetta di due righe.
    for (const c of COMPAGNI_PREDEFINITI) {
      const p = (c.personalita || '').trim();
      const proprio = c.nome.split(' ').filter((x) => !/^(avv\.|dott\.ssa|dott\.|prof\.ssa|prof\.)$/i.test(x)).pop();
      expect(p.length, `${c.id}: troppo corta per dire chi e e come si comporta`).toBeGreaterThan(120);
      expect(p, `${c.id}: non comincia dicendo CHI e`).toMatch(/^Sei /);
      expect(p, `${c.id}: il nome proprio non compare`).toMatch(new RegExp(proprio, 'i'));
      // istruzioni di comportamento: verbi alla seconda persona singolare
      // (parli, spieghi, ragioni, verifichi, citi, ascolti, non approssimi...)
      const secondaPersona = p.match(/\b\w{3,}(?:i|hi)\b(?=[ ,.;:])/g) || [];
      expect(secondaPersona.length, `${c.id}: nessuna istruzione di comportamento`).toBeGreaterThan(2);
      // e non e' una riga sola: una vocazione dice piu di una cosa
      expect(p.split(/[.!?]\s/).filter((f) => f.trim().length > 15).length,
        `${c.id}: una frase sola, e un'etichetta non una vocazione`).toBeGreaterThan(1);
    }
  });

  it('e i guardrail dei Compagni sensibili NON sono stati persi', () => {
    const trova = (id) => COMPAGNI_PREDEFINITI.find(c => c.id === id).personalita;
    expect(trova('dott-elena')).toMatch(/NON dai diagnosi/);
    expect(trova('avv-marco')).toMatch(/Non inventi articoli o sentenze/);
    expect(trova('ricercatore')).toMatch(/NON inventi citazioni/);
    expect(trova('coach-aisha')).toMatch(/Non dai consigli medici/);
  });
});
