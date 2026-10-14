import { describe, expect, it } from 'vitest';
import { BestScore, type StorageLike } from '../src/ui/records';

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

describe('BestScore', () => {
  it('starts at 0 when nothing is stored', () => {
    expect(new BestScore(memStorage(), 'k').value).toBe(0);
  });

  it('higher score updates best, saves it, and reports a new record', () => {
    const s = memStorage();
    const b = new BestScore(s, 'k');
    expect(b.submit(12)).toBe(true);
    expect(b.value).toBe(12);
    expect(s.data.k).toBe('12');
  });

  it('equal or lower score keeps best and reports no record', () => {
    const b = new BestScore(memStorage({ k: '20' }), 'k');
    expect(b.submit(20)).toBe(false);
    expect(b.submit(5)).toBe(false);
    expect(b.value).toBe(20);
  });

  it('restores the stored best on construction', () => {
    expect(new BestScore(memStorage({ k: '33' }), 'k').value).toBe(33);
  });

  it('corrupted stored value falls back to 0', () => {
    expect(new BestScore(memStorage({ k: 'abc' }), 'k').value).toBe(0);
    expect(new BestScore(memStorage({ k: '-4' }), 'k').value).toBe(0);
  });

  it('throwing storage does not break reading or updating', () => {
    const b = new BestScore(broken, 'k');
    expect(b.value).toBe(0);
    expect(b.submit(7)).toBe(true);
    expect(b.value).toBe(7);
  });

  it('missing storage works in memory only', () => {
    const b = new BestScore(null, 'k');
    expect(b.submit(3)).toBe(true);
    expect(b.value).toBe(3);
  });
});
