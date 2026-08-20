// b.358 — IL CORSO CHE NON NASCEVA PIU (collaudo di Luca: «il corso di
// inglese non viene piu creato»).
//
// Il syllabus si accettava SOLO come array nudo. Ma il docente porta addosso
// una vocazione lunga e narrativa, e davanti a "rispondi SOLO con JSON" il
// modello a volte incarta l'elenco dentro un oggetto — `{"lezioni":[...]}`,
// `{"syllabus":[...]}` — oppure risponde in prosa. Nel primo caso il corso
// moriva per niente; nel secondo moriva in silenzio.
//
// Qui si prova la parte pura: comunque sia incartato, l'elenco si trova.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { elencoLezioniDa, estraiJSON } from '../app/lib/compagni/corsi/generatore.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

const LEZIONI = [
  { titolo: 'Salutare e presentarsi', obiettivi: ['dire il proprio nome'], peso: 'alto' },
  { titolo: 'Chiedere indicazioni', obiettivi: ['orientarsi in citta'], peso: 'medio' },
];

describe('il corso nasce comunque il modello incarti la risposta', () => {
  it('array nudo: la forma che gia funzionava', () => {
    expect(elencoLezioniDa(LEZIONI)).toHaveLength(2);
  });

  it('elenco dentro un oggetto: PRIMA moriva qui', () => {
    expect(elencoLezioniDa({ lezioni: LEZIONI }), 'la chiave italiana').toHaveLength(2);
    expect(elencoLezioniDa({ syllabus: LEZIONI }), 'la chiave inglese').toHaveLength(2);
    expect(elencoLezioniDa({ corso: { titolo: 'x' }, elenco: LEZIONI }), 'una chiave qualunque').toHaveLength(2);
  });

  it('scarta cio che lezione non e', () => {
    expect(elencoLezioniDa(null)).toEqual([]);
    expect(elencoLezioniDa('una lezione bellissima')).toEqual([]);
    expect(elencoLezioniDa([])).toEqual([]);
    expect(elencoLezioniDa({ note: ['ciao', 'come stai'] }), 'stringhe non sono lezioni').toEqual([]);
    expect(elencoLezioniDa([{ obiettivi: ['senza titolo'] }]), 'senza titolo non e una lezione').toEqual([]);
  });

  it('funziona sul JSON vero come esce dal modello, involucro compreso', () => {
    const rispostaModello = '```json\n{"lezioni":[{"titolo":"Salutare","obiettivi":["a"],"peso":"alto"}]}\n```';
    expect(elencoLezioniDa(estraiJSON(rispostaModello))).toHaveLength(1);
  });

  it('se la prima risposta e illeggibile si RIPROVA con una veste neutra', () => {
    const src = leggi('lib/compagni/corsi/generatore.js');
    expect(src, 'il secondo tentativo esiste').toMatch(/veste neutra/);
    expect(src, 'senza personaggio: solo JSON').toContain('Rispondi SOLO con JSON valido, senza una parola fuori dal JSON');
  });

  it('il motivo del guasto non si perde piu lungo la catena', () => {
    expect(leggi('api/compagni/corso/route.js'), 'il server lo scrive').toMatch(/log\.warn\('generazione non riuscita'/);
    expect(leggi('lib/compagni/cliente.js'), 'il client lo porta a galla').toMatch(/err\.motivo/);
    const vista = leggi('components/Life/LifeView.js');
    expect(vista, 'e la schermata distingue la sessione scaduta').toMatch(/e\.status === 401\) setErrore\(L\('lifeLoginNeeded'\)\)/);
  });
});
