import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { daTradurre, sembraLingua, vociDaTradurre, applicaTraduzioni, traduzioneAccesa } from '../app/lib/topics/titoliTradotti.js';
import { SETTINGS_DEFAULT } from '../app/lib/mondo/settings.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.548/b.572 — traduzione dei titoli', () => {
  it('non ritraduce cio che e gia nella lingua della persona', () => {
    expect(daTradurre('Una notizia lunga abbastanza', 'it', 'it-IT')).toBe(false);
    expect(daTradurre('Both countries accused other of firing', 'en', 'it')).toBe(true);
    expect(daTradurre('Il maltempo cambia il fine settimana in tutta la penisola', undefined, 'it')).toBe(false);
    expect(daTradurre('The weather changes across the country this weekend', undefined, 'it')).toBe(true);
  });

  it('non traduce sigle o frammenti e conserva l originale', () => {
    expect(daTradurre('IMF', 'en', 'it')).toBe(false);
    const schede = [{ id: 'a', titolo: 'Both countries accused', sintesi: 'Tensions', lingua: 'en' }];
    const dopo = applicaTraduzioni(schede, { 'a|titolo': 'Entrambi i paesi si accusano' });
    expect(dopo[0].titolo).toBe('Entrambi i paesi si accusano');
    expect(dopo[0].titoloOriginale).toBe('Both countries accused');
    expect(dopo[0].tradotta).toBe(true);
  });

  it('deduplica e limita il lavoro di traduzione', () => {
    const schede = [
      { id: 'a', titolo: 'Both countries accused other of firing first', sintesi: 'Weeks of simmering tensions', lingua: 'en' },
      { id: 'b', titolo: 'Notizia italiana abbastanza lunga da contare', lingua: 'it' },
      { id: 'c', titolo: 'Both countries accused other of firing first', lingua: 'en' },
    ];
    expect(vociDaTradurre(schede, 'it').map((v) => `${v.id}.${v.campo}`)).toEqual(['a.titolo', 'a.sintesi']);
    const tante = Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, titolo: `A long english title number ${i}`, lingua: 'en' }));
    expect(vociDaTradurre(tante, 'it')).toHaveLength(24);
  });

  it('il default resta tradotto nel modello nuovo e nel ponte legacy', () => {
    expect(SETTINGS_DEFAULT.titles).toBe('translated');
    expect(traduzioneAccesa({})).toBe(true);
    expect(traduzioneAccesa({ mondoTitoli: 'originali' })).toBe(false);
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p).toMatch(/key: 'titles'/);
    expect(p).toMatch(/value: 'translated'/);
    expect(p).toMatch(/mondoTitoli: next\.titles === 'original'/);
  });

  it('il giornale usa davvero il traduttore e la cache delle frasi', () => {
    const news = leggi('app/components/MondoNews.js');
    expect(news).toMatch(/const traduciSchede = useCallback/);
    expect(news).toMatch(/if \(nuovi\.length\) traduciSchede\(nuovi\)/);
    expect(news).toMatch(/tradottiRef\.current\.get/);
    expect(news).toMatch(/tradottiRef\.current\.set/);
  });

  it('il riconoscimento prudente non scambia accenti e sigle per una lingua', () => {
    expect(sembraLingua('Non è più possibile per il pubblico', 'it')).toBe(true);
    expect(sembraLingua('Milan Inter', 'it')).toBe(false);
  });
});