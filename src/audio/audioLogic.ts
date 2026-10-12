// AudioContext 없이 테스트 가능한 순수 로직.
import type { StackUpEvent } from '../core/StackUpLogic';
import { AUDIO_CONFIG } from './audioConfig';

export type SoundKind = 'land' | 'perfect' | 'cut' | 'regrow' | 'gameOver' | 'milestone';
export interface SoundCue {
  kind: SoundKind;
  /** perfect 전용: 음계 스텝 */
  step: number;
}

/** 콤보(1~) → 음계 스텝. 1 미만은 0, 상한 perfectMaxStep. */
export function comboToStep(combo: number, maxStep: number = AUDIO_CONFIG.perfectMaxStep): number {
  if (!Number.isFinite(combo)) return 0;
  return Math.max(0, Math.min(maxStep, Math.floor(combo) - 1));
}

/** 음계 스텝 → 주파수(Hz). 5음 음계를 옥타브로 이어 붙인다. */
export function stepToFreq(
  step: number,
  base: number = AUDIO_CONFIG.perfectBaseFreq,
  scale: readonly number[] = AUDIO_CONFIG.scaleSemitones,
): number {
  const s = Math.max(0, Math.floor(step));
  const octave = Math.floor(s / scale.length);
  const semis = scale[s % scale.length]! + 12 * octave;
  return semitoneToFreq(base, semis);
}

export function semitoneToFreq(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12);
}

/**
 * 이벤트 → 소리. 한 drop에서 cut → land → perfect → regrow가 연달아 나오므로
 * Perfect 착지(land.perfect)는 land 소리를 내지 않고 perfect 음이 대신한다.
 * regrow는 perfect 위에 지연 레이어로 얹힌다.
 */
export function cueForEvent(ev: StackUpEvent): SoundCue | null {
  switch (ev.type) {
    case 'land':
      return ev.perfect ? null : { kind: 'land', step: 0 };
    case 'perfect':
      return { kind: 'perfect', step: comboToStep(ev.combo) };
    case 'cut':
      return { kind: 'cut', step: 0 };
    case 'regrow':
      return { kind: 'regrow', step: 0 };
    case 'gameOver':
      return { kind: 'gameOver', step: 0 };
    case 'milestone':
      return { kind: 'milestone', step: 0 };
  }
}

/** getItem/setItem만 있으면 되는 최소 스토리지 형태. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 음소거 상태 영속화. 스토리지가 없거나 throw해도 동작한다. */
export class MuteStore {
  constructor(
    private readonly storage: StorageLike | null | undefined,
    private readonly key: string = AUDIO_CONFIG.storageKey,
  ) {}

  load(): boolean {
    try {
      return this.storage?.getItem(this.key) === '1';
    } catch {
      return false;
    }
  }

  save(muted: boolean): void {
    try {
      this.storage?.setItem(this.key, muted ? '1' : '0');
    } catch {
      // 저장 불가 환경: 무시
    }
  }
}

export interface AudioSettings {
  bgmOn: boolean;
  sfxOn: boolean;
  bgmVolume: number;
  sfxVolume: number;
}

export function defaultSettings(): AudioSettings {
  return { ...AUDIO_CONFIG.defaults };
}

/** 0..1로 clamp. NaN/비숫자는 fallback. */
export function clampVolume(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

/** 임의 값 → 유효한 설정. 누락/손상된 필드는 기본값. */
export function sanitizeSettings(raw: unknown): AudioSettings {
  const d = AUDIO_CONFIG.defaults;
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    bgmOn: typeof o.bgmOn === 'boolean' ? o.bgmOn : d.bgmOn,
    sfxOn: typeof o.sfxOn === 'boolean' ? o.sfxOn : d.sfxOn,
    bgmVolume: clampVolume(o.bgmVolume, d.bgmVolume),
    sfxVolume: clampVolume(o.sfxVolume, d.sfxVolume),
  };
}

/** 마스터 이후 BGM/SFX 버스의 실제 gain. 전체 음소거면 둘 다 0. duck은 BGM 배율(0..1). */
export function effectiveGains(s: AudioSettings, muted: boolean, duck = 1): { bgm: number; sfx: number } {
  if (muted) return { bgm: 0, sfx: 0 };
  return {
    bgm: s.bgmOn ? clampVolume(s.bgmVolume, 0) * clampVolume(duck, 1) : 0,
    sfx: s.sfxOn ? clampVolume(s.sfxVolume, 0) : 0,
  };
}

/** 설정 영속화(JSON). 스토리지 없음/throw/손상 JSON이어도 기본값으로 동작. */
export class AudioSettingsStore {
  constructor(
    private readonly storage: StorageLike | null | undefined,
    private readonly key: string = AUDIO_CONFIG.settingsKey,
  ) {}

  load(): AudioSettings {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return defaultSettings();
      return sanitizeSettings(JSON.parse(raw));
    } catch {
      return defaultSettings();
    }
  }

  save(s: AudioSettings): void {
    try {
      this.storage?.setItem(this.key, JSON.stringify(s));
    } catch {
      // 저장 불가 환경: 무시
    }
  }
}

export interface BgmStep {
  /** 아르페지오 주파수(Hz), 없으면 null */
  arp: number | null;
  /** 베이스 주파수(Hz), 없으면 null */
  bass: number | null;
  hat: boolean;
}

export function bgmLoopSteps(): number {
  return AUDIO_CONFIG.bgm.stepsPerBar * AUDIO_CONFIG.bgm.bars;
}

/** 스텝 길이(초). */
export function bgmStepDuration(bpm: number = AUDIO_CONFIG.bgm.bpm): number {
  return 60 / bpm / AUDIO_CONFIG.bgm.stepsPerBeat;
}

/** 스텝 인덱스(무한히 증가 가능, 루프 길이로 순환) → 이 스텝에서 낼 음. */
export function bgmStep(index: number): BgmStep {
  const B = AUDIO_CONFIG.bgm;
  const total = bgmLoopSteps();
  const i = ((Math.floor(index) % total) + total) % total;
  const bar = Math.floor(i / B.stepsPerBar);
  const inBar = i % B.stepsPerBar;
  const deg = B.arpPattern[inBar];
  let arp: number | null = null;
  if (deg !== undefined) {
    const d = Math.max(0, deg + B.barShift[bar]!);
    const len = B.scaleSemitones.length;
    arp = semitoneToFreq(B.baseFreq, B.scaleSemitones[d % len]! + 12 * Math.floor(d / len));
  }
  // 베이스: 마디 첫 박과 3박(스텝 0, 4), 스텝 6에 짧게
  const bass = (B.bassSteps as readonly number[]).includes(inBar) ? semitoneToFreq(B.bassBaseFreq, B.bassRoots[bar]! + 12) : null;
  return { arp, bass, hat: (B.hatSteps as readonly number[]).includes(inBar) };
}

/**
 * 다음 BGM 스텝 시각. prev가 이미 now+startDelay 이후면 유지(이중 예약 방지),
 * 지났거나 첫 시작(prev 없음/비유한)이면 now+startDelay로 재정렬.
 */
export function nextBgmTime(prev: number | null, now: number, startDelay: number): number {
  const floor = now + startDelay;
  if (!Number.isFinite(floor)) return prev !== null && Number.isFinite(prev) ? prev : 0;
  if (prev === null || !Number.isFinite(prev)) return floor;
  return prev < floor ? floor : prev;
}

/** cue 하나가 쓰는 SFX 보이스 수. */
export function sfxVoiceCost(kind: SoundKind): number {
  const C = AUDIO_CONFIG;
  switch (kind) {
    case 'perfect':
      return 2;
    case 'regrow':
      return C.regrow.notes.length;
    case 'milestone':
      return C.milestone.notes.length + 1; // 팡파르 음 + 스윕
    default:
      return 1;
  }
}

/** 새 SFX 보이스 시작 허용 여부. 일반 SFX는 예약분을 남기고, 마일스톤만 전체 상한까지 쓴다. */
export function canStartSfxVoice(active: number, isMilestone: boolean): boolean {
  const C = AUDIO_CONFIG;
  return active < (isMilestone ? C.maxVoices : C.maxVoices - C.milestoneVoiceReserve);
}
