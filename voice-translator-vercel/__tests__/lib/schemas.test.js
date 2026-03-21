import { describe, it, expect } from 'vitest';
import { validateTranslateInput, validateTTSInput, validateRoomCreate, validateMessageInput } from '../../app/lib/schemas.js';

describe('schemas', () => {
  describe('validateTranslateInput', () => {
    it('accepts valid input', () => {
      const result = validateTranslateInput({
        text: 'Hello world',
        sourceLang: 'en',
        targetLang: 'it',
        sourceLangName: 'English',
        targetLangName: 'Italian',
      });
      expect(result.valid).toBe(true);
      expect(result.data.text).toBe('Hello world');
      expect(result.data.sourceLang).toBe('en');
      expect(result.data.targetLang).toBe('it');
    });

    it('rejects missing text', () => {
      const result = validateTranslateInput({ sourceLang: 'en', targetLang: 'it' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('text');
    });

    it('rejects missing sourceLang', () => {
      const result = validateTranslateInput({ text: 'Hello', targetLang: 'it' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sourceLang');
    });

    it('rejects invalid lang code format', () => {
      const result = validateTranslateInput({
        text: 'Hello',
        sourceLang: 'en123',
        targetLang: 'it',
      });
      expect(result.valid).toBe(false);
    });

    it('sanitizes HTML in text', () => {
      const result = validateTranslateInput({
        text: '<script>alert(1)</script>Hello <b>world</b>',
        sourceLang: 'en',
        targetLang: 'it',
      });
      expect(result.valid).toBe(true);
      expect(result.data.text).not.toContain('<script>');
      expect(result.data.text).not.toContain('<b>');
    });

    it('rejects null body', () => {
      expect(validateTranslateInput(null).valid).toBe(false);
      expect(validateTranslateInput(undefined).valid).toBe(false);
    });

    it('handles optional fields correctly', () => {
      const result = validateTranslateInput({
        text: 'test',
        sourceLang: 'en',
        targetLang: 'zh',
        roomId: 'ABCDEF',
        isReview: true,
        conversationContext: 'previous context here',
      });
      expect(result.valid).toBe(true);
      expect(result.data.roomId).toBe('ABCDEF');
      expect(result.data.isReview).toBe(true);
      expect(result.data.conversationContext).toBe('previous context here');
    });

    it('accepts lang codes with region', () => {
      const result = validateTranslateInput({
        text: 'test', sourceLang: 'zh-TW', targetLang: 'pt-BR',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTTSInput', () => {
    it('accepts valid input', () => {
      const result = validateTTSInput({ text: 'Hello', langCode: 'en', voice: 'nova' });
      expect(result.valid).toBe(true);
    });

    it('rejects empty text', () => {
      const result = validateTTSInput({ text: '', langCode: 'en' });
      expect(result.valid).toBe(false);
    });

    it('rejects missing text', () => {
      expect(validateTTSInput({ langCode: 'en' }).valid).toBe(false);
    });
  });

  describe('validateRoomCreate', () => {
    it('accepts valid room creation', () => {
      const result = validateRoomCreate({ name: 'Luca', lang: 'it', mode: 'conversation' });
      expect(result.valid).toBe(true);
      expect(result.data.name).toBe('Luca');
    });

    it('rejects missing name', () => {
      expect(validateRoomCreate({ lang: 'it' }).valid).toBe(false);
    });

    it('rejects missing lang', () => {
      expect(validateRoomCreate({ name: 'Luca' }).valid).toBe(false);
    });

    it('sanitizes name', () => {
      const result = validateRoomCreate({ name: '<script>hack</script>Luca', lang: 'it' });
      expect(result.valid).toBe(true);
      expect(result.data.name).not.toContain('<script>');
    });
  });

  describe('validateMessageInput', () => {
    it('accepts valid message', () => {
      const result = validateMessageInput({
        roomId: 'ABCDEF', text: 'Hello', sender: 'Luca',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects missing roomId', () => {
      expect(validateMessageInput({ text: 'Hello', sender: 'Luca' }).valid).toBe(false);
    });

    it('strips invalid chars from roomId', () => {
      const result = validateMessageInput({
        roomId: 'ABC<>DEF', text: 'Hello', sender: 'Luca',
      });
      expect(result.valid).toBe(true);
      expect(result.data.roomId).toBe('ABCDEF');
    });
  });
});
