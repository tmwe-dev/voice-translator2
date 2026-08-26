// b.512 — «capacitor, poi vedremo» (Luca): primo scaffolding per l'app
// davvero installabile. Non e' un export statico (BarTalk usa molte
// API route lato server: un `next export` le romperebbe tutte), e'
// un involucro nativo che carica la produzione live via server.url —
// stesso codice web, nessuna duplicazione.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const esiste = (p) => existsSync(join(process.cwd(), p));

describe('b.512 — Capacitor: primo scaffolding dell\'app installabile', () => {
  it('capacitor.config.json punta alla produzione live, non a un export statico', () => {
    const c = JSON.parse(leggi('capacitor.config.json'));
    expect(c.appId).toBe('com.tmwe.bartalk');
    expect(c.appName).toBe('BarTalk');
    expect(c.server.url).toBe('https://voice-translator2.vercel.app');
  });

  it('i pacchetti Capacitor sono dichiarati in package.json', () => {
    const p = JSON.parse(leggi('package.json'));
    for (const dep of ['@capacitor/core', '@capacitor/cli', '@capacitor/ios', '@capacitor/android']) {
      expect(p.dependencies?.[dep] || p.devDependencies?.[dep], `manca ${dep}`).toBeTruthy();
    }
  });

  it('le due piattaforme native esistono, coi loro .gitignore', () => {
    expect(esiste('ios/App/App.xcodeproj')).toBe(true);
    expect(esiste('android/gradlew')).toBe(true);
    expect(esiste('ios/.gitignore')).toBe(true);
    expect(esiste('android/.gitignore')).toBe(true);
  });
});
