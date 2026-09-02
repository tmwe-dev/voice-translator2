import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.527 — collaudo video di Luca con ernesto (es): «la traduzione
// scritta e parlata non vengono attivate, la voce dell'ospite non viene
// resa piu soffice per default, i comandi sono separati e non seguono
// lo standard template, non mantieni i menu quando sei a tutta pagina».

describe('b.527 — il silenzio della traduzione ora si spiega e si ripara', () => {
  it('il fallimento d avvio dell interprete e uno stato leggibile', () => {
    const f = leggi('app/hooks/useInterpreterMode.js');
    expect(f).toMatch(/const \[erroreAvvio, setErroreAvvio\] = useState\(null\)/);
    expect(f).toMatch(/setErroreAvvio\(e\?\.message \|\| 'avvio non riuscito'\)/);
    expect(f).toMatch(/erroreAvvio,\n  \};/);
  });
  it('un avvio fallito RIPROVA invece di restare muto per sempre', () => {
    const f = leggi('app/components/RoomView.js');
    expect(f).toMatch(/interpreter\.erroreAvvio \? 2500 : 0/);
    expect(f).toMatch(/\[interpreterActive, interpreter, interpreter\?\.active, interpreter\?\.erroreAvvio\]/);
  });
  it('nei sottotitoli: traduzione spenta = un tasto che la accende, non il vuoto', () => {
    const f = leggi('app/components/VideoCallOverlay.js');
    // b.597 — la condizione unica e diventata tre rami distinti (Stanza
    // Diretta / gruppo / traduzione solo spenta): ognuno dice il PROPRIO
    // motivo invece di condividere lo stesso "tocca per accendere" anche
    // quando accendere non e possibile.
    expect(f).toMatch(/!interpreterActive && setInterpreterActive \? \(/);
    expect(f).toMatch(/L\('translationOffTap'\)/);
    expect(f).toMatch(/L\('interpreterFailed'\)/);
  });
  it('in Stanza Diretta o di gruppo i sottotitoli spiegano il motivo, non restano un vuoto muto', () => {
    // b.597 — Luca dal vivo (nuovo audit): "poi non traduce", senza che
    // niente lo spiegasse. In Stanza Diretta/gruppo il pannello prima
    // cadeva sul generico captionsWillAppear ("appariranno qui"), una
    // promessa che li non si avvera mai.
    const f = leggi('app/components/VideoCallOverlay.js');
    expect(f).toMatch(/\) : stanzaDiretta \? \(/);
    expect(f).toMatch(/\) : stanzaConPiuDiDue \? \(/);
  });
});

describe('b.527 — la voce dell ospite e piu soffice per default', () => {
  const f = leggi('app/components/RoomView.js');
  it('con lingue diverse parte a 0.45, non a 0.7', () => {
    expect(f).toMatch(/if \(!partnerVolumeToccatoRef\.current\) setPartnerVolume\(0\.45\)/);
  });
  it('ma la mano dell utente comanda: il cursore toccato non viene scavalcato', () => {
    expect(f).toMatch(/partnerVolumeToccatoRef\.current = true/);
    expect(f).toMatch(/setPartnerVolume=\{cambiaPartnerVolume\}/);
  });
});

describe('b.527 — template e menu', () => {
  const f = leggi('app/components/VideoCallOverlay.js');
  it('i comandi non spariscono piu da soli', () => {
    expect(f).toMatch(/const comandiVisibili = true;/);
    expect(f).not.toMatch(/setComandiVisibili\(false\), 6000/);
  });
  it('la testata e UNA barra: indietro, chi e come, chiusura', () => {
    expect(f).toMatch(/LA TESTATA UNICA/);
    expect(f).toMatch(/\{'←'\} \{L\('chatWord'\)\}/);
    expect(f).toMatch(/L\('connectedWord'\) : L\('connectingLabel'\)/);
  });
  it('niente piu italiano fisso nella chiamata', () => {
    expect(f).not.toMatch(/Le traduzioni appariranno qui appena parlate/);
    expect(f).not.toMatch(/'Connessione in corso\.\.\.'/);
    expect(f).not.toMatch(/ · STA PARLANDO/);
    expect(f).not.toMatch(/`Voce di \$\{/);
    expect(f).not.toMatch(/>Volumi</);
  });
});

describe('b.527 — le chiavi nuove esistono in it e en', () => {
  it.each(['connectingLabel', 'captionsWillAppear', 'translationOffTap', 'interpreterFailed', 'whileTranslationSpeaks'])('%s', (k) => {
    expect(leggi('app/lib/locales/it.js')).toContain(`"${k}":"`);
    expect(leggi('app/lib/locales/en.js')).toContain(`"${k}":"`);
  });
});
