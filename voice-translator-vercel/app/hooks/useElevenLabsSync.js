'use client';
import { useEffect } from 'react';
import { fetchConRiprova } from '../lib/riprova.js';
import { toast } from '../lib/avvisi.js';
import { createLogger } from '../lib/logger.js';
// b.138 — gli avvisi di questo hook si leggono a schermo: vanno tradotti.
import { tFuori } from '../lib/i18n.js';
import { memGet, memSet } from '../lib/memoria.js';

const log = createLogger('voci-premium');

/**
 * useElevenLabsSync — Auto-loads ElevenLabs voices and syncs selection to localStorage.
 */
export default function useElevenLabsSync(auth) {
  // ── Le voci premium (b.122) ──
  //
  // Prima: una sola fetch, e se falliva `console.warn` e finita li.
  // L'effetto non ripartiva perche la sua unica dipendenza
  // (`canUseElevenLabs`) non cambiava piu. Un singhiozzo di rete al
  // momento sbagliato voleva dire niente voci premium per tutta la
  // sessione, senza che comparisse niente da nessuna parte.
  //
  // Era questo il motivo per cui "a volte le voci premium non ci sono".
  useEffect(() => {
    if (!auth.canUseElevenLabs || auth.elevenLabsVoices.length > 0) return;

    let annullato = false;
    const token = auth.userTokenRef.current || '';

    fetchConRiprova('/api/tts-elevenlabs?action=voices',
      { headers: { 'Authorization': `Bearer ${token}` } },
      {
        volte: 3,
        // Se dopo tre tentativi non ce l'ha fatta, l'utente lo deve
        // sapere: altrimenti apre l'elenco, lo trova vuoto, e pensa di
        // non aver diritto alle voci premium.
        suRinuncia: (errore) => {
          if (annullato) return;
          log.warn('voci premium non caricate:', errore?.message);
          toast.error(tFuori('premiumVoicesFailed'));
        },
      })
      // b.363 — prima il corpo si leggeva come JSON senza rete di
      // sicurezza: se il guardiano rispondeva con una pagina d'errore
      // (429 in HTML) la lettura esplodeva e l'utente non riceveva
      // nemmeno l'avviso di rinuncia, perche i tentativi erano andati a
      // buon fine a livello di rete.
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (annullato || !data.voices) {
          // b.363 — corpo illeggibile o senza voci: prima si usciva in
          // silenzio e l'elenco restava vuoto senza motivo da nessuna
          // parte. Ora almeno resta scritto, e l'utente lo vede.
          if (!annullato) {
            log.warn('voci premium: risposta senza elenco');
            toast.error(tFuori('premiumVoicesFailed'));
          }
          return;
        }
        auth.setElevenLabsVoices(data.voices);
      })
      .catch(() => { /* gia detto all'utente da suRinuncia: qui si tace per non dirlo due volte */ });

    // Se si cambia schermata mentre i tentativi sono in corso, l'avviso
    // non deve comparire su una pagina che non c'entra piu.
    return () => { annullato = true; };
  }, [auth.canUseElevenLabs]);

  // Load saved voice from localStorage
  useEffect(() => {
    try {
      const savedVoice = memGet('vt-elvoice');
      if (savedVoice) auth.setSelectedELVoice(savedVoice);
    } catch (e) {
      // In navigazione privata localStorage solleva: la voce salvata
      // non si recupera, ma non e un guasto da mostrare — si riparte
      // dalla predefinita e la sessione funziona lo stesso.
      log.warn('voce salvata non recuperabile:', e?.message);
    }
  }, []);

  // Persist voice selection
  useEffect(() => {
    if (auth.selectedELVoice) {
      try {
        memSet('vt-elvoice', auth.selectedELVoice);
      } catch (e) {
        // Idem: la scelta vale per questa sessione e non sopravvive al
        // riavvio. Avvisare a schermo per questo sarebbe rumore.
        log.warn('voce non memorizzata:', e?.message);
      }
    }
  }, [auth.selectedELVoice]);

  // Auto-select cloned voice
  useEffect(() => {
    if (auth.clonedVoiceId && !auth.selectedELVoice && auth.canUseElevenLabs) {
      auth.setSelectedELVoice(auth.clonedVoiceId);
    }
  }, [auth.clonedVoiceId, auth.canUseElevenLabs]);
}
