// Qualita adattiva per la mesh WebRTC della stanza di gruppo.
// Aumentando i partecipanti ogni telefono deve spedire piu copie del proprio
// video: non possiamo lasciare a sette connessioni la stessa qualita usata
// in una chiamata a due. Il profilo limita banda e fotogrammi senza cambiare
// il numero massimo della stanza ne spegnere la telecamera di nessuno.

export function profiloVideoGruppo(totalePartecipanti = 1) {
  const totale = Math.max(1, Math.min(8, Number(totalePartecipanti) || 1));
  if (totale <= 3) return { maxBitrate: 700_000, maxFramerate: 24, scaleResolutionDownBy: 1 };
  if (totale <= 5) return { maxBitrate: 450_000, maxFramerate: 20, scaleResolutionDownBy: 1.25 };
  return { maxBitrate: 260_000, maxFramerate: 15, scaleResolutionDownBy: 1.5 };
}

export async function applicaProfiloVideoGruppo(pc, totalePartecipanti) {
  if (!pc?.getSenders) return false;
  const profilo = profiloVideoGruppo(totalePartecipanti);
  let applicati = 0;

  for (const sender of pc.getSenders()) {
    if (sender?.track?.kind !== 'video' || typeof sender.getParameters !== 'function'
      || typeof sender.setParameters !== 'function') continue;
    try {
      const parametri = sender.getParameters() || {};
      const encodings = Array.isArray(parametri.encodings) && parametri.encodings.length
        ? parametri.encodings.map(e => ({ ...e }))
        : [{}];
      encodings[0].maxBitrate = profilo.maxBitrate;
      encodings[0].maxFramerate = profilo.maxFramerate;
      encodings[0].scaleResolutionDownBy = profilo.scaleResolutionDownBy;
      await sender.setParameters({ ...parametri, encodings });
      applicati++;
    } catch {
      // Safari/vecchi browser possono rifiutare uno dei parametri: la
      // chiamata deve continuare col comportamento nativo del browser.
    }
  }
  return applicati > 0;
}
