// ═══════════════════════════════════════════════════════════════
// UNDICI CORREZIONI IN UN FIATO (b.126)
//
// I punti aperti dell'audit esterno, verificati e corretti uno per uno.
// Quasi tutti hanno la stessa forma: non un pezzo scritto male, ma una
// cosa identificata per quello che SEMBRA invece che per quello che E —
// il contenuto invece dell'id, il nome invece dell'identita, l'ordine
// dei rami invece della loro specificita.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CAPIENZA } from '../app/lib/decisioni.js';
import { JOIN_ROOM as JOIN_ROOM_GENERATO } from '../app/lib/redisLua.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|--).*$/gm, '');

describe('1 · nessuno viene buttato fuori in silenzio', () => {
  const lua = () => senzaCommenti(leggi('app/lib/redisLua.js'));

  it('la stanza piena si dichiara, non si fa posto', () => {
    // Prima l'undicesimo prendeva il posto di un partecipante gia
    // dentro: quello sostituito teneva il gettone ma spariva da
    // room.members, e scopriva di essere fuori dai 403 che iniziava a
    // ricevere. Espulso da una conversazione mentre ci parlava.
    const s = lua();
    expect(s).toMatch(/return 'PIENA'/);
    expect(s, 'nessuna sostituzione di membri').not.toMatch(/room\.members\[i\] = \{name=name/);
  });

  it('e il tetto e quello scelto dall\'host, non 10 fisso', () => {
    // La UI ne prometteva fino a 20, Redis ne teneva 10.
    //
    // b.139-bis — il numero non e piu scritto dentro il Lua: veniva da
    // li e da altri due posti, e i tre non concordavano. Ora lo script
    // se lo fa interpolare da CAPIENZA (decisioni.js), quindi si
    // controlla il sorgente Lua GENERATO, non il modello.
    expect(lua()).toContain('tonumber(room.maxPartecipanti) or ${CAPIENZA.PREDEFINITA}');
    expect(JOIN_ROOM_GENERATO).toContain('tonumber(room.maxPartecipanti) or 20');
  });

  it('chi arriva a stanza piena riceve 409, non un posto altrui', () => {
    const r = senzaCommenti(leggi('app/lib/roomActions.js'));
    expect(r).toMatch(/room\.piena/);
    expect(r).toMatch(/status: 409/);
  });
});

describe('2 · un messaggio si identifica col suo id', () => {
  it('l\'aggiornamento cerca per identificativo prima che per testo', () => {
    // Due "si" di fila dello stesso utente sono indistinguibili: la
    // traduzione del primo, arrivando tardi, finiva sul secondo.
    const s = senzaCommenti(leggi('app/lib/redisLua.js'));
    const i = s.indexOf('local messageId = ARGV[6]');
    expect(i, 'il messageId deve arrivare').toBeGreaterThan(-1);
    // b.166 — CONFERMATO (caccia al tesoro): la ricerca per id ora
    // richiede ANCHE che il messaggio trovato appartenga a chi sta
    // facendo la PATCH (m.sender == sender) — altrimenti un membro
    // qualunque poteva riscrivere la traduzione del messaggio di un
    // altro (il clientId non e segreto, torna a tutti via polling).
    expect(s.slice(i, i + 500)).toMatch(/if m\.clientId == messageId and m\.sender == sender then/);
  });

  it('il ripiego sul contenuto resta, per i client vecchi', () => {
    // Toglierlo avrebbe rotto la fase 2 di chi non manda ancora l'id.
    expect(senzaCommenti(leggi('app/lib/redisLua.js')))
      .toMatch(/if m\.sender == sender and m\.original == original then/);
  });

  it('e il client lo manda', () => {
    const c = senzaCommenti(leggi('app/hooks/useTranslationAPI.js'));
    expect(c).toMatch(/idSpedizioneRef/);
    expect(c).toMatch(/clientId: idSpedizioneRef\.current\.get\(original\)/);
  });

  it('il registro delle spedizioni non cresce all\'infinito', () => {
    // Una mappa che cresce sempre e una perdita di memoria con un altro
    // nome — stessa regola della posta in uscita (b.111).
    expect(senzaCommenti(leggi('app/hooks/useTranslationAPI.js')))
      .toMatch(/idSpedizioneRef\.current\.size > 50/);
  });
});

describe('3 · due messaggi uguali non sono un doppione', () => {
  const m = () => senzaCommenti(leggi('app/api/messages/route.js'));

  it('il doppione si riconosce dall\'identificativo della spedizione', () => {
    // "si" / "sei sicuro?" / "si" entro otto secondi e una conversazione
    // normale: il secondo "si" spariva.
    expect(m()).toMatch(/gemello = recenti\.find\(\(m\) => m\.clientId === clientId\)/);
  });

  it('e senza identificativo la finestra e stretta', () => {
    const s = m();
    expect(s).toMatch(/Date\.now\(\) - 1500/);
    expect(s, 'la vecchia finestra larga non decide piu da sola')
      .not.toMatch(/recenti\.find\(m => m\.sender === identity\.name && m\.original === original\)/);
  });
});

describe('4 · il riassunto non accorcia la vita dell\'archivio', () => {
  it('si conserva la scadenza che c\'era', () => {
    // Salvata a 7 giorni, il riassunto la riscriveva a 1: dopo 24 ore
    // compariva ancora nell'elenco e aprirla dava "non trovata".
    const s = senzaCommenti(leggi('app/lib/redisLua.js'));
    const i = s.indexOf('conv.summary = ARGV[1]');
    const corpo = s.slice(i, i + 400);
    expect(corpo).toMatch(/local ttl = redis\.call\('TTL', KEYS\[1\]\)/);
    expect(corpo, 'niente scadenza imposta a mano').not.toMatch(/'EX', 86400/);
  });
});

describe('5 · archivio: riprendere, condividere, eliminare', () => {
  const p = () => senzaCommenti(leggi('app/page.js'));

  it('Riprendi e Condividi usano `id`, che E il codice della stanza', () => {
    // Chiedevano `roomId`, che una conversazione salvata non ha: la
    // condizione era sempre falsa e i due pulsanti non funzionavano mai.
    const s = p();
    expect(s, 'nessun controllo su roomId').not.toMatch(/detailConversation\?\.roomId/);
    expect(s).toMatch(/onResume=\{detailConversation\?\.id/);
  });

  it('Elimina esiste davvero, lato server', () => {
    const c = senzaCommenti(leggi('app/api/conversation/route.js'));
    expect(c).toMatch(/action === 'delete'/);
    expect(senzaCommenti(leggi('app/lib/store.js'))).toMatch(/export async function deleteConversation/);
  });

  it('e cancella anche dagli elenchi degli ALTRI partecipanti', () => {
    // Lasciarla nei loro elenchi vorrebbe dire mostrargli una
    // conversazione che non si apre piu.
    const s = senzaCommenti(leggi('app/lib/store.js'));
    const i = s.indexOf('export async function deleteConversation');
    expect(s.slice(i, i + 1200)).toMatch(/for \(const membro of conv\.members/);
  });

  it('solo chi c\'era puo cancellare', () => {
    const s = senzaCommenti(leggi('app/lib/store.js'));
    const i = s.indexOf('export async function deleteConversation');
    expect(s.slice(i, i + 800)).toMatch(/non-partecipante/);
  });

  it('e il client controlla la risposta', () => {
    // Prima non guardava `res.ok`: il server rifiutava e l'utente
    // vedeva la schermata tornare indietro come se fosse riuscito.
    expect(p()).toMatch(/if \(!res\.ok\)[\s\S]{0,260}L\('cannotDelete'\)/);
  });
});

describe('6 · /api/room non consegna l\'oggetto interno', () => {
  const r = () => senzaCommenti(leggi('app/api/room/route.js'));

  it('senza gettone esce una scheda pubblica', () => {
    const s = r();
    expect(s).toMatch(/membersCount:/);
    expect(s).toMatch(/langs:/);
  });

  it('e i campi delicati restano dentro', () => {
    const s = r();
    const i = s.indexOf('return NextResponse.json({\n      room: {');
    const scheda = s.slice(i, i + 900);
    for (const campo of ['hostEmail', 'contextPrompt', 'totalCost']) {
      expect(scheda, `${campo} non deve uscire a chi non e nella stanza`).not.toContain(campo);
    }
  });

  it('chi e dentro vede tutto: ha un gettone per QUESTA stanza', () => {
    expect(r()).toMatch(/if \(dentro\) return NextResponse\.json\(\{ room \}\)/);
  });
});

describe('7 · il router dei fornitori non ha piu rami morti', () => {
  const pr = () => senzaCommenti(leggi('app/lib/providerRouter.js'));

  it('i casi specifici vengono prima di quello generale', () => {
    // `CJK || CJK` intercettava ogni coppia con una lingua CJK, quindi
    // SEA↔CJK e SOUTH_ASIAN↔CJK non si raggiungevano mai.
    const s = pr();
    expect(s.indexOf("reason: 'sea_cjk_pair'")).toBeLessThan(s.indexOf("reason: 'cjk_involved'"));
    expect(s.indexOf("reason: 'south_asian_cjk'")).toBeLessThan(s.indexOf("reason: 'cjk_involved'"));
  });

  it('e ogni ramo resta raggiungibile', () => {
    const s = pr();
    for (const r of ['cjk_pair', 'sea_cjk_pair', 'south_asian_cjk', 'cjk_involved', 'sea_pair', 'south_asian_global']) {
      expect(s, `manca ${r}`).toContain(r);
    }
  });
});

describe('8 · le reazioni tornano indietro se il server rifiuta', () => {
  it('si annota com\'era prima', () => {
    // In Direct /api/reazioni e chiuso: la reazione restava a schermo,
    // visibile solo a chi l'aveva messa, mai consegnata a nessuno.
    const s = senzaCommenti(leggi('app/hooks/useReazioni.js'));
    expect(s).toMatch(/const conteDiPrima = conte\[msgId\]/);
    expect(s).toMatch(/const mieDiPrima = mie\[msgId\]/);
  });

  it('e si ripristina quando la risposta non arriva buona', () => {
    const s = senzaCommenti(leggi('app/hooks/useReazioni.js'));
    expect(s).toMatch(/if \(conteDiPrima === undefined\) delete q\[msgId\]/);
  });
});

describe('9 · la modalita Diretta e uno-a-uno', () => {
  it('accendendola la stanza scende a due', () => {
    // useWebRTC ha un solo pcRef: il terzo che entrava in una stanza
    // Diretta non riceveva e non mandava niente, in silenzio, dentro una
    // stanza che gli prometteva riservatezza.
    // b.139-bis — il 2 non e piu scritto a mano qui: era il terzo posto
    // in cui viveva un numero di capienza. Ora e CAPIENZA.DIRETTA.
    const s = senzaCommenti(leggi('app/components/CreateRoomSheet.js'));
    expect(s).toContain('normalizzaCapienza(maxParticipants, { diretta })');
    expect(s).toContain('if (nuovo && maxParticipants > CAPIENZA.DIRETTA) setMaxParticipants(CAPIENZA.DIRETTA)');
    expect(CAPIENZA.DIRETTA).toBe(2);
  });

  it('e il selettore non lascia risalire', () => {
    expect(senzaCommenti(leggi('app/components/CreateRoomSheet.js')))
      .toContain('disabled={diretta && n > CAPIENZA.DIRETTA}');
  });
});

describe('10 · le modalita che il motore non conosce non si offrono', () => {
  it('interview e conference non sono piu scegliibili', () => {
    // Si creavano, e poi TalkControls non trovava nessun percorso per
    // quella modalita: niente comandi vocali e nessuna spiegazione.
    const s = senzaCommenti(leggi('app/components/CreateRoomSheet.js'));
    expect(s).not.toMatch(/id: 'interview'/);
    expect(s).not.toMatch(/id: 'conference'/);
  });

  it('e MODES resta la sola fonte di cosa esiste', () => {
    const c = leggi('app/lib/constants.js');
    const i = c.indexOf('export const MODES');
    const blocco = c.slice(i, i + 500);
    expect(blocco).toContain('conversation');
    expect(blocco).not.toContain('interview');
  });
});

describe('11 · un solo signalling, quello protetto', () => {
  it('il percorso via /api/room non c\'e piu', () => {
    // Era la seconda implementazione, e la meno protetta: senza gettone
    // si accontentava di `signal.from`, un nome dichiarato da chi chiama.
    const r = senzaCommenti(leggi('app/lib/roomActions.js'));
    expect(r).not.toMatch(/export async function handleWebrtcSignal/);
    expect(r).not.toMatch(/export async function handleWebrtcPoll/);
    const api = senzaCommenti(leggi('app/api/room/route.js'));
    expect(api).not.toMatch(/case 'webrtc-signal'/);
    expect(api).not.toMatch(/case 'webrtc-poll'/);
  });

  it('e quello vero, su Supabase Realtime, e intatto', () => {
    // Togliere il duplicato senza toccare l'originale: e tutto il punto.
    expect(leggi('app/hooks/useWebRTC.js')).toMatch(/event: 'webrtc-signal'/);
  });
});
