import { describe, expect, it } from 'vitest';
import { AUDIO_CONFIG } from '../src/audio/audioConfig';
import {
  AudioSettingsStore,
  bgmLoopSteps,
  bgmStep,
  bgmStepDuration,
  comboToStep,
  cueForEvent,
  defaultSettings,
  effectiveGains,
  canStartSfxVoice,
  nextBgmTime,
  sfxVoiceCost,
  MuteStore,
  sanitizeSettings,
  stepToFreq,
  type StorageLike,
} from '../src/audio/audioLogic';

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

describe('cueForEvent milestone', () => {
  it('milestone event maps to the milestone cue', () => {
    expect(cueForEvent({ type: 'milestone', level: 10, floors: 10 })?.kind).toBe('milestone');
  });
});

const memStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('AudioSettingsStore', () => {
  it('nothing stored loads the defaults', () => {
    expect(new AudioSettingsStore(memStorage()).load()).toEqual(AUDIO_CONFIG.defaults);
  });
  it('defaults keep BGM quieter than SFX', () => {
    expect(AUDIO_CONFIG.defaults.bgmVolume).toBeLessThan(AUDIO_CONFIG.defaults.sfxVolume);
  });
  it('saved settings are restored by a new store', () => {
    const s = memStorage();
    const v = { bgmOn: false, sfxOn: true, bgmVolume: 0.2, sfxVolume: 0.5 };
    new AudioSettingsStore(s).save(v);
    expect(new AudioSettingsStore(s).load()).toEqual(v);
  });
  it('corrupt JSON loads the defaults', () => {
    const s = memStorage();
    s.setItem(AUDIO_CONFIG.settingsKey, '{not json');
    expect(new AudioSettingsStore(s).load()).toEqual(AUDIO_CONFIG.defaults);
  });
  it('JSON of a wrong type loads the defaults', () => {
    const s = memStorage();
    s.setItem(AUDIO_CONFIG.settingsKey, '42');
    expect(new AudioSettingsStore(s).load()).toEqual(AUDIO_CONFIG.defaults);
  });
  it('storage that throws neither crashes load nor save', () => {
    const store = new AudioSettingsStore(throwingStorage);
    expect(() => store.save(defaultSettings())).not.toThrow();
    expect(store.load()).toEqual(AUDIO_CONFIG.defaults);
  });
  it('null storage works without errors', () => {
    const store = new AudioSettingsStore(null);
    expect(() => store.save(defaultSettings())).not.toThrow();
    expect(store.load()).toEqual(AUDIO_CONFIG.defaults);
  });
  it('out of range and NaN volumes are clamped or defaulted', () => {
    const s = sanitizeSettings({ bgmOn: 'yes', sfxOn: false, bgmVolume: 5, sfxVolume: -1 });
    expect(s).toEqual({ bgmOn: true, sfxOn: false, bgmVolume: 1, sfxVolume: 0 });
    expect(sanitizeSettings({ bgmVolume: NaN, sfxVolume: 'loud' }).bgmVolume).toBe(AUDIO_CONFIG.defaults.bgmVolume);
    expect(sanitizeSettings({ sfxVolume: 'loud' }).sfxVolume).toBe(AUDIO_CONFIG.defaults.sfxVolume);
  });
  it('settings and the legacy mute key are stored independently', () => {
    const s = memStorage();
    new MuteStore(s).save(true);
    new AudioSettingsStore(s).save(defaultSettings());
    expect(new MuteStore(s).load()).toBe(true);
    expect(AUDIO_CONFIG.storageKey).toBe('stackup.muted');
    expect(AUDIO_CONFIG.settingsKey).not.toBe(AUDIO_CONFIG.storageKey);
  });
});

describe('effectiveGains', () => {
  const base = { bgmOn: true, sfxOn: true, bgmVolume: 0.4, sfxVolume: 0.8 };
  it('unmuted passes both volumes through', () => {
    expect(effectiveGains(base, false)).toEqual({ bgm: 0.4, sfx: 0.8 });
  });
  it('global mute silences both BGM and SFX', () => {
    expect(effectiveGains(base, true)).toEqual({ bgm: 0, sfx: 0 });
  });
  it('BGM off silences only BGM', () => {
    expect(effectiveGains({ ...base, bgmOn: false }, false)).toEqual({ bgm: 0, sfx: 0.8 });
  });
  it('SFX off silences only SFX', () => {
    expect(effectiveGains({ ...base, sfxOn: false }, false)).toEqual({ bgm: 0.4, sfx: 0 });
  });
  it('ducking scales only the BGM gain', () => {
    const g = effectiveGains(base, false, 0.25);
    expect(g.bgm).toBeCloseTo(0.1);
    expect(g.sfx).toBe(0.8);
  });
  it('out-of-range volumes never produce gain outside 0..1', () => {
    const g = effectiveGains({ ...base, bgmVolume: 9, sfxVolume: NaN }, false);
    expect(g).toEqual({ bgm: 1, sfx: 0 });
  });
});

describe('bgm pattern', () => {
  const loop = bgmLoopSteps();
  const allowed = new Set(AUDIO_CONFIG.bgm.scaleSemitones.map((x) => x % 12));
  it('loop length is bars times steps per bar', () => {
    expect(loop).toBe(AUDIO_CONFIG.bgm.bars * AUDIO_CONFIG.bgm.stepsPerBar);
  });
  it('step index past the loop wraps to the same step', () => {
    expect(bgmStep(loop + 3)).toEqual(bgmStep(3));
    expect(bgmStep(-1)).toEqual(bgmStep(loop - 1));
  });
  it('tempo is within 100 to 120 BPM', () => {
    expect(60 / bgmStepDuration() / 2).toBeGreaterThanOrEqual(100);
    expect(60 / bgmStepDuration() / 2).toBeLessThanOrEqual(120);
  });
  it('arpeggio notes stay inside the pentatonic scale and a sane range', () => {
    let notes = 0;
    for (let i = 0; i < loop; i++) {
      const f = bgmStep(i).arp;
      if (f === null) continue;
      notes++;
      const semis = 12 * Math.log2(f / AUDIO_CONFIG.bgm.baseFreq);
      expect(allowed.has(Math.round(semis) % 12)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(AUDIO_CONFIG.bgm.baseFreq);
      expect(f).toBeLessThan(AUDIO_CONFIG.bgm.baseFreq * 4);
    }
    expect(notes).toBeGreaterThan(0);
  });
  it('bass plays on the first beat of every bar and stays low', () => {
    for (let bar = 0; bar < AUDIO_CONFIG.bgm.bars; bar++) {
      const f = bgmStep(bar * AUDIO_CONFIG.bgm.stepsPerBar).bass;
      expect(f).not.toBeNull();
      expect(f!).toBeLessThan(200);
    }
  });
  it('hi-hat only sounds on the configured off-beats', () => {
    const hats = Array.from({ length: AUDIO_CONFIG.bgm.stepsPerBar }, (_, i) => bgmStep(i).hat);
    expect(hats.flatMap((h, i) => (h ? [i] : []))).toEqual([...AUDIO_CONFIG.bgm.hatSteps]);
  });
});

describe('nextBgmTime', () => {
  it('first start with no previous time aligns to now plus the delay', () => {
    expect(nextBgmTime(null, 10, 0.1)).toBeCloseTo(10.1);
  });
  it('already scheduled ahead of now keeps the previous time (no double scheduling)', () => {
    expect(nextBgmTime(10.3, 10, 0.1)).toBe(10.3);
  });
  it('previous time already passed re-aligns to now plus the delay', () => {
    expect(nextBgmTime(9, 10, 0.1)).toBeCloseTo(10.1);
  });
  it('previous time exactly at the boundary is kept', () => {
    expect(nextBgmTime(10.1, 10, 0.1)).toBeCloseTo(10.1);
  });
  it('non-finite previous time is treated as a first start', () => {
    expect(nextBgmTime(NaN, 5, 0.1)).toBeCloseTo(5.1);
    expect(nextBgmTime(Infinity, 5, 0.1)).toBeCloseTo(5.1);
  });
  it('non-finite now never returns NaN', () => {
    expect(Number.isFinite(nextBgmTime(3, NaN, 0.1))).toBe(true);
    expect(Number.isFinite(nextBgmTime(null, NaN, 0.1))).toBe(true);
  });
});

describe('sfx voice budget', () => {
  it('cut, perfect, regrow and milestone from one drop all fit within the voice limit', () => {
    let active = 0;
    const kinds = ['cut', 'perfect', 'regrow', 'milestone'] as const;
    for (const k of kinds) {
      for (let v = 0; v < sfxVoiceCost(k); v++) {
        expect(canStartSfxVoice(active, k === 'milestone')).toBe(true);
        active++;
      }
    }
    expect(active).toBeLessThanOrEqual(AUDIO_CONFIG.maxVoices);
  });
  it('non-milestone sounds stop at the limit minus the milestone reserve', () => {
    const cap = AUDIO_CONFIG.maxVoices - AUDIO_CONFIG.milestoneVoiceReserve;
    expect(canStartSfxVoice(cap - 1, false)).toBe(true);
    expect(canStartSfxVoice(cap, false)).toBe(false);
  });
  it('the reserve covers a whole milestone fanfare even when other sounds fill their share', () => {
    const cap = AUDIO_CONFIG.maxVoices - AUDIO_CONFIG.milestoneVoiceReserve;
    expect(AUDIO_CONFIG.maxVoices - cap).toBeGreaterThanOrEqual(sfxVoiceCost('milestone'));
    expect(canStartSfxVoice(cap, true)).toBe(true);
  });
  it('the normal share covers the largest non-milestone drop (cut + perfect + regrow)', () => {
    const need = sfxVoiceCost('cut') + sfxVoiceCost('perfect') + sfxVoiceCost('regrow');
    expect(AUDIO_CONFIG.maxVoices - AUDIO_CONFIG.milestoneVoiceReserve).toBeGreaterThanOrEqual(need);
  });
});
