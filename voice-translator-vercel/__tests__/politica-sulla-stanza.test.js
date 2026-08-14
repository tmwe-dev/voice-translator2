// ═══════════════════════════════════════════════════════════════
// TRE SISTEMI DESCRIVEVANO LA STESSA STANZA (b.125)
//
// Alla domanda "perche c'e ambiguita fra sistemi paralleli?" la
// risposta piu onesta non e una spiegazione: e questo difetto, che
// dall'ambiguita nasce in modo diretto e si puo provare.
//
// ── LA CATENA ──
//
// L'host spunta "litigio libero" creando una stanza Community. Quel
// valore finisce in DUE posti:
//
//     /api/mondo   ->  entry.hot          (la voce della vetrina)
//     moderazione  ->  salvaRegole(hot)   (le regole di ingresso)
//
// e in nessuno dei due la chat va a guardare. MessageList decide se
// velare le parole pesanti cosi:
//
//     <ForseVelato hot={!!roomInfo?.hot} ...>
//
// e `roomInfo` arriva da `roomPolling.roomInfo`, cioe dall'OGGETTO
// STANZA di store.js — dove `hot` non e mai stato scritto.
//
//     createRoom -> created host hostTier hostEmail members context
//                   contextPrompt description totalCost msgCount
//                   diretta ended
//
// Nessun `hot`. Quindi `roomInfo?.hot` e sempre `undefined`, il velo
// si applica sempre, e le stanze "litigio libero" non lo sono mai
// state.
//
// ── PERCHE E LA PROVA DELL'AMBIGUITA ──
//
// Non c'e un pezzo scritto male. La casella nella UI funziona. Il
// campo si salva. Due volte, perfino. La vetrina mostra il
// contrassegno. La moderazione lo legge. Ogni pezzo, preso da solo,
// fa il suo mestiere.
//
// Ma la cosa che l'utente GUARDA legge da un quarto posto, e in quel
// posto la sua scelta non e mai arrivata. Quando la stessa entita e
// descritta in piu sistemi, prima o poi qualcuno legge quello
// sbagliato — e non se ne accorge nessuno, perche non c'e un errore:
// c'e solo una cosa che non succede.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('la stanza conosce la propria politica', () => {
  it('esiste il modo di scriverla, ed e atomico', () => {
    // Leggi-modifica-riscrivi da fuori perderebbe gli aggiornamenti
    // concorrenti: due host che pubblicano insieme, uno vince e
    // l'altro sparisce. La regola della base di codice da b.59.
    const lua = leggi('app/lib/redisLua.js');
    expect(lua).toMatch(/export const AGGIORNA_POLITICA_PUBBLICA = `/);
    expect(lua).toMatch(/room\.hot = ARGV\[1\] == '1'/);
    const s = senzaCommenti(leggi('app/lib/store.js'));
    expect(s).toMatch(/export async function aggiornaPoliticaPubblica/);
    expect(s).toMatch(/redis\('EVAL', AGGIORNA_POLITICA_PUBBLICA/);
  });

  it('e la vetrina la scrive anche sulla stanza, non solo su di se', () => {
    const m = senzaCommenti(leggi('app/api/mondo/route.js'));
    expect(m).toMatch(/aggiornaPoliticaPubblica\(roomId, \{/);
    expect(m).toMatch(/hot: entry\.hot/);
  });

  it('continua a scriverla anche nelle regole di moderazione', () => {
    // Le due scritture servono a cose diverse: la moderazione decide
    // chi ENTRA, la stanza decide cosa si VEDE. Toglierne una per
    // "semplificare" romperebbe l'altra.
    const m = senzaCommenti(leggi('app/api/mondo/route.js'));
    expect(m).toMatch(/salvaRegole\(roomId, \{/);
  });

  it('se la scrittura fallisce, la stanza resta usabile ma si annota', () => {
    // Bloccare la pubblicazione per questo sarebbe peggio del difetto.
    // Ma tacere e come e nato il problema.
    const m = leggi('app/api/mondo/route.js');
    const i = m.indexOf('aggiornaPoliticaPubblica');
    expect(m.slice(i, i + 600)).toMatch(/log\.warn\(/);
  });
});

describe('quello che l\'utente guarda legge dove l\'utente ha scelto', () => {
  it('la chat continua a leggere hot dalla stanza', () => {
    // Non si cambia il lettore: si fa arrivare il dato dove gia guarda.
    expect(leggi('app/components/MessageList.js')).toMatch(/hot=\{!!roomInfo\?\.hot\}/);
  });

  it('e ora quel campo puo esistere davvero', () => {
    // Prima questo test sarebbe stato impossibile da scrivere: non
    // c'era nessun punto in cui `room.hot` venisse impostato.
    const lua = leggi('app/lib/redisLua.js');
    const i = lua.indexOf('AGGIORNA_POLITICA_PUBBLICA');
    const corpo = lua.slice(i, i + 700);
    for (const campo of ['room.hot', 'room.roomType', 'room.maxPartecipanti', 'room.suApprovazione']) {
      // `toMatch` con una stringa confronta alla lettera, non come
      // espressione: sfuggire il punto ci faceva cercare `room\.hot`,
      // che nel sorgente non c'e. `toContain` dice cosa si intende.
      expect(corpo, `manca ${campo}`).toContain(campo);
    }
  });

  it('il velo si toglie solo se hot e vero', () => {
    // La regola in velo.js non cambia: cambia il fatto che ora possa
    // ricevere un valore invece di undefined.
    expect(leggi('app/lib/velo.js')).toMatch(/if \(opzioni\.hot\) return \{ velare: false/);
  });
});
