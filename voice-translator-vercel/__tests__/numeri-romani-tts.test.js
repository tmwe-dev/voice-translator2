import { describe, it, expect, vi } from 'vitest';
vi.mock('../app/lib/logger.js', () => ({ createLogger: () => ({ warn(){}, debug(){}, error(){}, info(){} }) }));
import { preprocessForTTS } from '../app/lib/ttsPreprocessor.js';

// b.299 — "XXIV" non deve piu essere letto lettera per lettera dalla voce.
describe('numeri romani nella voce', () => {
  it('in italiano diventano l\'ordinale parlato', () => {
    expect(preprocessForTTS('Nel secolo XXIV la musica', 'it')).toContain('24º');   // contesto 'secolo'
    expect(preprocessForTTS('capitolo III', 'it')).toContain('terzo');
    expect(preprocessForTTS('Papa Giovanni XXIII benedì', 'it')).toContain('23º');   // contesto 'papa'
  });
  it('non tocca lettere che NON sono romani ben formati', () => {
    // "vidi" resta, e una I o V isolata non si converte
    // MIX e un romano valido (1009) MA senza contesto e una parola: resta
    expect(preprocessForTTS('un bel MIX di suoni', 'it')).toContain('MIX');
    // una I o V isolata (un segno solo) non si tocca mai
    expect(preprocessForTTS('Ho V amici', 'it')).toContain('V amici');
  });
  it('fuori dall\'italiano lascia la cifra, mai le lettere', () => {
    expect(preprocessForTTS('The XVIII century', 'en')).toContain('18');
  });
});
