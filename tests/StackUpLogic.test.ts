import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/config';
import { createRng } from '../src/core/rng';
import { StackUpLogic, type StackUpEvent } from '../src/core/StackUpLogic';

const W0 = DEFAULT_CONFIG.baseWidth;

function make(seed = 1): StackUpLogic {
  return new StackUpLogic(createRng(seed));
}
function events(g: StackUpLogic): StackUpEvent[] {
  const out: StackUpEvent[] = [];
  g.consumeEvents((e) => out.push(e));
  return out;
}
/** 이동 블록을 top 기준 offset 만큼 어긋난 위치에 두고 drop. */
function dropAt(g: StackUpLogic, offset: number): void {
  g.current.x = g.top.x + offset;
  g.drop();
}

describe('drop: overlap', () => {
  it('exact overlap keeps the width and counts as Perfect', () => {
    const g = make();
    dropAt(g, 0);
    expect(g.top.w).toBe(W0);
    expect(g.top.x).toBeCloseTo((1 - W0) / 2);
    expect(g.combo).toBe(1);
    const ev = events(g);
    expect(ev.some((e) => e.type === 'perfect')).toBe(true);
    expect(ev.some((e) => e.type === 'cut')).toBe(false);
  });

  it('partial overlap keeps only the overlapping width and moves the block to the overlap', () => {
    const g = make();
    const base = g.top;
    dropAt(g, 0.1);
    expect(g.top.w).toBeCloseTo(W0 - 0.1);
    expect(g.top.x).toBeCloseTo(base.x + 0.1);
    expect(g.combo).toBe(0);
    const cut = events(g).find((e) => e.type === 'cut');
    expect(cut).toMatchObject({ side: 'right' });
    expect(cut!.type === 'cut' && cut!.w).toBeCloseTo(0.1);
  });

  it('partial overlap on the left reports a left-side cut piece', () => {
    const g = make();
    const base = g.top;
    dropAt(g, -0.1);
    expect(g.top.x).toBeCloseTo(base.x);
    expect(g.top.w).toBeCloseTo(W0 - 0.1);
    const cut = events(g).find((e) => e.type === 'cut');
    expect(cut).toMatchObject({ side: 'left' });
  });

  it('no overlap ends the game and later input is ignored', () => {
    const g = make();
    dropAt(g, W0 + 0.01);
    expect(g.isGameOver).toBe(true);
    const ev = events(g);
    expect(ev.some((e) => e.type === 'gameOver')).toBe(true);
    const blocks = g.blocks.length;
    const score = g.score;
    g.drop();
    g.update(1);
    expect(g.blocks.length).toBe(blocks);
    expect(g.score).toBe(score);
    expect(events(g)).toEqual([]);
  });

  it('touching edges only (overlap of zero) ends the game', () => {
    const g = make();
    dropAt(g, W0);
    expect(g.isGameOver).toBe(true);
  });
});

describe('Perfect tolerance boundary', () => {
  it('offset just inside the tolerance is Perfect and snaps to the previous x', () => {
    const g = make();
    const tol = W0 * DEFAULT_CONFIG.perfectToleranceRatio;
    const base = g.top;
    dropAt(g, tol * 0.99);
    expect(g.combo).toBe(1);
    expect(g.top.x).toBe(base.x);
    expect(g.top.w).toBe(W0);
  });

  it('offset just outside the tolerance is cut and resets the combo', () => {
    const g = make();
    dropAt(g, 0);
    const tol = g.top.w * DEFAULT_CONFIG.perfectToleranceRatio;
    dropAt(g, tol * 1.01);
    expect(g.combo).toBe(0);
    expect(g.top.w).toBeLessThan(W0);
  });

  it('tolerance never drops below the configured minimum on narrow blocks', () => {
    const g = make();
    g.top.w = 0.05; // ratio 허용치 < min
    g.current.w = 0.05;
    dropAt(g, DEFAULT_CONFIG.perfectToleranceMin * 0.99);
    expect(g.combo).toBe(1);
  });

  it('offset just outside the configured minimum on narrow blocks is cut', () => {
    const g = make();
    g.top.w = 0.05;
    g.current.w = 0.05;
    dropAt(g, DEFAULT_CONFIG.perfectToleranceMin * 1.01);
    expect(g.combo).toBe(0);
  });

  it('tolerance is 4.5% of the block width and 0.006 minimum', () => {
    expect(DEFAULT_CONFIG.perfectToleranceRatio).toBe(0.045);
    expect(DEFAULT_CONFIG.perfectToleranceMin).toBe(0.006);
  });

  it('tolerance scales with the current (narrowed) width, not the base width', () => {
    const g = make();
    dropAt(g, 0.1); // 폭이 좁아진다
    const w = g.top.w;
    const tol = Math.max(w * DEFAULT_CONFIG.perfectToleranceRatio, DEFAULT_CONFIG.perfectToleranceMin);
    expect(tol).toBeLessThan(W0 * DEFAULT_CONFIG.perfectToleranceRatio);
    dropAt(g, tol * 1.01);
    expect(g.combo).toBe(0);
    const g2 = make();
    dropAt(g2, 0.1);
    dropAt(g2, tol * 0.99);
    expect(g2.combo).toBe(1);
  });
});

describe('milestone', () => {
  function milestones(g: StackUpLogic, floorsToStack: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < floorsToStack; i++) {
      dropAt(g, 0);
      g.consumeEvents((e) => {
        if (e.type === 'milestone') out.push(e.floors);
      });
    }
    return out;
  }

  it('perfect stacking emits milestones only at 5, 10, 20, 30 and 40 floors', () => {
    expect(milestones(make(), 40)).toEqual([5, 10, 20, 30, 40]);
  });

  it('floors between milestones emit no milestone event', () => {
    const g = make();
    const seen: number[] = [];
    for (let f = 1; f <= 45; f++) {
      dropAt(g, 0);
      let got = false;
      g.consumeEvents((e) => {
        if (e.type === 'milestone') got = true;
      });
      if (got) seen.push(f);
    }
    for (const f of [1, 2, 3, 4, 6, 9, 11, 15, 19, 21, 25, 35, 41, 45]) expect(seen).not.toContain(f);
  });

  it('milestone event carries level and floors equal to the stacked floor count', () => {
    const g = make();
    for (let i = 0; i < 4; i++) dropAt(g, 0);
    events(g);
    dropAt(g, 0);
    const m = events(g).find((e) => e.type === 'milestone');
    expect(m).toEqual({ type: 'milestone', level: 5, floors: 5 });
    expect(g.floors).toBe(5);
  });

  it('non-Perfect drops reaching a milestone floor also emit it', () => {
    const g = make();
    for (let i = 0; i < 4; i++) dropAt(g, 0);
    events(g);
    dropAt(g, 0.1);
    expect(events(g).filter((e) => e.type === 'milestone')).toHaveLength(1);
  });

  it('a game over drop on a milestone floor emits no milestone', () => {
    const g = make();
    for (let i = 0; i < 4; i++) dropAt(g, 0);
    events(g);
    dropAt(g, 1); // 5층 시도, 완전히 빗나감
    expect(g.isGameOver).toBe(true);
    expect(events(g).some((e) => e.type === 'milestone')).toBe(false);
  });

  it('each milestone fires once per game with no duplicates', () => {
    const list = milestones(make(), 60);
    expect(new Set(list).size).toBe(list.length);
    expect(list).toEqual([5, 10, 20, 30, 40, 50, 60]);
  });

  it('at most one milestone event is emitted per drop', () => {
    const g = make();
    for (let i = 0; i < 30; i++) {
      dropAt(g, 0);
      expect(events(g).filter((e) => e.type === 'milestone').length).toBeLessThanOrEqual(1);
    }
  });

  it('reset allows the same milestones to fire again in a new game', () => {
    const g = make();
    expect(milestones(g, 10)).toEqual([5, 10]);
    g.reset();
    expect(milestones(g, 10)).toEqual([5, 10]);
  });

  it('milestone comes last after cut, land, perfect and regrow in the same drop', () => {
    const g = make();
    dropAt(g, 0.1); // 폭 축소 (1층)
    for (let i = 0; i < 3; i++) dropAt(g, 0); // 2~4층, 콤보 3
    events(g);
    dropAt(g, 0); // 5층, 콤보 4 -> perfect
    const ev = events(g).map((e) => e.type);
    expect(ev).toEqual(['land', 'perfect', 'milestone']);
    // regrow와 함께: 콤보 5에서 5층이 되도록
    const h = make();
    for (let i = 0; i < 4; i++) dropAt(h, 0);
    events(h);
    dropAt(h, 0); // 5층, 콤보 5 -> regrow
    expect(events(h).map((e) => e.type)).toEqual(['land', 'perfect', 'regrow', 'milestone']);
    // cut과 함께
    const k = make();
    for (let i = 0; i < 4; i++) dropAt(k, 0);
    events(k);
    dropAt(k, 0.1);
    expect(events(k).map((e) => e.type)).toEqual(['cut', 'land', 'milestone']);
  });

  it('same seed and inputs produce the same event sequence including milestones', () => {
    const run = (seed: number): string => {
      const g = new StackUpLogic(createRng(seed));
      const log: StackUpEvent[] = [];
      for (let i = 0; i < 45 && !g.isGameOver; i++) {
        for (let k = 0; k < 5 + (i % 4); k++) g.update(1 / 60);
        g.current.x = g.top.x + (i % 3 === 0 ? 0.1 : 0);
        g.drop();
        g.consumeEvents((e) => log.push(e));
      }
      return JSON.stringify(log);
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).toContain('milestone');
  });
});

describe('width regrow', () => {
  it('every 5th consecutive Perfect regrows the width by 8% of W0 around the center', () => {
    const g = make();
    dropAt(g, 0.1); // 폭을 줄여 둔다
    const w0 = g.top.w;
    const x0 = g.top.x;
    for (let i = 0; i < 4; i++) dropAt(g, 0);
    expect(g.top.w).toBeCloseTo(w0);
    events(g);
    dropAt(g, 0);
    const grow = W0 * DEFAULT_CONFIG.regrowRatio;
    expect(g.top.w).toBeCloseTo(w0 + grow);
    expect(g.top.x).toBeCloseTo(x0 - grow / 2);
    expect(events(g).find((e) => e.type === 'regrow')).toMatchObject({ amount: expect.closeTo(grow) });
  });

  it('regrow never exceeds W0', () => {
    const g = make();
    for (let i = 0; i < 20; i++) {
      dropAt(g, 0);
      expect(g.top.w).toBeLessThanOrEqual(W0 + 1e-12);
    }
    expect(g.top.w).toBeCloseTo(W0);
  });

  it('a non-Perfect drop resets the streak so regrow needs 5 new Perfects', () => {
    const g = make();
    dropAt(g, 0.1);
    const w = g.top.w;
    for (let i = 0; i < 4; i++) dropAt(g, 0);
    dropAt(g, 0.05);
    const w2 = g.top.w;
    for (let i = 0; i < 4; i++) dropAt(g, 0);
    expect(g.top.w).toBeCloseTo(w2);
    expect(w2).toBeLessThan(w);
  });
});

describe('speed', () => {
  it('speed starts at the configured start value on level 1', () => {
    const g = make();
    expect(g.current.speed).toBeCloseTo(DEFAULT_CONFIG.speedStart);
  });

  it('speed increases by the per-level amount each floor', () => {
    const g = make();
    dropAt(g, 0);
    expect(g.current.speed).toBeCloseTo(DEFAULT_CONFIG.speedStart + DEFAULT_CONFIG.speedPerLevel);
  });

  it('speed is capped at the maximum on high floors', () => {
    const g = make();
    for (let i = 0; i < 60; i++) dropAt(g, 0);
    expect(g.current.speed).toBeCloseTo(DEFAULT_CONFIG.speedMax);
    expect(g.speedForLevel(1000)).toBe(DEFAULT_CONFIG.speedMax);
  });
});

describe('movement', () => {
  it('moving block bounces at the bounds and flips direction', () => {
    const g = make();
    g.current.x = g.maxX() - 0.001;
    g.current.dir = 1;
    g.update(0.1);
    expect(g.current.x).toBeCloseTo(g.maxX());
    expect(g.current.dir).toBe(-1);
    g.current.x = g.minX() + 0.001;
    g.current.dir = -1;
    g.update(0.1);
    expect(g.current.dir).toBe(1);
  });

  it('update moves the block by direction * speed * dt', () => {
    const g = make();
    g.current.x = 0.5;
    g.current.dir = 1;
    g.update(0.1);
    expect(g.current.x).toBeCloseTo(0.5 + g.current.speed * 0.1);
  });
});

describe('score', () => {
  it('a non-Perfect floor gives 1 point', () => {
    const g = make();
    dropAt(g, 0.1);
    expect(g.score).toBe(1);
    expect(g.floors).toBe(1);
  });

  it('Perfect adds a bonus equal to the combo count', () => {
    const g = make();
    dropAt(g, 0); // 1 + 1
    expect(g.score).toBe(2);
    dropAt(g, 0); // + 1 + 2
    expect(g.score).toBe(5);
    dropAt(g, 0); // + 1 + 3
    expect(g.score).toBe(9);
  });

  it('combo bonus is capped at 5', () => {
    const g = make();
    for (let i = 0; i < 5; i++) dropAt(g, 0);
    const before = g.score;
    dropAt(g, 0); // combo 6 -> 1 + 5
    expect(g.score - before).toBe(6);
    dropAt(g, 0);
    expect(g.combo).toBe(7);
    expect(g.score - before).toBe(12);
  });

  it('max combo is tracked after the combo resets', () => {
    const g = make();
    for (let i = 0; i < 3; i++) dropAt(g, 0);
    dropAt(g, 0.1);
    expect(g.combo).toBe(0);
    expect(g.maxCombo).toBe(3);
  });

  it('game over event carries the final score, floors and max combo', () => {
    const g = make();
    dropAt(g, 0);
    dropAt(g, 0);
    events(g);
    dropAt(g, 1);
    const ev = events(g).find((e) => e.type === 'gameOver');
    expect(ev).toMatchObject({ score: g.score, floors: 2, maxCombo: 2 });
  });
});

describe('determinism', () => {
  function play(seed: number): string {
    const g = new StackUpLogic(createRng(seed));
    const log: unknown[] = [];
    for (let i = 0; i < 40 && !g.isGameOver; i++) {
      for (let k = 0; k < 7 + (i % 5); k++) g.update(1 / 60);
      g.drop();
      g.consumeEvents((e) => log.push(e));
      log.push([g.score, g.combo, g.current.x, g.current.w, g.current.dir]);
    }
    return JSON.stringify(log);
  }

  it('same seed and same input sequence give identical results', () => {
    expect(play(42)).toBe(play(42));
  });

  it('different seeds can start differently (rng is actually used)', () => {
    const starts = new Set<string>();
    for (let s = 0; s < 20; s++) {
      const g = make(s);
      starts.add(`${g.current.dir}:${g.current.colorIndex}`);
    }
    expect(starts.size).toBeGreaterThan(1);
  });

  it('reset restores a fresh game', () => {
    const g = make();
    dropAt(g, 0);
    dropAt(g, 5);
    g.reset();
    expect(g.isGameOver).toBe(false);
    expect(g.score).toBe(0);
    expect(g.blocks.length).toBe(1);
  });
});
