import { describe, it, expect, vi, beforeEach } from 'vitest';
import CircuitBreaker from '../../app/lib/circuitBreaker.js';

describe('CircuitBreaker', () => {
  let cb;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 100 });
  });

  it('starts in CLOSED state', () => {
    expect(cb.getState('test')).toBe('CLOSED');
    expect(cb.canExecute('test')).toBe(true);
  });

  it('opens after reaching failure threshold', async () => {
    const fail = () => { throw new Error('fail'); };

    await expect(cb.execute('test', fail)).rejects.toThrow();
    expect(cb.getState('test')).toBe('CLOSED'); // 1 failure < threshold

    await expect(cb.execute('test', fail)).rejects.toThrow();
    expect(cb.getState('test')).toBe('OPEN'); // 2 failures = threshold
  });

  it('blocks execution when OPEN', async () => {
    const fail = () => { throw new Error('fail'); };
    await expect(cb.execute('test', fail)).rejects.toThrow();
    await expect(cb.execute('test', fail)).rejects.toThrow();

    expect(cb.canExecute('test')).toBe(false);
    await expect(cb.execute('test', () => 'ok')).rejects.toThrow(/Circuit OPEN/);
  });

  it('transitions to HALF_OPEN after cooldown', async () => {
    const fail = () => { throw new Error('fail'); };
    await expect(cb.execute('test', fail)).rejects.toThrow();
    await expect(cb.execute('test', fail)).rejects.toThrow();

    // Wait for cooldown
    await new Promise(r => setTimeout(r, 150));

    expect(cb.canExecute('test')).toBe(true);
    expect(cb.getState('test')).toBe('HALF_OPEN');
  });

  it('closes on success after HALF_OPEN', async () => {
    const fail = () => { throw new Error('fail'); };
    await expect(cb.execute('test', fail)).rejects.toThrow();
    await expect(cb.execute('test', fail)).rejects.toThrow();

    await new Promise(r => setTimeout(r, 150));

    const result = await cb.execute('test', () => 'ok');
    expect(result).toBe('ok');
    expect(cb.getState('test')).toBe('CLOSED');
  });

  it('resets circuit', async () => {
    const fail = () => { throw new Error('fail'); };
    await expect(cb.execute('test', fail)).rejects.toThrow();
    await expect(cb.execute('test', fail)).rejects.toThrow();

    cb.reset('test');
    expect(cb.getState('test')).toBe('CLOSED');
    expect(cb.canExecute('test')).toBe(true);
  });

  it('enforces max circuits with LRU eviction', () => {
    // Create many circuits
    for (let i = 0; i < 105; i++) {
      cb.canExecute(`key-${i}`);
    }
    // Should have at most MAX_CIRCUITS entries
    expect(cb.circuits.size).toBeLessThanOrEqual(100);
  });

  it('provides metrics', async () => {
    cb.canExecute('a');
    cb.canExecute('b');
    const metrics = cb.getMetrics();
    expect(metrics).toHaveProperty('a');
    expect(metrics).toHaveProperty('b');
    expect(metrics.a.state).toBe('CLOSED');
  });

  it('counts open circuits', async () => {
    const fail = () => { throw new Error('fail'); };
    await expect(cb.execute('test', fail)).rejects.toThrow();
    await expect(cb.execute('test', fail)).rejects.toThrow();
    expect(cb.openCount).toBe(1);
  });

  it('thrown error has code and retryAfterSec', async () => {
    const fail = () => { throw new Error('fail'); };
    await expect(cb.execute('test', fail)).rejects.toThrow();
    await expect(cb.execute('test', fail)).rejects.toThrow();

    try {
      await cb.execute('test', () => 'ok');
    } catch (e) {
      expect(e.code).toBe('CIRCUIT_OPEN');
      expect(e.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it('destroy cleans up', () => {
    cb.startAutoCleanup(50);
    cb.canExecute('test');
    cb.destroy();
    expect(cb.circuits.size).toBe(0);
  });
});
