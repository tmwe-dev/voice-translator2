// ═══════════════════════════════════════════════════════════════
// TAVOLO — tu + più Compagni che conversano insieme (Luca)
//
// "Invita i tuoi agenti nella conversazione": tu scrivi, e ognuno dei
// Compagni scelti risponde a te e a ciò che gli altri hanno appena detto
// nello stesso giro. Tradotto nella tua lingua, con la voce di ciascuno.
//
// È la forma SICURA dell'invito: una superficie di Life a sé, che NON
// tocca il flusso stanza/WebRTC di BarTalk. Riusa la cerniera → wallet.
// Il costruttore di prompt è puro e testabile.
// ═══════════════════════════════════════════════════════════════

export const TAVOLO_MAX = 4;

/**
 * Il prompt di un turno al tavolo, per callLLM via cerniera.
 * @param compagno         chi parla ora (personalita, nome)
 * @param storia           [{ruolo:'persona'|nome, testo}] scambi precedenti
 * @param ultimoUmano      l'ultimo messaggio della persona
 * @param altriQuestoGiro  [{nome, testo}] cosa hanno già detto gli altri ORA
 * @param lingua
 */
export function promptTavolo({ compagno, storia = [], ultimoUmano = '', altriQuestoGiro = [], lingua = 'it' } = {}) {
  const nome = (compagno && compagno.nome) || 'Ospite';
  const persona = (compagno && compagno.personalita) || '';
  const system =
`${persona}
Sei ${nome}, a un tavolo con una persona e altri interlocutori. Rispondi in prima persona, breve e naturale (1-2 frasi). Parli con la persona e reagisci a cosa dicono gli altri. Rispondi nella lingua: ${lingua}.`;

  const passato = (storia || []).slice(-8)
    .map(m => `[${m.ruolo === 'persona' ? 'persona' : m.ruolo}]: ${m.testo}`).join('\n');
  const oraAltri = (altriQuestoGiro || []).length
    ? `\n\nIn questo giro hanno già detto:\n${altriQuestoGiro.map(a => `${a.nome}: ${a.testo}`).join('\n')}`
    : '';
  const prompt =
`${passato ? passato + '\n\n' : ''}[persona]: ${ultimoUmano}${oraAltri}\n\nRispondi come ${nome}, breve.`;
  return { system, prompt };
}
