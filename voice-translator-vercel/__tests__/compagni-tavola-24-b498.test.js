import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══ b.498 — TAVOLA 24: I COMPAGNI ═══
// «La memoria e un interruttore visibile su ogni Compagno» — non piu
// sepolta nel modulo di modifica. «Dimentica tutto» sta nella riga
// sotto, col colore dell'attenzione. E aggiungerne uno e la pillola
// grande in fondo.

const vista = readFileSync(join(process.cwd(), 'app/components/Life/GestioneCompagni.js'), 'utf8');

describe('tavola 24 — i Compagni', () => {
  it('la memoria e un interruttore visibile sulla card dei miei', () => {
    expect(vista).toMatch(/toggleMemoria/);
    const carta = vista.slice(vista.indexOf('const carta ='));
    expect(carta).toMatch(/memoria/);
  });

  it('l\'interruttore salva davvero (salvaMio) e ricarica la lista', () => {
    expect(vista).toMatch(/toggleMemoria[\s\S]{0,600}salvaMio/);
  });

  it('dimentica sta nella riga sotto, col colore dell\'attenzione', () => {
    const carta = vista.slice(vista.indexOf('const carta ='));
    expect(carta).toMatch(/dimentica\(c\.id\)/);
    expect(carta).toMatch(/color: dimenticato === c\.id \? accent : rosso/);
  });

  it('aggiungere un Compagno e la pillola grande in fondo', () => {
    const posListe = vista.indexOf('lifePredefined');
    const posAggiungi = vista.lastIndexOf('lifeCreateManual');
    expect(posAggiungi).toBeGreaterThan(posListe);
  });
});
