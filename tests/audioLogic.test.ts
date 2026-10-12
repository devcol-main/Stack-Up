import { describe, expect, it } from 'vitest';
import { AUDIO_CONFIG } from '../src/audio/audioConfig';
import { comboToStep, cueForEvent, MuteStore, stepToFreq, type StorageLike } from '../src/audio/audioLogic';

describe('comboToStep', () => {
  it('combo 1 maps to the lowest step', () => expect(comboToStep(1)).toBe(0));
  it('each extra combo raises the step by one', () => expect(comboToStep(4)).toBe(3));
  it('combo above the cap stays at the max step', () => expect(comboToStep(999)).toBe(AUDIO_CONFIG.perfectMaxStep));
  it('zero, negative or NaN combo falls back to step 0', () => {
    expect(comboToStep(0)).toBe(0);
    expect(comboToStep(-3)).toBe(0);
    expect(comboToStep(NaN)).toBe(0);
  });
});

describe('stepToFreq', () => {
  it('step 0 returns the base frequency', () => expect(stepToFreq(0)).toBeCloseTo(AUDIO_CONFIG.perfectBaseFreq));
  it('frequency strictly rises with each step', () => {
    for (let s = 1; s <= AUDIO_CONFIG.perfectMaxStep; s++) expect(stepToFreq(s)).toBeGreaterThan(stepToFreq(s - 1));
  });
  it('step equal to the scale length is exactly one octave up', () => {
    expect(stepToFreq(AUDIO_CONFIG.scaleSemitones.length)).toBeCloseTo(AUDIO_CONFIG.perfectBaseFreq * 2);
  });
});

describe('cueForEvent', () => {
  it('perfect landing produces no land cue so the perfect tone replaces it', () => {
    expect(cueForEvent({ type: 'land', level: 1, x: 0, w: 1, perfect: true, combo: 1 })).toBeNull();
  });
  it('normal landing produces a land cue', () => {
    expect(cueForEvent({ type: 'land', level: 1, x: 0, w: 1, perfect: false, combo: 0 })?.kind).toBe('land');
  });
  it('perfect event uses the combo-based step', () => {
    expect(cueForEvent({ type: 'perfect', level: 3, combo: 3 })).toEqual({ kind: 'perfect', step: 2 });
  });
  it('cut, regrow and gameOver map to their own cues', () => {
    expect(cueForEvent({ type: 'cut', level: 1, x: 0, w: 1, side: 'left', colorIndex: 0 })?.kind).toBe('cut');
    expect(cueForEvent({ type: 'regrow', level: 1, amount: 1, newWidth: 2 })?.kind).toBe('regrow');
    expect(
      cueForEvent({ type: 'gameOver', score: 1, floors: 1, maxCombo: 0, level: 1, x: 0, w: 1, colorIndex: 0 })?.kind,
    ).toBe('gameOver');
  });
});

describe('MuteStore', () => {
  const mem = (): StorageLike & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };
  const throwing: StorageLike = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };

  it('nothing stored loads as not muted', () => expect(new MuteStore(mem()).load()).toBe(false));
  it('saved muted state is restored by a new store', () => {
    const s = mem();
    new MuteStore(s).save(true);
    expect(new MuteStore(s).load()).toBe(true);
  });
  it('saving unmuted after muted restores as not muted', () => {
    const s = mem();
    const store = new MuteStore(s);
    store.save(true);
    store.save(false);
    expect(store.load()).toBe(false);
  });
  it('storage that throws neither crashes load nor save', () => {
    const store = new MuteStore(throwing);
    expect(() => store.save(true)).not.toThrow();
    expect(store.load()).toBe(false);
  });
  it('missing storage (null) works without errors', () => {
    const store = new MuteStore(null);
    expect(() => store.save(true)).not.toThrow();
    expect(store.load()).toBe(false);
  });
});
