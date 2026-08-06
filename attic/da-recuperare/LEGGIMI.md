# Due cose che valgono più di quelle che le hanno sostituite

Trovate dall'audit di b.105 in `app/attic/`, che era una discarica senza
un solo importatore. `app/attic/` è stato cancellato in b.109; questi due
file sono stati messi qui perché **non sono spazzatura**.

## useVAD.js — RECUPERATO in b.109

La calibrazione automatica del rumore ambientale (righe 88-96) è stata
estratta in `app/lib/calibraRumore.js` ed è viva: il preset di
sensibilità `auto` la usa.

Il file resta qui solo come riferimento storico.

## AudioQueue.js — DA RECUPERARE, non ancora fatto

Riordina l'audio per **numero di sequenza** (righe 56-94), tenendo gli
elementi in una mappa e aspettando quello mancante fino a dieci secondi.

Il codice vivo (`app/hooks/useAudioSystem.js`) usa invece una coda
d'arrivo: primo arrivato, primo riprodotto. **Con Edge a ~75 ms ed
ElevenLabs a 300 ms e più, due frasi dette in fila possono uscire
nell'ordine sbagliato.**

### Perché non l'ho integrato

Sostituire la coda dentro `useAudioSystem` è una riscrittura vera, e in
questo ambiente non posso far girare l'applicazione per verificarla. Un
errore lì non si vede in un test statico: si sente, e si sente male —
audio doppio, audio muto, o frasi che non escono più.

Va fatto con l'app aperta davanti, provando una conversazione con i due
motori mescolati.
