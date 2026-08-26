import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.516 — Luca ha corretto dal vivo il design b.515 («il riassunto non lo
// voglio, voglio aprire dentro la pagina l'articolo»): questo file
// verificava le tre porte/SchedaArgomento-per-articoli, ora sostituite da
// LettoreArticolo. Restano solo i controlli ancora veri.
describe('b.515→b.516 — SchedaArgomento resta SOLO per i video', () => {
  it('SchedaArgomento conserva autoGenera (innocuo, non piu usato per articoli)', () => {
    const f = leggi('app/components/SchedaArgomento.js');
    expect(f).toMatch(/autoGenera = false/);
  });

  it('MondoNews non usa piu SchedaArgomento per gli articoli', () => {
    const f = leggi('app/components/MondoNews.js');
    expect(f).not.toMatch(/schedaAutoGenera/);
    expect(f).not.toMatch(/setScheda\(\{ tipo: 'articolo', dati: t \}\)/);
    expect(f).toMatch(/resta in uso SOLO per i video/);
  });

  it('it.js e en.js hanno ancora le chiavi (restano definite, anche se non piu usate in MondoNews)', () => {
    const it_ = leggi('app/lib/locales/it.js');
    const en_ = leggi('app/lib/locales/en.js');
    expect(it_).toMatch(/"newsOpenSite":"Vai al sito"/);
    expect(en_).toMatch(/"newsOpenSite":"Go to site"/);
  });
});
