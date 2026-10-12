import { describe, expect, it } from 'vitest';
import { GameFlow } from '../src/ui/flow';

describe('GameFlow', () => {
  it('first tap on title starts the game without a drop', () => {
    const f = new GameFlow(0.3);
    expect(f.phase).toBe('title');
    expect(f.tap()).toBe('start');
    expect(f.phase).toBe('playing');
  });

  it('taps while playing request a drop', () => {
    const f = new GameFlow(0.3);
    f.tap();
    expect(f.tap()).toBe('drop');
    expect(f.tap()).toBe('drop');
  });

  it('endGame moves playing to gameOver, and is ignored on title or twice', () => {
    const f = new GameFlow(0.3);
    expect(f.endGame()).toBe(false);
    expect(f.phase).toBe('title');
    f.tap();
    expect(f.endGame()).toBe(true);
    expect(f.phase).toBe('gameOver');
    expect(f.endGame()).toBe(false);
  });

  it('taps right after game over are ignored until the lock time passes', () => {
    const f = new GameFlow(0.3);
    f.tap();
    f.endGame();
    expect(f.tap()).toBe('none');
    f.update(0.29);
    expect(f.tap()).toBe('none');
    expect(f.phase).toBe('gameOver');
    f.update(0.02);
    expect(f.tap()).toBe('retry');
    expect(f.phase).toBe('playing');
  });

  it('retry goes straight to playing, and the next tap drops', () => {
    const f = new GameFlow(0.3);
    f.tap();
    f.endGame();
    f.update(1);
    f.tap();
    expect(f.tap()).toBe('drop');
  });

  it('time spent playing does not count toward the game over lock', () => {
    const f = new GameFlow(0.3);
    f.tap();
    f.update(5);
    f.endGame();
    expect(f.tap()).toBe('none');
  });

  it('submit can be claimed once per game over and again after retry', () => {
    const f = new GameFlow(0.3);
    expect(f.claimSubmit()).toBe(false); // title
    f.tap();
    expect(f.claimSubmit()).toBe(false); // playing
    f.endGame();
    expect(f.claimSubmit()).toBe(true);
    expect(f.claimSubmit()).toBe(false);
    f.update(1);
    f.tap();
    f.endGame();
    expect(f.claimSubmit()).toBe(true);
  });

  it('round increments on each retry', () => {
    const f = new GameFlow(0);
    f.tap();
    const r0 = f.round;
    f.endGame();
    f.tap();
    expect(f.round).toBe(r0 + 1);
  });
});
