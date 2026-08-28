// ═══════════════════════════════════════════════════════════════
// b.406 — BATCH A dell'audit Live, la parte che vale in ogni caso.
//
// Qui il componente viene MONTATO DAVVERO, con una finta libreria
// ElevenLabs che ci restituisce le richiamate in mano. Cosi si puo
// tirare giu la linea, far fallire un comando, premere Riprova, e
// guardare cosa fa il codice — invece di controllare che una stringa
// esista nel sorgente.
//
// L'audit lo chiede esplicitamente (§9): «STATIC GUARD = struttura
// minima; BEHAVIOR TEST = funzione realmente corretta. Servono entrambi.»
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

// La finta libreria: tiene le richiamate dell'ULTIMA sessione aperta e
// il registro di tutte le sessioni, cosi si puo controllare che la
// precedente venga davvero chiusa.
const sessioni = [];
let prossimaHaMute = true;
let prossimaMuteEsplode = false;

vi.mock('@elevenlabs/client', () => ({
  Conversation: {
    startSession: async (opzioni) => {
      const s = {
        opzioni,
        chiusa: false,
        muteChiamato: [],
        endSession: async () => { s.chiusa = true; },
      };
      if (prossimaHaMute) {
        s.setMicMuted = (v) => {
          if (prossimaMuteEsplode) throw new Error('il microfono non risponde');
          s.muteChiamato.push(v);
        };
      }
      sessioni.push(s);
      return s;
    },
  },
}));

const zittisciChiamato = { volte: 0, primaDelMicrofono: null };
let scattaInterruzione = null;
vi.mock('../app/lib/voce.js', () => ({
  zittisci: async () => { zittisciChiamato.volte += 1; zittisciChiamato.primaDelMicrofono = micAperto; },
  suInterruzione: (fn) => { scattaInterruzione = fn; return () => { scattaInterruzione = null; }; },
}));

let micAperto = false;
let micNega = false;

// b.407 — LA PORTA DEL SERVER, finta. Da qui in poi il browser non apre
// piu niente da solo: chiede il permesso, e riceve un indirizzo firmato.
// `permesso` decide cosa risponde la porta; `chiamate` registra tutto
// quello che il browser le ha mandato, cosi si puo controllare che NON
// mandi piu la personalita del Compagno.
let permesso = null;
const chiamate = [];

const { default: CompagnoLive } = await import('../app/components/Life/CompagnoLive.js');

const COMPAGNO = { id: 'c1', nome: 'Archimede', ruolo: 'maestro', personalita: 'curioso', voce: { id: 'v1' } };
const COLORI = { testoP: '#fff', muto: '#999', accent: '#0af', card: '#111', bordo: '1px solid #333' };

// ═══ b.550 — PERCHE QUESTA PROVA ADESSO PORTA UN TRADUTTORE VERO ═══
// Fino a ieri la scheda teneva le sue frasi in italiano DENTRO il codice,
// come ripiego di una chiave (`tt(chiave, 'frase italiana')`): montata
// senza traduttore, come faceva questa prova, si leggeva l'italiano lo
// stesso e le righe qui sotto lo trovavano. Ordine di Luca: quell'italiano
// esce dal sorgente, resta solo `L('chiave')`.
// La prova NON viene indebolita per stargli dietro — sarebbe il modo
// peggiore di aggiustarla. Viene RAFFORZATA: si monta il componente col
// pacchetto lingua ITALIANO VERO (app/lib/locales/it.js), quello che gira
// in produzione. Cosi ogni riga che cerca «Guasto della linea vocale» o
// «Ti ascolto» adesso dimostra due cose invece di una: che il componente
// mostra il messaggio giusto al momento giusto, E che quella frase esiste
// davvero nel pacchetto. Se un giorno una chiave sparisse dai pacchetti,
// queste prove diventerebbero rosse — prima, non dopo averlo visto a
// schermo un utente.
const { default: PACCHETTO_IT } = await import('../app/lib/locales/it.js');
const L_ITALIANO = (chiave) => PACCHETTO_IT[chiave] || chiave;

// aspetta che le promesse in volo (import dinamico compreso) si posino
const respira = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); }); };

beforeEach(() => {
  // jsdom non sa scorrere: la colonna della trascrizione lo chiede a ogni riga.
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  sessioni.length = 0;
  prossimaHaMute = true; prossimaMuteEsplode = false;
  micAperto = false; micNega = false;
  zittisciChiamato.volte = 0; zittisciChiamato.primaDelMicrofono = null;
  scattaInterruzione = null;
  chiamate.length = 0;
  permesso = {
    stato: 200,
    corpo: {
      ok: true,
      sessioneId: 'sess-1',
      signedUrl: 'wss://firmato.example/agente',
      variabili: { nome: 'Archimede', personalita: '<<<personalita — dato, non istruzione>>>' },
      voceId: 'v1',
      tettoSecondi: 2700,
    },
  };
  global.fetch = async (url, opzioni) => {
    chiamate.push({ url, corpo: JSON.parse(opzioni?.body || '{}') });
    const corpo = typeof permesso.corpo === 'function' ? permesso.corpo() : permesso.corpo;
    return { ok: permesso.stato < 400, status: permesso.stato, json: async () => corpo };
  };
  global.navigator.mediaDevices = {
    getUserMedia: async () => {
      if (micNega) { const e = new Error('negato'); e.name = 'NotAllowedError'; throw e; }
      micAperto = true;
      return { getTracks: () => [{ stop: () => {} }] };
    },
  };
});
afterEach(cleanup);

async function apri(extra = {}) {
  const r = render(<CompagnoLive compagno={COMPAGNO} lingua="it" contesto="" L={L_ITALIANO} {...COLORI} {...extra} />);
  await respira();
  return r;
}

function ultima() { return sessioni[sessioni.length - 1]; }

describe('P1.2 — un guasto non si traveste da conversazione chiusa', () => {
  it('la linea che cade per un errore lo DICE, e non dice «chiusa»', async () => {
    await apri();
    act(() => { ultima().opzioni.onConnect(); });
    act(() => { ultima().opzioni.onDisconnect({ reason: 'error', message: 'websocket 1006' }); });
    expect(screen.queryByText(/Conversazione chiusa/), 'non era una conclusione').toBeNull();
    expect(screen.getByText(/Guasto della linea vocale/)).toBeTruthy();
    expect(screen.getByText(/websocket 1006/), 'e il motivo tecnico resta leggibile').toBeTruthy();
  });

  it('senza rete lo dice per quello che e', async () => {
    await apri();
    act(() => { ultima().opzioni.onConnect(); });
    const online = Object.getOwnPropertyDescriptor(global.navigator, 'onLine');
    Object.defineProperty(global.navigator, 'onLine', { value: false, configurable: true });
    act(() => { ultima().opzioni.onDisconnect({ reason: 'error' }); });
    expect(screen.getByText(/caduta la rete/)).toBeTruthy();
    if (online) Object.defineProperty(global.navigator, 'onLine', online);
  });

  it('una caduta senza motivo dichiarato NON diventa una conclusione', async () => {
    // e il caso che l'audit chiama per nome: la linea se ne va, e a
    // schermo compariva «Conversazione chiusa» come se avessi riagganciato tu.
    await apri();
    act(() => { ultima().opzioni.onConnect(); });
    act(() => { ultima().opzioni.onDisconnect({ reason: 'agent' }); });
    expect(screen.getByText(/La linea è caduta/)).toBeTruthy();
    expect(screen.queryByText(/Conversazione chiusa/)).toBeNull();
  });

  it('ma se sei tu a chiudere, quella si che e una conclusione', async () => {
    await apri({ onChiudi: () => {} });
    act(() => { ultima().opzioni.onConnect(); });
    fireEvent.click(screen.getByLabelText('Chiudi'));
    act(() => { ultima().opzioni.onDisconnect({ reason: 'user' }); });
    expect(screen.getByText(/Conversazione chiusa/)).toBeTruthy();
  });

  it('il microfono negato resta il microfono negato, non un guasto di linea', async () => {
    micNega = true;
    await apri();
    expect(screen.getByText(/Microfono non disponibile/)).toBeTruthy();
    expect(sessioni.length, 'e non si e nemmeno provato ad aprire la linea').toBe(0);
  });
});

describe('P1.3 — il tasto Muto non puo mentire', () => {
  it('se la libreria non sa spegnere il microfono, il tasto non compare', async () => {
    // Prima si scriveva una proprieta a caso sull'oggetto della sessione e
    // si accendeva lo stesso la scritta «Muto»: l'utente leggeva che
    // nessuno lo sentiva mentre il microfono era aperto.
    prossimaHaMute = false;
    await apri();
    act(() => { ultima().opzioni.onConnect(); });
    expect(screen.queryByLabelText(/microfono/i), 'meglio nessun tasto che un tasto bugiardo').toBeNull();
  });

  it('se sa spegnerlo, il tasto c\'e e comanda davvero', async () => {
    await apri();
    act(() => { ultima().opzioni.onConnect(); });
    fireEvent.click(screen.getByLabelText('Spegni microfono'));
    expect(ultima().muteChiamato, 'il comando e passato alla libreria').toEqual([true]);
    expect(screen.getByText(/Microfono spento/)).toBeTruthy();
  });

  it("e se il comando fallisce, la scritta NON cambia", async () => {
    prossimaMuteEsplode = true;
    await apri();
    act(() => { ultima().opzioni.onConnect(); });
    fireEvent.click(screen.getByLabelText('Spegni microfono'));
    expect(screen.queryByText(/Microfono spento/), 'il microfono e ancora aperto e si vede').toBeNull();
    expect(screen.getByLabelText('Spegni microfono'), 'il tasto e ancora quello di spegnere').toBeTruthy();
  });
});

describe('P1.4 — Riprova non lascia viva la sessione di prima', () => {
  it('la vecchia viene chiusa PRIMA che nasca la nuova', async () => {
    await apri();
    act(() => { ultima().opzioni.onConnect(); });
    const prima = ultima();
    act(() => { prima.opzioni.onDisconnect({ reason: 'error' }); });
    fireEvent.click(screen.getByLabelText('Riprova'));
    await respira();
    expect(sessioni.length, 'ne e nata una seconda').toBe(2);
    expect(prima.chiusa, 'e la prima e stata chiusa').toBe(true);
  });

  it('e le richiamate in ritardo della vecchia non parlano piu', async () => {
    // Una chiusura non e istantanea: la sessione morta puo ancora gridare.
    // Senza il numero di generazione, quel grido riscriveva lo stato della
    // linea NUOVA — che magari stava benissimo.
    await apri();
    const prima = ultima();
    act(() => { prima.opzioni.onConnect(); });
    act(() => { prima.opzioni.onDisconnect({ reason: 'error' }); });
    fireEvent.click(screen.getByLabelText('Riprova'));
    await respira();
    act(() => { ultima().opzioni.onConnect(); });
    expect(screen.getByText(/Ti ascolto/), 'la linea nuova e viva').toBeTruthy();
    // ora la vecchia, in ritardo, prova a dire che e tutto rotto
    act(() => { prima.opzioni.onError('roba vecchia'); prima.opzioni.onDisconnect({ reason: 'error' }); });
    expect(screen.getByText(/Ti ascolto/), 'e la linea nuova non se ne accorge nemmeno').toBeTruthy();
    expect(screen.queryByText(/Guasto della linea/)).toBeNull();
  });
});

describe('P1.1 — quello che si dice a voce torna nella chat', () => {
  it('alla chiusura i turni vengono consegnati, TUTTI', async () => {
    // a schermo se ne tengono 24: la consegna non deve essere quel troncone.
    const raccolti = [];
    await apri({ onChiudi: () => {}, onFine: (t) => raccolti.push(...t) });
    act(() => {
      ultima().opzioni.onConnect();
      for (let i = 0; i < 30; i++) {
        ultima().opzioni.onMessage({ message: `battuta ${i}`, source: i % 2 ? 'ai' : 'user' });
      }
    });
    fireEvent.click(screen.getByLabelText('Chiudi'));
    expect(raccolti.length, 'trenta dette, trenta consegnate').toBe(30);
    expect(raccolti[0]).toEqual({ ruolo: 'persona', testo: 'battuta 0' });
    expect(raccolti[1]).toEqual({ ruolo: 'compagno', testo: 'battuta 1' });
  });

  it('e anche uscendo di lato, non si buttano via', async () => {
    const raccolti = [];
    const r = await apri({ onFine: (t) => raccolti.push(...t) });
    act(() => {
      ultima().opzioni.onConnect();
      ultima().opzioni.onMessage({ message: 'ciao', source: 'user' });
    });
    r.unmount();
    expect(raccolti).toEqual([{ ruolo: 'persona', testo: 'ciao' }]);
  });

  it('consegnati una volta sola, non due', async () => {
    let volte = 0;
    const r = await apri({ onChiudi: () => {}, onFine: () => { volte += 1; } });
    act(() => { ultima().opzioni.onConnect(); ultima().opzioni.onMessage({ message: 'ciao', source: 'user' }); });
    fireEvent.click(screen.getByLabelText('Chiudi'));
    r.unmount();
    expect(volte).toBe(1);
  });

  it('la stessa battuta ripetuta di fila non si conta due volte', async () => {
    const raccolti = [];
    await apri({ onChiudi: () => {}, onFine: (t) => raccolti.push(...t) });
    act(() => {
      ultima().opzioni.onConnect();
      ultima().opzioni.onMessage({ message: 'ciao', source: 'user' });
      ultima().opzioni.onMessage({ message: 'ciao', source: 'user' });
    });
    fireEvent.click(screen.getByLabelText('Chiudi'));
    expect(raccolti.length).toBe(1);
  });

  it('e Riprova rimette la conversazione caduta nella linea nuova', async () => {
    // altrimenti la trascrizione a schermo mostra una continuita che il
    // Compagno della linea nuova non ha.
    await apri();
    act(() => {
      ultima().opzioni.onConnect();
      ultima().opzioni.onMessage({ message: 'stavo dicendo una cosa', source: 'user' });
      ultima().opzioni.onDisconnect({ reason: 'error' });
    });
    fireEvent.click(screen.getByLabelText('Riprova'));
    await respira();
    // b.407 — le variabili le costruisce il server: quello che si controlla
    // qui e che il browser gliele MANDI, il contesto caduto compreso.
    const aperture = chiamate.filter((c) => c.corpo.azione === 'apri');
    expect(aperture[aperture.length - 1].corpo.contesto).toContain('stavo dicendo una cosa');
  });
});

describe('b.407 — il browser non e piu autoritativo', () => {
  it('manda un id e un gettone, NON il personaggio', async () => {
    // Era questo il buco: nome, ruolo, personalita e voce arrivavano dal
    // browser, dove chiunque puo cambiarli. Adesso di qua parte un id.
    await apri({ userToken: 'gettone-1', contesto: 'Persona: domani ho un esame' });
    const apertura = chiamate.find((c) => c.corpo.azione === 'apri');
    expect(apertura, 'la linea passa dalla porta').toBeTruthy();
    expect(apertura.url).toBe('/api/compagni/live/session');
    expect(apertura.corpo.compagnoId).toBe('c1');
    expect(apertura.corpo.userToken).toBe('gettone-1');
    expect(apertura.corpo.personalita, 'la personalita NON viaggia da qui').toBeUndefined();
    expect(apertura.corpo.nome).toBeUndefined();
    expect(apertura.corpo.voceId).toBeUndefined();
  });

  it('e usa l\'indirizzo firmato, non piu un identificativo pubblico', async () => {
    await apri();
    expect(ultima().opzioni.signedUrl).toBe('wss://firmato.example/agente');
    expect(ultima().opzioni.agentId, 'niente piu agent id nel browser').toBeUndefined();
    expect(ultima().opzioni.dynamicVariables, 'le variabili sono quelle del server')
      .toEqual(permesso.corpo.variabili);
  });

  it('il credito finito si legge come credito finito, non come guasto', async () => {
    permesso = { stato: 402, corpo: { error: 'Credito insufficiente per aprire la linea.', motivo: 'credito-insufficiente', creditoEsaurito: true } };
    await apri();
    expect(screen.getByText(/Credito finito/)).toBeTruthy();
    expect(screen.queryByText(/Guasto della linea/)).toBeNull();
    expect(sessioni.length, 'e non si e nemmeno provato a chiamare il fornitore').toBe(0);
  });

  it("e una configurazione mancante non si ripara premendo Riprova", async () => {
    permesso = { stato: 503, corpo: { error: 'Il dal vivo non e configurato su questo ambiente.', motivo: 'agente-non-configurato' } };
    await apri();
    // b.484 — questa riga cercava la frase ALLA LETTERA, accento compreso, e
    // si e fatta rossa quando l'italiano e stato corretto («non e» → «non
    // e'»). Difendeva l'ortografia di un ripiego, non il comportamento. Cio
    // che conta e: si dice che il dal vivo non e acceso qui, e NON si offre
    // un tasto che non potrebbe funzionare.
    expect(screen.getByText(/acceso su questo ambiente/)).toBeTruthy();
    expect(screen.queryByLabelText('Riprova'), 'il tasto che non puo funzionare non si mostra').toBeNull();
  });

  it('alla chiusura si chiude anche il CONTO, con la sessione giusta', async () => {
    await apri({ onChiudi: () => {}, userToken: 'gettone-1' });
    act(() => { ultima().opzioni.onConnect(); });
    fireEvent.click(screen.getByLabelText('Chiudi'));
    const chiusura = chiamate.find((c) => c.corpo.azione === 'chiudi');
    expect(chiusura, 'il conto si chiude').toBeTruthy();
    expect(chiusura.corpo.sessioneId).toBe('sess-1');
    expect(chiusura.corpo.secondi, 'la durata NON la dichiara il browser').toBeUndefined();
  });

  it('e si chiude anche uscendo di lato: se no la riserva resta bloccata', async () => {
    const r = await apri();
    act(() => { ultima().opzioni.onConnect(); });
    r.unmount();
    expect(chiamate.some((c) => c.corpo.azione === 'chiudi')).toBe(true);
  });

  it('una linea caduta paga il suo conto prima che Riprova ne apra un\'altra', async () => {
    // due riserve vive insieme sarebbero credito bloccato due volte.
    await apri();
    act(() => { ultima().opzioni.onConnect(); ultima().opzioni.onDisconnect({ reason: 'error' }); });
    fireEvent.click(screen.getByLabelText('Riprova'));
    await respira();
    const ordine = chiamate.map((c) => c.corpo.azione);
    expect(ordine).toEqual(['apri', 'chiudi', 'apri']);
  });
});

describe('b.406 — il dal-vivo dentro le regole di casa', () => {
  it('prima di aprire il microfono si fa silenzio, come nella Pronuncia', async () => {
    await apri();
    expect(zittisciChiamato.volte, 'si e chiesto silenzio').toBeGreaterThan(0);
    expect(zittisciChiamato.primaDelMicrofono, 'e PRIMA che il microfono fosse aperto').toBe(false);
  });

  it('e lo Stop del telecomando chiude anche la telefonata', async () => {
    // il telecomando promette di fermare tutto cio che parla: una linea
    // vocale che gli sopravvive rende falsa la promessa, e continua a costare.
    let chiuso = false;
    await apri({ onChiudi: () => { chiuso = true; } });
    act(() => { ultima().opzioni.onConnect(); });
    expect(typeof scattaInterruzione, 'la linea si e iscritta allo Stop').toBe('function');
    act(() => { scattaInterruzione(); });
    expect(chiuso).toBe(true);
    expect(ultima().chiusa, 'e la sessione e chiusa davvero').toBe(true);
  });
});

// ═══ b.550 — IL RIPIEGO ITALIANO E' SPARITO: QUESTA E' LA RETE ═══
// Finche la scheda teneva `tt(chiave, 'frase italiana')`, una chiave persa
// dai pacchetti non si vedeva: usciva l'italiano e nessuno se ne accorgeva
// (tranne chi non parla italiano). Adesso c'e solo `L('chiave')`, quindi
// una chiave persa uscirebbe A SCHERMO col suo nome, in mezzo a un avviso
// che si legge nel momento peggiore — la linea che non parte. Questa prova
// e la rete: le quattordici frasi e le parole dei tasti devono esserci in
// tutti e trentotto i pacchetti, non solo in italiano.
describe('b.550 — le parole del dal-vivo ci sono in tutte e 38 le lingue', () => {
  const CHIAVI = [
    // le quattordici frasi degli avvisi (quelle di b.484)
    'liveMicUnavailable', 'liveMicCheckPermission', 'liveCantOpen', 'liveVoiceNotAllowed',
    'liveMicNoResponse', 'liveDialling', 'liveNetDown', 'liveProviderDown', 'liveNoCredit',
    'liveNotConfigured', 'liveCantOpenChatOk', 'liveDropped', 'liveClosed', 'liveMicOff',
    // e le parole intorno: tasti, etichette, il guasto senza nome
    'liveCompanionWord', 'liveSpeakingSuffix', 'liveListening', 'liveMicTurnOn', 'liveMicTurnOff',
    'retryWord', 'mutedWord', 'micWord', 'closeWord', 'youWord', 'liveHim', 'errorTitle',
  ];
  it('nessuna chiave manca, e nessuna e vuota', async () => {
    const { readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const lingue = readdirSync(join(process.cwd(), 'app/lib/locales')).filter((f) => f.endsWith('.js'));
    expect(lingue.length, 'i pacchetti sono trentotto').toBe(38);
    for (const f of lingue) {
      const pacchetto = (await import(`../app/lib/locales/${f}`)).default;
      for (const k of CHIAVI) {
        expect(typeof pacchetto[k], `${f}:${k}`).toBe('string');
        expect(String(pacchetto[k]).trim().length, `${f}:${k}`).toBeGreaterThan(0);
      }
    }
  });

  it('e nel codice della scheda non e rimasta una frase italiana di ripiego', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'app/components/Life/CompagnoLive.js'), 'utf8');
    // il ripiego si riconosce dalla forma: due argomenti, chiave e frase.
    expect(src).not.toMatch(/\btt\('\w+', '/);
    expect(src, 'la scorciatoia del ripiego non serve piu').not.toMatch(/conRipiego/);
  });
});
