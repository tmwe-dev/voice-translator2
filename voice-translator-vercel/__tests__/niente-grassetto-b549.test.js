import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.549 — cinque ordini di Luca, chiusi insieme ═══

describe('b.549 — NIENTE GRASSETTO, da nessuna parte', () => {
  it('nessun fontWeight 600/700/800/900/bold in tutta l\'applicazione', () => {
    // Ordine tassativo: «la cosa tassativa: non voglio grassetto da
    // nessuna parte e neanche dentro i pulsanti cazzo». Erano 666
    // occorrenze in 94 file: adesso zero. Questa prova impedisce che
    // rientrino dalla finestra, un componente alla volta.
    const colpevoli = [];
    const guarda = (dir) => {
      for (const v of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        if (v.name.startsWith('.')) continue;              // scarti del sistema
        const q = `${dir}/${v.name}`;
        if (v.isDirectory()) { guarda(q); continue; }
        if (!v.name.endsWith('.js')) continue;
        const src = leggi(q);
        const trovati = src.match(/fontWeight:\s*'?(600|700|800|900|bold)'?/g) || [];
        if (trovati.length) colpevoli.push(`${q}: ${trovati.length}`);
      }
    };
    guarda('app/components');
    guarda('app/lib');
    expect(colpevoli, 'il grassetto e vietato: usa 500').toEqual([]);
  });
});

describe('b.549 — il pianeta non parte piu al buio', () => {
  it('si apre di giorno, la notte resta a un tocco', () => {
    const g = leggi('app/components/GloboMondo.js');
    expect(g).toMatch(/const \[stato, setStato\] = useState\(1\)/);
    // e l'elenco dei cieli non e cambiato: la notte c'e ancora
    expect(g).toMatch(/\{ id: 'notte'/);
    expect(g).toMatch(/\{ id: 'giorno'/);
  });
});

describe('b.549 — le stanze hanno una faccia nell\'elenco', () => {
  it('ogni riga porta l\'avatar di chi ospita, o la sua iniziale', () => {
    const s = leggi('app/components/StanzeView.js');
    expect(s).toMatch(/non vedo immagini nelle chat/);   // il perche, scritto
    expect(s).toMatch(/\{s\.avatar/);
    expect(s).toMatch(/String\(s\.host \|\| s\.nome \|\| '·'\)\.slice\(0, 1\)/);
  });
});

describe('b.549 — all\'apertura si piantano TUTTI i semi', () => {
  const news = leggi('app/components/MondoNews.js');
  // b.573 — erano tre, ora sono quattro (i tuoi semi piu i rami) e non
  // si ruotano piu qui: l'ordine giusto lo ha gia deciso `mescolaSemi`.
  it('fino a quattro giri, il primo apre e gli altri si accodano', () => {
    expect(news).toMatch(/const scelti = giri\.filter\(\(g\) => g\?\.query\)\.slice\(0, 4\)/);
    expect(news).toMatch(/await cerca\(scelti\[0\]\.query, 'notizie', false, true\)/);
    expect(news).toMatch(/await cerca\(altro\.query, 'notizie', false, true, true\)/);
  });
  it('e la guardia non scarta piu le ricerche in fila', () => {
    // `cercando` e uno stato: con due await di fila la seconda partiva
    // prima del ridisegno e veniva buttata. Ora si guarda un riferimento.
    // b.552 — la guardia si e' sdoppiata: chi cerca in primo piano NON
    // viene piu scartato se sta girando una ricerca in sottofondo (la
    // annulla e passa avanti). Il punto di b.549 — che la guardia guardi
    // un RIFERIMENTO e non uno stato — vale identico.
    expect(news).toMatch(/if \(!pulita\) return;/);
    expect(news).toMatch(/if \(cercandoRef\.current\) \{/);
    expect(news).toMatch(/cercandoRef\.current = true;/);
    expect(news).toMatch(/cercandoRef\.current = false;/);
  });
});

describe('b.549 — i guru si possono invitare in stanza', () => {
  it('il pannello esiste e mostra i Compagni veri', () => {
    const g = leggi('app/components/ui/InvitaGuru.js');
    expect(g).toMatch(/import \{ COMPAGNI_PREDEFINITI \}/);
    expect(g).toMatch(/onInvita\?\.\(scelto\)/);
    expect(g).toMatch(/L\('inviteGuruTitle'\)/);
  });
  it('la stanza ha il tasto, e il guru legge gli ultimi messaggi', () => {
    const r = leggi('app/components/RoomView.js');
    expect(r).toMatch(/<InvitaGuru aperto=\{guruAperto\}/);
    expect(r).toMatch(/setGuruAperto\(true\)/);
    expect(r).toMatch(/const invitaGuru = useCallback/);
    expect(r, 'entra sapendo di cosa si parla').toMatch(/\(messages \|\| \[\]\)\.slice\(-8\)/);
    expect(r, 'e la persona puo correggerlo prima di inviare').toMatch(/setTextInput\(`\$\{chi\?\.nome \|\| 'Compagno'\}: \$\{detto\}`\)/);
  });
  it('le parole ci sono in tutti e 38 i pacchetti', async () => {
    for (const f of readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      for (const k of ['inviteGuruTitle', 'inviteGuruDesc', 'inviteGuruDo']) {
        expect(typeof o[k], `${f}:${k}`).toBe('string');
      }
    }
    // b.552 — questa prova apre a uno a uno TUTTI e 38 i pacchetti di
    // lingua: mezzo megabyte di traduzioni. Sul portatile mentre lavora
    // i cinque secondi di prammatica non bastano, e un rosso per
    // stanchezza della macchina e' peggio di nessun rosso.
  }, 30000);
});
