import { LocalLeaderboardService, normalizeNickname, type StorageLike } from '../../../../shared/leaderboard';
import { LEGACY_NICKNAME_KEYS, PlayerProfile } from '../../../../shared/player';
import { UI_CONFIG } from './uiConfig';

export interface StackUpStats {
  floors: number;
  maxCombo: number;
}

export const STACK_UP_GAME_ID = 'stack-up';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** 새 형식은 stats, 옛 형식(최상위 floors/maxCombo)은 레코드 자체에서 읽는다. */
export function sanitizeStackUpStats(raw: unknown): StackUpStats {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const src = (typeof r.stats === 'object' && r.stats !== null ? r.stats : r) as Record<string, unknown>;
  return { floors: num(src.floors), maxCombo: num(src.maxCombo) };
}

export function createStackUpLeaderboard(storage?: StorageLike | null): LocalLeaderboardService<StackUpStats> {
  return new LocalLeaderboardService<StackUpStats>({
    gameId: STACK_UP_GAME_ID,
    key: UI_CONFIG.leaderboardKey,
    sanitizeStats: sanitizeStackUpStats,
    storage,
  });
}

/** 공통 프로필. 공통 닉네임이 없으면 옛 Stack Up 닉네임을 한 번 가져온다. */
export function createPlayerProfile(storage?: StorageLike | null): PlayerProfile {
  return new PlayerProfile({ storage, legacyNicknameKeys: LEGACY_NICKNAME_KEYS });
}

/** 제출할 닉네임. 입력칸이 비어 있으면 공통 프로필 닉네임을 쓴다(Reset 등으로 비어도 닉네임이 Anonymous로 덮이지 않게). */
export function nicknameToSubmit(input: string, profileNickname: string): string {
  return normalizeNickname(input.trim() ? input : profileNickname);
}
