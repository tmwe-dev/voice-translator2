// ═══════════════════════════════════════════════════════════════
// b.237 — la regia della conversazione e il secondo asse (profili).
//
// Il difetto (audit conversazionale): i Compagni facevano
// ASCOLTA → RISPONDI → DOMANDA, un questionario. Mancava la regia:
// capire COSA sta facendo la persona prima di decidere la mossa.
//
// Qui si prova: (1) il controllore stima le situazioni giuste dai
// segnali di forma; (2) ogni situazione detta una mossa; (3) l'involucro
// monta il profilo come asse SEPARATO dalla libertà; (4) ogni superficie
// riceve il profilo giusto; (5) i call site veri lo passano davvero.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { situazioneDaTesto, mossaPerSituazione, regiaConversazione } from '../app/lib/compagni/controllore.js';
import { PROFILI, promptProfilo, profiloPerSuperficie, PROFILI_ELENCO, pulisciProfili, profiloEffettivo } from '../app/lib/compagni/profili.js';
import { involucroCompagno } from '../app/lib/compagni/contratto.js';
import { promptTavolo } from '../app/lib/compagni/tavolo.js';
import { promptTurno } from '../app/lib/compagni/podcast.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('controllore — la situazione si stima dai segnali, non a caso', () => {
  it('una domanda è una domanda', () => {
    expect(situazioneDaTesto('Come funziona la fotosintesi?')).toBe('domanda');
    // ...ma "quale conviene?" è una DECISIONE: la parola spia vince sul "?"
    // perché la mossa giusta lì è mettere in fila pro e contro.
    expect(situazioneDaTesto('Secondo te quale conviene?')).toBe('decisione');
  });
  it('lo sfogo si riconosce e NON diventa un interrogatorio', () => {
    const s = situazioneDaTesto('Oggi sono stanco morto, non ne posso più');
    expect(s).toBe('sfogo');
    expect(mossaPerSituazione(s)).toMatch(/ASCOLTA/);
    expect(mossaPerSituazione(s)).toMatch(/UNA domanda/);
  });
  it('i puntini sospesi = sta ancora pensando: si accompagna, non si chiude', () => {
    const s = situazioneDaTesto('Secondo me il problema vero è che...');
    expect(s).toBe('riflessione');
    expect(mossaPerSituazione(s)).toMatch(/accompagna/i);
  });
  it('una decisione da prendere chiede pro e contro, non filosofia', () => {
    expect(situazioneDaTesto('Non so se accettare il lavoro a Milano o restare qui')).toBe('decisione');
  });
  it('un compito concreto è operativo: informazioni tutte insieme, poi passi', () => {
    const s = situazioneDaTesto('Organizzami il viaggio a Tokyo per marzo');
    expect(s).toBe('richiesta');
    expect(mossaPerSituazione(s)).toMatch(/in un colpo solo/);
  });
  it('un saluto secco resta un saluto, un "ok" fa PROSEGUIRE senza ripetere', () => {
    expect(situazioneDaTesto('Ciao!')).toBe('saluto');
    expect(situazioneDaTesto('ok')).toBe('conferma');
    expect(mossaPerSituazione('conferma')).toMatch(/PROSEGUI/);
  });
  it('la regia dichiara di essere una stima, non un ordine cieco', () => {
    const { blocco, situazione } = regiaConversazione({ ultimo: 'Che ne pensi?' });
    expect(situazione).toBe('domanda');
    expect(blocco).toMatch(/stima, non certezza/);
    expect(blocco).toMatch(/REGIA DI QUESTO TURNO/);
  });
});

describe('profili — il secondo asse, separato dalla libertà', () => {
  it('esistono i quattro profili, ciascuno con la sua condotta', () => {
    expect(Object.keys(PROFILI).sort()).toEqual(['conversazionale', 'dibattimentale', 'didattico', 'operativo']);
    expect(promptProfilo('conversazionale')).toMatch(/NON chiudere ogni risposta con una domanda/);
    expect(promptProfilo('didattico')).toMatch(/comprensione viene PRIMA del programma/);
    expect(promptProfilo('dibattimentale')).toMatch(/steelman/);
    expect(promptProfilo('operativo')).toMatch(/RISULTATO/);
  });
  it('ogni superficie riceve il profilo giusto', () => {
    expect(profiloPerSuperficie('amico')).toBe('conversazionale');
    expect(profiloPerSuperficie('impara')).toBe('didattico');
    expect(profiloPerSuperficie('tavolo')).toBe('dibattimentale');
    expect(profiloPerSuperficie('podcast')).toBe('dibattimentale');
    expect(profiloPerSuperficie('dossier')).toBe('operativo');
  });
  it('l\'involucro monta il profilo quando c\'è, e resta identico quando non c\'è', () => {
    const senza = involucroCompagno({ liberta: 'balanced' });
    const con = involucroCompagno({ liberta: 'balanced', profilo: 'didattico' });
    expect(senza).not.toMatch(/PROFILO DIDATTICO/);
    expect(con).toMatch(/PROFILO DIDATTICO/);
    // Il profilo NON sostituisce la libertà: convivono, assi diversi.
    expect(con).toMatch(/MODO EQUILIBRATO/);
  });
  it('l\'elenco per il form del Deep Setting è pronto', () => {
    expect(PROFILI_ELENCO.map(p => p.id)).toContain('operativo');
    expect(PROFILI_ELENCO.every(p => p.etichetta && p.obiettivo)).toBe(true);
  });
});

describe('deep setting — l\'override si valida PRIMA di toccare il database', () => {
  it('passa solo ciò che esiste: superfici note, profili noti', () => {
    expect(pulisciProfili({ amico: 'didattico', tavolo: 'operativo' }))
      .toEqual({ amico: 'didattico', tavolo: 'operativo' });
    // Robaccia: superficie inventata, profilo inventato, tipi sbagliati.
    expect(pulisciProfili({ hacker: 'didattico', amico: 'jailbreak', impara: 42 })).toBe(null);
    expect(pulisciProfili('stringa')).toBe(null);
    expect(pulisciProfili(null)).toBe(null);
    expect(pulisciProfili({})).toBe(null);
  });
  it('il profilo effettivo: override se c\'è e vale, altrimenti il default', () => {
    const c = { profili: { tavolo: 'conversazionale' } };
    expect(profiloEffettivo(c, 'tavolo')).toBe('conversazionale');    // override
    expect(profiloEffettivo(c, 'amico')).toBe('conversazionale');     // default
    expect(profiloEffettivo({}, 'podcast')).toBe('dibattimentale');   // default
    expect(profiloEffettivo({ profili: { amico: 'finto' } }, 'amico')).toBe('conversazionale'); // invalido → default
  });
  it('il Tavolo rispetta l\'override del Deep Setting', () => {
    const { system } = promptTavolo({ compagno: { nome: 'Alex', profili: { tavolo: 'operativo' } }, ultimoUmano: 'Fate.' });
    expect(system).toMatch(/PROFILO OPERATIVO/);
    expect(system).not.toMatch(/PROFILO DIBATTIMENTALE/);
  });
  it('la persistenza valida i profili in scrittura E in lettura', () => {
    const s = leggi('app/lib/compagni/persistenza.js');
    const scritture = (s.match(/pulisciProfili\(/g) || []).length;
    expect(scritture, 'una in riga (salva), una in daRiga (legge)').toBeGreaterThanOrEqual(2);
  });
});

describe('i call site veri usano davvero il secondo asse', () => {
  it('il Tavolo dibatte col profilo dibattimentale', () => {
    const { system } = promptTavolo({ compagno: { nome: 'Alex', personalita: 'Analista.' }, ultimoUmano: 'Che ne dite?' });
    expect(system).toMatch(/PROFILO DIBATTIMENTALE/);
  });
  it('il Podcast pure', () => {
    const { system } = promptTurno({ compagno: { nome: 'Elena' }, argomento: 'AI' });
    expect(system).toMatch(/PROFILO DIBATTIMENTALE/);
  });
  it('la rotta Amico monta il profilo effettivo E la regia del turno', () => {
    const s = leggi('app/api/compagni/amico/route.js');
    expect(s).toMatch(/profilo: profiloEffettivo\(compagno, 'amico'\)/);
    expect(s).toMatch(/regiaConversazione\(\{ ultimo, storia: messaggi \}\)/);
  });
  it('il generatore dei corsi insegna col profilo didattico', () => {
    const s = leggi('app/lib/compagni/corsi/generatore.js');
    expect(s).toMatch(/promptProfilo\('didattico'\)/);
  });
  it('Archimede ragiona col modello pieno, gli altri restano sul default', () => {
    const s = leggi('app/lib/compagni/catalogo.js');
    const archimede = s.slice(s.indexOf("id: 'archimede'"), s.indexOf("id: 'dott-elena'"));
    expect(archimede).toMatch(/modello: 'gpt-4o'/);
    const elena = s.slice(s.indexOf("id: 'dott-elena'"), s.indexOf("id: 'avv-marco'"));
    expect(elena).not.toMatch(/modello: 'gpt-4o'[^-]/);
  });
});
