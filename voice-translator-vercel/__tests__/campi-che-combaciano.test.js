// ═══════════════════════════════════════════════════════════════
// I CAMPI CHE NON COMBACIAVANO (b.110)
//
// Il guasto piu silenzioso di tutti: chi scrive un dato lo chiama in
// un modo, chi lo legge lo chiama in un altro. Nessun errore, nessun
// avviso rosso in console — solo `undefined`, che in JavaScript e un
// valore come un altro. Il programma continua a funzionare e sbaglia.
//
// L'audit ne ha trovati otto. Erano tutti invisibili perche ognuno di
// loro produceva un comportamento PLAUSIBILE: una notifica di troppo,
// un link che non funziona, un archivio vuoto. Cose che si scambiano
// per scelte di progetto finche non si guarda il codice dei due lati
// insieme.
//
// Questi test non guardano il comportamento: guardano che i due lati
// usino la stessa parola. E l'unico modo per accorgersene subito.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');

// I commenti raccontano i vecchi nomi sbagliati: se non si tolgono,
// ogni test qui sotto fallirebbe sulla propria spiegazione.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('un messaggio: chi lo firma e chi legge la firma', () => {
  // Il produttore e uno solo e scrive `sender`.
  it('chi produce un messaggio scrive sempre `sender`', () => {
    const api = app('hooks/useTranslationAPI.js');
    expect(api).toMatch(/sender:\s*senderName/);
    expect(senzaCommenti(api), 'nessun produttore deve usare `speaker`')
      .not.toMatch(/\bspeaker:\s/);
  });

  it('le notifiche confrontano `sender`, non un campo inesistente', () => {
    // Se leggessero `speaker` il confronto sarebbe sempre vero: arriverebbe
    // una notifica anche per i messaggi scritti da noi.
    const n = senzaCommenti(app('hooks/useNotifications.js'));
    expect(n).toMatch(/lastMsg\.sender\s*!==\s*myName/);
    expect(n).not.toMatch(/lastMsg\.speaker/);
  });

  it('la modalita taxi decide le lingue guardando `sender`', () => {
    // Con il campo sbagliato le due lingue finiscono scambiate: si
    // traduce dall'italiano all'italiano e non si capisce perche.
    const rv = senzaCommenti(app('components/RoomView.js'));
    expect(rv).toMatch(/msg\.sender\s*===\s*myName/);
    expect(rv, 'msg.from non esiste su un messaggio di chat')
      .not.toMatch(/msg\.from\s*===/);
  });
});

describe('una stanza si chiama `id`', () => {
  it('chi la crea le da `id`', () => {
    expect(app('lib/store.js')).toMatch(/const room = \{\s*\n?\s*id/);
  });

  it('nessun link di invito e costruito su `roomId`', () => {
    // Il sintomo era un indirizzo con scritto "room=undefined": copiato,
    // mandato, e chi lo apriva non entrava da nessuna parte.
    // `roomPolling.roomId` e legittimo (lo espone l'hook, riga 790);
    // sbagliato e leggerlo dall'OGGETTO stanza o conversazione.
    const p = senzaCommenti(app('page.js'));
    expect(p).not.toMatch(/\?room=\$\{(room|conv|detailConversation)\??\.roomId\}/);
    // b.606 — il link `?room=${room.id}` stava SOLO in startChatWithContact,
    // funzione morta (mai chiamata): tolta. Resta quello della cronologia.
    expect(p).toMatch(/\?room=\$\{detailConversation\.id\}/);
  });
});

describe('entrare in una stanza scelta da un elenco', () => {
  it('il codice si passa come argomento, non si spera nello stato', () => {
    // setJoinCode e asincrono: chiamare subito handleJoinRoom() faceva
    // leggere il codice PRECEDENTE. La prima volta non succedeva niente,
    // la seconda si entrava nella stanza sbagliata.
    const p = senzaCommenti(app('page.js'));
    expect(p).toMatch(/handleJoinRoom\(\s*codiceEsplicito\s*\)/);
    expect(p).toMatch(/handleJoinRoom\(\s*rid\s*\)/);
    expect(p, 'la chiamata vera deve usare il codice risolto')
      .toMatch(/roomPolling\.handleJoinRoom\(\s*codice\s*,/);
  });
});

describe('pubblicare una stanza in Community', () => {
  it('il gettone si prende dal ref dove viene davvero scritto', () => {
    // `room.sessionToken` non esiste: handleCreateRoom restituisce la
    // stanza e mette il gettone nel ref. Il campo era sempre vuoto,
    // quindi se l'host non era gia loggato la rotta rispondeva 401 e la
    // stanza non compariva mai nella vetrina.
    const p = senzaCommenti(app('page.js'));
    expect(p).toMatch(/roomSessionToken:\s*roomPolling\.roomSessionTokenRef\?\.current/);
    expect(p).not.toMatch(/room\?\.sessionToken/);
    expect(app('hooks/useRoomPolling.js')).toMatch(/roomSessionTokenRef/);
  });
});

describe('le lingue a tre lettere esistono', () => {
  it('il filtro accetta i codici dichiarati nelle costanti', () => {
    const { LANG_CODE_RE } = { LANG_CODE_RE: /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/ };
    expect(app('lib/schemas.js')).toMatch(/\[a-z\]\{2,3\}/);
    // La prova vera: ogni codice dichiarato deve superare il filtro.
    const cost = app('lib/constants.js');
    const codici = [...cost.matchAll(/\{\s*code:\s*'([a-z-]+)'/g)].map(m => m[1]);
    expect(codici.length, 'le lingue devono essere trovate').toBeGreaterThan(10);
    for (const c of codici) {
      expect(LANG_CODE_RE.test(c), `la lingua "${c}" verrebbe rifiutata`).toBe(true);
    }
  });
});

describe('la cronologia si archivia e si ritrova con la stessa chiave', () => {
  it('si archivia sotto il nome visualizzato', () => {
    expect(app('lib/store.js')).toMatch(/convlist:\$\{member\.name\}/);
  });

  it('la sessione sa dire il nome, non solo l\'email', () => {
    // createSession salva solo { email, created }. Chi leggeva
    // `session.name` trovava undefined e ripiegava sull'email: una
    // chiave che non esiste. Il nome ora si prende dal profilo dentro
    // getSession, in un posto solo — non con un ripiego per rotta, che
    // sarebbe anche un buco per rotta (il nome verrebbe dal client).
    const u = senzaCommenti(app('lib/users.js'));
    expect(u).toMatch(/getSession/);
    expect(u, 'getSession deve arricchire la sessione col nome del profilo')
      .toMatch(/session\.email && !session\.name/);
    // b.636 — il profilo si chiede in parallelo al rinnovo della
    // sessione, e la variabile si chiama `utente`. Il nome arriva dallo
    // stesso posto di prima: il profilo, non il client.
    expect(u).toMatch(/session\.name = (user|utente)\.name/);
  });

  it('entrambe le rotte della cronologia risolvono l\'identita allo stesso modo', () => {
    // La rotta GET aveva lo STESSO difetto della POST ed era sfuggita:
    // il controllo "eri fra i partecipanti?" confronta i nomi dei membri,
    // quindi con l'email rispondeva 403 a chi la conversazione l'aveva
    // davvero fatta.
    const r = senzaCommenti(app('api/conversation/route.js'));
    const quante = (r.match(/session\.name \|\| session\.email/g) || []).length;
    expect(quante, 'sia list che GET devono preferire il nome').toBe(2);
  });
});

describe('le promesse sulla durata sono mantenute', () => {
  it('conversazione ed elenco scadono insieme', () => {
    const s = app('lib/store.js');
    const conv = s.match(/`conv:\$\{id\}`[^;]*'EX',\s*(\d+)/);
    const lista = s.match(/EXPIRE',\s*listKey,\s*(\d+)/);
    expect(conv, 'la conversazione deve avere una scadenza').toBeTruthy();
    expect(lista, 'l\'elenco deve avere una scadenza').toBeTruthy();
    // Se l'elenco dura piu della conversazione, l'utente vede una riga
    // che aprendola dice "non trovata": un dato perso senza avviso.
    expect(Number(conv[1])).toBeGreaterThanOrEqual(Number(lista[1]));
  });
});
