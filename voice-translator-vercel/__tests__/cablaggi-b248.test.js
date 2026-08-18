// ═══════════════════════════════════════════════════════════════
// b.248 — Quattro cablaggi rotti fra chi possiede un valore e chi lo usa.
//
//  1. Il server genera codici stanza di OTTO caratteri esadecimali
//     (randomBytes(4).toString('hex'), store.js), ma il campo di
//     inserimento manuale ne accettava SEI: un codice reale come
//     A4F72C19 non si poteva digitare per intero. Mai.
//  2. TalkControls leggeva il gettone di stanza da
//     webrtc.roomSessionTokenRef, che useWebRTC riceve come PARAMETRO
//     ma non espone mai nel suo return: alzata di mano e concessione
//     della parola partivano con token null → 401 su /api/room.
//  3. RoomView passava userToken={null} alle azioni AI della chat, ma
//     /api/chat-action autentica proprio con resolveAuth({userToken,
//     lendingCode}): anche un utente loggato riceveva 401.
//  4. Il dialogo "Porta i tuoi amici" (InvitaAmici) non aveva nessuna
//     via d'uscita standard: niente Escape, niente chiusura dal velo,
//     e l'unico bottone che chiudeva era senza aria-label — il collaudo
//     dal vivo lo ha trovato aperto sopra la home, inchiodato.
//
// NOTA ONESTA: questi test leggono il codice, non aprono un browser.
// Provano che i fili ora vanno dal posto giusto al posto giusto; che i
// gesti funzionino davvero lo dice il collaudo dal vivo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
// Un difetto CITATO in un commento non e quel difetto: si controlla
// il codice, non la sua spiegazione.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ─── 1 · Il campo del codice stanza tiene un codice intero ───
describe('il codice stanza da 8 caratteri entra nel campo', () => {
  it('il server genera DAVVERO 8 caratteri (contati, non creduti)', () => {
    // La stessa espressione di createRoom (store.js): 4 byte in hex.
    const codice = randomBytes(4).toString('hex').toUpperCase();
    expect(codice).toHaveLength(8);
    const store = senzaCommenti(leggi('app/lib/store.js'));
    expect(store).toContain("const id = randomBytes(4).toString('hex').toUpperCase()");
  });

  it('il campo manuale accetta 8 caratteri, non piu 6', () => {
    const s = senzaCommenti(leggi('app/components/JoinView.js'));
    expect(s).toContain('value={joinCode} maxLength={8}');
    // Il difetto: il tetto a 6 sul campo del codice stanza.
    expect(s).not.toContain('value={joinCode} maxLength={6}');
  });

  it('e il placeholder mostra la forma vera del codice (8 esadecimali)', () => {
    const s = senzaCommenti(leggi('app/components/JoinView.js'));
    expect(s).toMatch(/placeholder="[0-9A-F]{8}" value=\{joinCode\}/);
  });
});

// ─── 2 · Il gettone di classroom arriva da chi lo possiede ───
describe('alzata di mano e concessione parola col gettone VERO', () => {
  const talk = () => senzaCommenti(leggi('app/components/TalkControls.js'));

  it('il difetto e ancora vero alla fonte: useWebRTC non espone roomSessionTokenRef', () => {
    const hook = senzaCommenti(leggi('app/hooks/useWebRTC.js'));
    const inizioReturn = hook.lastIndexOf('return {');
    expect(inizioReturn, 'il return pubblico di useWebRTC deve esistere').toBeGreaterThan(-1);
    // Se un giorno l'hook lo esponesse, questo controllo va aggiornato:
    // oggi NON lo espone, ed e per questo che leggerlo da webrtc dava null.
    expect(hook.slice(inizioReturn)).not.toContain('roomSessionTokenRef');
  });

  it('TalkControls non pesca piu il gettone dal posto che non esiste', () => {
    expect(talk()).not.toContain('webrtc?.roomSessionTokenRef');
  });

  it('raiseHand e grantSpeak usano la prop roomSessionToken', () => {
    const s = talk();
    const occorrenze = s.match(/roomSessionToken: roomSessionToken \|\| null/g) || [];
    expect(occorrenze, 'una per raiseHand, una per grantSpeak').toHaveLength(2);
    // E la prop e dichiarata nella firma del componente (prima del corpo).
    const firma = s.slice(0, s.indexOf('}) {'));
    expect(firma).toContain('roomSessionToken,');
  });

  it('RoomView gliela passa, dalla stessa catena di reazioni e moderazione', () => {
    const s = senzaCommenti(leggi('app/components/RoomView.js'));
    const iTalk = s.indexOf('<TalkControls');
    expect(iTalk).toBeGreaterThan(-1);
    expect(s.slice(iTalk, s.indexOf('/>', iTalk))).toContain('roomSessionToken={roomSessionToken}');
  });
});

// ─── 3 · Le azioni AI della chat viaggiano autenticate ───
describe('le azioni AI della chat non partono piu a mani vuote', () => {
  it('il server autentica DAVVERO con userToken/lendingCode e senza risponde 401', () => {
    const rotta = senzaCommenti(leggi('app/api/chat-action/route.js'));
    expect(rotta).toContain('const auth = await resolveAuth({');
    expect(rotta).toContain('userToken,');
    expect(rotta).toContain('lendingCode,');
    expect(rotta).toContain("{ error: 'Authentication required' }, { status: 401 }");
  });

  it('RoomView non cabla piu userToken={null} sul pannello', () => {
    const s = senzaCommenti(leggi('app/components/RoomView.js'));
    expect(s).not.toContain('userToken={null}');
    const iPanel = s.indexOf('<ChatActionsPanel');
    expect(iPanel).toBeGreaterThan(-1);
    expect(s.slice(iPanel, s.indexOf('/>', iPanel))).toContain('userToken={userToken}');
  });

  it('e il gettone vero parte da page.js (auth.userToken) verso RoomView', () => {
    const s = senzaCommenti(leggi('app/page.js'));
    const iRoom = s.indexOf('<RoomView');
    expect(iRoom).toBeGreaterThan(-1);
    expect(s.slice(iRoom, s.indexOf('/>', iRoom))).toContain('userToken={auth.userToken}');
  });

  it('il pannello inoltra al server proprio cio che riceve', () => {
    const s = senzaCommenti(leggi('app/components/ChatActionsPanel.js'));
    expect(s).toContain("fetch('/api/chat-action'");
    expect(s).toContain('userToken,');
  });
});

// ─── 4 · "Porta i tuoi amici" si chiude come ogni altro modale ───
describe('il dialogo InvitaAmici ha tutte le vie di uscita', () => {
  const inv = () => senzaCommenti(leggi('app/components/InvitaAmici.js'));

  it('Escape chiude (ascoltato solo mentre e aperto, e si stacca)', () => {
    const s = inv();
    expect(s).toMatch(/e\.key === 'Escape'.*onClose\(\)/);
    expect(s).toContain("window.addEventListener('keydown'");
    expect(s).toContain("window.removeEventListener('keydown'");
  });

  it('il tocco sul velo chiude, la carta no (convenzione degli altri modali)', () => {
    const s = inv();
    // Il velo: role="dialog" con onClick={onClose}.
    expect(s).toMatch(/role="dialog" aria-modal="true" onClick=\{onClose\}/);
    // La carta ferma la propagazione, come in JoinView e ChatActionsPanel.
    expect(s).toContain('onClick={e => e.stopPropagation()}');
  });

  it('il bottone che chiude ora ha un aria-label esplicito', () => {
    // Era il motivo per cui il collaudo automatico non lo trovava: il
    // bottone c'era (invitaDopo, "Piu tardi") ma senza aria-label.
    expect(inv()).toMatch(/onClose\(\); \}\} aria-label=\{L\('close'\)\}/);
  });
});
