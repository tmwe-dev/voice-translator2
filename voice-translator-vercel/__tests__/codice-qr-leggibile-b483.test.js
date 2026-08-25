// ═══════════════════════════════════════════════════════════════
// UN CODICE A BARRE DEVE POTER ESSERE LETTO — b.483
//
// Il difetto da cui nasce: il QR che si mostra al TASSISTA era VERDE SU
// BLU SCURO. E l'unico codice dell'applicazione che deve inquadrare uno
// sconosciuto, di corsa, dentro un'auto — ed era l'unico disegnato al
// contrario. Un lettore si aspetta scuro su chiaro; al rovescio molte
// fotocamere non leggono, e non lo dicono: semplicemente non succede
// niente, e chi inquadra pensa di aver sbagliato lui.
//
// Il secondo difetto era piu serio: tre dei cinque codici li disegnava un
// server di TERZI. Se quel server e lento o irraggiungibile, il codice
// non compare — su schermate il cui unico scopo e il codice. E
// l'indirizzo di casa di chi lo usa usciva dal telefono.
//
// Questa prova tiene ferme le tre cose che rendono leggibile un QR, e lo
// fa in un posto solo, cosi la prossima schermata che ne vorra uno non
// puo reinventarsi i colori.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');

function fileConCodice(dir, trovati = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) fileConCodice(p, trovati);
    else if (/\.jsx?$/.test(voce.name)) trovati.push(p);
  }
  return trovati;
}

// un difetto CITATO in un commento non e quel difetto (trappola numero 6)
function senzaCommenti(testo) {
  return testo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('il codice a barre si legge', () => {
  const sorgente = fs.readFileSync(path.join(APP, 'lib', 'codiceQR.js'), 'utf8');

  it('c\'e un posto solo che decide come si disegna un QR', () => {
    expect(sorgente).toContain('export async function disegnaQR');
    expect(sorgente).toContain('export async function immagineQR');
  });

  it('il tratto e NERO e il fondo e BIANCO', () => {
    const codice = senzaCommenti(sorgente);
    expect(codice, 'il tratto deve essere nero pieno').toMatch(/QR_TRATTO\s*=\s*'#000000'/);
    expect(codice, 'il fondo deve essere bianco pieno').toMatch(/QR_FONDO\s*=\s*'#ffffff'/);
  });

  it('nessuna schermata si disegna il QR per conto suo', () => {
    // Chi vuole un codice chiama il posto comune. Chi chiama la libreria
    // a mano puo scegliersi i colori, ed e cosi che e nato il verde su blu.
    const colpevoli = [];
    for (const f of fileConCodice(APP)) {
      if (f.endsWith(path.join('lib', 'codiceQR.js'))) continue;
      const codice = senzaCommenti(fs.readFileSync(f, 'utf8'));
      if (/import\(\s*'qrcode'\s*\)/.test(codice) || /QRCode\.to(Canvas|DataURL)/.test(codice)) {
        colpevoli.push(path.relative(APP, f));
      }
    }
    expect(colpevoli,
      'Questi file chiamano la libreria dei QR a mano invece di passare da\n'
      + 'app/lib/codiceQR.js, quindi possono scegliersi colori che non si\n'
      + `leggono:\n  ${colpevoli.join('\n  ')}`).toEqual([]);
  });

  it('nessun codice viene da un server di altri', () => {
    // Un server di terzi puo essere giu proprio quando serve, e l'indirizzo
    // di chi lo usa non deve uscire dal telefono per diventare un disegno.
    const colpevoli = [];
    for (const f of fileConCodice(APP)) {
      const codice = senzaCommenti(fs.readFileSync(f, 'utf8'));
      if (/qrserver\.com|chart\.googleapis\.com\/chart\?[^'"`]*qr/i.test(codice)) {
        colpevoli.push(path.relative(APP, f));
      }
    }
    expect(colpevoli, `Il QR lo disegniamo noi:\n  ${colpevoli.join('\n  ')}`).toEqual([]);
  });

  it('gli angoli del codice non si arrotondano', () => {
    // I tre quadrati che un lettore cerca per primi stanno negli angoli:
    // un raggio abbastanza grande ci entra dentro e il codice non viene
    // piu riconosciuto, senza che niente lo segnali.
    const taxi = senzaCommenti(fs.readFileSync(path.join(APP, 'components', 'TaxiQRView.js'), 'utf8'));
    const tela = taxi.match(/<canvas[\s\S]{0,240}?\/>/);
    expect(tela, 'la tela del QR del tassista').not.toBeNull();
    expect(tela[0], 'niente borderRadius sulla tela del codice').not.toMatch(/borderRadius/);
  });
});
