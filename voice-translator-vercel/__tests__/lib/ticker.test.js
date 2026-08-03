/**
 * Tests for the shared ticker (single-interval scheduler).
 * Verifies: subscribe/unsubscribe, interval cadence, immediate mode,
 * error isolation (a throwing subscriber doesn't kill others).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeTick, tickerSubscriberCount } from '../../app/lib/ticker.js';

describe('ticker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs subscriber at requested cadence', () => {
    const fn = vi.fn();
    const unsub = subscribeTick(3000, fn);

    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(2000); // t=3s
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000); // t=6s
    expect(fn).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('immediate mode fires right away', () => {
    const fn = vi.fn();
    const unsub = subscribeTick(30000, fn, { immediate: true });
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('unsubscribe stops the callback', () => {
    const fn = vi.fn();
    const unsub = subscribeTick(2000, fn);
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    vi.advanceTimersByTime(10000);
    expect(fn).toHaveBeenCalledTimes(1); // no more calls
  });

  it('a throwing subscriber does not kill others', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    const u1 = subscribeTick(1000, bad);
    const u2 = subscribeTick(1000, good);

    vi.advanceTimersByTime(2000);
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();

    u1(); u2();
  });

  it('subscriber count tracks subscriptions', () => {
    const base = tickerSubscriberCount();
    const u1 = subscribeTick(1000, () => {});
    const u2 = subscribeTick(1000, () => {});
    expect(tickerSubscriberCount()).toBe(base + 2);
    u1(); u2();
    expect(tickerSubscriberCount()).toBe(base);
  });

  it('minimum interval is clamped to 1000ms', () => {
    const fn = vi.fn();
    const unsub = subscribeTick(10, fn); // absurdly low
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1); // not 100 times
    unsub();
  });
});
