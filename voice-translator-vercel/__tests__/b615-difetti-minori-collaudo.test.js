import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// b.615 — i difetti minori del collaudo fisico del 03/09 (prod b.613),
// chiusi uno a uno. Ognuno con la prova che lo vede.

const respira = () => new Promise((r) => setTimeout(r, 0));
class AudioFinto {
  constructor(src) { this.src = src; this.paused = true; this.ended = false; this.dataset = {}; this._o = {}; }
  addEventListener(t, fn) { (this._o[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this._o[t] = (this._o[t] || []).filter((x) => x !== fn); }
  _grida(t) { for (const fn of [...(this._o[t] || [])]) fn(); const d = this[`on${t}`]; if (typeof d === 'function') d(); }
  play() { this.paused = false; this._grida('play'); return Promise.resolve(); }
  pause() { if (this.paused) return; this.paused = true; this._grida('pause'); }
  guasto() { this._grida('error'); }
}

describe('b.615 (6) — «Ferma» vale anche per il pezzo che sta ancora arrivando', () => {
  let cliente; let chiamate;
  beforeEach(async () => {
    vi.resetModules();
    global.Audio = AudioFinto;
    global.URL.createObjectURL = () => 'blob:finto';
    global.URL.revokeObjectURL = () => {};
    chiamate = 0;
    global.fetch = async () => { chiamate += 1; return { ok: true, headers: { get: () => null }, blob: async () => ({}) }; };
    cliente = await import('../app/lib/compagni/cliente.js');
  });

  it('parlaTurno: gia fermato prima di chiedere → nessuna chiamata al fornitore', async () => {
    await cliente.parlaTurno({ testo: 'ciao', lingua: 'it', deveFermare: () => true }, () => {});
    expect(chiamate).toBe(0);
  });

  it('parlaTurno: fermato mentre il file era in viaggio → arrivato, non si suona', async () => {
    let fermato = false; let audio = null;
    global.fetch = async () => { chiamate += 1; fermato = true; return { ok: true, headers: { get: () => null }, blob: async () => ({}) }; };
    await cliente.parlaTurno({ testo: 'ciao', lingua: 'it', deveFermare: () => fermato }, (a) => { audio = a; });
    expect(chiamate).toBe(1);
    expect(audio, 'nessun audio creato').toBeNull();
  });

  it('parlaBilingue: lo Stop fra un pezzo e l\'altro non fa partire il pezzo dopo', async () => {
    let fermato = false;
    global.fetch = async () => { chiamate += 1; return { ok: true, headers: { get: () => null }, blob: async () => ({}) }; };
    const p = cliente.parlaBilingue({
      testo: 'Ciao [L2:hello] come stai [L2:how are you]', linguaParlata: 'it', linguaStudiata: 'en',
      deveFermare: () => fermato,
    }, (a) => { fermato = true; setTimeout(() => a._grida('ended'), 0); });
    await p;
    // il primo pezzo e' partito (e chi lo ascolta ha premuto Ferma); nessun altro
    expect(chiamate).toBe(1);
  });

  it('senza deveFermare tutto come prima: tutti i pezzi si dicono', async () => {
    await cliente.parlaBilingue({
      testo: 'Ciao [L2:hello] come stai', linguaParlata: 'it', linguaStudiata: 'en',
    }, (a) => { setTimeout(() => a._grida('ended'), 0); });
    expect(chiamate).toBe(3);
  });
});

describe('b.615 (4) — la pill del telecomando si spegne anche se l\'audio si rompe', () => {
  it('un audio che va in error libera il registro', async () => {
    vi.resetModules();
    const voce = await import('../app/lib/voce.js');
    const a = new AudioFinto('x');
    voce.suona(a, 'prova');
    expect(voce.stato().attivo).toBe(true);
    a.guasto();
    expect(voce.stato().attivo, 'niente piu "in corso"').toBe(false);
    await respira();
  });
});

describe('b.615 (1) — &nbsp; non arriva piu grezzo ai riassunti del Mondo', () => {
  it('leggiRss decodifica &nbsp; e &#160; nelle descrizioni', async () => {
    const { leggiRss } = await import('../app/lib/topics/ricerca.js');
    const xml = `<rss><channel><item><title>T</title><link>https://a.it/x</link><description>Prima&nbsp;parte&#160;seconda &amp; terza</description></item></channel></rss>`;
    const [it] = leggiRss(xml);
    expect(it.descrizione).toBe('Prima parte seconda & terza');
  });

  it('e la decodifica delle schede (estrai.js) ha la stessa regola', () => {
    const s = readFileSync('app/lib/topics/estrai.js', 'utf8');
    const f = s.slice(s.indexOf('function decodifica('), s.indexOf('function assolutizza('));
    expect(f).toContain('&nbsp;');
  });
});

describe('b.615 (8) — la soglia del silenzio ha un margine ed e\' scritta una volta', () => {
  it('nessun letterale 1000 sparso: una costante, sopra i 996 byte del silenzio', () => {
    const s = readFileSync('app/hooks/useInterpreterMode.js', 'utf8');
    expect(s).not.toMatch(/blob\.size < 1000/);
    const m = s.match(/const BYTE_MINIMI_BLOCCO_CON_VOCE = (\d+);/);
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBeGreaterThan(996 + 200);
    expect((s.match(/blob\.size < BYTE_MINIMI_BLOCCO_CON_VOCE/g) || []).length).toBe(2);
  });
});

describe('b.615 (2) — i cuori del Mondo si chiedono una volta per indirizzo', () => {
  it('l\'effetto ricorda le chiavi gia chieste e respira prima di chiedere', () => {
    const s = readFileSync('app/components/FeedNotizieMondo.js', 'utf8');
    expect(s).toContain('chiaviChiesteRef');
    expect(s).toMatch(/filter\(\(k\) => k && !chiaviChiesteRef\.current\.has\(k\)\)/);
    expect(s).toMatch(/const respiro = setTimeout\(/);
    expect(s).toMatch(/clearTimeout\(respiro\)/);
  });
});

describe('b.615 (7) — «Rispondi» e «Invita un esperto» in tutte le lingue', () => {
  const dir = 'app/lib/locales';
  const lingue = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''));
  const pacchetto = (l) => {
    const s = readFileSync(`${dir}/${l}.js`, 'utf8');
    const m = s.match(/=\s*(\{[\s\S]*\})\s*;?\s*export/);
    return JSON.parse(m[1]);
  };

  it('replyWord esiste in ogni pacchetto, e non e\' la copia dell\'inglese (tranne en)', () => {
    for (const l of lingue) {
      const p = pacchetto(l);
      expect(p.replyWord, l).toBeTruthy();
      if (!['en'].includes(l)) expect(p.replyWord, l).not.toBe('Reply');
    }
  });

  it('inviteGuruTitle non e\' piu «Invite an expert» copiato ovunque', () => {
    for (const l of lingue) {
      if (l === 'en') continue;
      expect(pacchetto(l).inviteGuruTitle, l).not.toBe('Invite an expert');
    }
  });

  it('BarraReazioni legge la parola dal pacchetto, non la cabla', () => {
    const s = readFileSync('app/components/BarraReazioni.js', 'utf8');
    expect(s).toContain("L('replyWord')");
    expect(s).not.toMatch(/>\s*Rispondi\s*\n/);
  });
});
