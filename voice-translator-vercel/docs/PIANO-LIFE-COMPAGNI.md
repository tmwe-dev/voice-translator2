# Life & Compagni — Piano e Design

*Documento di lavoro. Fonte unica di verità per la nuova area. Si aggiorna a ogni passo.*

---

## 1. La visione, in una riga

BarTalk oggi fa parlare **persone** che non condividono la lingua. Aggiungiamo
un'**intelligenza convocabile**: personaggi AI ("Compagni") che puoi ascoltare
discutere, con cui studiare, e che puoi invitare in una chat — sempre nella
lingua di ciascuno.

---

## 2. L'unica entità: il Compagno

Tutto ruota attorno a **una sola cosa**, riusata ovunque. Non tre sistemi: uno.

```
Compagno
 ├─ id, nome, ruolo (etichetta breve)
 ├─ emoji, colore, avatar (/avatars/N.png — fisso per ora)
 ├─ voce: { id ElevenLabs, nome }        ← SOLO timbro (TTS)
 ├─ provider + modello                    ← il "cervello" (callLLM)
 ├─ liberta: strict|balanced|creative|autonomous
 ├─ personalita: prompt                   ← chi è; vive NEL NOSTRO DB
 └─ predefinito: bool                     ← catalogo vs creato dall'utente
```

- **Predefiniti**: catalogo di partenza (8), in `app/lib/compagni/catalogo.js`. **[FATTO]**
- **Creati dall'utente**: stessa forma, salvati in Supabase (tabella `compagni`, RLS per utente). **[DA FARE]**

**Un Compagno ha tre capacità, tutte opzionali:**
- **voce** (timbro ElevenLabs) — sempre;
- **cervello** (personalità + modello, via callLLM) — sempre;
- **memoria** (ricorda chi sei nel tempo) — solo se acceso: è ciò che trasforma un
  coach in un *amico che ricorda*. Vedi §9.

Lo STESSO Compagno può quindi essere: ospite di un podcast, docente di un corso, o
amico/coach con memoria. Non tre entità: una, con capacità diverse accese.

---

## 3. Le superfici che usano il Compagno

### A) LIFE — sezione nuova, isolata (quarta voce nella barra in basso)
1. **Radio / Podcast** — scegli argomento (o discussione di Mondo, o notizia) +
   2–4 Compagni → li ascolti discutere. Multilingua. *(orchestratore FATTO)*
2. **Impara / Corsi** — catalogo di percorsi prefabbricati + wizard per crearne di
   nuovi (argomento, livello, categoria, personalizzazione). Ogni corso è **insegnato
   da un Compagno**; le categorie a fonti certificate (medicina, ecc.) attingono allo
   scraper Topics/Cobra. Struttura: corso → lezioni (obiettivi, contenuto on-demand,
   quiz, fonti, progresso). Vedi §8.
3. **Amico / Coach** — un Compagno con **memoria persistente**: ti riconosce, ricorda,
   segue i tuoi obiettivi, propone. Vedi §9.

### B) CHAT — l'unico ponte con BarTalk esistente
In una stanza inviti i tuoi Compagni invece di (o oltre a) una persona; o crei la
stanza già con loro. La chat diretta con loro è la chat che c'è già. **[ULTIMO, delicato — tocca il flusso stanza]**

---

## 4. Il motore è già in BarTalk — non se ne costruiscono di nuovi

Ogni Compagno parla passando dai motori esistenti, verificati:

```
personalità → callLLM (app/lib/llmCaller.js)      ← genera il testo
            → /api/translate                       ← nella lingua dell'ascoltatore
            → /api/tts-elevenlabs (voce.id)         ← voce, E SCALA GIÀ DAL WALLET
```

Conseguenza: **una sola economia** (il wallet di BarTalk), **una sola privacy**,
**una sola traduzione**. Niente pipeline parallele.

---

## 5. Le regole non negoziabili

1. **ElevenLabs = solo voce.** Usiamo le *voci* TTS, NON gli *agenti conversazionali*
   ElevenLabs: quelli parlano in diretta nella loro lingua fissa e scavalcano la
   traduzione — addio multilingua.
2. **La personalità è una sola, nel nostro DB.** ElevenLabs non "possiede" i Compagni.
3. **Tutto passa dal wallet.** Nessun token fuori dal conto autorizzazione→fornitore→esecuzione→contabilità.
4. **Nessun Compagno cloud in modalità Diretta.** In Diretta la conversazione non esce
   dai nostri server: non la si compromette per una feature.
5. **Additivo.** File nuovi, non si tocca il codice che funziona. Il ponte in chat è
   l'unico punto che toccherà l'esistente, e viene per ultimo con collaudo a due dispositivi.
6. **Life è un modulo PARALLELO e AUTONOMO.** Vive in un suo spazio, non sparpaglia
   codice dentro BarTalk, e parla con BarTalk **solo attraverso una cerniera unica**
   (un adattatore sottile). Se domani BarTalk cambia dentro, cambia solo la cerniera —
   non venti punti di Life. Manutenibilità prima di tutto: Life si potrebbe staccare
   quasi come un pacchetto a sé.

---

## 5-bis. Il confine e la cerniera unica

Life NON chiama mai direttamente le funzioni interne di BarTalk. Passa da **un solo
file-adattatore** che espone tre verbi e nasconde il resto:

```
app/lib/compagni/           ← DOMINIO LIFE (autonomo)
 ├─ catalogo.js             Compagni predefiniti + forma dell'entità   [FATTO]
 ├─ podcast.js              orchestratore turni (puro)                 [FATTO]
 ├─ ponte.js                ← LA CERNIERA UNICA verso BarTalk          [prossimo]
 ├─ corsi/                  catalogo + generatore lezioni
 ├─ memoria.js              memoria persistente a 3 livelli (§9)
 └─ persistenza.js          lettura/scrittura tabelle Life su Supabase
app/components/Life/        ← UI LIFE (autonoma)
app/api/compagni/*          ← ROTTE LIFE (autonome)

ponte.js espone SOLO (i verbi verso BarTalk; nasconde il resto):
 ├─ generaTesto({personalita, modello, userToken, ...}) → callLLM + wallet (riserva/commit)
 ├─ traduci(testo, lingua)                               → /api/translate
 ├─ parla(testo, voceId, ...)                            → /api/tts-elevenlabs (wallet)
 └─ cerca(query, {profonda})                             → motore Topics/Cobra (SSRF-safe)

Nota: la PERSISTENZA di Life (compagni, corsi, memorie, progressi) sta in tabelle
NOSTRE su Supabase e NON passa dal ponte — il ponte è solo per le capacità di BarTalk.
```

Regola pratica: se un file di Life importa qualcosa di BarTalk che **non** sia `ponte.js`,
è un errore di architettura. Un solo punto di contatto, una sola cosa da aggiornare.

---

## 6. Il piano a passi (con stato)

| # | Passo | Rischio | Stato |
|---|---|---|---|
| 1a | Entità Compagno + 8 predefiniti (`catalogo.js`) | nullo | **FATTO** (eslint 0) |
| 2a | Orchestratore podcast puro (`podcast.js`) + test | nullo | **FATTO** (9 test verdi) |
| — | **Push b.194/b.195** (dentro c'è il fix sicurezza) | — | **FATTO** |
| 1c | **Cerniera `ponte.js`** (generaTesto+wallet, traduci, parla, cerca) | billing | **PROSSIMO** — pattern wallet già verificato (resolveAuth→riserva→callLLM→commit) |
| 2b | Rotta `/api/compagni/podcast`: usa ponte + orchestratore | billing | dopo 1c |
| 3 | UI Life: shell (4ª voce barra) + "Crea il tuo Compagno" (avatar, voce con anteprima) | basso | dopo 2b |
| 4 | Podcast player (coda audio sequenziale, chi parla, transcript) | basso | dopo 3 |
| 5 | Persistenza Compagni utente (tabella Supabase `compagni`, RLS) | dati persistenti (CK6) | quando serve salvare i creati |
| 6 | **Impara/Corsi**: catalogo + generatore (syllabus/lezione/quiz) + rotta — §8 | medio | **BACKEND FATTO** (testato); manca UI |
| 7 | **Amico/Coach — memoria** persistente (3 livelli) — §9 | dati sensibili | **FATTO** (backend+UI, tabelle provate live); prompt estrazione ripreso da RadioChat |
| 8 | Ponte: invita Compagni in stanza | **tocca il flusso stanza (regola §8 di CLAUDE.md)** | ULTIMO, con collaudo 2 dispositivi |

---

## 7. Decisioni ancora aperte (poche, tue)

1. **Collocazione Life** — assunta *quarta voce barra in basso*. Da confermare o spostare in alto.
2. **Quali predefiniti** — ne ho messi 8 ragionevoli (medico, avvocato, professore,
   analista, ricercatore, coach, filosofo, fact-checker). Aggiungi/togli a piacere.
3. **Podcast: chi paga i token** — l'utente che lo genera, immagino. Da confermare quando arrivo a 2b.
4. **Persistenza Compagni** — quando aprire la tabella Supabase (passo 5): ora o dopo aver visto podcast+UI.

---

## 8. Impara / Corsi — design

Ripreso dal sistema corsi di RadioChat (`courseCatalog.ts`, `courseGenerator.ts`,
`types/courses.ts`), ricostruito autonomo in `app/lib/compagni/corsi/`.

- **Catalogo prefabbricato** (`corsi/catalogo.js`, dati puri): template con titolo,
  categoria, livelli disponibili, "focus" (sotto-argomenti), personalizzazioni suggerite.
- **19 categorie**, alcune a **fonti certificate** (medicina, psicologia, farmacologia,
  nutrizione…): per quelle il generatore usa `ponte.cerca` (Topics/Cobra) per fonti vere.
- **6 livelli**: bambino → base → intermedio → avanzato → universitario → ricercatore,
  ognuno con un range di lezioni.
- **Generazione** (`corsi/generatore.js`, via `ponte.generaTesto` → fatturato):
  1. syllabus = elenco lezioni con obiettivi; 2. contenuto lezione on-demand;
  3. quiz (4 opzioni + spiegazione). Generato nella lingua dell'utente; riuso in altre
     lingue via `ponte.traduci`.
- **Dati**: `CorsoDefinizione → Lezione[]` (obiettivi, stato locked/available/in_progress/
  completed, quiz, fonti, punteggio) + `Progresso`. Persistiti in Supabase (RLS per utente).
- **Il docente è un Compagno**: la personalità del Compagno è la voce didattica; la sua
  voce ElevenLabs legge la lezione.

**Cobra (lo scraper): cosa riusiamo e cosa NO — valutato sul codice.**
Cobra ha uno scraper serio (smartScrape con browser, crawl multi-pagina, SSRF su ogni
URL, registro fonti, pipeline di scrittura). MA è un'app Node a sé (server persistente +
bridge Chrome): dentro Vercel serverless **non gira**, e importarla farebbe esplodere la
complessità — contro la regola del "più semplice possibile". Decisione:
- **Fonti** → `ponte.cerca` = il Topics/Cobra *leggero* già in BarTalk (RSS + articolo +
  Wikipedia + riordino fonti), SSRF-safe. Basta per i corsi.
- **Scrittura** → `ponte.generaTesto`, fondata sulle fonti (mini-RAG nel prompt). Non
  serve la pipeline `output/rivista` di Cobra.
- **Cobra come servizio esterno** (crawl profondo con browser) solo se un domani servirà:
  Life lo chiamerebbe via HTTP con **un** verbo in più sul ponte. Due sistemi, una
  cerniera. NON in v1.

Stato: `corsi/catalogo.js`, `corsi/generatore.js` (syllabus/lezione/quiz, con fonti per le
materie certificate) e `/api/compagni/corso` **[FATTI, testati]**. Manca la UI.

---

## 9. Amico / Coach — memoria persistente — design

Ripreso da LifeTutor di RadioChat (`src/lib/lifeTutor/*`, `types/lifeTutor.ts`):
un cervello con **memoria a 3 livelli**, ricostruito autonomo in `app/lib/compagni/memoria.js`.

- **RECENTE** (~7 giorni) — sempre nel prompt del Compagno.
- **CONSOLIDATA** — fatti importanti taggati (famiglia, lavoro, studio, salute, emozione,
  obiettivi, preferenze…) con importanza 1-5, cercati quando pertinenti al messaggio.
- **PROFONDA** — archivio completo per ricostruzioni.

Flusso: dopo ogni conversazione, un'estrazione (via `ponte.generaTesto`) tira fuori i
ricordi nuovi e li salva taggati; un **profilo utente evolutivo** viene iniettato nel
prompt; opzionali **suggerimenti proattivi**. Persistenza in Supabase: `compagno_memorie`,
`compagno_profilo` (RLS per utente).

**Privacy — non negoziabile (sono dati personali sensibili):**
- RLS per utente, **solo server** (mai esposti al client di altri).
- Trattati come la traduzione: passano solo dai nostri provider AI, a nessun terzo.
- **Mai in modalità Diretta**: lì niente lascia i nostri server, memoria compresa.
- La memoria è **per-Compagno e per-utente**, e disattivabile/cancellabile dall'utente.

---

## 10. Cosa NON facciamo (per chiarezza)

- Non importiamo RadioChat: è codebase vecchio. Raccogliamo idee e schemi (agenti,
  orchestratore, podcast, tutor) e li ricostruiamo sopra BarTalk. Harvesting, non merge.
- Non copiamo le `.tsx` di RadioChat (React/Vite ≠ Next): le grafiche si reimplementano
  nello stile di BarTalk.
- Non usiamo auth, wallet, schema, WebRTC, TTS-infra di RadioChat.
