import { afterEach, describe, expect, it, vi } from 'vitest';
import { track } from '../src/analytics';

const g = globalThis as { devcol?: unknown };

afterEach(() => {
  delete g.devcol;
});

describe('analytics track', () => {
  it('without t.js (no window.devcol) → does nothing and does not throw', () => {
    expect(() => track('game_over', { stage: 3, score: 10, duration_ms: 500 })).not.toThrow();
  });

  it('with t.js loaded → forwards type and props to devcol.track', () => {
    const spy = vi.fn();
    g.devcol = { track: spy };
    track('stage_clear', { stage: 5, score: 42 });
    expect(spy).toHaveBeenCalledWith('stage_clear', { stage: 5, score: 42 });
  });

  it('devcol.track throwing → swallowed so the game keeps running', () => {
    g.devcol = { track: () => { throw new Error('boom'); } };
    expect(() => track('game_over', { stage: 1, score: 0, duration_ms: 0 })).not.toThrow();
  });
});
