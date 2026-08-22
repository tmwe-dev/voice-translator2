import { describe, it, expect } from 'vitest';
import { schedaLingua, lingueConScheda, istruzioniDaScheda } from '../app/lib/compagni/corsi/schede.js';
import { PROFILI, profiloPer, istruzioniProfilo, LIVELLI } from '../app/lib/compagni/corsi/catalogo.js';
import { CAST, assistentePer, vocePrestata, lingueConVoceCertificata, LINGUE_SENZA_VOCE_CERTIFICATA } from '../app/lib/compagni/corsi/assistenti.js';
import { promptScena, AMBIENTI } from '../app/lib/compagni/corsi/scena.js';

// ═══════════════════════════════════════════════════════════════
// I CORSI DI LINGUA — le regole decise col piano, tenute ferme.
//
// b.378. Sono tutte cose che si rompono in silenzio: una scheda che
// perde un campo, un profilo che finisce nella scala dei livelli, una
// voce assegnata a una lingua che non sa fare. Nessuna di queste da
// errore: producono solo lezioni un po' peggiori, e nessuno se ne
// accorge finche un utente non apre la prima lezione e trova
// ventisei righe di "A significa A".
// ═══════════════════════════════════════════════════════════════

describe('le schede lingua', () => {
  it('coprono tutte le lingue che il selettore offre', () => {
    const offerte = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ar', 'nl', 'tr', 'hi'];
    for (const l of offerte) expect(schedaLingua(l), l).toBeTruthy();
  });

  it('ogni scheda dice le sette cose che servono', () => {
    for (const l of lingueConScheda()) {
      const s = schedaLingua(l);
      expect(s.scrittura, l).toBeTruthy();
      expect(s.confronto, l).toMatch(/^(parola|carattere)$/);
      expect(s.ordineFrase, l).toBeTruthy();
      expect(s.registri, l).toBeTruthy();
      expect(s.apertura, l).toBeTruthy();
      expect(Array.isArray(s.tavoleExtra), l).toBe(true);
      expect(s.suoniDifficili, l).toBeTruthy();
    }
  });

  it('le lingue a ideogrammi si confrontano per CARATTERE, non per parola', () => {
    for (const l of ['ja', 'zh', 'hi']) expect(schedaLingua(l).confronto, l).toBe('carattere');
    for (const l of ['en', 'es', 'fr', 'de', 'it']) expect(schedaLingua(l).confronto, l).toBe('parola');
  });

  it('chi ha una scrittura da imparare lo dichiara PRIMA di far parlare', () => {
    for (const l of ['ja', 'zh', 'ar', 'hi']) {
      expect(schedaLingua(l).primaDiParlare, l).toBeTruthy();
    }
    // le lingue in alfabeto latino non devono bloccare nessuno
    for (const l of ['en', 'es', 'it']) expect(schedaLingua(l).primaDiParlare, l).toBeNull();
  });

  it("alla prima lezione VIETA l'elenco meccanico — e il difetto che ha aperto tutto", () => {
    const i = istruzioniDaScheda('en', 'it', true);
    expect(i).toMatch(/VIETATO/);
    expect(i.toLowerCase()).toContain('elenco');
    // e non lo dice nelle lezioni successive, dove non serve
    expect(istruzioniDaScheda('en', 'it', false)).not.toMatch(/VIETATO/);
  });

  it('i suoni difficili cambiano con la lingua di CASA', () => {
    const perItaliano = istruzioniDaScheda('en', 'it', false);
    const perSpagnolo = istruzioniDaScheda('en', 'es', false);
    expect(perItaliano).not.toBe(perSpagnolo);
    expect(perItaliano).toContain('th');
  });

  it('una lingua senza scheda non rompe niente: non dice niente', () => {
    expect(istruzioniDaScheda('xx', 'it', true)).toBe('');
    expect(schedaLingua(null)).toBeNull();
  });

  it('il giapponese dice che il verbo va in fondo, e lo dice SUBITO', () => {
    expect(schedaLingua('ja').ordineFrase).toMatch(/fondo/i);
    expect(schedaLingua('ja').ordineFrase).toMatch(/SUBITO/);
  });
});

describe('i profili sono un asse a parte dai livelli', () => {
  it('nessun profilo e anche un livello: sono due scale diverse', () => {
    const idLivelli = LIVELLI.map((l) => l.id);
    const soloProfili = PROFILI.filter((p) => p.id !== 'chiunque' && !['universitario', 'ricercatore', 'bambino'].includes(p.id));
    for (const p of soloProfili) expect(idLivelli, p.id).not.toContain(p.id);
    // e i tre nuovi ci sono
    expect(PROFILI.map((p) => p.id)).toEqual(expect.arrayContaining(['ragazzo', 'professionista', 'anziano']));
  });

  it('ogni profilo cambia la FORMA: dice quanto dura un blocco', () => {
    for (const p of PROFILI) {
      if (p.id === 'chiunque') { expect(p.minuti).toBeNull(); continue; }
      expect(p.minuti, p.id).toBeGreaterThan(0);
      expect(p.istruzione, p.id).toBeTruthy();
    }
  });

  it('il profilo neutro non dice niente al Maestro', () => {
    expect(istruzioniProfilo('chiunque')).toBe('');
    expect(istruzioniProfilo('inesistente')).toBe('');
  });

  it("l'anziano ha la ripetizione, il professionista solo scene di lavoro", () => {
    expect(istruzioniProfilo('anziano')).toMatch(/ripet/i);
    expect(istruzioniProfilo('professionista')).toMatch(/lavoro/i);
  });
});

describe('gli assistenti madrelingua', () => {
  it('ogni lingua insegnata ha una voce DAVVERO certificata per quella lingua', () => {
    for (const l of lingueConVoceCertificata()) {
      const a = assistentePer(l);
      expect(a.prestata, l).toBe(false);
      expect(a.lingue, `${a.nome} deve saper fare ${l}`).toContain(l);
      expect(a.voceId, l).toMatch(/^[A-Za-z0-9]{15,}$/);
    }
  });

  it('le lingue senza voce certificata sono dichiarate, non nascoste', () => {
    for (const l of LINGUE_SENZA_VOCE_CERTIFICATA) {
      expect(vocePrestata(l), l).toBe(true);
      expect(assistentePer(l).prestata, l).toBe(true);
    }
  });

  it('nessun personaggio ha una voce senza lingue: era il difetto di prima', () => {
    // "Li Wei, assistente cinese" era Adam, che non ha nessuna certificazione
    for (const c of CAST) {
      expect(c.lingue.length, c.nome).toBeGreaterThan(0);
      expect(c.voceId, c.nome).toBeTruthy();
    }
  });

  it('chi studia due lingue vicine ritrova spesso la stessa persona', () => {
    expect(assistentePer('es').nome).toBe(assistentePer('pt').nome);
    expect(assistentePer('fr').nome).toBe(assistentePer('it').nome);
    expect(assistentePer('zh').nome).toBe(assistentePer('ja').nome);
  });
});

describe('le tavole', () => {
  it('nessuna scena chiede piu a due persone di toccarsi', () => {
    for (const a of AMBIENTI) {
      expect(a.scena, a.id).not.toMatch(/handing|shaking|asking an|taking the order from/i);
    }
  });

  it('il prompt vieta il contatto e fissa il numero di arti', () => {
    const p = promptScena({ titolo: 'Al bar', livello: 'base' });
    expect(p).toMatch(/NEVER touch/);
    expect(p).toMatch(/two arms and two hands/);
  });

  it('non si chiedono piu di cinque oggetti in una tavola sola', () => {
    const p = promptScena({ titolo: 'Al bar', livello: 'base' });
    const elenco = p.split('at a glance:')[1]?.split('.')[0] || '';
    expect(elenco.split(',').length).toBeLessThanOrEqual(5);
  });
});
