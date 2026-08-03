import { describe, it, expect } from 'vitest';
import { quickQualityScore, shouldUseBridge } from '../../app/lib/translationQuality.js';

describe('translationQuality', () => {
  describe('quickQualityScore', () => {
    it('gives high score for good translation', () => {
      const { score, issues } = quickQualityScore('Hello world', 'Ciao mondo', 'en', 'it');
      expect(score).toBeGreaterThanOrEqual(0.8);
      expect(issues).toHaveLength(0);
    });

    it('detects empty output', () => {
      const { score, issues } = quickQualityScore('Hello', '', 'en', 'it');
      expect(score).toBe(0);
      expect(issues).toContain('empty_output');
    });

    it('detects meta-text', () => {
      const { score, issues } = quickQualityScore('Hello', 'Translation: Ciao', 'en', 'it');
      expect(issues).toContain('meta_text');
      expect(score).toBeLessThan(1.0);
    });

    it('detects not translated (same as source)', () => {
      const { score, issues } = quickQualityScore('Hello world', 'Hello world', 'en', 'it');
      expect(issues).toContain('not_translated');
    });

    it('detects wrong script for CJK target', () => {
      const { score, issues } = quickQualityScore('Hello world', 'Hello world in Chinese', 'en', 'zh');
      expect(issues).toContain('wrong_script');
    });

    it('accepts correct CJK output', () => {
      const { score, issues } = quickQualityScore('Hello', '你好', 'en', 'zh');
      expect(score).toBeGreaterThanOrEqual(0.7);
      expect(issues).not.toContain('wrong_script');
    });

    it('detects missing Vietnamese diacritics', () => {
      const { score, issues } = quickQualityScore(
        'How are you today?',
        'Ban co khoe khong hom nay', // missing diacritics
        'en', 'vi'
      );
      expect(issues).toContain('missing_diacritics');
    });

    it('detects too short translation', () => {
      const { score, issues } = quickQualityScore(
        'This is a long sentence that should have a reasonable length translation output',
        'X',
        'en', 'it'
      );
      expect(issues).toContain('too_short');
    });

    it('detects repetitive hallucination', () => {
      const { score, issues } = quickQualityScore(
        'Hello',
        'ciao ciao ciao ciao ciao ciao ciao ciao ciao ciao ciao ciao ciao',
        'en', 'it'
      );
      expect(issues).toContain('repetitive');
    });

    it('detects wrong script for Thai', () => {
      const { score, issues } = quickQualityScore('Hello', 'Sawasdee', 'en', 'th');
      expect(issues).toContain('wrong_script');
    });
  });

  describe('shouldUseBridge', () => {
    it('does not bridge English pairs', () => {
      expect(shouldUseBridge('en', 'it', 0.5)).toBe(false);
      expect(shouldUseBridge('zh', 'en', 0.5)).toBe(false);
    });

    it('does not bridge high confidence pairs', () => {
      expect(shouldUseBridge('it', 'fr', 0.9)).toBe(false);
    });

    it('bridges rare language pairs', () => {
      expect(shouldUseBridge('th', 'hu', 0.6)).toBe(true);
      expect(shouldUseBridge('vi', 'fi', 0.6)).toBe(true);
    });

    it('bridges low confidence CJK pairs', () => {
      expect(shouldUseBridge('zh', 'ro', 0.7)).toBe(true);
    });

    it('does not bridge common pairs', () => {
      expect(shouldUseBridge('it', 'es', 0.88)).toBe(false);
    });
  });
});
