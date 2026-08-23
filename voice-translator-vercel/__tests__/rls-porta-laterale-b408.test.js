// ═══════════════════════════════════════════════════════════════
// b.408 — LA PORTA LATERALE DEL DATABASE, e la guardia che la tiene chiusa.
//
// Un audit esterno del 23/08/2026 ha trovato otto tabelle pubbliche su
// Supabase con RLS spenta e i ruoli `anon`/`authenticated` con SELECT e
// INSERT diretti. Verificato sul database vivo, corretto con la
// migrazione 013, verificato di nuovo: anon respinto, service_role
// legge, advisor di sicurezza senza errori.
//
// QUESTE PROVE NON RIGUARDANO IL DATABASE — quello e stato controllato
// dal vivo, e un test unitario non puo interrogarlo senza le chiavi.
// Riguardano LA RAGIONE per cui quella chiusura non ha rotto niente:
// nessun codice di browser tocca quelle tabelle. Se domani qualcuno
// scrivesse una lettura lato client, l'applicazione si romperebbe in
// produzione e nessuno saprebbe perche. Qui si rompe subito, con scritto
// il motivo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RADICE = process.cwd();
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');

// Le otto tabelle chiuse dalla migrazione 013. Contengono dati personali:
// compiti e materiali dello studente, scansioni, corsi, profilo, errori di
// pronuncia, e i dispositivi PeepOff con chiavi pubbliche e presenza.
const TABELLE_CHIUSE = [
  'compiti_jobs', 'compiti_materiali', 'compiti_scansioni', 'corsi_utente',
  'peepoff_dispositivi', 'peepoff_segnali', 'profilo_studente', 'pronuncia_profilo',
];

function tuttiIFile(cartella, trovati = []) {
  for (const nome of readdirSync(join(RADICE, cartella))) {
    const relativo = `${cartella}/${nome}`;
    const pieno = join(RADICE, relativo);
    if (statSync(pieno).isDirectory()) tuttiIFile(relativo, trovati);
    else if (nome.endsWith('.js') || nome.endsWith('.jsx')) trovati.push(relativo);
  }
  return trovati;
}

describe('la migrazione 013 c\'e, ed e completa', () => {
  const percorso = 'supabase/migrations/013_rls_tabelle_life_e_peepoff.sql';

  it('esiste nel repository, non solo nel database', () => {
    // una migrazione applicata a mano e non scritta e un cambiamento che
    // il prossimo ambiente non avra mai.
    expect(existsSync(join(RADICE, percorso)), percorso).toBe(true);
  });

  it('accende RLS su tutte e otto, nessuna dimenticata', () => {
    const sql = leggi(percorso);
    for (const t of TABELLE_CHIUSE) {
      expect(sql, `${t}: manca ENABLE ROW LEVEL SECURITY`)
        .toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`));
    }
  });

  it('e toglie anche i permessi diretti: due chiusure, non una', () => {
    const sql = leggi(percorso);
    for (const t of TABELLE_CHIUSE) {
      expect(sql, `${t}: manca la revoca dei permessi`)
        .toMatch(new RegExp(`REVOKE ALL ON public\\.${t}\\s+FROM anon, authenticated`));
    }
  });

  it('e dice come si torna indietro', () => {
    // regola di casa: nessuna soglia di rollback definita in corsa.
    const sql = leggi(percorso);
    expect(sql).toMatch(/DISABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE/);
  });

  it('chiude anche le tre funzioni privilegiate di Mondo', () => {
    const sql = leggi(percorso);
    for (const f of ['mondo_conta_vista', 'mondo_dopo_commento', 'mondo_ricalcola_like']) {
      expect(sql, `${f}: EXECUTE ancora aperto`).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${f}`));
      expect(sql, `${f}: percorso di ricerca non blindato`).toMatch(new RegExp(`ALTER FUNCTION public\\.${f}[^;]*search_path = public, pg_temp`));
    }
  });
});

describe('perche la chiusura non ha rotto niente, e deve restare cosi', () => {
  // Tutti i file che finiscono nel browser. `app/lib` e `app/api` no: il
  // primo e misto, il secondo e solo server. Qui si guardano i posti dove
  // il codice gira di sicuro dal lato dell'utente.
  const nelBrowser = [
    ...tuttiIFile('app/components'),
    ...tuttiIFile('app/hooks'),
  ];

  it('nessun componente e nessun hook legge quelle tabelle', () => {
    const colpevoli = [];
    for (const f of nelBrowser) {
      const codice = leggi(f);
      if (!codice.includes('.from(')) continue;
      for (const t of TABELLE_CHIUSE) {
        if (codice.includes(`from('${t}'`) || codice.includes(`from("${t}"`)) colpevoli.push(`${f} → ${t}`);
      }
    }
    expect(colpevoli, `dal browser quelle tabelle non si vedono piu (migrazione 013).\nVanno lette da una rotta di server:\n  ${colpevoli.join('\n  ')}`).toEqual([]);
  });

  it('e chi le legge davvero usa la chiave di servizio, non quella anonima', () => {
    for (const f of ['app/lib/compagni/compiti.js', 'app/lib/compagni/corsi/biblioteca.js', 'app/api/peepoff/route.js']) {
      const codice = leggi(f);
      expect(codice, `${f}: deve passare da getSupabaseAdmin`).toMatch(/getSupabaseAdmin/);
      expect(codice, `${f}: la chiave anonima non ha piu accesso a queste tabelle`).not.toMatch(/getSupabaseClient/);
    }
  });

  it('il client anonimo del browser resta, ma solo per i canali realtime', () => {
    // Non e un errore che esista: le stanze lo usano per i canali. Diventa
    // un errore il giorno in cui gli si fa leggere una tabella.
    const usanti = nelBrowser.filter((f) => leggi(f).includes('getSupabaseClient'));
    expect(usanti.sort()).toEqual(['app/hooks/useRealtimeRoom.js', 'app/hooks/useWebRTC.js']);
    for (const f of usanti) {
      expect(leggi(f), `${f}: il client anonimo non interroga tabelle`).not.toMatch(/\.from\(/);
    }
  });
});
