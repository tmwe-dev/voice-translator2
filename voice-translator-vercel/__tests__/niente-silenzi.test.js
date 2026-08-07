// ═══════════════════════════════════════════════════════════════
// NESSUN ERRORE MUORE IN SILENZIO (b.119)
//
// Erano 79 punti in 27 file dove un errore veniva raccolto e buttato
// via senza una parola. Due dei guasti trovati provando in due erano
// esattamente questo:
//
//   · la stanza lasciata a meta spariva per sempre, perche il
//     controllo verso il server finiva in un `catch {}`;
//   · i messaggi in modalita Direct sparivano, perche l'invio falliva
//     dentro un `try { ... } catch {}`.
//
// In nessuno dei due casi c'era un errore visibile. Solo una cosa che
// non succedeva — che e il modo peggiore di rompersi, perche nessuno
// sa da dove cominciare a guardare.
//
// ── LA REGOLA, E COSA NON VIETA ──
//
// Non e vietato ignorare un errore: certe volte e giusto. E vietato
// ignorarlo SENZA DIRLO. Basta una riga di commento che spieghi
// perche li va bene, e il controllo tace.
//
// Costa una frase. In cambio, fra sei mesi si sa se quel silenzio era
// una scelta o una dimenticanza — e oggi non si sapeva mai.
//
// ── IL PEZZO GROSSO TROVATO STRADA FACENDO ──
//
// `await processAndSendAudio(blob)` era avvolto in un `catch {}` vuoto
// in TUTTI E DUE i percorsi della registrazione vocale. Parlavi,
// smettevi, e se trascrizione o traduzione o invio fallivano non
// succedeva NIENTE: le tue parole sparivano senza un avviso.
//
// E lo stesso difetto dei messaggi persi corretto in b.111, ma sulla
// VOCE — cioe sul motivo per cui questo programma esiste.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const app = (p) => fs.readFileSync(path.join(RADICE, 'app', p), 'utf8');

function tuttiIFile(dir, trovati = []) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) tuttiIFile(p, trovati);
    else if (nome.endsWith('.js')) trovati.push(p);
  }
  return trovati;
}

describe('la regola e un controllo, non una buona intenzione', () => {
  it('`no-empty` e attiva e non fa eccezioni per i catch', () => {
    // Scritta in una convenzione, una regola si dimentica. Scritta nel
    // controllo automatico, non si puo aggirare per distrazione.
    const cfg = fs.readFileSync(path.join(RADICE, 'eslint.config.mjs'), 'utf8');
    expect(cfg).toMatch(/'no-empty':\s*\['error',\s*\{\s*allowEmptyCatch:\s*false\s*\}\]/);
  });

  it('e `no-undef` resta accesa: e quella che ha preso l\'invito rotto', () => {
    const cfg = fs.readFileSync(path.join(RADICE, 'eslint.config.mjs'), 'utf8');
    expect(cfg).toMatch(/'no-undef':\s*'error'/);
  });
});

describe('nessun catch resta muto', () => {
  it('in tutto app/ non c\'e piu un blocco vuoto', () => {
    const colpevoli = [];
    for (const f of tuttiIFile(path.join(RADICE, 'app'))) {
      // Due cautele, e la seconda me l'ha insegnata questo stesso test
      // diventando rosso per il motivo sbagliato:
      //
      //  1. una riga di COMMENTO che cita `catch {}` per spiegare un
      //     difetto vecchio non e quel difetto (postaInUscita.js);
      //  2. ma togliere TUTTE le righe di commento trasforma in "vuoto"
      //     ogni catch spiegato su piu righe — cioe proprio quelli
      //     fatti bene. Si toglie solo la citazione, non la spiegazione.
      const t = fs.readFileSync(f, 'utf8')
        .split('\n')
        .filter((r) => !(r.trim().startsWith('//') && /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(r)))
        .join('\n');
      if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(t)) {
        colpevoli.push(f.split('voice-translator-vercel/')[1]);
      }
    }
    expect(colpevoli, `catch muti:\n  ${colpevoli.join('\n  ')}`).toEqual([]);
  });

  it('e non restano segnaposto "da chiarire"', () => {
    // Riempire 79 punti con la stessa frase vuota sarebbe stato un modo
    // di zittire il controllo senza aggiungere niente. Il segnaposto
    // serviva solo a contare quelli su cui serviva guardare davvero.
    const colpevoli = [];
    for (const f of tuttiIFile(path.join(RADICE, 'app'))) {
      if (/DA CHIARIRE/.test(fs.readFileSync(f, 'utf8'))) {
        colpevoli.push(f.split('voice-translator-vercel/')[1]);
      }
    }
    expect(colpevoli).toEqual([]);
  });
});

describe('la voce che spariva ora lo dice', () => {
  const t = () => app('hooks/useTranslation.js');

  it('l\'invio dell\'audio non e piu ingoiato', () => {
    const s = t();
    expect(s, 'il catch vuoto sull\'audio non deve tornare')
      .not.toMatch(/processAndSendAudio\(blob\); \} catch \{\s*\}/);
  });

  it('in TUTTI E DUE i percorsi di registrazione', () => {
    // Erano due, e correggerne uno solo avrebbe lasciato meta del
    // difetto in piedi — con la falsa impressione di averlo chiuso.
    const s = t();
    const quanti = (s.match(/await processAndSendAudio\(blob\); \} catch \(errore\)/g) || []).length;
    expect(quanti, 'entrambi i percorsi devono avvisare').toBe(2);
  });

  it('e l\'utente viene avvisato, non solo il registro', () => {
    // Un errore scritto solo nella console e un errore che l'utente non
    // vede: continua a credere che il messaggio sia partito.
    const s = t();
    expect(s).toMatch(/toast\.error\(/);
    expect(s).toMatch(/import \{ toast \} from '\.\.\/lib\/avvisi\.js'/);
  });
});

describe('i motivi scritti dicono qualcosa', () => {
  it('non sono tutti la stessa frase copiata', () => {
    // Il modo piu facile di soddisfare il controllo era incollare
    // "ignore" ottantanove volte. Serve a zero.
    const frasi = new Set();
    for (const f of tuttiIFile(path.join(RADICE, 'app'))) {
      const t = fs.readFileSync(f, 'utf8');
      for (const m of t.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\/\* ([^*]+) \*\/\s*\}/g)) {
        frasi.add(m[1].trim());
      }
    }
    expect(frasi.size, 'servono motivi diversi per situazioni diverse').toBeGreaterThan(10);
  });

  it('nessun motivo e una parola sola tipo "ignore"', () => {
    const pigri = [];
    for (const f of tuttiIFile(path.join(RADICE, 'app'))) {
      const t = fs.readFileSync(f, 'utf8');
      for (const m of t.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\/\* ([^*]+) \*\/\s*\}/g)) {
        const frase = m[1].trim();
        if (frase.split(/\s+/).length < 3) pigri.push(`${f.split('voice-translator-vercel/')[1]}: "${frase}"`);
      }
    }
    expect(pigri, `motivi troppo corti per dire qualcosa:\n  ${pigri.join('\n  ')}`).toEqual([]);
  });
});
