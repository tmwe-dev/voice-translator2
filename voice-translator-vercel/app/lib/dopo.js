// ═══════════════════════════════════════════════════════════════
// DOPO — fai questa cosa a sipario chiuso (Luca, b.244)
//
// `after()` di Next rimanda un lavoro a DOPO la risposta: perfetto per gli
// appunti del Maestro e per la memoria, che sono una seconda chiamata al
// modello e non devono far aspettare chi sta parlando.
//
// Ma `after()` esiste solo DENTRO una richiesta: fuori (nei test, in uno
// script) lancia. Qui si incapsula una volta sola: se il rinvio non è
// possibile, il lavoro si fa subito. Meglio farlo in ritardo che non farlo.
// ═══════════════════════════════════════════════════════════════
import { after } from 'next/server';

/** Rimanda `fn` a dopo la risposta; se non si può, la esegue subito. */
export function dopo(fn) {
  if (typeof fn !== 'function') return undefined;
  try {
    after(fn);
    return undefined;
  } catch {
    // Fuori da una richiesta: si esegue e basta.
    return fn();
  }
}
