import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.605 — Modulo F1 dell'audit di architettura (b.598): la logica "crea la
// stanza e mettila in vetrina" esce da page.js (dove nessuna prova poteva
// eseguirla) e diventa una funzione pura, provata QUI per comportamento.

vi.mock('../app/lib/memoria.js', () => ({ memGet: vi.fn(() => 'TOKEN-LOCALE') }));
import { creaEPubblicaStanza, creaStanzaRapida } from '../app/lib/stanze/creaEPubblica.js';

function scenario({ roomType = 'public', room = { id: 'ABC123', diretta: false }, stato = 200, fetchErrore = null } = {}) {
  const chiamate = [];
  const fetchImpl = vi.fn(async (url, o) => {
    chiamate.push({ url, corpo: JSON.parse(o.body), signal: o.signal });
    if (fetchErrore) throw fetchErrore;
    return { ok: stato < 400, status: stato };
  });
  const roomPolling = { handleCreateRoom: vi.fn(async () => room), roomSessionTokenRef: { current: 'GETTONE' } };
  const applicaPoliticaStanza = vi.fn();
  const roomInfoRef = { current: null };
  const avvisa = vi.fn();
  const p = {
    roomConfig: { nome: 'Bar Sport', lang: 'es', mode: 'conversation', description: 'd', diretta: true, maxParticipants: 8, ognunoPagaIlSuo: true, roomType, category: 'sport', hot: true },
    prefs: { name: 'Luca', lang: 'it', avatar: 'A', country: 'IT' },
    myLang: 'it', selectedMode: 'x', selectedContext: 'general',
    auth: { isTrial: false, isTopPro: true, userAccount: { token: 'TOK' } },
    roomPolling, applicaPoliticaStanza, roomInfoRef, avvisa, fetchImpl,
  };
  return { p, chiamate, roomPolling, applicaPoliticaStanza, roomInfoRef, avvisa };
}

describe('creaEPubblicaStanza', () => {
  it('crea la stanza con TUTTI i campi del foglio, applica la politica, pubblica in vetrina', async () => {
    const { p, chiamate, roomPolling, applicaPoliticaStanza, roomInfoRef } = scenario();
    const esito = await creaEPubblicaStanza(p);
    expect(esito).toEqual({ room: { id: 'ABC123', diretta: false }, pubblicata: true, motivo: 'ok' });
    expect(roomPolling.handleCreateRoom).toHaveBeenCalledWith('Luca', 'es', 'conversation', 'A', 'general', 'conversation', 'd', false, true, { token: 'TOK' }, true, 8, true);
    // b.123 — la politica legge la stanza del server, con ripiego sulla scelta locale
    expect(applicaPoliticaStanza).toHaveBeenCalledWith({ id: 'ABC123', diretta: false });
    expect(roomInfoRef.current).toEqual({ id: 'ABC123', diretta: true });
    expect(chiamate.length).toBe(1);
    expect(chiamate[0].url).toBe('/api/mondo');
    expect(chiamate[0].signal).toBeInstanceOf(AbortSignal);
    // nessun campo del foglio viene buttato via (b.96, b.110, b.111, b.397)
    expect(chiamate[0].corpo).toEqual({
      roomId: 'ABC123', host: 'Luca', nome: 'Bar Sport', description: 'd', mode: 'conversation',
      categoria: 'sport', lang: 'es', hostLang: 'it', paese: 'IT', roomType: 'public',
      maxPartecipanti: 8, hot: true, roomSessionToken: 'GETTONE', userToken: 'TOK',
    });
  });

  it('una stanza privata non finisce in vetrina (b.139-bis: la regola e\' quella di decisioni.js)', async () => {
    const { p, chiamate } = scenario({ roomType: 'private' });
    const esito = await creaEPubblicaStanza(p);
    expect(esito.pubblicata).toBe(false);
    expect(esito.motivo).toBe('privata');
    expect(chiamate).toEqual([]);
  });

  it('se la stanza non nasce non si pubblica niente', async () => {
    const { p, chiamate } = scenario({ room: null });
    const esito = await creaEPubblicaStanza(p);
    expect(esito).toMatchObject({ room: null, pubblicata: false, motivo: 'stanza-non-creata' });
    expect(chiamate).toEqual([]);
  });

  it('la vetrina che fallisce non fa fallire la stanza, e lo dice', async () => {
    const rete = scenario({ fetchErrore: new Error('rete giu') });
    const e1 = await creaEPubblicaStanza(rete.p);
    expect(e1).toMatchObject({ pubblicata: false, motivo: 'rete' });
    expect(e1.room.id).toBe('ABC123');
    expect(rete.avvisa).toHaveBeenCalledWith('[Community] stanza non pubblicata:', 'rete giu');
    const http = scenario({ stato: 401 });
    const e2 = await creaEPubblicaStanza(http.p);
    expect(e2).toMatchObject({ pubblicata: false, motivo: 'http-401' });
    expect(http.avvisa).toHaveBeenCalledWith('[Community] stanza non pubblicata:', 'HTTP 401');
  });

  it('senza account il gettone utente viene dalla memoria locale, senza nome si e\' "Host"', async () => {
    const { p, chiamate } = scenario();
    p.auth = { userAccount: null };
    p.prefs = { name: '', lang: '', avatar: 'A', country: '' };
    await creaEPubblicaStanza(p);
    expect(chiamate[0].corpo.userToken).toBe('TOKEN-LOCALE');
    expect(chiamate[0].corpo.host).toBe('Host');
    expect(chiamate[0].corpo.hostLang).toBe('it');
    expect(chiamate[0].corpo.paese).toBe('');
  });
});

describe('b.605 — page.js chiama la funzione, non ne tiene una copia', () => {
  it('nessuna fetch a /api/mondo dentro page.js: la vetrina passa dalla funzione', () => {
    const s = leggi('app/page.js').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    expect(s).not.toMatch(/fetch\('\/api\/mondo'/);
    expect(s).toMatch(/await creaEPubblicaStanza\(\{/);
    // b.607 — le tre stanze "al volo" passano da creaStanzaRapida: in
    // page.js non resta nessuna chiamata diretta a handleCreateRoom.
    expect((s.match(/roomPolling\.handleCreateRoom\(/g) || []).length).toBe(0);
    expect((s.match(/await creaStanzaRapida\(\{/g) || []).length).toBe(3);
  });
});

describe('b.607 — creaStanzaRapida: la stanza al volo, una sequenza sola', () => {
  const base = () => ({
    roomPolling: { handleCreateRoom: vi.fn(async () => ({ id: 'R1' })) },
    prefs: { name: '', avatar: 'A' },
    auth: { isTrial: true, isTopPro: false, userAccount: null },
  });
  it('con i soli valori predefiniti: conversazione, contesto general, non Diretta, host "Host"', async () => {
    const b = base();
    const { room, contesto } = await creaStanzaRapida({ ...b, lang: 'it' });
    expect(room).toEqual({ id: 'R1' });
    expect(b.roomPolling.handleCreateRoom).toHaveBeenCalledWith('Host', 'it', 'conversation', 'A', 'general', 'conversation', '', true, false, null, false);
    expect(contesto).toEqual({ contextId: 'general', contextPrompt: expect.any(String), description: '' });
  });
  it('il contesto scelto porta con se il suo prompt', async () => {
    const b = base();
    b.prefs.name = 'Luca';
    const { contesto } = await creaStanzaRapida({ ...b, lang: 'en', mode: 'm', contextId: 'business', description: 'd' });
    expect(b.roomPolling.handleCreateRoom.mock.calls[0].slice(0, 7)).toEqual(['Luca', 'en', 'm', 'A', 'business', 'm', 'd']);
    expect(contesto.contextId).toBe('business');
    expect(contesto.contextPrompt.length).toBeGreaterThan(0);
    expect(contesto.description).toBe('d');
  });
  it('un contesto sconosciuto non esplode: prompt vuoto', async () => {
    const { contesto } = await creaStanzaRapida({ ...base(), lang: 'it', contextId: 'boh' });
    expect(contesto.contextPrompt).toBe('');
  });
});
