import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanaSezione, risolviSezioni, bloccoSezioni } from '../app/lib/compagni/sezioni.js';
import { haAppenaConcordato, rigaAntiEco } from '../app/lib/compagni/orchestratore.js';
import { promptTavolo } from '../app/lib/compagni/tavolo.js';
import { promptTurno } from '../app/lib/compagni/podcast.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.533 — Luca: «perche non hai completato quanto discusso?????».
// I quattro pezzi di RadioChat rimasti fuori, portati TUTTI, provati
// sui RISULTATI.

const C = { id: 'x', nome: 'Test', personalita: 'Sei Test.', liberta: 'strict' };

describe('b.533 — Prompt Sections: la KB personale (funzioni VERE)', () => {
  const sezioni = [
    { tipo: 'regole', titolo: 'Formato', testo: 'Chiudi con una domanda.', priorita: 1 },
    { tipo: 'argomento', titolo: 'Economia', testo: 'Cita dati recenti.', tag: ['inflazione', 'economia'], priorita: 3 },
    { tipo: 'contesto', testo: 'Progetto di ricerca.', priorita: 2 },
    { tipo: 'argomento', testo: 'Regola sportiva.', tag: ['calcio'], priorita: 4 },
    { tipo: 'regole', testo: 'Spenta.', attiva: false },
  ];
  it('regole e contesto sempre; argomento solo se il tag compare; spente mai', () => {
    const att = risolviSezioni(sezioni, "Parliamo dell'inflazione in Europa");
    expect(att.map(s => s.testo)).toEqual(['Chiudi con una domanda.', 'Progetto di ricerca.', 'Cita dati recenti.']);
  });
  it('il blocco entra nel prompt del Tavolo e del Podcast', () => {
    const b = bloccoSezioni(sezioni, 'inflazione');
    const t = promptTavolo({ compagno: C, ultimoUmano: 'ciao', lingua: 'it', sezioniBlocco: b }).system;
    const p = promptTurno({ compagno: C, argomento: 'x', lingua: 'it', sezioniBlocco: b }).system;
    expect(t).toContain('REGOLE PERSONALI');
    expect(p).toContain('Cita dati recenti.');
  });
  it('la sanificazione non si fida del client', () => {
    expect(sanaSezione({ tipo: 'hack', testo: 'x'.repeat(2000), priorita: 99 })).toMatchObject({ tipo: 'regole', priorita: 10 });
    expect(sanaSezione({ tipo: 'regole', testo: '' })).toBeNull();
  });
});

describe('b.533 — il riassunto cumulativo entra nei prompt', () => {
  it('Tavolo: il verbale compare come PRIMA, IN SINTESI', () => {
    const t = promptTavolo({ compagno: C, ultimoUmano: 'ciao', lingua: 'it', riassunto: 'Marco vuole i dati; Elena dissente.' }).system;
    expect(t).toContain('PRIMA, IN SINTESI');
    expect(t).toContain('Elena dissente.');
  });
  it('Podcast: idem, nel prompt utente', () => {
    const p = promptTurno({ compagno: C, argomento: 'x', round: 3, precedenti: [{ nome: 'A', testo: 'b' }], lingua: 'it', riassunto: 'Round 1: si parlava di dazi.' });
    expect(p.user).toContain('PRIMA, IN SINTESI');
  });
  it('la rotta ha l azione riassunto e il client il suo attrezzo', () => {
    expect(leggi('app/api/compagni/tavolo/route.js')).toMatch(/azione === 'riassunto'/);
    expect(leggi('app/lib/compagni/cliente.js')).toMatch(/export function aggiornaRiassunto/);
    expect(leggi('app/components/Life/Tavolo.js')).toMatch(/aggiornaVerbale\(perServer\)/);
    expect(leggi('app/components/Life/LifeView.js')).toMatch(/riassunto: riassuntoRef\.current/);
  });
});

describe('b.533 — turni smart e anti-eco personale', () => {
  const f = leggi('app/api/compagni/tavolo/route.js');
  it('dal secondo giro l ordine ruota, col 30% di scambio', () => {
    expect(f).toMatch(/giriFatti % ordine\.length/);
    expect(f).toMatch(/Math\.random\(\) < 0\.3/);
    expect(f).toMatch(/for \(const c of ordine\)/);
  });
  it('chi ha appena concordato riceve l asticella, non il bavaglio', () => {
    expect(haAppenaConcordato('Sono d\'accordo con Marco', 'it')).toBe(true);
    expect(haAppenaConcordato('I numeri dicono altro', 'it')).toBe(false);
    expect(rigaAntiEco('it')).toContain('passa');
    expect(f).toMatch(/haAppenaConcordato\(suoUltimo\.testo, lingua\)/);
  });
});

describe('b.533 — il giornale del viaggiatore e la copertina del podcast', () => {
  it('entrando in Notizie senza ricerche, la prima parte da sola (e non sporca le tue)', () => {
    const f = leggi('app/components/MondoNews.js');
    expect(f).toMatch(/__VT_GAZZETTA/);
    expect(f).toMatch(/ricerchePredefinite\(prefs, nomePaese\)/);
    // b.551 — AGGIORNATA (rosso pre-esistente, dichiarato apertamente).
    // b.549 ha cambiato il gesto: non si pianta piu UN giro (`giro.query`)
    // ma i primi tre semi, il primo subito e gli altri accodati —
    // collaudo di Luca «mostra solo i preferiti... non fa l'autoricerca».
    // Cio che b.533 difendeva resta identico e resta provato qui sotto:
    // la ricerca d'ingresso e' SILENZIOSA (quarto argomento `true`), cioe
    // non finisce fra le tue ricerche.
    expect(f).toMatch(/await cerca\(scelti\[0\]\.query, 'notizie', false, true\)/);
    expect(f, 'gli altri semi si accodano, non sostituiscono').toMatch(/await cerca\(altro\.query, 'notizie', false, true, true\)/);
    expect(f).toMatch(/if \(silenziosa\) throw/);
  });
  it('il podcast ha la copertina dalla rotta video gia in cache (niente wallet)', () => {
    const f = leggi('app/components/Life/LifeView.js');
    expect(f).toMatch(/\/api\/topics\/video\?q=/);
    expect(f).toMatch(/setCopertina\(\{ img: v\.miniatura/);
  });
  it('la KB si edita da Gestione Compagni', () => {
    const f = leggi('app/components/Life/GestioneCompagni.js');
    expect(f).toMatch(/function SezioneNuova/);
    expect(f).toMatch(/sezioniPrompt: \[\.\.\.\(prefs\?\.sezioniPrompt \|\| \[\]\), sz\]/);
  });
});
