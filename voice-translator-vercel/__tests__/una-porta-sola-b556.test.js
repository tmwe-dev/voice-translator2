// ═══════════════════════════════════════════════════════════════
// b.581 — UNA PORTA PER LE AZIONI, TRADUZIONE SEMPRE FUORI
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

describe('chiusa, le azioni secondarie restano dietro una porta sola', () => {
  it('la porta azioni e unica, ma Traduci resta sempre visibile fuori', () => {
    monta();
    expect(screen.getByLabelText('actionsWord')).toBeTruthy();
    expect(screen.getByTestId('traduci-video')).toBeTruthy();
    for (const k of ['likeWord', 'newsTalkAbout', 'boardSave', 'hideForever', 'interpreteTitolo']) {
      expect(screen.queryByLabelText(k), `${k} non deve ingombrare da chiusa`).toBe(null);
    }
  });

  it('Traduci non sparisce quando YouTube non offre sottotitoli: resta visibile ma disabilitato', () => {
    monta();
    const t = screen.getByTestId('traduci-video');
    expect(t).toBeTruthy();
    expect(t.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('aperta, il menu contiene solo le azioni secondarie', () => {
  it('compaiono le azioni disponibili senza duplicare Traduci', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    for (const k of ['likeWord', 'newsTalkAbout', 'boardSave', 'hideForever']) {
      expect(screen.getByLabelText(k), `${k} deve esserci da aperta`).toBeTruthy();
    }
    expect(screen.getAllByTestId('traduci-video')).toHaveLength(1);
    expect(screen.queryByLabelText('interpreteTitolo')).toBe(null);
  });

  it('ogni azione secondaria ha la parola scritta accanto', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    const parole = [...document.querySelectorAll('span')].map((x) => x.textContent);
    expect(parole).toContain('boardSave');
    expect(parole).toContain('hideForever');
  });

  it('toccare una voce secondaria la esegue e richiude il menu', () => {
    monta();
    fireEvent.click(screen.getByLabelText('actionsWord'));
    fireEvent.click(screen.getByLabelText('boardSave'));
    expect(screen.queryByLabelText('boardSave')).toBe(null);
    expect(screen.getByTestId('traduci-video')).toBeTruthy();
  });
});

describe('b.581 — Traduci e un comando primario', () => {
  const i = fs.readFileSync(path.join(__dirname, '..', 'app/components/ui/InterpreteVideo.js'), 'utf8');
  const f = fs.readFileSync(path.join(__dirname, '..', 'app/components/FeedNotizieMondo.js'), 'utf8');

  it('InterpreteVideo disegna direttamente Traduci e chiude la vecchia porta dei tre puntini', () => {
    expect(i).toMatch(/data-testid="traduci-video"/);
    expect(i).toMatch(/onDisponibile\?\.\(false\)/);
    expect(i).not.toMatch(/comandoNascosto = false, apriOra = 0/);
  });

  it('la porta delle azioni continua a segnalare se una delle sue azioni secondarie e accesa', () => {
    expect(f).toMatch(/vive\.some\(\(v\) => v\.acceso\) && !aperto \? VETRO_ACCESO : VETRO/);
  });
});
