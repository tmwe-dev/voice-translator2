import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { generaCredenzialiTURN } from '../app/lib/turnCredenziali.js';

// b.282 — lo schema e quello che coturn verifica con use-auth-secret:
// se questi conti non tornano, il relay rifiutera OGNI telefono.
describe('credenziali temporanee del relay', () => {
  it('la password e la firma HMAC-SHA1 del nome utente, in base64', () => {
    const c = generaCredenzialiTURN('segreto-di-prova', ['turn:x:3478']);
    const attesa = createHmac('sha1', 'segreto-di-prova').update(c.username).digest('base64');
    expect(c.credential).toBe(attesa);
  });

  it('il nome utente porta la scadenza, nel futuro e non oltre il ttl', () => {
    const prima = Math.floor(Date.now() / 1000);
    const c = generaCredenzialiTURN('s', ['turn:x:3478'], 3600);
    const scadenza = parseInt(c.username.split(':')[0], 10);
    expect(scadenza).toBeGreaterThan(prima);
    expect(scadenza).toBeLessThanOrEqual(prima + 3601);
    expect(c.username.endsWith(':bartalk')).toBe(true);
  });

  it('gli indirizzi passano intatti', () => {
    const urls = ['turn:turn.bartalk.app:3478', 'turns:turn.bartalk.app:5349'];
    expect(generaCredenzialiTURN('s', urls).urls).toEqual(urls);
  });
});
