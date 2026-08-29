// ═══════════════════════════════════════════════════════════════
// b.556 — UNA PORTA SOLA, IN BASSO, E LA TRADUZIONE DENTRO
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createElement as e } from 'react';
import fs from 'fs';
import path from 'path';
import FeedNotizieMondo from '../app/components/FeedNotizieMondo.js';

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
  it('compaiono tutte le azioni disponibili', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    for (const k of ['likeWord', 'newsTalkAbout', 'boardSave', 'hideForever']) {
      expect(screen.getByLabelText(k), `${k} deve esserci da aperta`).toBeTruthy();
    }
  });

  it('l interprete compare solo se quel video ha davvero i sottotitoli', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    expect(screen.queryByLabelText('interpreteTitolo')).toBe(null);
  });

  it('ogni azione ha la parola scritta accanto, non solo l icona', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    const parole = [...document.querySelectorAll('span')].map((x) => x.textContent);
    expect(parole).toContain('boardSave');
    expect(parole).toContain('hideForever');
  });

  it('toccare una voce la esegue e richiude il menu', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    fireEvent.click(screen.getByLabelText('boardSave'));
    expect(screen.queryByLabelText('boardSave')).toBe(null);
  });
});

describe('il comando della traduzione vive nella stessa porta delle azioni', () => {
  const i = fs.readFileSync(path.join(__dirname, '..', 'app/components/ui/InterpreteVideo.js'), 'utf8');
  const f = fs.readFileSync(path.join(__dirname, '..', 'app/components/FeedNotizieMondo.js'), 'utf8');

  it('l interprete puo avere il comando nascosto e aprirsi dall esterno', () => {
    expect(i).toMatch(/comandoNascosto = false, apriOra = 0/);
    expect(i).toMatch(/useEffect\(\(\) => \{ if \(apriOra\) setAperto\(true\); \}, \[apriOra\]\)/);
    expect(i).toMatch(/\{!comandoNascosto && \(/);
  });

  it('il feed usa un contatore e autorizza il comando solo sulla slide attiva e visibile', () => {
    expect(f).toMatch(/const \[apriInterprete, setApriInterprete\] = useState\(0\)/);
    expect(f).toMatch(/setApriInterprete\(\(n\) => n \+ 1\)/);
    expect(f).toMatch(/comandoNascosto apriOra=\{i === indiceAttivo && i === indiceVisibile \? apriInterprete : 0\}/);
  });

  it('la porta chiusa segnala se qualcosa e acceso', () => {
    expect(f).toMatch(/vive\.some\(\(v\) => v\.acceso\) && !aperto \? VETRO_ACCESO : VETRO/);
  });
});