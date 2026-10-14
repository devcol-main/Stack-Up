// Stack Up UI 튜닝 수치와 키.
export const UI_CONFIG = {
  /** 게임 오버 직후 이 시간(초) 동안 입력(재시작)을 무시한다. 연타 방지. */
  gameOverInputLockSec: 0.3,
  /** 프레임 dt 상한(초). 탭 전환 등으로 긴 프레임이 생겨도 물리가 튀지 않게. */
  maxFrameDt: 0.05,
  /** 리더보드에 표시하는 항목 수. */
  leaderboardSize: 10,
  /** 폰트 로드를 기다리는 최대 시간(ms). 넘기면 폴백 폰트로 그냥 시작한다. */
  fontTimeoutMs: 1500,
  /** document.fonts.load에 넘기는 폰트 스펙. */
  fontSpec: '800 16px Geist',
  bestKey: 'stackup.best',
  /** 공통 프로필로 옮기기 전의 옛 닉네임 키. 가져오기만 하고 쓰지 않는다. */
  legacyNicknameKey: 'stackup.nickname',
  reducedMotionKey: 'stackup.reducedMotion',
  /** 데이터 초기화 확인 대기 시간(ms). 지나면 첫 단계로 돌아간다. */
  resetConfirmMs: 3000,
  leaderboardKey: 'stackup.leaderboard',
} as const;
