// ═══════════════════════════════════════════════════════════════
// b.412 — tre punti che avevano in comune una cosa: un'informazione
// c'era e non arrivava dove serviva.
//
// P1.12 — il Dossier SA quando la ricerca fonti e fallita, lo mostra
// pure a schermo, e non lo diceva al prompt del report: che quindi
// intitolava «Fatti di partenza (dalle fonti)» un testo nato senza
// nemmeno una fonte. L13 dell'audit.
//
// P1.11 — lo Stop del Tavolo alzava una bandierina che fermava la VOCE
// successiva, ma la generazione gia partita continuava fino in fondo:
// si pagava, e chi aveva premuto Stop restava ad aspettare.
//
// P1.19 — le lezioni di un corso pubblico venivano salvate cosi com'erano,
// e finiscono nella schermata e nel prompt di ALTRI utenti. Compresi i
// corsi per bambini.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promptReport, FONTI } from '../app/lib/compagni/dossier.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const BRIEFING = 'Nel 2024 il consumo e cresciuto del 12%.';
const report = (statoFonti) => promptReport({
  argomento: 'energia', briefing: BRIEFING, statoFonti, discussione: 'A: ... B: ...',
}).prompt;

describe('L13 / P1.12 — un testo senza fonti non si traveste da evidenza', () => {
  it('con le fonti vere, si dice che sono supportate dalle fonti', () => {
    expect(report(FONTI.VERIFICATE)).toContain('supportati dalle fonti');
  });

  it('SENZA fonti non compare piu la parola «fonti» come garanzia', () => {
    const p = report(FONTI.ASSENTI);
    expect(p, 'era questo il difetto').not.toContain('Fatti di partenza supportati dalle fonti');
    expect(p).toContain('NON verificato da fonti');
    expect(p, 'il testo c\'e ancora: cambia come viene presentato').toContain(BRIEFING);
  });

  it('e con la ricerca GUASTA lo si dice al modello a chiare lettere', () => {
    const p = report(FONTI.GUASTE);
    expect(p).toMatch(/RICERCA FONTI/i);
    expect(p).toMatch(/non trattarlo come evidenza/i);
  });

  it('i tre stati producono tre intestazioni diverse, non due', () => {
    const tre = new Set([report(FONTI.VERIFICATE), report(FONTI.ASSENTI), report(FONTI.GUASTE)]);
    expect(tre.size).toBe(3);
  });

  it('senza briefing non si intitola niente', () => {
    const p = promptReport({ argomento: 'x', briefing: '', statoFonti: FONTI.ASSENTI, discussione: 'y' }).prompt;
    expect(p).not.toMatch(/Contesto generale/);
  });

  it("e lo stato attraversa tutta la catena, non si ferma a meta", () => {
    // Bastava che si fermasse in UN punto e il prompt tornava a mentire.
    expect(senzaCommenti(leggi('app/components/Life/Tavolo.js')), 'la schermata lo tiene').toMatch(/setStatoFonti\(/);
    expect(senzaCommenti(leggi('app/components/Life/Tavolo.js')), 'e lo manda').toMatch(/reportFinale\(\{[^}]*statoFonti/s);
    expect(senzaCommenti(leggi('app/lib/compagni/cliente.js')), 'il cliente lo inoltra').toMatch(/azione: 'report'[^}]*statoFonti/s);
    expect(senzaCommenti(leggi('app/api/compagni/dossier/route.js')), 'la rotta lo legge').toMatch(/statoFonti/);
    expect(senzaCommenti(leggi('app/lib/compagni/dossier.js')), 'e il prompt lo usa').toMatch(/intestazioneBriefing\(statoFonti\)/);
  });

  it('e un valore inventato dal client non diventa «verificate» per sbaglio... anzi si, e va bene cosi', () => {
    // La rotta accetta solo i due stati PEGGIORI dal client e ripiega su
    // «verificate». Sembra al contrario, ma e giusto: lo stato lo produce
    // il nostro server insieme al briefing, e un client che mente puo solo
    // PEGGIORARE la propria intestazione, mai migliorarla.
    const r = senzaCommenti(leggi('app/api/compagni/dossier/route.js'));
    expect(r).toMatch(/body\.statoFonti === FONTI\.GUASTE \|\| body\.statoFonti === FONTI\.ASSENTI/);
  });
});

describe('P1.11 — lo Stop del Tavolo taglia anche cio che e gia partito', () => {
  const t = () => senzaCommenti(leggi('app/components/Life/Tavolo.js'));

  it('la richiesta ha un filo, e lo Stop lo taglia', () => {
    expect(t()).toMatch(/abortRef\.current = new AbortController\(\)/);
    expect(t()).toMatch(/abortRef\.current\?\.abort\(\)/);
  });

  it('e il filo arriva davvero alla richiesta', () => {
    expect(t()).toMatch(/parlaTavolo\(\{[^}]*segnale: abortRef\.current\?\.signal/s);
    expect(senzaCommenti(leggi('app/lib/compagni/cliente.js'))).toMatch(/postJSON\('\/api\/compagni\/tavolo', \{[^}]*\}, segnale\)/s);
  });

  it('si ricontrolla DOPO l\'attesa, non solo prima', () => {
    // fra la partenza e il ritorno ci stanno secondi, ed e li che si
    // preme Stop: senza il secondo controllo le risposte comparivano.
    const corpo = t().slice(t().indexOf('const d = await parlaTavolo('));
    const stop = corpo.indexOf('if (fermatoRef.current) return;');
    const mostra = corpo.indexOf('setMessaggi((m) => [...m, { ruolo: r.nome');
    expect(stop, 'il controllo dopo l\'attesa c\'e').toBeGreaterThan(-1);
    expect(mostra, 'e viene prima di mostrare le risposte').toBeGreaterThan(stop);
  });

  it('e lo Stop del telecomando passa dalla stessa porta', () => {
    expect(t()).toMatch(/suInterruzione\(\(\) => fermaRef\.current\(\)\)/);
  });
});

describe('P1.19 — di una lezione pubblicata si tiene solo cio che si conosce', () => {
  let pubblici;
  beforeEach(async () => {
    vi.resetModules();
    pubblici = await import('../app/lib/compagni/corsi/pubblici.js');
  });

  it('la forma consentita e dichiarata in un posto solo', () => {
    const s = senzaCommenti(leggi('app/lib/compagni/corsi/pubblici.js'));
    expect(s, 'le lezioni si ricostruiscono').toMatch(/\.map\(normalizzaLezione\)/);
    expect(s, 'e non si salvano cosi come arrivano').not.toMatch(/const lezioni = Array\.isArray\(corso\.lezioni\) \? corso\.lezioni\.slice\(0, 20\) : \[\];/);
    // i tre campi permessi, e nessun altro
    expect(s).toMatch(/return \{ titolo, obiettivi, peso \}/);
  });

  it('un peso inventato diventa quello di mezzo, non passa', () => {
    const s = leggi('app/lib/compagni/corsi/pubblici.js');
    expect(s).toMatch(/PESI\.includes\(l\.peso\) \? l\.peso : 'medio'/);
  });

  it('e una lezione senza titolo non e una lezione', () => {
    const s = leggi('app/lib/compagni/corsi/pubblici.js');
    expect(s).toMatch(/if \(!titolo\) return null;/);
    expect(s).toMatch(/\.filter\(Boolean\)/);
  });

  it('titoli e obiettivi hanno una misura, perche finiscono in un prompt altrui', () => {
    const s = leggi('app/lib/compagni/corsi/pubblici.js');
    expect(s).toMatch(/String\(l\.titolo \|\| ''\)\.slice\(0, 160\)/);
    expect(s).toMatch(/\.slice\(0, 8\)/);
    expect(s).toMatch(/String\(o \|\| ''\)\.slice\(0, 200\)/);
  });
});
