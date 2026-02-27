// Voice sampling scripts — short versions for quick recording (~60s each)
// Full scripts ported from audio-craft-deck

export const VOICE_SCRIPTS = {
  it: {
    title: 'Tecnologia e Comunicazione',
    paragraphs: [
      "La comunicazione umana ha attraversato trasformazioni profonde nel corso dei secoli. Dalle prime incisioni rupestri ai manoscritti medievali, ogni epoca ha portato con sé nuovi strumenti per condividere idee e conoscenze. Oggi viviamo in un'era in cui la voce stessa può essere digitalizzata, analizzata e riprodotta con una fedeltà sorprendente.",
      "Il suono della voce umana è uno degli strumenti più potenti a nostra disposizione. Ogni persona possiede un timbro unico, una firma sonora che la distingue da tutte le altre. Questa unicità è il risultato di fattori anatomici, culturali e personali che si intrecciano in modo complesso e affascinante.",
      "Quando parliamo, le corde vocali vibrano creando onde sonore che si propagano nell'aria. Queste onde vengono modulate dalla forma della bocca, dalla posizione della lingua e dall'intensità del respiro. Il risultato è un flusso continuo di informazioni acustiche ricche di sfumature e significati.",
      "La tecnologia moderna ci permette di catturare queste sfumature con una precisione mai vista prima. I microfoni digitali convertono le vibrazioni sonore in segnali elettrici, che vengono poi trasformati in dati numerici. Questo processo di digitalizzazione apre possibilità straordinarie nel campo dell'intelligenza artificiale.",
    ]
  },
  en: {
    title: 'The Art of Voice',
    paragraphs: [
      "The human voice is perhaps the most versatile instrument ever created by nature. From the softest whisper to the most powerful shout, it can convey an extraordinary range of emotions and meanings. Every person carries within them a unique vocal signature that sets them apart from all others.",
      "When we speak, a remarkable chain of events unfolds in our bodies. Air from the lungs passes through the vocal cords, causing them to vibrate at specific frequencies. These vibrations are then shaped by the throat, mouth, and nasal passages to produce the rich tapestry of sounds we call speech.",
      "Modern recording technology allows us to capture these sounds with incredible fidelity. High-quality microphones can detect the subtlest nuances of pronunciation, the gentle rise and fall of intonation, and the rhythmic patterns that give each voice its distinctive character.",
      "Creating a high-quality synthetic voice begins with careful recording sessions. The speaker reads a variety of texts designed to cover all the phonemes of the target language. Each sentence is chosen to exercise different aspects of natural speech, from simple declarative statements to complex questions.",
    ]
  }
};

// Get script for a given language, fallback to English
export function getVoiceScript(langCode) {
  if (langCode === 'it') return VOICE_SCRIPTS.it;
  return VOICE_SCRIPTS.en;
}
