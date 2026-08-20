// b.355 — Il traduttore subito: la vecchia "prima prova" a frase fissa e
// diventata un traduttore vero, faccia a faccia. Qui si verifica che i
// comportamenti chiesti nel collaudo esistano davvero nel sorgente.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const src = leggi('components/PrimaProva.js');

describe('il traduttore subito', () => {
  it('è montato nella Home, chiuso dietro l\'icona "Parla ora"', () => {
    const home = leggi('components/HomeView.js');
    expect(home).toMatch(/<PrimaProva/);
    expect(home, 'l\'icona che lo apre esiste').toMatch(/riapriPrimaProva/);
    expect(home, 'si chiama "Parla ora"').toMatch(/speakNowTitle/);
  });

  it('si scrive o si detta, e la traduzione parte da sola', () => {
    // Niente frase preconfezionata: si traduce quello che l'utente scrive.
    expect(src, 'traduce il testo dell\'utente').toContain('/api/translate');
    expect(src, 'parte da sola quando smetti di scrivere').toMatch(/setTimeout\(\(\) => traduci\(testo\)/);
    expect(src, 'la dettatura c\'e, dove il browser la offre').toMatch(/SpeechRecognition/);
    expect(src, 'la trascrizione arriva nel campo mentre parli').toMatch(/interimResults = true/);
  });

  it('la voce arriva insieme al testo, ed e madrelingua', () => {
    // b.356 — prima ElevenLabs (voce NATIVA della lingua d'arrivo), e solo
    // se non risponde la voce di sistema: meglio una voce che nessuna.
    expect(src, 'la voce madrelingua').toContain('/api/tts-elevenlabs');
    expect(src, 'il ripiego se ElevenLabs tace').toContain('tts-edge');
    expect(src).toMatch(/new Audio/);
    expect(src, 'la voce parte dalla traduzione appena arrivata').toMatch(/parla\(d\.translated\)/);
    // Ma non mentre il microfono e aperto: il telefono si detterebbe
    // da solo la propria traduzione.
    expect(src).toMatch(/if \(!dettoRef\.current\) parla/);
  });

  it('il faccia a faccia gira il testone di 180 gradi', () => {
    expect(src, 'il tasto che capovolge esiste').toMatch(/setCapovolto/);
    expect(src, 'il tradotto si legge al contrario, dal lato dell\'altro').toContain("rotate(180deg)");
    expect(src, 'capovolto: prima il tradotto, poi la scrittura').toMatch(/capovolto \? \(<>\{bloccoTradotto\}\{bloccoScrittura\}<\/>\)/);
  });

  it('non propone come meta la lingua che già parli', () => {
    expect(src, 'la scelta iniziale salta la tua lingua').toMatch(/RAPIDE\.find\(\(m\) => m\.split\('-'\)\[0\] !==/);
    expect(src, 'la fila delle mete non contiene la tua lingua').toMatch(/l\.code !== miaLingua/);
  });

  it('una volta usato, non riappare da solo', () => {
    expect(src).toMatch(/memSet\(FATTA, '1'\)/);
    const home = leggi('components/HomeView.js');
    expect(home, 'ma la riga per riaprirlo resta').toMatch(/riapriPrimaProva/);
  });

  it('se la voce fallisce, il testo resta comunque', () => {
    // La sintesi è un di più: non deve far fallire tutta la prova.
    const bloccoVoce = src.slice(src.indexOf('tts-edge') - 400, src.indexOf('tts-edge') + 800);
    expect(bloccoVoce).toMatch(/catch/);
  });

  it('dice cosa sta facendo e cosa è andato storto', () => {
    expect(src, 'lo stato di lavoro esiste').toMatch(/'traduco'/);
    expect(src, 'l\'errore si vede, non resta muto').toContain('La traduzione non e arrivata');
  });

  it('i messaggi si susseguono, e restano in ordine', () => {
    // b.356 — nessuna frase tradotta viene persa: entra nel registro, e
    // le risposte che arrivano scomposte si rimettono in fila.
    expect(src, 'il registro esiste').toMatch(/setStoria/);
    expect(src, 'in ordine di partenza').toMatch(/sort\(\(a, b\) => a\.n - b\.n\)/);
    // Ma una resa parziale (l'utente sta ancora allungando la frase) si butta.
    expect(src).toMatch(/staAllungando/);
  });
});
