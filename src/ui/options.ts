// 옵션/표시 관련 순수 로직. DOM 없이 테스트 가능.
import type { BestScore, StorageLike } from './records';

/** OS 설정과 수동 설정 중 하나라도 켜져 있으면 축소 모드. */
export function effectiveReducedMotion(os: boolean, manual: boolean): boolean {
  return os || manual;
}

/** 수동 Reduced motion 설정 저장. 스토리지가 없거나 throw해도 동작한다. */
export class ReducedMotionStore {
  constructor(
    private readonly storage: StorageLike | null,
    private readonly key: string,
  ) {}

  load(): boolean {
    try {
      return this.storage?.getItem(this.key) === '1';
    } catch {
      return false;
    }
  }

  save(on: boolean): void {
    try {
      this.storage?.setItem(this.key, on ? '1' : '0');
    } catch {
      // 저장 불가: 메모리 값만 유지
    }
  }
}

export interface ResetTargets {
  best: BestScore;
  storage: StorageLike | null;
  /** Stack Up 리더보드가 저장된 키. 빈 목록('[]')으로 덮어쓴다. */
  leaderboardKey: string;
}

/**
 * Stack Up의 최고 기록과 리더보드만 지운다. 공통 플레이어 프로필(playerId, 닉네임)과
 * 다른 게임 기록은 건드리지 않는다.
 */
export function resetUserData(t: ResetTargets): void {
  t.best.reset();
  try {
    t.storage?.setItem(t.leaderboardKey, '[]');
  } catch {
    // 저장 불가: 호출 쪽이 서비스 인스턴스를 새로 만들어 메모리 값도 비운다
  }
}

/** 마일스톤 팝업 문구. */
export function milestoneText(floors: number): string {
  return `${floors} FLOORS!`;
}

/** HUD에 보여줄 BEST: 플레이 중 점수가 기존 최고를 넘으면 같이 올라간다. */
export function hudBest(best: number, score: number): number {
  return Math.max(best, score);
}

/** 확인 단계가 필요한 동작(데이터 초기화)용 2단계 게이트. 시간은 호출자가 ms로 넘긴다. */
export class ConfirmGate {
  private armedAt: number | null = null;

  constructor(private readonly windowMs: number) {}

  get armed(): boolean {
    return this.armedAt !== null;
  }

  /** 누를 때마다 호출. 첫 호출은 'armed', 제한 시간 안의 두 번째 호출은 'confirmed'. */
  press(nowMs: number): 'armed' | 'confirmed' {
    if (this.armedAt !== null && nowMs - this.armedAt <= this.windowMs) {
      this.armedAt = null;
      return 'confirmed';
    }
    this.armedAt = nowMs;
    return 'armed';
  }

  /** 패널 닫기/타임아웃 시 취소. */
  cancel(): void {
    this.armedAt = null;
  }
}
