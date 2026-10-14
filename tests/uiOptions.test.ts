import { describe, expect, it } from 'vitest';
import { ConfirmGate, ReducedMotionStore, effectiveReducedMotion, hudBest, milestoneText, resetUserData } from '../src/ui/options';
import { BestScore, type StorageLike } from '../src/ui/records';
import { GameFlow } from '../src/ui/flow';
import { createPlayerProfile, createStackUpLeaderboard } from '../src/ui/leaderboard';
import { UI_CONFIG } from '../src/ui/uiConfig';

function memStorage(init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}
const broken: StorageLike = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('reduced motion', () => {
  it('either OS or manual setting on gives reduced motion', () => {
    expect(effectiveReducedMotion(false, false)).toBe(false);
    expect(effectiveReducedMotion(true, false)).toBe(true);
    expect(effectiveReducedMotion(false, true)).toBe(true);
    expect(effectiveReducedMotion(true, true)).toBe(true);
  });

  it('saved manual setting is restored by a new store', () => {
    const s = memStorage();
    new ReducedMotionStore(s, 'k').save(true);
    expect(new ReducedMotionStore(s, 'k').load()).toBe(true);
    new ReducedMotionStore(s, 'k').save(false);
    expect(new ReducedMotionStore(s, 'k').load()).toBe(false);
  });

  it('missing or throwing storage defaults to off without errors', () => {
    expect(new ReducedMotionStore(null, 'k').load()).toBe(false);
    const st = new ReducedMotionStore(broken, 'k');
    expect(st.load()).toBe(false);
    expect(() => st.save(true)).not.toThrow();
  });
});

describe('resetUserData', () => {
  const otherGame = '[{"playerId":"x","nickname":"Bug","score":400,"stats":{"bugsCaught":3},"ts":1}]';

  it('clears Stack Up best and leaderboard but keeps the player profile, other game data and settings', async () => {
    const s = memStorage({
      [UI_CONFIG.bestKey]: '40',
      [UI_CONFIG.leaderboardKey]: '[{"nickname":"A","score":40,"floors":4,"maxCombo":1,"ts":1}]',
      [UI_CONFIG.reducedMotionKey]: '1',
      'devcol.player.id': 'pid-1',
      'devcol.player.nickname': 'Neo',
      'bugSquash.best': '400',
      'bugSquash.leaderboard': otherGame,
    });
    const best = new BestScore(s, UI_CONFIG.bestKey);
    resetUserData({ best, storage: s, leaderboardKey: UI_CONFIG.leaderboardKey });
    expect(best.value).toBe(0);
    expect(new BestScore(s, UI_CONFIG.bestKey).value).toBe(0);
    expect(await createStackUpLeaderboard(s).getTop(10)).toEqual([]);
    expect(s.data['devcol.player.id']).toBe('pid-1');
    expect(s.data['devcol.player.nickname']).toBe('Neo');
    expect(createPlayerProfile(s).nickname).toBe('Neo');
    expect(s.data['bugSquash.best']).toBe('400');
    expect(s.data['bugSquash.leaderboard']).toBe(otherGame);
    expect(s.data[UI_CONFIG.reducedMotionKey]).toBe('1');
  });

  it('throwing or missing storage does not raise and memory values are reset', () => {
    for (const storage of [broken, null]) {
      const best = new BestScore(storage, 'best');
      best.submit(10);
      expect(() => resetUserData({ best, storage, leaderboardKey: 'lb' })).not.toThrow();
      expect(best.value).toBe(0);
    }
  });
});

describe('new best detection', () => {
  it('first play with a positive score is a new best', () => {
    expect(new BestScore(memStorage(), 'b').submit(3)).toBe(true);
  });
  it('same score as the best is not a new best', () => {
    const b = new BestScore(memStorage({ b: '7' }), 'b');
    expect(b.submit(7)).toBe(false);
  });
  it('higher score is a new best and a lower one is not', () => {
    const b = new BestScore(memStorage({ b: '7' }), 'b');
    expect(b.submit(8)).toBe(true);
    expect(b.submit(5)).toBe(false);
  });
  it('score 0 is never a new best', () => {
    expect(new BestScore(memStorage(), 'b').submit(0)).toBe(false);
  });
});

describe('hudBest', () => {
  it('shows the stored best until the score passes it, then follows the score', () => {
    expect(hudBest(10, 4)).toBe(10);
    expect(hudBest(10, 12)).toBe(12);
    expect(hudBest(0, 0)).toBe(0);
  });
});

describe('milestoneText', () => {
  it('formats floors as "<n> FLOORS!"', () => {
    expect(milestoneText(5)).toBe('5 FLOORS!');
    expect(milestoneText(10)).toBe('10 FLOORS!');
  });
});

describe('ConfirmGate', () => {
  it('first press arms and a second press within the window confirms', () => {
    const g = new ConfirmGate(3000);
    expect(g.press(0)).toBe('armed');
    expect(g.armed).toBe(true);
    expect(g.press(1000)).toBe('confirmed');
    expect(g.armed).toBe(false);
  });
  it('pressing after the window expires only re-arms', () => {
    const g = new ConfirmGate(3000);
    g.press(0);
    expect(g.press(3500)).toBe('armed');
  });
  it('cancel disarms so the next press needs confirmation again', () => {
    const g = new ConfirmGate(3000);
    g.press(0);
    g.cancel();
    expect(g.armed).toBe(false);
    expect(g.press(100)).toBe('armed');
  });
});

describe('options panel and GameFlow', () => {
  it('cannot open options while playing', () => {
    const f = new GameFlow(0.3);
    f.tap();
    expect(f.openOptions()).toBe(false);
    expect(f.optionsOpen).toBe(false);
  });
  it('taps are ignored while options are open on the title, and work after closing', () => {
    const f = new GameFlow(0.3);
    expect(f.openOptions()).toBe(true);
    expect(f.tap()).toBe('none');
    expect(f.phase).toBe('title');
    f.closeOptions();
    expect(f.tap()).toBe('start');
  });
  it('retry is ignored while options are open on game over', () => {
    const f = new GameFlow(0.3);
    f.tap();
    f.endGame();
    f.update(1);
    f.openOptions();
    expect(f.tap()).toBe('none');
    f.closeOptions();
    expect(f.tap()).toBe('retry');
  });
});
