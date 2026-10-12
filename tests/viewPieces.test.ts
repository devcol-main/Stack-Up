import { describe, expect, it } from 'vitest';
import { sliceWidths } from '../src/view/glowSprites';
import { computeLayout } from '../src/view/layout';
import { PiecePool } from '../src/view/pieces';

const layout = computeLayout(270, 480, 1);

describe('PiecePool', () => {
  it('spawned piece falls and rotates over time', () => {
    const pool = new PiecePool(4);
    const p = pool.spawn(0.2, 0.1, 3, 1, -2);
    pool.update(0.1, layout, 0);
    expect(p.dy).toBeGreaterThan(0);
    expect(p.rot).toBeCloseTo(-0.2);
    expect(pool.activeCount).toBe(1);
  });

  it('piece that falls below the screen is deactivated and its slot is reused', () => {
    const pool = new PiecePool(1);
    const p = pool.spawn(0.2, 0.1, 1, 0, 1);
    for (let i = 0; i < 300; i++) pool.update(1 / 30, layout, 0);
    expect(pool.activeCount).toBe(0);
    const q = pool.spawn(0.5, 0.2, 2, 3, 1);
    expect(q).toBe(p);
    expect(q.dy).toBe(0);
    expect(q.level).toBe(2);
  });

  it('full pool recycles the piece that has fallen the most', () => {
    const pool = new PiecePool(2);
    const a = pool.spawn(0, 0.1, 1, 0, 1);
    pool.update(0.2, layout, 0);
    const b = pool.spawn(0, 0.1, 2, 0, 1);
    const c = pool.spawn(0, 0.1, 3, 0, 1);
    expect(c).toBe(a);
    expect(b.active).toBe(true);
    expect(b.level).toBe(2);
    expect(c.level).toBe(3);
    expect(pool.activeCount).toBe(2);
  });

  it('clear deactivates all pieces', () => {
    const pool = new PiecePool(3);
    pool.spawn(0, 0.1, 1, 0, 1);
    pool.spawn(0, 0.1, 1, 0, 1);
    pool.clear();
    expect(pool.activeCount).toBe(0);
  });
});

describe('sliceWidths', () => {
  const out = { left: 0, mid: 0, right: 0 };

  it('wide block keeps both caps and stretches the middle', () => {
    sliceWidths(100, 12, out);
    expect(out).toEqual({ left: 12, mid: 76, right: 12 });
  });

  it('narrow block splits its width between the caps with no middle', () => {
    sliceWidths(9, 12, out);
    expect(out.mid).toBe(0);
    expect(out.left + out.right).toBe(9);
  });

  it('slice widths always add up to the block width', () => {
    for (let w = 1; w < 80; w++) {
      sliceWidths(w, 12, out);
      expect(out.left + out.mid + out.right).toBe(w);
      expect(out.mid).toBeGreaterThanOrEqual(0);
    }
  });
});
