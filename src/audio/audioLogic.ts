// AudioContext 없이 테스트 가능한 순수 로직.
import type { StackUpEvent } from '../core/StackUpLogic';
import { AUDIO_CONFIG } from './audioConfig';

export type SoundKind = 'land' | 'perfect' | 'cut' | 'regrow' | 'gameOver';
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
      return null; // 전용 사운드는 이후 하위 작업
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
