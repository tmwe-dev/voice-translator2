import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { daTradurre, sembraLingua } from '../app/lib/topics/titoliTradotti.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.548 — «i testi non vengono tradotti anche se il setting dice di
// farlo» (Luca). Era una feature ORFANA: la preferenza esisteva, si
// accendeva, si salvava, e nel giornale non la leggeva nessuno. ═══

describe('b.548 — cosa si traduce e cosa no (regole vere)', () => {
  it('non si traduce cio che e gia nella tua lingua', async () => {
    const { daTradurre } = await import('../app/lib/topics/titoliTradotti.js');
    expect(daTradurre('Una notizia lunga abbastanza', 'it', 'it-IT'), 'italiano -> italiano').toBe(false);
    expect(daTradurre('Both countries accused other of firing', 'en', 'it')).toBe(true);
    expect(daTradurre('Ein langer deutscher Titel hier', 'de', 'it')).toBe(true);
  });
  it('non si traducono le sigle e i frammenti', async () => {
    const { daTradurre } = await import('../app/lib/topics/titoliTradotti.js');
    expect(daTradurre('IMF', 'en', 'it')).toBe(false);
    expect(daTradurre('', 'en', 'it')).toBe(false);
    expect(daTradurre(null, 'en', 'it')).toBe(false);
  });
  it('se la lingua del testo non si sa, si prova (meglio che lasciarlo straniero)', async () => {
    const { daTradurre } = await import('../app/lib/topics/titoliTradotti.js');
    expect(daTradurre('Thailand: Selected Issues paper', null, 'it')).toBe(true);
  });
  it('si raccolgono titolo e sintesi, senza doppioni e con un tetto', async () => {
    const { vociDaTradurre } = await import('../app/lib/topics/titoliTradotti.js');
    const schede = [
      { id: 'a', titolo: 'Both countries accused other of firing first', sintesi: 'Weeks of simmering tensions', lingua: 'en' },
      { id: 'b', titolo: 'Notizia italiana abbastanza lunga da contare', lingua: 'it' },
      { id: 'c', titolo: 'Both countries accused other of firing first', lingua: 'en' },  // stessa frase: una volta sola
    ];
    const voci = vociDaTradurre(schede, 'it');
    expect(voci.map((v) => `${v.id}.${v.campo}`)).toEqual(['a.titolo', 'a.sintesi']);
    // il tetto vale davvero
    const tante = Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, titolo: `A long english title number ${i}`, lingua: 'en' }));
    expect(vociDaTradurre(tante, 'it')).toHaveLength(24);
  });
  it('la traduzione sostituisce ma NON butta l\'originale', async () => {
    const { applicaTraduzioni } = await import('../app/lib/topics/titoliTradotti.js');
    const schede = [{ id: 'a', titolo: 'Both countries accused', sintesi: 'Tensions', lingua: 'en' }];
    const dopo = applicaTraduzioni(schede, { 'a|titolo': 'Entrambi i paesi si accusano' });
    expect(dopo[0].titolo).toBe('Entrambi i paesi si accusano');
    expect(dopo[0].titoloOriginale, 'l\'originale resta, si puo sempre tornare indietro').toBe('Both countries accused');
    expect(dopo[0].sintesi, 'cio che non e stato tradotto non si tocca').toBe('Tensions');
    expect(dopo[0].tradotta).toBe(true);
    // niente traduzioni: niente da fare, e nessuna copia inutile
    expect(applicaTraduzioni(schede, {})).toBe(schede);
  });
  it('il predefinito e TRADOTTI, come dice il pannello', async () => {
    const { traduzioneAccesa } = await import('../app/lib/topics/titoliTradotti.js');
    expect(traduzioneAccesa({}), 'chi non ha mai toccato niente').toBe(true);
    expect(traduzioneAccesa({ mondoTitoli: 'originali' })).toBe(false);
    expect(traduzioneAccesa({ mondoTitoli: 'tradotti' })).toBe(true);
  });
});

describe('b.548 — e adesso il giornale la usa davvero', () => {
  const news = leggi('app/components/MondoNews.js');
  it('le schede appena arrivate passano dal traduttore', () => {
    expect(news).toMatch(/const traduciSchede = useCallback/);
    expect(news).toMatch(/if \(nuovi\.length\) traduciSchede\(nuovi\)/);
    expect(news).toMatch(/setArgomenti\(\(prima\) => applicaTraduzioni\(prima \|\| \[\], rese\)\)/);
  });
  it('la stessa frase non si paga due volte', () => {
    expect(news).toMatch(/tradottiRef\.current\.get\(`\$\{mia\}\|\$\{v\.testo\}`\)/);
    expect(news).toMatch(/tradottiRef\.current\.set\(`\$\{mia\}\|\$\{v\.testo\}`, resa\)/);
  });
  it('e il predefinito e allineato ovunque (la lezione del ritmo del globo)', () => {
    expect(leggi('app/components/MondoDiscussioni.js')).toMatch(/prefs\?\.mondoTitoli \|\| 'tradotti'/);
    expect(leggi('app/components/ui/PreferenzeMondo.js')).toMatch(/chiave: 'mondoTitoli',[\s\S]{0,700}predefinito: 'tradotti'/);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.572 — «LA TRADUZIONE CREA UN PROBLEMA» (Luca)
//
// Vero, e la causa era netta: si saltava la traduzione solo se la
// scheda DICHIARAVA la propria lingua. Feed e video quasi mai la
// dichiarano, quindi un titolo italiano andava a farsi tradurre in
// italiano — e il modello non rifiuta, RISCRIVE. Il titolo cambiava da
// solo sotto gli occhi di chi legge, con altre parole, a pagamento.
//
// La cura non e' un riconoscitore di lingue: e' rispondere a una sola
// domanda, «e' gia la mia lingua?», con le parole piu comuni. Un si
// sbagliato costa un titolo lasciato in pace; un no sbagliato costa
// quello che costava prima. L'errore, se capita, capita dalla parte
// giusta.
// ═══════════════════════════════════════════════════════════════
describe('b.572 — mai dall italiano all italiano', () => {
  it('un titolo italiano senza lingua dichiarata non si traduce in italiano', () => {
    expect(daTradurre('Il maltempo cambia il fine settimana in tutta la penisola', undefined, 'it')).toBe(false);
  });

  it('ma un titolo inglese senza lingua dichiarata si traduce eccome', () => {
    expect(daTradurre('The weather changes across the country this weekend', undefined, 'it')).toBe(true);
  });

  it('e per chi guarda in inglese vale al contrario', () => {
    expect(daTradurre('The government said the new rules will start in June', undefined, 'en')).toBe(false);
    expect(daTradurre('Il governo ha detto che le nuove regole partiranno a giugno', undefined, 'en')).toBe(true);
  });

  it('gli accenti non ingannano il riconoscimento', () => {
    expect(sembraLingua('Non è più possibile per il pubblico', 'it')).toBe(true);
  });

  it('una sigla o due parole non bastano per dichiarare una lingua', () => {
    expect(sembraLingua('Milan Inter', 'it')).toBe(false);
  });

  it('nel dubbio si traduce, come prima: il difetto era la certezza sbagliata', () => {
    expect(daTradurre('Zeitenwende Wolkenkratzer Fernsehturm heute', undefined, 'it')).toBe(true);
  });

  it('e la lingua dichiarata comanda sempre sul sospetto', () => {
    expect(daTradurre('The weather changes across the country', 'it', 'it')).toBe(false);
  });
});
