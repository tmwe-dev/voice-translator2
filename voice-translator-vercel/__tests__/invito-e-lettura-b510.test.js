// b.510 — tre richieste di Luca durante il giro di test:
//   1. «sono in stanze, permettimi di creare a stanza e invitare anche
//      da dentro la stanza» — invito raggiungibile dal menu della stanza,
//      non solo dal logo di Home.
//   2. «non voglio essere obbligato a uscire dall'applicazione per
//      leggere un testo... devi permettermi di leggerlo dentro il
//      contenitore» — la fonte di una discussione si apre in un lettore
//      interno, non in una scheda nuova del browser.
//   3. «come faccio a condividere un post da instagram, linkedin o
//      facebook?» — bottone Condividi con il foglio nativo del sistema.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.510 — invito dall\'interno della stanza', () => {
  it('RoomHeader ha una voce "Invita" nel menu che porta a quickinvite', () => {
    const p = leggi('app/components/RoomHeader.js');
    expect(p).toMatch(/roomId && setView &&/);
    expect(p).toMatch(/L\('inviteFriend'\)/);
    expect(p).toMatch(/setView\('quickinvite'\)/);
  });

  it('QuickInvite: il tasto indietro torna alla stanza se si arriva da una stanza esistente', () => {
    const p = leggi('app/components/QuickInvite.js');
    expect(p).toMatch(/if \(roomId && setViewAfterCreate\) setViewAfterCreate\(\); else setView\('home'\);/);
  });
});

describe('b.510 — leggere dentro il contenitore, non uscire dall\'app', () => {
  it('la card della fonte non apre piu una scheda nuova del browser', () => {
    const p = leggi('app/components/MondoDiscussioni.js');
    expect(p, 'niente piu target=_blank sulla card della fonte').not.toMatch(/href=\{media\.url\} target="_blank"/);
    expect(p, 'ora apre il lettore interno').toMatch(/onClick=\{\(\) => setLettoreUrl\(media\.url\)\}/);
  });

  it('esiste il lettore interno con iframe e il ripiego "apri nel browser" sempre visibile', () => {
    const p = leggi('app/components/MondoDiscussioni.js');
    expect(p).toMatch(/const \[lettoreUrl, setLettoreUrl\] = useState\(null\);/);
    expect(p).toMatch(/<iframe src=\{lettoreUrl\}/);
    expect(p, 'il ripiego usa la chiave gia esistente openOutside').toMatch(/L\('openOutside'\)/);
  });
});

describe('b.510 — condividere un post (Instagram, LinkedIn, Facebook...)', () => {
  it('MondoDiscussioni ha un bottone Condividi con navigator.share', () => {
    const p = leggi('app/components/MondoDiscussioni.js');
    expect(p).toMatch(/typeof navigator !== 'undefined' && navigator\.share/);
    expect(p).toMatch(/navigator\.share\(\{ title: disc\.title/);
    expect(p).toMatch(/L\('shareWord'\)/);
  });
});
