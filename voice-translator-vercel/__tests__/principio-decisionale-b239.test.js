// ═══════════════════════════════════════════════════════════════
// b.239 — il criterio di scelta (Convergence Decision Model, Fase 1).
//
// Dal documento prendiamo l'idea utile — confrontare più mosse e scegliere
// quella che tiene insieme obiettivo, momento e responsabilità — e NON la
// parte numerica: punteggi che nessuno misura sembrerebbero rigore senza
// esserlo, e la distanza euclidea è compensatoria, cioè contraddice il
// principio che dovrebbe difendere.
//
// I due vincoli che questi test inchiodano:
//   1. il criterio NON scavalca sicurezza, verità e permessi;
//   2. la deliberazione resta invisibile e la risposta breve — qui la voce
//      si paga a carattere, un ragionamento a schermo costerebbe due volte.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  PRINCIPIO_DECISIONALE, GERARCHIA_PRIORITA, REGOLE_EPISTEMICHE, involucroCompagno,
} from '../app/lib/compagni/contratto.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('il criterio di scelta — confronto fra mosse, non una regola', () => {
  it('mette sul tavolo mosse diverse dalla risposta immediata', () => {
    expect(PRINCIPIO_DECISIONALE).toMatch(/una mossa migliore della risposta più immediata/);
    expect(PRINCIPIO_DECISIONALE).toMatch(/dire meno/);
  });

  it('ma NON promette una facolta che il canale non da: niente "puoi tacere"', () => {
    // Oggi un turno e richiesta->risposta: scrivere "puoi scegliere di non
    // rispondere" chiederebbe al modello di fingere. Il surrogato onesto e
    // non occupare spazio inutile. WAIT tornera col full-duplex.
    expect(PRINCIPIO_DECISIONALE).not.toMatch(/non rispondere|puoi tacere|resta in silenzio/i);
    expect(PRINCIPIO_DECISIONALE).toMatch(/Non occupare più spazio conversazionale del necessario/);
    expect(PRINCIPIO_DECISIONALE).toMatch(/non anticipare il pensiero della persona/);
  });

  it('chiede convergenza, non massimizzazione di un asse solo', () => {
    expect(PRINCIPIO_DECISIONALE).toMatch(/INSIEME/);
    expect(PRINCIPIO_DECISIONALE).toMatch(/senza sacrificarne irragionevolmente una alle altre/);
    // Le tre dimensioni ci sono tutte, in parole, non in coordinate.
    expect(PRINCIPIO_DECISIONALE).toMatch(/l'obiettivo/);              // obiettivo
    expect(PRINCIPIO_DECISIONALE).toMatch(/la situazione presente/);   // situazione
    expect(PRINCIPIO_DECISIONALE).toMatch(/responsabilità del tuo ruolo/); // relazione
  });

  it('NON porta dentro punteggi, assi numerati o geometria', () => {
    // Erano la parte debole del modello: numeri mai misurati, e una distanza
    // compensatoria che avrebbe permesso a un asse alto di coprirne uno basso.
    expect(PRINCIPIO_DECISIONALE).not.toMatch(/0\.\d|\bX\b|\bY\b|\bZ\b|cubo|vertice|distanza|punteggio/i);
  });
});

describe('i due vincoli che lo rendono sicuro e sostenibile', () => {
  it('la deliberazione resta invisibile e la risposta breve', () => {
    expect(PRINCIPIO_DECISIONALE).toMatch(/Il confronto resta interno/);
    expect(PRINCIPIO_DECISIONALE).toMatch(/non descrivere il tuo processo decisionale/);
    // La riga che protegge latenza e costo TTS (qui la voce si paga a carattere).
    expect(PRINCIPIO_DECISIONALE).toMatch(/non lasciare che un ragionamento più ampio allunghi automaticamente la risposta/);
  });

  it('e non scavalca sicurezza, verità e permessi: viene DOPO', () => {
    const inv = involucroCompagno({ liberta: 'balanced' });
    const iGerarchia = inv.indexOf(GERARCHIA_PRIORITA.slice(0, 40));
    const iEpistemica = inv.indexOf(REGOLE_EPISTEMICHE.slice(0, 40));
    const iCriterio = inv.indexOf(PRINCIPIO_DECISIONALE.slice(0, 40));
    expect(iGerarchia, 'la gerarchia deve esserci').toBeGreaterThan(-1);
    expect(iCriterio, 'il criterio deve esserci').toBeGreaterThan(-1);
    expect(iGerarchia, 'la sicurezza viene prima del criterio').toBeLessThan(iCriterio);
    expect(iEpistemica, 'l\'anti-invenzione viene prima del criterio').toBeLessThan(iCriterio);
  });

  it('resta corto: la velocità è un requisito', () => {
    expect(PRINCIPIO_DECISIONALE.length).toBeLessThan(900);
  });
});

describe('vale ovunque, perché sta nella costituzione', () => {
  it('arriva a tutte le superfici che montano l\'involucro', () => {
    // Amico, Tavolo, Podcast e i corsi passano tutti da involucroCompagno.
    for (const liberta of ['strict', 'balanced', 'creative', 'autonomous']) {
      expect(involucroCompagno({ liberta })).toContain('PRINCIPIO DI GIUDIZIO');
    }
    expect(involucroCompagno({ liberta: 'balanced', profilo: 'didattico' }))
      .toContain('PRINCIPIO DI GIUDIZIO');
  });

  it('e non ha aggiunto nessuna chiamata al modello', () => {
    // Il criterio vive nel prompt: se comparisse una seconda generaTesto per
    // "decidere la mossa", avremmo raddoppiato costo e latenza per turno.
    const rotta = leggi('app/api/compagni/amico/route.js');
    expect((rotta.match(/await generaTesto\(/g) || []).length).toBe(1);
  });
});
