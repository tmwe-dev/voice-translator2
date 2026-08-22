// ═══════════════════════════════════════════════════════════════
// L'INVITATO DOVEVA COMPILARE UN MODULO PER DIRE "CIAO" (b.133)
//
// Luca, provando l'invito da un secondo telefono:
//
//   "non deve fare niente, deve solo aprire la pagina e scrivere
//    direttamente. il campo nome non accetta piu di un carattere e ti
//    butta fuori dal campo."
//
// Due difetti diversi, sovrapposti, che si nascondevano a vicenda.
//
// ── PRIMO: IL CAMPO NOME PERDEVA IL FUOCO A OGNI LETTERA ──
//
// `GlassCard` e `PrimaryBtn` erano definiti DENTRO il corpo di JoinView.
// Ogni tasto premuto cambiava `prefs` → JoinView si ridisegnava → quelle
// due funzioni venivano ricreate → per React erano COMPONENTI NUOVI, non
// gli stessi con proprieta diverse → smontava e rimontava tutto il
// sottoalbero, campo di testo compreso.
//
// Da fuori sembrava un limite di un carattere. Era il campo che moriva
// e rinasceva vuoto, senza fuoco, dopo ogni lettera.
//
// ── SECONDO: IL MODULO NON DOVEVA ESSERCI ──
//
// E la parte piu importante, perche il primo difetto era visibile solo
// grazie al secondo: un invitato non doveva vedere nessun campo nome.
//
// Due cancelli lo tenevano fuori:
//
//   1. `auto=1` — l'ingresso automatico partiva solo con quel parametro,
//      che mettono solo i QR generati da noi. Un link incollato in una
//      chat non ce l'ha. Ed e il modo piu comune di invitare qualcuno.
//
//   2. `prefs.gender` — la schermata di ingresso rapido lo esigeva.
//      Arriva solo da `gg=`, un altro parametro dei nostri QR. Il genere
//      serve a scegliere una voce: e una preferenza, non un documento.
//
// Chi non passava tutti e due i cancelli finiva nelle tre schermate di
// presentazione. Invitato a parlare, messo a compilare.
//
// ── PERCHE NESSUN TEST L'AVEVA VISTO ──
//
// Stessa forma di b.128 e b.130: ogni pezzo, da solo, e corretto. Il
// modulo funziona, l'ingresso automatico funziona, il QR funziona. E il
// percorso reale — un link condiviso a mano, aperto da uno sconosciuto —
// non passava da nessuno dei pezzi collaudati.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('il campo nome sopravvive a piu di una lettera', () => {
  const righe = () => leggi('app/components/JoinView.js').split('\n');

  it('GlassCard e PrimaryBtn nascono FUORI da JoinView', () => {
    // E l'unica cosa che conta: definiti dentro, React li considera
    // componenti nuovi a ogni battuta e butta via il campo di testo.
    const r = righe();
    const iCard = r.findIndex((l) => /^function GlassCard\(/.test(l));
    const iBtn = r.findIndex((l) => /^function PrimaryBtn\(/.test(l));
    const iView = r.findIndex((l) => /^export default function JoinView\(/.test(l));

    expect(iCard, 'GlassCard deve stare a livello di modulo').toBeGreaterThan(-1);
    expect(iBtn, 'PrimaryBtn deve stare a livello di modulo').toBeGreaterThan(-1);
    expect(iCard, 'GlassCard PRIMA di JoinView, non dentro').toBeLessThan(iView);
    expect(iBtn, 'PrimaryBtn PRIMA di JoinView, non dentro').toBeLessThan(iView);
  });

  it('e ricevono i colori come proprieta, non dalla chiusura', () => {
    // Erano funzioni annidate proprio per pescare `C` e `FONT` dal corpo
    // di JoinView. Spostandole fuori vanno passati, altrimenti tornano
    // dentro alla prima modifica.
    const s = senzaCommenti(leggi('app/components/JoinView.js'));
    expect(s).toMatch(/function GlassCard\(\{ children, style = \{\}, C \}\)/);
    // `style = {}` contiene una graffa: si guarda la riga intera, non
    // si prova a delimitare la lista delle proprieta con [^}].
    expect(s).toMatch(/function PrimaryBtn\(\{ onClick, disabled, children, style = \{\}, C, FONT \}\)/);
  });
});

describe('chi apre un invito entra, non compila', () => {
  const init = () => senzaCommenti(leggi('app/hooks/useInitializeApp.js'));

  it('l\'ingresso automatico non dipende piu da auto=1', () => {
    // Il parametro lo mettevano solo i nostri QR. Un link condiviso a
    // mano arrivava senza, e l'ospite finiva nelle tre schermate.
    const s = init();
    expect(s, 'non deve esistere un ramo che esige auto=1')
      .not.toMatch(/const autoJoin = urlParams\.get\('auto'\)/);
    expect(s, 'e nessuna condizione if (autoJoin)').not.toMatch(/if \(autoJoin\)/);
  });

  it('ma il codice stanza resta la condizione, non si entra a vuoto', () => {
    const s = init();
    const i = s.indexOf('if (roomParam) {');
    expect(i, 'l\'ingresso vive dentro il ramo del codice stanza').toBeGreaterThan(-1);
    expect(s.slice(i, i + 2600)).toMatch(/setAutoJoinTriggered\(true\)/);
  });

  it('e a chi non ha un nome se ne da uno provvisorio', () => {
    // Senza nome l\'avvio in page.js non scatta: e gia gated su prefs.name.
    expect(init()).toMatch(/const nomeOspite = guestNameParam[\s\S]{0,120}'Ospite'/);
  });
});

describe('il genere non e una chiave d\'ingresso', () => {
  it('non serve piu per saltare le tre schermate', () => {
    // Arrivava solo da `gg=`. Serve a scegliere una voce: si imposta
    // dopo, con la conversazione gia aperta.
    const s = senzaCommenti(leggi('app/components/JoinView.js'));
    // b.389 — la riga chiedeva la condizione ESATTA, e da oggi ne ha un
    // pezzo in piu: l'invito aperto sullo stesso browser dell'host torna
    // a chiedere chi sei. Quello che questa prova deve difendere non e
    // com'e scritta la condizione, ma che il GENERE non ci sia dentro:
    // arrivava solo dai nostri QR e teneva fuori gli ospiti veri.
    expect(s).toMatch(/const isPrefilled = prefs\.name && isInvited/);
    expect(s, 'il genere non deve comparire nella condizione')
      .not.toMatch(/const isPrefilled = [^;]*prefs\.gender/);
  });

  it("ma l'invito aperto sullo stesso browser dell'host torna a chiedere (b.389)", () => {
    // Il difetto: si entrava come l'host, tutti i messaggi marcati «Tu»,
    // e la lobby ferma su «In attesa del partner» perche il partner era
    // lui stesso.
    const s = leggi('app/components/JoinView.js');
    expect(s, 'si riconosce la collisione').toMatch(/collisioneHost/);
    expect(s, "e si controlla il segreto dell'host").toMatch(/vt-host-secrets/);
    expect(s, "l'ingresso automatico si ferma solo li")
      .toMatch(/const entraDaSolo = [^;]*!collisioneHost/);
  });
});

describe('mentre si entra non si mostra il modulo', () => {
  const s = () => senzaCommenti(leggi('app/components/JoinView.js'));

  it('c\'e un ramo che precede sia il modulo sia il bottone', () => {
    // L'avvio di page.js impiega 600 ms. In quei 600 ms la vecchia
    // versione disegnava le domande: l'ospite le VEDEVA comunque.
    const t = s();
    const iEntra = t.indexOf('if (entraDaSolo && !ingressoBloccato)');
    const iBottone = t.indexOf('if (isInvited && isPrefilled)');
    expect(iEntra, 'il ramo deve esistere').toBeGreaterThan(-1);
    expect(iEntra, 'e venire PRIMA di quello col bottone').toBeLessThan(iBottone);
  });

  it('e basta un invito con un nome, niente altro', () => {
    expect(s()).toMatch(/const entraDaSolo = isInvited && !!String\(prefs\.name \|\| ''\)\.trim\(\)/);
  });

  it('se l\'avvio di page.js non parte, si entra da qui', () => {
    // Ripiego, non doppione: se il timer di page.js ha funzionato questo
    // componente e gia smontato e il suo timer muore con lui.
    const t = s();
    const i = t.indexOf('const entraDaSolo =');
    const corpo = t.slice(i, i + 1200);
    expect(corpo).toMatch(/ingressoRef\.current/);
    expect(corpo).toMatch(/handleJoinRoom\(\)/);
    expect(corpo).toMatch(/clearTimeout\(ripiego\)/);
  });

  it('e non si resta a girare per sempre se l\'ingresso fallisce', () => {
    // Stanza piena, codice scaduto, rete assente: dopo otto secondi si
    // ridanno i comandi invece di mostrare un cerchio eterno.
    const t = s();
    const i = t.indexOf('const entraDaSolo =');
    expect(t.slice(i, i + 1200)).toMatch(/setIngressoBloccato\(true\)/);
  });

  it('e l\'ingresso non viene chiesto due volte', () => {
    // Un secondo JOIN_ROOM mentre il primo e in volo puo far contare due
    // volte lo stesso ospite verso il limite di dieci.
    const t = s();
    const i = t.indexOf('const entraDaSolo =');
    const corpo = t.slice(i, i + 1200);
    expect(corpo).toMatch(/if \(!entraDaSolo \|\| ingressoRef\.current\) return;/);
  });
});
