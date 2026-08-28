// ═══════════════════════════════════════════════════════════════
// b.556 — UNA PORTA SOLA, IN BASSO, E LA TRADUZIONE DENTRO
//
// Collaudo di Luca, con la fotografia della slide: «nascondi tutte le
// icone dietro una icona in basso, su click apri le altre per
// permettere una selezione» e, nella stessa riga, «non si capisce come
// attivare i sottotitoli di traduzione o la voce di traduzione».
//
// Sono lo stesso difetto detto due volte: sei cerchi muti incolonnati
// in mezzo allo schermo coprivano l'inquadratura senza dire cosa fanno,
// e il comando piu importante — tradurre il video, che e' il motivo per
// cui BarTalk esiste — stava in un angolo in alto dove nessuno lo
// cercava. Chiuso: un tasto. Aperto: ogni voce con la sua parola
// accanto, traduzione compresa.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createElement as e } from 'react';
import fs from 'fs';
import path from 'path';
import FeedNotizieMondo from '../app/components/FeedNotizieMondo.js';

// L'osservatore e il recupero dalla rete non esistono in jsdom: qui
// serve solo che il componente si monti e si tocchi.
class OsservatoreFinto { observe() {} unobserve() {} disconnect() {} }
beforeEach(() => {
  global.IntersectionObserver = OsservatoreFinto;
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));
});
afterEach(cleanup);

const C = { bg: '#05070f', card: '#11151f', cardBorder: '#222', accent: '#5b8cff', textPrimary: '#fff', textSecondary: '#9aa' };
const L = (k) => k;
const video = { id: 'abcdefghijk', titolo: 'Un video', canale: 'euronews', miniatura: 'https://i/x.jpg' };
const monta = () => render(e(FeedNotizieMondo, { aperto: true, C, L, filtro: 'video', video: [video], argomenti: [] }));

describe('chiusa, si vede il video e basta', () => {
  it('c e una porta sola, e le altre non ci sono', () => {
    monta();
    expect(screen.getByLabelText('actionsWord')).toBeTruthy();
    for (const k of ['likeWord', 'newsTalkAbout', 'boardSave', 'hideForever', 'interpreteTitolo']) {
      expect(screen.queryByLabelText(k), `${k} non deve ingombrare da chiusa`).toBe(null);
    }
  });
});

describe('aperta, ogni voce dice cosa fa', () => {
  it('compaiono tutte', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    for (const k of ['likeWord', 'newsTalkAbout', 'boardSave', 'hideForever']) {
      expect(screen.getByLabelText(k), `${k} deve esserci da aperta`).toBeTruthy();
    }
  });

  it('ma l INTERPRETE solo se quel video ha davvero i sottotitoli', () => {
    // b.569 — trovato col browser in mano: la voce «Interprete» c'era
    // sempre, la si toccava e non succedeva NIENTE, perche' il pezzo non
    // si disegna quando il video non ha sottotitoli. Una porta che non
    // si apre e' peggio di una porta che non c'e' (regola di b.535,
    // ordine di Luca). Qui non c'e' rete, quindi sottotitoli non ce ne
    // sono: la voce NON deve comparire.
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    expect(screen.queryByLabelText('interpreteTitolo')).toBe(null);
  });

  it('e ognuna ha la parola scritta accanto, non solo l icona', () => {
    // e' meta dell'ordine di Luca: sei cerchi muti non si capiscono.
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    const parole = [...document.querySelectorAll('span')].map((x) => x.textContent);
    expect(parole).toContain('boardSave');
    expect(parole).toContain('hideForever');
  });

  it('toccare una voce fa la cosa e richiude', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    fireEvent.click(screen.getByLabelText('boardSave'));
    expect(screen.queryByLabelText('boardSave'), 'si richiude da sola').toBe(null);
  });
});

describe('il comando della traduzione non vive piu in un angolo', () => {
  const i = fs.readFileSync(path.join(__dirname, '..', 'app/components/ui/InterpreteVideo.js'), 'utf8');
  const f = fs.readFileSync(path.join(__dirname, '..', 'app/components/FeedNotizieMondo.js'), 'utf8');

  it('l interprete accetta di avere il comando altrove', () => {
    expect(i).toMatch(/comandoNascosto = false, apriOra = 0/);
    expect(i).toMatch(/useEffect\(\(\) => \{ if \(apriOra\) setAperto\(true\); \}, \[apriOra\]\)/);
    expect(i, 'e allora non disegna un tasto doppione').toMatch(/\{!comandoNascosto && \(/);
  });

  it('e il feed lo apre dal ventaglio, contando i tocchi', () => {
    // un contatore e non un vero/falso: toccare due volte deve riaprire,
    // e un vero/falso gia vero non avviserebbe nessuno.
    expect(f).toMatch(/const \[apriInterprete, setApriInterprete\] = useState\(0\)/);
    expect(f).toMatch(/setApriInterprete\(\(n\) => n \+ 1\)/);
    expect(f).toMatch(/comandoNascosto apriOra=\{i === indiceAttivo \? apriInterprete : 0\}/);
  });

  it('la porta chiusa dice se qualcosa e acceso, senza doverla aprire', () => {
    expect(f).toMatch(/vive\.some\(\(v\) => v\.acceso\) && !aperto \? VETRO_ACCESO : VETRO/);
  });
});
