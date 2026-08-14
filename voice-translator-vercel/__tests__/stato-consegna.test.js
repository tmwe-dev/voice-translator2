// ═══════════════════════════════════════════════════════════════
// "IN CODA" NON E "CONSEGNATO" (b.120)
//
// Questo difetto l'ho introdotto io in b.111.
//
// La posta in uscita ha risolto un problema vero: prima, in modalita
// Direct, un messaggio che non riusciva a partire spariva per sempre.
// Ora resta da parte e riparte da solo. Bene.
//
// Ma insieme al rimedio e arrivata una bugia: il messaggio parcheggiato
// mostrava la STESSA identica spunta di uno arrivato dall'altra parte.
// `_status: 'sent'` veniva messo alla creazione, PRIMA che qualunque
// cosa fosse partita.
//
// Quindi: ho smesso di perdere i messaggi e ho cominciato a far credere
// che fossero arrivati. Meglio del prima — e disonesto lo stesso.
//
// ── I CINQUE MOMENTI ──
//
//   in coda     ·    in attesa che il canale si apra
//   inviato     ✓    il server o il canale l'ha preso in carico
//   consegnato  ✓✓   e arrivato all'altro telefono
//   letto       ✓✓   l'ha visto (in verde)
//   fallito     !    non e partito, e non partira
//
// Il grigio della prima non e estetica: e la differenza fra "aspetta"
// e "e andata". Chi manda un messaggio importante in una zona senza
// campo ha diritto di sapere in quale dei due si trova.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('un messaggio nasce "in coda", non "inviato"', () => {
  it('lo stato iniziale dice la verita', () => {
    const s = senzaCommenti(app('hooks/useTranslationAPI.js'));
    expect(s).toMatch(/_status: 'in-coda'/);
    expect(s, "il vecchio 'sent' messo alla creazione non deve tornare")
      .not.toMatch(/_status: 'sent'/);
  });

  it('diventa "inviato" solo quando qualcuno lo prende davvero in carico', () => {
    const s = senzaCommenti(app('hooks/useTranslationAPI.js'));
    // due strade, e tutte e due devono confermare: il canale diretto
    // (che risponde vero/falso) e il salvataggio sul server.
    expect(s, 'il canale diretto dice se e partito').toMatch(/\.then\(\(partito\) => \{ if \(partito\) segnaStato\('inviato'\)/);
    expect(s, 'e il server pure').toMatch(/if \(res\.ok\) \{[\s\S]{0,200}segnaStato\('inviato'\)/);
  });

  it('e il risultato dell\'invio diretto NON si butta piu', () => {
    // In b.111 lo chiamavo e ignoravo cosa rispondeva. Era la riga che
    // rendeva impossibile distinguere i due casi.
    const s = senzaCommenti(app('hooks/useTranslationAPI.js'));
    expect(s).toMatch(/Promise\.resolve\(spedisciContenuto\(/);
  });
});

describe('un invio fallito si vede', () => {
  it('il server che risponde male porta a "fallito"', () => {
    const s = senzaCommenti(app('hooks/useTranslationAPI.js'));
    const quanti = (s.match(/segnaStato\('fallito'\)/g) || []).length;
    expect(quanti, 'sia risposta negativa sia errore di rete').toBeGreaterThanOrEqual(2);
  });
});

describe('i cinque stati si distinguono a schermo', () => {
  const m = () => app('components/MessageList.js');

  it('ognuno ha il suo segno', () => {
    const s = m();
    for (const stato of ['in-coda', 'inviato', 'consegnato', 'letto', 'fallito']) {
      expect(s, `manca lo stato ${stato}`).toMatch(new RegExp(`'${stato}'`));
    }
  });

  it('"in coda" si distingue da "inviato" anche a colpo d\'occhio', () => {
    // Stessa spunta con opacita diversa non basterebbe: serve un segno
    // diverso, perche e una differenza di sostanza.
    const s = senzaCommenti(m());
    expect(s).toMatch(/_status === 'in-coda' \? 0\.55 : 1/);
    expect(s, 'un punto, non una spunta').toMatch(/_status === 'in-coda'[\s\S]{0,120}·/);
  });

  it('"fallito" e rosso e non e una spunta', () => {
    const s = senzaCommenti(m());
    expect(s).toMatch(/_status === 'fallito' \? \(PALETTE\.red/);
  });

  it('e c\'e una parola, non solo un simbolo', () => {
    // Chi usa un lettore di schermo sentirebbe altrimenti solo
    // "immagine". E anche chi vede, davanti a un punto grigio, non
    // saprebbe che vuol dire.
    const s = m();
    expect(s).toMatch(/const ETICHETTA_STATO = \{/);
    // b.138 — la parola c'e ancora, ma ETICHETTA_STATO tiene il NOME
    // della chiave e la frase la mette L(): prima erano cinque frasi
    // italiane, e chi ascoltava l'app in un'altra lingua le sentiva cosi.
    expect(s).toMatch(/aria-label=\{L\(ETICHETTA_STATO/);
    expect(s).toMatch(/title=\{L\(ETICHETTA_STATO/);
  });
});

describe('l\'ordine degli stati non torna indietro', () => {
  it('una conferma di consegna in ritardo non cancella "letto"', () => {
    // Le due conferme viaggiano su canali diversi e possono arrivare in
    // ordine qualsiasi: senza questo controllo, un messaggio gia letto
    // tornerebbe a "consegnato".
    const s = senzaCommenti(app('hooks/useRoomPolling.js'));
    expect(s).toMatch(/_status === 'consegnato' \|\| prev\[idx\]\._status === 'letto'/);
  });

  it('i nomi vecchi in inglese non sono rimasti in giro', () => {
    // Meta in italiano e meta in inglese e il modo piu semplice per
    // ritrovarsi con due stati che non combaciano mai.
    for (const f of ['hooks/useRoomPolling.js', 'hooks/useTranslationAPI.js', 'components/MessageList.js']) {
      const s = senzaCommenti(app(f));
      expect(s, `${f} usa ancora i nomi vecchi`).not.toMatch(/_status === 'read'|_status === 'delivered'|_status: 'read'|_status: 'delivered'/);
    }
  });
});
