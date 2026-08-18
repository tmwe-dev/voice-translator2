// ═══════════════════════════════════════════════════════════════
// GUARDIA SULLA STANZA VIDEO DI GRUPPO
//
// Il patto di questo modulo e uno solo: NON deve toccare la
// videochiamata a due, che funziona bene ed e curata (ducking,
// anti-eco, gestione iOS). Se questo modulo si rompe, li non deve
// succedere niente.
//
// Poi le due cose che rendono possibile stare in piu di due:
//   1. una connessione PER OGNI persona, non una sola
//   2. ogni segnale ha un DESTINATARIO, non e gridato alla stanza
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

const hook = leggi('hooks/useStanzaVideo.js');
const rotta = leggi('api/stanza-video/route.js');
const schermo = leggi('components/StanzaVideoGruppo.js');
const parlato = leggi('hooks/useParlatoTradotto.js');

describe('il modulo e davvero separato', () => {
  it('non modifica useWebRTC, che regge la chiamata a due', () => {
    const due = leggi('hooks/useWebRTC.js');
    expect(due, 'la chiamata a due deve restare a connessione singola').toMatch(/pcRef/);
    // Nominarlo in un commento va bene; IMPORTARLO no: legherebbe i due
    // moduli e un guasto qui si porterebbe dietro la chiamata a due.
    expect(hook, 'il gruppo non deve importare il modulo a due')
      .not.toMatch(/^import .*useWebRTC/m);
  });

  it('non passa da /api/room: ha il suo smistamento', () => {
    expect(hook).toMatch(/'\/api\/stanza-video'/);
    expect(hook).not.toMatch(/'\/api\/room'/);
  });

  it('riusa le primitive collaudate invece di riscriverle', () => {
    for (const f of ['createPeerConnection', 'createAnswer', 'acceptAnswer', 'addIceCandidate']) {
      expect(hook, `manca il riuso di ${f}`).toMatch(new RegExp(f));
    }
    expect(hook).toMatch(/from '\.\.\/lib\/webrtc\.js'/);
  });
});

describe('una connessione per ogni persona', () => {
  it('i peer stanno in una mappa, non in una variabile sola', () => {
    expect(hook).toMatch(/peersRef = useRef\(new Map\(\)\)/);
    expect(hook).toMatch(/peersRef\.current\.set\(/);
    expect(hook).toMatch(/peersRef\.current\.get\(/);
  });

  it('il flusso di ognuno finisce nel suo riquadro', () => {
    expect(hook).toMatch(/aggiornaPartecipante\(nome, \{ stream/);
  });

  it('chi se ne va sparisce dai riquadri', () => {
    expect(hook).toMatch(/chiudiPeer/);
    expect(hook, 'anche se se ne va senza salutare').toMatch(/if \(!vivi\.includes/);
  });
});

describe('ogni segnale ha un destinatario', () => {
  it('la cassetta e per persona, non per stanza', () => {
    expect(rotta).toMatch(/svideo:\$\{stanza\}:\$\{nome\.toLowerCase\(\)\}/);
  });

  it('chi manda deve dire A CHI', () => {
    const blocco = rotta.slice(rotta.indexOf("case 'manda'"), rotta.indexOf("case 'ritira'"));
    expect(blocco).toMatch(/destinatario richiesto/);
  });

  it('quello che ho letto non lo rileggo, e in un colpo solo', () => {
    // b.248 — qui si pretendeva il DEL separato dopo l'LRANGE: era
    // proprio il difetto (un ICE arrivato fra i due comandi veniva
    // cancellato non letto). Ora lettura e svuotamento sono UNO script
    // Lua; la prova comportamentale sta in video-gruppo-b248.test.js.
    const blocco = rotta.slice(rotta.indexOf("case 'ritira'"));
    expect(blocco).toMatch(/redis\('EVAL', RITIRA_CASSETTA, 1, chiave\)/);
  });

  it('chiama chi ARRIVA DOPO, verso tutti quelli che trova', () => {
    // La prima versione usava l'ordine alfabetico e il collaudo con tre
    // persone l'ha bocciata: entrando Anna-Bruno-Carla, devoChiamare era
    // vuoto per tutti e nessuno si collegava. La regola era simmetrica,
    // ma l'informazione no: chi entra sa chi c'e, chi c'era non lo sa.
    expect(rotta).toMatch(/devoChiamare: giaDentro/);
    expect(rotta, 'chi c\'era si legge PRIMA di aggiungersi').toMatch(/const prima = \(await redis\('ZRANGE'/);
  });

  it('l\'ordine di arrivo si conserva davvero', () => {
    // Con un insieme semplice l'ordine non esiste, e "dopo" non si sa.
    expect(rotta).toMatch(/redis\('ZADD', presenze/);
    expect(rotta, 'il battito non deve riscrivere il momento di ingresso')
      .toMatch(/if \(!mio\) await redis\('ZADD'/);
  });

  it('la rete di sicurezza non fa offrire due persone a vicenda', () => {
    // Si riprova SOLO verso chi e arrivato prima: il chiamante resta
    // sempre lo stesso dei due.
    expect(rotta).toMatch(/arrivatiPrimaDiMe/);
    expect(hook).toMatch(/d\.arrivatiPrimaDiMe \|\| \[\]/);
  });

  it('c\'e un tetto dichiarato, e si spiega perche', () => {
    expect(rotta).toMatch(/MAX_PARTECIPANTI = 8/);
    expect(rotta).toMatch(/stanza piena/);
  });
});

describe('chi parla viene tradotto, e ognuno paga il suo', () => {
  it('si trascrive SOLO il proprio microfono', () => {
    // Trascrivere gli altri costerebbe N volte la stessa frase.
    expect(parlato).toMatch(/mioStream/);
    expect(parlato).toMatch(/'\/api\/transcribe'/);
    expect(parlato).toMatch(/mioStream\.getAudioTracks\(\)/);
  });

  it('agli altri va il TESTO, non l\'audio da trascrivere', () => {
    expect(parlato).toMatch(/mandaTesto\?\.\(testo, miaLingua/);
    expect(hook).toMatch(/tipo: 'parlato'/);
  });

  it('si accorge da solo di chi parla, senza pulsanti', () => {
    expect(parlato).toMatch(/SOGLIA/);
    expect(parlato).toMatch(/SILENZIO_CHIUDE/);
    expect(parlato, 'chi parla a lungo non deve aspettare la fine').toMatch(/PEZZO_MASSIMO/);
  });

  it('chi ascolta traduce verso la PROPRIA lingua', () => {
    expect(parlato).toMatch(/targetLang: miaLingua/);
  });

  it('la stessa frase non si traduce due volte, e non si paga due volte', () => {
    expect(parlato).toMatch(/memoriaRef/);
  });

  it('se parliamo la stessa lingua non si spende niente', () => {
    expect(parlato).toMatch(/lingua === miaLingua/);
  });
});

describe('la schermata', () => {
  it('mostra un riquadro per persona con sotto il tradotto', () => {
    expect(schermo).toMatch(/stanza\.partecipanti\.map/);
    expect(schermo).toMatch(/battuta\.tradotto \|\| battuta\.testo/);
  });

  it('il proprio video e specchiato e muto, come deve', () => {
    // Non specchiato disorienta; non muto fa fischiare tutto.
    expect(schermo).toMatch(/muted=\{mio\}/);
    expect(schermo).toMatch(/scaleX\(-1\)/);
  });

  it('e raggiungibile: c\'e una voce in Home e una porta dalla sala d\'attesa', () => {
    expect(leggi('components/HomeView.js')).toMatch(/id: 'stanza-video'/);
    expect(leggi('page.js')).toMatch(/view === 'stanza-video'/);
  });

  it('il pulsante sta DENTRO la scheda della stanza, non appiccicato fuori', () => {
    // b.102 lo aveva messo fuori da LobbyView: esisteva nel DOM ma la
    // schermata della stanza gli passava sopra e non si poteva premere.
    // Il collaudo dal vivo lo ha bocciato. Un pulsante che c'e ma non si
    // preme non esiste.
    expect(leggi('components/LobbyView.js')).toMatch(/Entra in video di gruppo/);
    expect(leggi('components/LobbyView.js')).toMatch(/setView\('stanza-video'\)/);
    expect(leggi('page.js'), 'non deve tornare fuori da LobbyView')
      .not.toMatch(/Entra in video di gruppo/);
  });
});
