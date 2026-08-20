// ═══════════════════════════════════════════════════════════════
// b.167 — Verifica dell'audit esterno del 15/8
//
// L'utente ha incollato un audit esterno completo (4 P0 + una lista di
// P1/P2). Ogni punto e stato verificato leggendo il codice reale prima
// di correggere (regola 5 di CLAUDE.md): P0-4 (mondo) e il P1 sulle
// apiKeys in chiaro erano gia risolti in b.166; il "bug Qwen" di Chat
// Action era gia risolto in b.160 (l'audit ha letto uno snapshot vecchio
// o si e confuso). Qui si verificano SOLO i punti confermati e corretti
// in questo round: P0-1 (Direct Mode solo via header), P0-2 (hostTier
// dichiarato dal client), logout che non revoca la sessione server,
// "blocca" che non espelle chi e gia dentro.
//
// P0-3 (join con lo stesso nome dell'host → ruolo host) e confermato ma
// NON corretto qui: tocca il flusso di reconnect dell'host, che oggi
// funziona, e non si puo verificare senza un collaudo dal vivo a due
// dispositivi (CLAUDE.md, punto 2 e punto 8) — resta in attesa della
// decisione del prodotto su come autenticare il reconnect.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('P0-1: Direct Mode non si fida piu solo dell\'intestazione client', () => {
  const ROTTE_CON_STANZA = [
    'app/api/translate/route.js',
    'app/api/transcribe/route.js',
    'app/api/tts/route.js',
    'app/api/tts-edge/route.js',
    'app/api/chat-action/route.js',
    'app/api/translate-free/route.js',
    'app/api/summary/route.js',
    'app/api/stt-token/route.js',
    'app/api/translate-consensus/route.js',
    'app/api/tts-elevenlabs/route.js',
  ];

  it('tutte usano la guardia autorevole (chiede alla stanza, non solo all\'intestazione)', () => {
    for (const rotta of ROTTE_CON_STANZA) {
      const src = leggi(rotta);
      expect(src, rotta).toContain('assertElaborazioneConsentita');
      expect(src, rotta).not.toContain('assertCloudProcessingAllowed');
    }
  });

  it('/api/messages e /api/conversation restano quelle gia corrette (eDiretta sulla stanza vera)', () => {
    // L'audit stesso lo segnala come gia fatto bene: nessuna modifica
    // necessaria, verifica solo che non sia regredito.
    const messages = leggi('app/api/messages/route.js');
    expect(messages).toContain('eDiretta(room)');
    const conversation = leggi('app/api/conversation/route.js');
    expect(conversation).toContain('eDiretta(room)');
  });

  it('/api/tts-edge ora riceve roomId/roomSessionToken dai tre hook che parlano da dentro una stanza', () => {
    // useTTSEngine.js chiama /api/tts-edge due volte: la prima (riga ~49)
    // e un prewarm con testo finto ('.'), a cui roomId non serve. Quella
    // che conta e dentro fetchEdgeTTSBlob, che manda il testo vero.
    const engine = leggi('app/hooks/useTTSEngine.js');
    const iFn = engine.indexOf('async function fetchEdgeTTSBlob');
    const iFetch = engine.indexOf("fetch('/api/tts-edge'", iFn);
    expect(iFetch).toBeGreaterThan(iFn);
    const bloccoEngine = engine.slice(iFetch, iFetch + 550);
    expect(bloccoEngine).toContain('roomId');
    expect(bloccoEngine).toContain('roomSessionToken');

    for (const hook of ['app/hooks/useInterpreterMode.js', 'app/hooks/useStreamingInterpreter.js']) {
      const src = leggi(hook);
      // b.352 — l'interprete ora ha PIU motori (edge + premium con ripiego):
      // la rotta edge non e piu in una fetch fissa ma nell'elenco dei motori.
      const i = src.indexOf("'/api/tts-edge'");
      expect(i, hook).toBeGreaterThan(-1);
      // b.352 — nello streaming la voce passa da chiediVoce (piu motori con
      // ripiego): i pegni di stanza stanno nel corpo comune costruito li,
      // qualche riga PRIMA dell'elenco delle rotte. Si controlla la
      // FUNZIONE intera, non le righe subito dopo la stringa.
      const inizio = Math.max(0, src.lastIndexOf('const base', i));
      const blocco = src.slice(Math.min(inizio, i), i + 500);
      expect(blocco, hook).toContain('roomId');
      expect(blocco, hook).toContain('roomSessionToken');
    }
  });

  it('ChatActionsPanel manda roomId/roomSessionToken, RoomView glieli passa', () => {
    const panel = leggi('app/components/ChatActionsPanel.js');
    expect(panel).toContain('roomId,');
    expect(panel).toContain('roomSessionToken,');
    const roomView = leggi('app/components/RoomView.js');
    const i = roomView.indexOf('<ChatActionsPanel');
    const blocco = roomView.slice(i, i + 300);
    expect(blocco).toContain('roomId={roomId}');
    expect(blocco).toContain('roomSessionToken={roomSessionToken}');
  });

  it('/api/summary usa convId come roomId (stessa chiave, vedi saveConversation)', () => {
    const src = leggi('app/api/summary/route.js');
    expect(src).toContain('assertElaborazioneConsentita(req, { roomId: convId })');
  });
});

describe('P0-2: hostTier non arriva piu dal client dichiarato', () => {
  const src = leggi('app/api/room/route.js');

  it('tierDallaSessione ricava il livello dalla sessione, non da body.hostTier', () => {
    expect(src).toContain('async function tierDallaSessione(userToken)');
    expect(src).toContain('hostTier: await tierDallaSessione(body.userToken)');
    expect(src).not.toContain('hostTier: body.hostTier');
  });

  it('senza sessione valida il livello e sempre FREE', () => {
    const i = src.indexOf('async function tierDallaSessione');
    const blocco = src.slice(i, src.indexOf('\n}', i));
    expect(blocco).toContain("if (!userToken || typeof userToken !== 'string') return 'FREE';");
    expect(blocco).toContain("if (!sessione?.email) return 'FREE';");
    expect(blocco).toContain("if (!utente) return 'FREE';");
  });

  it('TOP PRO solo per gli account business/top_pro, stesso criterio del client (useAuth.js)', () => {
    const i = src.indexOf('async function tierDallaSessione');
    const blocco = src.slice(i, src.indexOf('\n}', i));
    expect(blocco).toContain("livelloAccount === 'business' || livelloAccount === 'top_pro'");
    const clientSrc = leggi('app/hooks/useAuth.js');
    // b.263 — al criterio di CONTO si aggiunge l'eredita dalla stanza
    // (l'ospite di una stanza TOP PRO usa la voce premium dell'host).
    // Qui si verifica il criterio sul conto, che non deve cambiare.
    expect(clientSrc).toContain("tier === 'business' || tier === 'top_pro'");
  });
});

describe('Logout: la sessione server viene revocata, non solo lo stato locale', () => {
  it('/api/auth espone l\'azione logout e chiama deleteSession', () => {
    const src = leggi('app/api/auth/route.js');
    expect(src).toContain('deleteSession');
    const i = src.indexOf("action === 'logout'");
    expect(i).toBeGreaterThan(-1);
    const blocco = src.slice(i, i + 150);
    expect(blocco).toContain('await deleteSession(token)');
  });

  it('useAuth.js chiama /api/auth con action logout PRIMA di pulire lo stato locale', () => {
    const src = leggi('app/hooks/useAuth.js');
    const iFn = src.indexOf('function logout(opts = {})');
    expect(iFn).toBeGreaterThan(-1);
    const iFetch = src.indexOf("action: 'logout'", iFn);
    const iRemove = src.indexOf("memDel('vt-token')", iFn);
    expect(iFetch, 'la chiamata al server deve esserci').toBeGreaterThan(-1);
    expect(iFetch).toBeLessThan(iRemove);
  });
});

describe('"Blocca" espelle davvero chi e gia dentro la stanza', () => {
  it('blocca() in moderazione.js chiama removeMember dopo aver scritto la blacklist', () => {
    const src = leggi('app/lib/moderazione.js');
    const i = src.indexOf('export async function blocca');
    const blocco = src.slice(i, src.indexOf('\nexport async function sblocca'));
    const iSadd = blocco.indexOf("redis('SADD'");
    const iRemove = blocco.indexOf('removeMember(roomId, nome)');
    expect(iSadd).toBeGreaterThan(-1);
    expect(iRemove).toBeGreaterThan(iSadd);
  });

  it('store.js espone removeMember, basato sullo script Lua REMOVE_MEMBER', () => {
    const src = leggi('app/lib/store.js');
    expect(src).toContain('export async function removeMember(roomId, name)');
    expect(src).toContain("redis('EVAL', REMOVE_MEMBER");
  });

  it('REMOVE_MEMBER toglie SOLO il membro cercato (confronto case-insensitive), nient\'altro', () => {
    const src = leggi('app/lib/redisLua.js');
    const i = src.indexOf('export const REMOVE_MEMBER');
    const blocco = src.slice(i, src.indexOf('`;', i));
    expect(blocco).toContain('string.lower(m.name) == target');
    expect(blocco).toContain('if not trovato then return nil end');
  });
});
